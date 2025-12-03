use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, InitSpace)]
/// Configuration parameters that define how a reserve behaves.
///
/// A `ReserveConfig` represents the full risk, interest-rate, and oracle behavior
/// for a given Reserve. These values are immutable after initialization and define:
///
/// - **Interest Rate Curve**
///   `optimal_utilization_rate`, `min_borrow_rate`, `optimal_borrow_rate`, `max_borrow_rate`
///   determine how interest increases as the reserve becomes more utilized.
///
/// - **Risk Parameters**
///   `loan_to_value_ratio`, `liquidation_threshold`, and `liquidation_bonus` control
///   collateralization and liquidation safety rules.
///
/// - **Protocol Fees**
///   Stored inside `ReserveFees`, defining borrow fees and fee splits.
///
/// - **Oracle Configuration**
///   `pyth_price_feed_id` points to the Pyth price feed used to value this asset.
pub struct ReserveConfig {
    pub optimal_utilization_rate: u8,
    pub loan_to_value_ratio: u8,
    pub liquidation_bonus: u8,
    pub liquidation_threshold: u8,
    pub min_borrow_rate: u8,
    pub optimal_borrow_rate: u8,
    pub max_borrow_rate: u8,
    pub fees: ReserveFees,
    pub pyth_price_feed_id:[u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
/// Configuration of fees applied to borrow and flash-loan operations.
///
/// All fees are expressed in WAD (1e18 fixed-point), except for host fee percentage.
pub struct ReserveFees {
    pub borrow_fee_wad: u64,
    pub flash_loan_fee_wad: u64,
    pub host_fee_percentage: u8,
}

impl ReserveConfig {
    /// Validates the reserve configuration and ensures all parameters fall within
    /// acceptable risk and economic bounds.
    ///
    /// This must be called during reserve initialization to protect the protocol
    /// from misconfigured assets that could cause insolvency or poor economic outcomes.
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
        require!(self.liquidation_bonus <= 100, crate::errors::LendingError::InvalidReserveConfig);

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
