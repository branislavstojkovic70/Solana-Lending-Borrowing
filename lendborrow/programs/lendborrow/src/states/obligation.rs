use anchor_lang::prelude::*;

pub const MAX_OBLIGATION_RESERVES: usize = 10;
pub const LIQUIDATION_CLOSE_FACTOR: u8 = 50;

#[account]
#[derive(InitSpace)]
/// User position in the lending market.
///
/// An `Obligation` tracks a single user's full position in a given `LendingMarket`:
/// - total **collateral value** (in quote currency),
/// - total **borrowed value**,
/// - how much the user is **allowed to borrow**,
/// - when the position becomes **unhealthy** (liquidatable),
/// - per-reserve collateral and borrow positions stored in a compact, flat buffer.
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


    /// Returns the maximum value (in quote currency) that can be safely withdrawn.
    ///
    /// Intuition:
    /// - You have `deposited_value` of collateral.
    /// - You have `borrowed_value` of debt.
    /// - Protocol only lets you withdraw collateral until the remaining collateral
    ///   still supports your `borrowed_value` under `allowed_borrow_value`.
    ///
    /// If:
    /// - `allowed_borrow_value == 0` → no borrowing allowed → no safe withdrawal.
    /// - `required_deposit_value >= deposited_value` → you're at or beyond the limit → 0.
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

    /// Returns how much additional borrow value (in quote) is allowed.
    ///
    /// `remaining = allowed_borrow_value - borrowed_value`.    
    pub fn remaining_borrow_value(&self) -> Result<u128> {
        self.allowed_borrow_value
            .checked_sub(self.borrowed_value)
            .ok_or(crate::errors::LendingError::MathOverflow.into())
    }

    /// Returns current loan-to-value ratio (LTV) as a WAD-scaled fraction.
    ///
    /// - `0` if there is no deposited collateral.
    /// - Otherwise: `borrowed_value / deposited_value` scaled by `1e18`.
    ///
    /// Example:
    /// - borrowed = 50
    /// - deposited = 100
    /// - LTV = 0.5 * 1e18
    pub fn loan_to_value(&self) -> Result<u128> {
        if self.deposited_value == 0 {
            return Ok(0);
        }

        self.borrowed_value
            .checked_mul(1_000_000_000_000_000_000) // WAD for precision
            .and_then(|v| v.checked_div(self.deposited_value))
            .ok_or(crate::errors::LendingError::MathOverflow.into())
    }

    /// Withdraws collateral from a specific collateral entry and updates values.
    ///
    /// Steps:
    /// 1. Load the `ObligationCollateral` at `collateral_index`.
    /// 2. Compute what fraction (`withdraw_pct`) of that collateral is being removed.
    /// 3. Apply that fraction to `collateral.market_value` to get `withdraw_value`.
    /// 4. Decrease `self.deposited_value` by `withdraw_value`.
    /// 5. Either:
    ///    - remove the collateral entry completely (if full withdrawal),
    ///    - or update its `deposited_amount` and `market_value` proportionally.
    ///
    /// Invariant: `deposited_value` always matches the sum of all `market_value`s.
    pub fn withdraw(&mut self, collateral_index: usize, withdraw_amount: u64) -> Result<()> {
        let (mut collateral, _) = self.find_collateral_by_index(collateral_index)?;

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
    /// Repays a portion of a borrow and updates borrowed value and per-reserve state.
    ///
    /// `settle_amount` is in WAD units (same scale as `borrowed_amount_wads`).
    ///
    /// Steps:
    /// 1. Load the `ObligationLiquidity` at `liquidity_index`.
    /// 2. Compute how much of its `market_value` should be reduced by this repayment.
    /// 3. Decrease `self.borrowed_value` by that `value_decrease`.
    /// 4. Reduce `borrowed_amount_wads` by `settle_amount`.
    /// 5. Either:
    ///    - remove the liquidity entry completely (fully repaid),
    ///    - or update its `market_value` accordingly.
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

    /// Ensures that the obligation is healthy (not over the unhealthy threshold).
    ///
    /// If there are active borrows:
    /// - requires `borrowed_value <= unhealthy_borrow_value`,
    /// - otherwise returns `ObligationUnhealthy` (eligible for liquidation).
    pub fn verify_healthy(&self) -> Result<()> {
        if self.borrows_len > 0 {
            require!(
                self.borrowed_value <= self.unhealthy_borrow_value,
                crate::errors::LendingError::ObligationUnhealthy
            );
        }
        Ok(())
    }

    /// Appends a new collateral entry to the obligation.
    ///
    /// Fails if adding another entry would exceed `MAX_OBLIGATION_RESERVES`.
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

    /// Appends a new borrow (liquidity) entry to the obligation.
    ///
    /// Fails if adding another entry would exceed `MAX_OBLIGATION_RESERVES`.
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

    /// Finds a collateral entry by its `deposit_reserve` pubkey.
    ///
    /// Returns the deserialized `ObligationCollateral` and its index.
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

    /// Finds a liquidity entry by its `borrow_reserve` pubkey.
    ///
    /// Returns the deserialized `ObligationLiquidity` and its index.
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

    /// Finds existing collateral for a given reserve or creates a new one if missing.
    ///
    /// Returns the index of the collateral entry.
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

    /// Finds existing liquidity for a given reserve or creates a new one if missing.
    ///
    /// Returns the index of the liquidity entry.
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

    /// Fetches a collateral entry by index from the flat buffer.
    ///
    /// Performs bounds checks on both the index and the underlying byte slice.
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
    
    /// Overwrites a collateral entry at `index` with the given value.
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

    /// Overwrites a liquidity entry at `index` with the given value.
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

    /// Removes a liquidity entry at `index` from the flat buffer.
    ///
    /// This compacts `data_flat` and decrements `borrows_len`.
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
/// Collateral position for a single reserve within an obligation.
///
/// This tracks:
/// - how much collateral is deposited (in token units),
/// - the current market value of that collateral (in quote currency).
pub struct ObligationCollateral {
    /// Reserve where the collateral is deposited.
    pub deposit_reserve: Pubkey,

    /// Amount of collateral tokens deposited into this reserve.
    pub deposited_amount: u64,

    /// Current market value of this collateral in quote currency.
    pub market_value: u128,
}

impl ObligationCollateral {
    /// Serialized byte length of this struct when packed into `data_flat`.
    pub const LEN: usize = 32 + 8 + 16;

    /// Creates a new, empty collateral position for a given reserve.
    pub fn new(deposit_reserve: Pubkey) -> Self {
        Self {
            deposit_reserve,
            deposited_amount: 0,
            market_value: 0,
        }
    }

    /// Increases the deposited collateral amount.
    pub fn deposit(&mut self, collateral_amount: u64) -> Result<()> {
        self.deposited_amount = self
            .deposited_amount
            .checked_add(collateral_amount)
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        Ok(())
    }

    /// Decreases the deposited collateral amount.
    pub fn withdraw(&mut self, collateral_amount: u64) -> Result<()> {
        self.deposited_amount = self
            .deposited_amount
            .checked_sub(collateral_amount)
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
/// Borrow (liquidity) position for a single reserve within an obligation.
///
/// This tracks:
/// - how much has been borrowed in WAD units,
/// - the cumulative borrow rate used to accrue interest,
/// - the current market value of the debt in quote currency.
pub struct ObligationLiquidity {
    pub borrow_reserve: Pubkey,
    pub cumulative_borrow_rate_wads: u128,
    pub borrowed_amount_wads: u128,
    pub market_value: u128,
}

impl ObligationLiquidity {
    /// Serialized byte length of this struct when packed into `data_flat`.
    pub const LEN: usize = 32 + 16 + 16 + 16;

    /// Initial cumulative borrow rate (1.0 in WAD units).
    pub const INITIAL_BORROW_RATE: u128 = 1_000_000_000_000_000_000;

    /// Creates a new, empty borrow position for a given reserve.
    pub fn new(borrow_reserve: Pubkey) -> Self {
        Self {
            borrow_reserve,
            cumulative_borrow_rate_wads: Self::INITIAL_BORROW_RATE,
            borrowed_amount_wads: 0,
            market_value: 0,
        }
    }

    /// Increases the borrowed amount (in WAD units).
    pub fn borrow(&mut self, borrow_amount: u128) -> Result<()> {
        self.borrowed_amount_wads = self
            .borrowed_amount_wads
            .checked_add(borrow_amount)
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        Ok(())
    }

    /// Decreases the borrowed amount (in WAD units).
    pub fn repay(&mut self, repay_amount: u128) -> Result<()> {
        self.borrowed_amount_wads = self
            .borrowed_amount_wads
            .checked_sub(repay_amount)
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        Ok(())
    }

    /// Accrues interest on this borrow position using a new cumulative borrow rate.
    ///
    /// - Requires `new_cumulative_borrow_rate_wads >= current_rate` (no negative rates).
    /// - Scales `borrowed_amount_wads` by the ratio of new/old cumulative rate.
    /// - Updates `cumulative_borrow_rate_wads` to the new value.
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