use anchor_lang::prelude::*;

pub const MAX_OBLIGATION_RESERVES: usize = 10;
pub const LIQUIDATION_CLOSE_FACTOR: u8 = 50;

#[account]
#[derive(InitSpace)]
pub struct Obligation {
    pub version: u8,
    pub last_update_slot: u64,
    pub lending_market: Pubkey,
    pub owner: Pubkey,
    pub deposited_value: u128,
    pub borrowed_value: u128,
    pub allowed_borrow_value: u128,
    pub unhealthy_borrow_value: u128,
    pub deposits_len: u8,
    pub borrows_len: u8,
    #[max_len(896)]
    pub data_flat: Vec<u8>,
}

impl Obligation {
    pub const PROGRAM_VERSION: u8 = 1;
    pub const SEED_PREFIX: &'static [u8] = b"obligation";

    pub fn max_withdraw_value(&self) -> Result<u128> {
        if self.allowed_borrow_value == 0 {
            return Ok(0);
        }

        let required_deposit_value = self
            .borrowed_value
            .checked_mul(self.deposited_value)
            .and_then(|v| v.checked_div(self.allowed_borrow_value))
            .ok_or(crate::errors::LendingError::MathOverflow)?;

        if required_deposit_value >= self.deposited_value {
            return Ok(0);
        }

        self.deposited_value
            .checked_sub(required_deposit_value)
            .ok_or(crate::errors::LendingError::MathOverflow.into())
    }

    pub fn remaining_borrow_value(&self) -> Result<u128> {
        self.allowed_borrow_value
            .checked_sub(self.borrowed_value)
            .ok_or(crate::errors::LendingError::MathOverflow.into())
    }

    pub fn loan_to_value(&self) -> Result<u128> {
        if self.deposited_value == 0 {
            return Ok(0);
        }

        self.borrowed_value
            .checked_mul(1_000_000_000_000_000_000) // WAD for precision
            .and_then(|v| v.checked_div(self.deposited_value))
            .ok_or(crate::errors::LendingError::MathOverflow.into())
    }

    // ✅ CHANGED: Dodao sam ažuriranje deposited_value i market_value
    pub fn withdraw(&mut self, collateral_index: usize, withdraw_amount: u64) -> Result<()> {
        let (mut collateral, _) = self.find_collateral_by_index(collateral_index)?;

        // ✅ CHANGED: Kalkulišem withdraw_pct i withdraw_value
        let withdraw_pct = if collateral.deposited_amount > 0 {
            (withdraw_amount as u128)
                .checked_mul(1_000_000_000_000_000_000)
                .and_then(|v| v.checked_div(collateral.deposited_amount as u128))
                .ok_or(crate::errors::LendingError::MathOverflow)?
        } else {
            return Err(crate::errors::LendingError::ObligationCollateralEmpty.into());
        };

        let withdraw_value = collateral
            .market_value
            .checked_mul(withdraw_pct)
            .and_then(|v| v.checked_div(1_000_000_000_000_000_000))
            .ok_or(crate::errors::LendingError::MathOverflow)?;

        self.deposited_value = self
            .deposited_value
            .checked_sub(withdraw_value)
            .ok_or(crate::errors::LendingError::MathOverflow)?;

        if withdraw_amount == collateral.deposited_amount {
            self.remove_collateral(collateral_index)?;
        } else {
            collateral.withdraw(withdraw_amount)?;
            collateral.market_value = collateral
                .market_value
                .checked_sub(withdraw_value)
                .ok_or(crate::errors::LendingError::MathOverflow)?;
            self.update_collateral(collateral_index, collateral)?;
        }

        Ok(())
    }

    pub fn repay(&mut self, liquidity_index: usize, settle_amount: u128) -> Result<()> {
        let (mut liquidity, _) = self.find_liquidity_by_index(liquidity_index)?;
        let value_decrease = if liquidity.borrowed_amount_wads > 0 {
            if settle_amount >= liquidity.borrowed_amount_wads {
                liquidity.market_value
            } else {
                settle_amount
                    .checked_mul(liquidity.market_value)
                    .and_then(|v| v.checked_div(liquidity.borrowed_amount_wads))
                    .ok_or(crate::errors::LendingError::MathOverflow)?
            }
        } else {
            return Err(crate::errors::LendingError::ObligationLiquidityEmpty.into());
        };


        self.borrowed_value = self
            .borrowed_value
            .checked_sub(value_decrease)
            .ok_or(crate::errors::LendingError::MathOverflow)?;

        liquidity.repay(settle_amount)?;

        if liquidity.borrowed_amount_wads == 0 {
            self.remove_liquidity(liquidity_index)?;
        } else {
            liquidity.market_value = liquidity
                .market_value
                .checked_sub(value_decrease)
                .ok_or(crate::errors::LendingError::MathOverflow)?;
            self.update_liquidity(liquidity_index, liquidity)?;
        }

        Ok(())
    }

    pub fn verify_healthy(&self) -> Result<()> {
        if self.borrows_len > 0 {
            require!(
                self.borrowed_value <= self.unhealthy_borrow_value,
                crate::errors::LendingError::ObligationUnhealthy
            );
        }
        Ok(())
    }

    pub fn add_collateral(&mut self, collateral: ObligationCollateral) -> Result<()> {
        require!(
            (self.deposits_len as usize + self.borrows_len as usize) < MAX_OBLIGATION_RESERVES,
            crate::errors::LendingError::ObligationReserveLimit
        );

        let mut collateral_bytes = Vec::new();
        collateral.serialize(&mut collateral_bytes)?;

        let insert_position = self.deposits_len as usize * ObligationCollateral::LEN;
        self.data_flat
            .splice(insert_position..insert_position, collateral_bytes);

        self.deposits_len = self.deposits_len.checked_add(1).unwrap();
        Ok(())
    }

    pub fn add_liquidity(&mut self, liquidity: ObligationLiquidity) -> Result<()> {
        require!(
            (self.deposits_len as usize + self.borrows_len as usize) < MAX_OBLIGATION_RESERVES,
            crate::errors::LendingError::ObligationReserveLimit
        );

        let mut liquidity_bytes = Vec::new();
        liquidity.serialize(&mut liquidity_bytes)?;
        self.data_flat.extend_from_slice(&liquidity_bytes);

        self.borrows_len = self.borrows_len.checked_add(1).unwrap();
        Ok(())
    }

    pub fn find_collateral(
        &self,
        deposit_reserve: Pubkey,
    ) -> Result<(ObligationCollateral, usize)> {
        let mut offset = 0;

        for i in 0..self.deposits_len as usize {
            if offset + ObligationCollateral::LEN > self.data_flat.len() {
                return Err(crate::errors::LendingError::InvalidObligationCollateral.into());
            }

            let collateral_slice = &self.data_flat[offset..offset + ObligationCollateral::LEN];
            if let Ok(collateral) = ObligationCollateral::deserialize(&mut &collateral_slice[..]) {
                if collateral.deposit_reserve == deposit_reserve {
                    return Ok((collateral, i));
                }
            }
            offset += ObligationCollateral::LEN;
        }

        Err(crate::errors::LendingError::InvalidObligationCollateral.into())
    }

    pub fn find_liquidity(&self, borrow_reserve: Pubkey) -> Result<(ObligationLiquidity, usize)> {
        let mut offset = self.deposits_len as usize * ObligationCollateral::LEN;

        for i in 0..self.borrows_len as usize {
            if offset + ObligationLiquidity::LEN > self.data_flat.len() {
                return Err(crate::errors::LendingError::InvalidObligationLiquidity.into());
            }

            let liquidity_slice = &self.data_flat[offset..offset + ObligationLiquidity::LEN];
            if let Ok(liquidity) = ObligationLiquidity::deserialize(&mut &liquidity_slice[..]) {
                if liquidity.borrow_reserve == borrow_reserve {
                    return Ok((liquidity, i));
                }
            }
            offset += ObligationLiquidity::LEN;
        }

        Err(crate::errors::LendingError::InvalidObligationLiquidity.into())
    }

    pub fn find_or_add_collateral(&mut self, deposit_reserve: Pubkey) -> Result<usize> {
        if let Ok((_, index)) = self.find_collateral(deposit_reserve) {
            return Ok(index);
        }

        require!(
            (self.deposits_len as usize + self.borrows_len as usize) < MAX_OBLIGATION_RESERVES,
            crate::errors::LendingError::ObligationReserveLimit
        );

        let collateral = ObligationCollateral::new(deposit_reserve);
        let index = self.deposits_len as usize;
        self.add_collateral(collateral)?;

        Ok(index)
    }

    pub fn find_or_add_liquidity(&mut self, borrow_reserve: Pubkey) -> Result<usize> {
        if let Ok((_, index)) = self.find_liquidity(borrow_reserve) {
            return Ok(index);
        }

        require!(
            (self.deposits_len as usize + self.borrows_len as usize) < MAX_OBLIGATION_RESERVES,
            crate::errors::LendingError::ObligationReserveLimit
        );

        let liquidity = ObligationLiquidity::new(borrow_reserve);
        let index = self.borrows_len as usize;
        self.add_liquidity(liquidity)?;

        Ok(index)
    }

    pub fn find_collateral_by_index(&self, index: usize) -> Result<(ObligationCollateral, usize)> {
        require!(
            index < self.deposits_len as usize,
            crate::errors::LendingError::InvalidObligationIndex
        );

        let offset = index * ObligationCollateral::LEN;
        require!(
            offset + ObligationCollateral::LEN <= self.data_flat.len(),
            crate::errors::LendingError::InvalidObligationData
        );

        let collateral_slice = &self.data_flat[offset..offset + ObligationCollateral::LEN];
        let collateral = ObligationCollateral::deserialize(&mut &collateral_slice[..])?;

        Ok((collateral, index))
    }

    pub fn find_liquidity_by_index(&self, index: usize) -> Result<(ObligationLiquidity, usize)> {
        require!(
            index < self.borrows_len as usize,
            crate::errors::LendingError::InvalidObligationIndex
        );

        let offset = (self.deposits_len as usize * ObligationCollateral::LEN)
            + (index * ObligationLiquidity::LEN);
        require!(
            offset + ObligationLiquidity::LEN <= self.data_flat.len(),
            crate::errors::LendingError::InvalidObligationData
        );

        let liquidity_slice = &self.data_flat[offset..offset + ObligationLiquidity::LEN];
        let liquidity = ObligationLiquidity::deserialize(&mut &liquidity_slice[..])?;

        Ok((liquidity, index))
    }

    pub fn update_collateral(
        &mut self,
        index: usize,
        collateral: ObligationCollateral,
    ) -> Result<()> {
        require!(
            index < self.deposits_len as usize,
            crate::errors::LendingError::InvalidObligationIndex
        );

        let offset = index * ObligationCollateral::LEN;
        let mut collateral_bytes = Vec::new();
        collateral.serialize(&mut collateral_bytes)?;

        self.data_flat[offset..offset + ObligationCollateral::LEN]
            .copy_from_slice(&collateral_bytes);

        Ok(())
    }

    pub fn update_liquidity(&mut self, index: usize, liquidity: ObligationLiquidity) -> Result<()> {
        require!(
            index < self.borrows_len as usize,
            crate::errors::LendingError::InvalidObligationIndex
        );

        let offset = (self.deposits_len as usize * ObligationCollateral::LEN)
            + (index * ObligationLiquidity::LEN);
        let mut liquidity_bytes = Vec::new();
        liquidity.serialize(&mut liquidity_bytes)?;

        self.data_flat[offset..offset + ObligationLiquidity::LEN].copy_from_slice(&liquidity_bytes);

        Ok(())
    }

    pub fn remove_collateral(&mut self, index: usize) -> Result<()> {
        require!(
            index < self.deposits_len as usize,
            crate::errors::LendingError::InvalidObligationIndex
        );

        let offset = index * ObligationCollateral::LEN;
        self.data_flat
            .drain(offset..offset + ObligationCollateral::LEN);
        self.deposits_len = self.deposits_len.checked_sub(1).unwrap();
        Ok(())
    }

    pub fn remove_liquidity(&mut self, index: usize) -> Result<()> {
        require!(
            index < self.borrows_len as usize,
            crate::errors::LendingError::InvalidObligationIndex
        );

        let offset = (self.deposits_len as usize * ObligationCollateral::LEN)
            + (index * ObligationLiquidity::LEN);
        self.data_flat
            .drain(offset..offset + ObligationLiquidity::LEN);
        self.borrows_len = self.borrows_len.checked_sub(1).unwrap();
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub struct ObligationCollateral {
    pub deposit_reserve: Pubkey,
    pub deposited_amount: u64,
    pub market_value: u128,
}

impl ObligationCollateral {
    pub const LEN: usize = 32 + 8 + 16;

    pub fn new(deposit_reserve: Pubkey) -> Self {
        Self {
            deposit_reserve,
            deposited_amount: 0,
            market_value: 0,
        }
    }

    pub fn deposit(&mut self, collateral_amount: u64) -> Result<()> {
        self.deposited_amount = self
            .deposited_amount
            .checked_add(collateral_amount)
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        Ok(())
    }

    pub fn withdraw(&mut self, collateral_amount: u64) -> Result<()> {
        self.deposited_amount = self
            .deposited_amount
            .checked_sub(collateral_amount)
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub struct ObligationLiquidity {
    pub borrow_reserve: Pubkey,
    pub cumulative_borrow_rate_wads: u128,
    pub borrowed_amount_wads: u128,
    pub market_value: u128,
}

impl ObligationLiquidity {
    pub const LEN: usize = 32 + 16 + 16 + 16;
    pub const INITIAL_BORROW_RATE: u128 = 1_000_000_000_000_000_000;

    pub fn new(borrow_reserve: Pubkey) -> Self {
        Self {
            borrow_reserve,
            cumulative_borrow_rate_wads: Self::INITIAL_BORROW_RATE,
            borrowed_amount_wads: 0,
            market_value: 0,
        }
    }

    pub fn borrow(&mut self, borrow_amount: u128) -> Result<()> {
        self.borrowed_amount_wads = self
            .borrowed_amount_wads
            .checked_add(borrow_amount)
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        Ok(())
    }

    pub fn repay(&mut self, repay_amount: u128) -> Result<()> {
        self.borrowed_amount_wads = self
            .borrowed_amount_wads
            .checked_sub(repay_amount)
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        Ok(())
    }

    pub fn accrue_interest(&mut self, new_cumulative_borrow_rate_wads: u128) -> Result<()> {
        require!(
            new_cumulative_borrow_rate_wads >= self.cumulative_borrow_rate_wads,
            crate::errors::LendingError::NegativeInterestRate
        );

        if new_cumulative_borrow_rate_wads > self.cumulative_borrow_rate_wads {
            let compounded_interest_rate = new_cumulative_borrow_rate_wads
                .checked_mul(1_000_000_000_000_000_000)
                .and_then(|v| v.checked_div(self.cumulative_borrow_rate_wads))
                .ok_or(crate::errors::LendingError::MathOverflow)?;

            self.borrowed_amount_wads = self
                .borrowed_amount_wads
                .checked_mul(compounded_interest_rate)
                .and_then(|v| v.checked_div(1_000_000_000_000_000_000))
                .ok_or(crate::errors::LendingError::MathOverflow)?;

            self.cumulative_borrow_rate_wads = new_cumulative_borrow_rate_wads;
        }

        Ok(())
    }
}
