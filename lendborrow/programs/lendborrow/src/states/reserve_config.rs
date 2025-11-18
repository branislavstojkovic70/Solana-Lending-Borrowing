use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub struct ReserveConfig {
    pub optimal_utilization_rate: u8,
    pub loan_to_value_ratio: u8,
    pub liquidation_bonus: u8,
    pub liquidation_threshold: u8,
    pub min_borrow_rate: u8,
    pub optimal_borrow_rate: u8,
    pub max_borrow_rate: u8,
    pub fees: ReserveFees,
    pub pyth_price_feed_id: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub struct ReserveFees {
    pub borrow_fee_wad: u64,
    pub flash_loan_fee_wad: u64,
    pub host_fee_percentage: u8,
}

impl ReserveConfig {
    pub fn validate(&self) -> Result<()> {
        // Optimal utilization rate must be between 0-100% (e.g., 80 means 80%)
        require!(
            self.optimal_utilization_rate <= 100,
            crate::errors::LendingError::InvalidReserveConfig
        );

        // Loan-to-value ratio must be between 0-100% (e.g., 50 means you can borrow 50% of collateral value)
        require!(
            self.loan_to_value_ratio <= 100,
            crate::errors::LendingError::InvalidReserveConfig
        );

        // Liquidation bonus must be between 0-100% (e.g., 5 means liquidator gets 5% discount)
        require!(
            self.liquidation_bonus <= 100,
            crate::errors::LendingError::InvalidReserveConfig
        );

        // Liquidation threshold must be between 0-100% (e.g., 55 means liquidation starts at 55% collateral ratio)
        require!(
            self.liquidation_threshold <= 100,
            crate::errors::LendingError::InvalidReserveConfig
        );

        // LTV must be less than or equal to liquidation threshold (can't borrow more than liquidation point)
        require!(
            self.loan_to_value_ratio <= self.liquidation_threshold,
            crate::errors::LendingError::InvalidReserveConfig
        );

        // Min borrow rate must be less than or equal to optimal rate (interest rate curve starts at min)
        require!(
            self.min_borrow_rate <= self.optimal_borrow_rate,
            crate::errors::LendingError::InvalidReserveConfig
        );

        // Optimal borrow rate must be less than or equal to max rate (interest rate curve peaks at max)
        require!(
            self.optimal_borrow_rate <= self.max_borrow_rate,
            crate::errors::LendingError::InvalidReserveConfig
        );

        // Host fee percentage must be between 0-100% (e.g., 20 means host gets 20% of protocol fees)
        require!(
            self.fees.host_fee_percentage <= 100,
            crate::errors::LendingError::InvalidReserveConfig
        );

        // Validate that pyth_price_feed_id is not all zeros
        require!(
            self.pyth_price_feed_id != [0u8; 32],
            crate::errors::LendingError::InvalidOracleConfig
        );

        Ok(())
    }
}
