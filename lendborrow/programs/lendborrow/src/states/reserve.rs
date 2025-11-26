// states/reserve.rs
use super::reserve_config::*;
use anchor_lang::prelude::*;
use crate::errors::LendingError;

const WAD: u128 = 1_000_000_000_000_000_000;

#[account]
#[derive(InitSpace)]
pub struct Reserve {
    pub version: u8,
    pub last_update_slot: u64,
    pub lending_market: Pubkey,
    pub liquidity_mint: Pubkey,
    pub liquidity_mint_decimals: u8,
    pub liquidity_supply: Pubkey,
    pub liquidity_fee_receiver: Pubkey,
    pub liquidity_oracle: Pubkey,
    pub liquidity_available_amount: u64,
    pub liquidity_borrowed_amount_wads: u128,
    pub liquidity_cumulative_borrow_rate_wads: u128,
    pub liquidity_market_price: u128,
    pub collateral_mint: Pubkey,
    pub collateral_supply: Pubkey,
    pub collateral_mint_total_supply: u64,
    pub config: ReserveConfig,
}

impl Reserve {
    pub const PROGRAM_VERSION: u8 = 1;
    pub const SEED_PREFIX: &'static [u8] = b"reserve";
    pub const INITIAL_BORROW_RATE: u128 = WAD;
    pub const SLOTS_PER_YEAR: u128 = 63_072_000; // ~2 slots/sec * 365 days
    pub const MAX_STALE_SLOTS: u64 = 120; // ~1 minute at 2 slots/sec
    pub const MAX_ACCRUE_SLOTS: u64 = 100_000; // Cap for safety (~1.5 days)

    pub fn is_stale(&self, current_slot: u64) -> Result<bool> {
        let slots_elapsed = current_slot
            .checked_sub(self.last_update_slot)
            .ok_or(LendingError::MathOverflow)?;

        Ok(slots_elapsed > Self::MAX_STALE_SLOTS)
    }

    pub fn mark_stale(&mut self) {
        self.last_update_slot = self.last_update_slot.saturating_sub(Self::MAX_STALE_SLOTS + 1);
    }

    pub fn collateral_exchange_rate(&self) -> Result<u128> {
        if self.collateral_mint_total_supply == 0 {
            return Ok(Self::INITIAL_BORROW_RATE);
        }

        let borrowed_liquidity = self.liquidity_borrowed_amount_wads
            .checked_div(Self::INITIAL_BORROW_RATE)
            .ok_or(LendingError::MathOverflow)?;

        let total_liquidity = (self.liquidity_available_amount as u128)
            .checked_add(borrowed_liquidity)
            .ok_or(LendingError::MathOverflow)?;

        let exchange_rate = total_liquidity
            .checked_mul(Self::INITIAL_BORROW_RATE)
            .and_then(|v| v.checked_div(self.collateral_mint_total_supply as u128))
            .ok_or(LendingError::MathOverflow)?;

        Ok(exchange_rate)
    }

    pub fn collateral_to_liquidity(&self, collateral_amount: u64) -> Result<u64> {
        let exchange_rate = self.collateral_exchange_rate()?;

        let liquidity_amount = (collateral_amount as u128)
            .checked_mul(exchange_rate)
            .and_then(|v| v.checked_div(Self::INITIAL_BORROW_RATE))
            .ok_or(LendingError::MathOverflow)?;

        Ok(liquidity_amount as u64)
    }

    pub fn liquidity_to_collateral(&self, liquidity_amount: u64) -> Result<u64> {
        let exchange_rate = self.collateral_exchange_rate()?;

        let collateral_amount = (liquidity_amount as u128)
            .checked_mul(Self::INITIAL_BORROW_RATE)
            .and_then(|v| v.checked_div(exchange_rate))
            .ok_or(LendingError::MathOverflow)?;

        Ok(collateral_amount as u64)
    }

    pub fn deposit_liquidity(&mut self, liquidity_amount: u64) -> Result<u64> {
        require!(liquidity_amount > 0, LendingError::InvalidAmount);

        let collateral_amount = self.liquidity_to_collateral(liquidity_amount)?;

        self.liquidity_available_amount = self.liquidity_available_amount
            .checked_add(liquidity_amount)
            .ok_or(LendingError::MathOverflow)?;

        self.collateral_mint_total_supply = self.collateral_mint_total_supply
            .checked_add(collateral_amount)
            .ok_or(LendingError::MathOverflow)?;

        Ok(collateral_amount)
    }

    pub fn calculate_utilization_rate(&self) -> Result<u128> {
        let borrowed = self.liquidity_borrowed_amount_wads
            .checked_div(Self::INITIAL_BORROW_RATE)
            .ok_or(LendingError::MathOverflow)?;

        let total_liquidity = (self.liquidity_available_amount as u128)
            .checked_add(borrowed)
            .ok_or(LendingError::MathOverflow)?;

        if total_liquidity == 0 {
            return Ok(0);
        }

        let utilization = borrowed
            .checked_mul(100)
            .and_then(|v| v.checked_mul(Self::INITIAL_BORROW_RATE))
            .and_then(|v| v.checked_div(total_liquidity))
            .ok_or(LendingError::MathOverflow)?;

        Ok(utilization)
    }

    pub fn calculate_borrow_rate(&self, utilization_rate: u128) -> Result<u128> {
        let optimal_util = (self.config.optimal_utilization_rate as u128)
            .checked_mul(Self::INITIAL_BORROW_RATE)
            .ok_or(LendingError::MathOverflow)?;

        if utilization_rate <= optimal_util {
            let rate_range = self.config.optimal_borrow_rate
                .checked_sub(self.config.min_borrow_rate)
                .ok_or(LendingError::MathOverflow)? as u128;

            let util_ratio = if optimal_util > 0 {
                utilization_rate
                    .checked_mul(Self::INITIAL_BORROW_RATE)
                    .and_then(|v| v.checked_div(optimal_util))
                    .ok_or(LendingError::MathOverflow)?
            } else {
                0
            };

            let rate = (self.config.min_borrow_rate as u128)
                .checked_add(
                    rate_range
                        .checked_mul(util_ratio)
                        .and_then(|v| v.checked_div(Self::INITIAL_BORROW_RATE))
                        .ok_or(LendingError::MathOverflow)?
                )
                .ok_or(LendingError::MathOverflow)?;

            rate.checked_mul(Self::INITIAL_BORROW_RATE / 100).ok_or(
                LendingError::MathOverflow.into()
            )
        } else {
            let rate_range = self.config.max_borrow_rate
                .checked_sub(self.config.optimal_borrow_rate)
                .ok_or(LendingError::MathOverflow)? as u128;

            let excess_util = utilization_rate
                .checked_sub(optimal_util)
                .ok_or(LendingError::MathOverflow)?;

            let max_excess = (100u128)
                .checked_mul(Self::INITIAL_BORROW_RATE)
                .and_then(|v| v.checked_sub(optimal_util))
                .ok_or(LendingError::MathOverflow)?;

            let util_ratio = if max_excess > 0 {
                excess_util
                    .checked_mul(Self::INITIAL_BORROW_RATE)
                    .and_then(|v| v.checked_div(max_excess))
                    .ok_or(LendingError::MathOverflow)?
            } else {
                0
            };

            let rate = (self.config.optimal_borrow_rate as u128)
                .checked_add(
                    rate_range
                        .checked_mul(util_ratio)
                        .and_then(|v| v.checked_div(Self::INITIAL_BORROW_RATE))
                        .ok_or(LendingError::MathOverflow)?
                )
                .ok_or(LendingError::MathOverflow)?;

            rate.checked_mul(Self::INITIAL_BORROW_RATE / 100).ok_or(
                LendingError::MathOverflow.into()
            )
        }
    }

    fn compound_interest(&self, rate: u128, slots: u128) -> Result<u128> {
        let rate_per_slot = rate
            .checked_mul(slots)
            .and_then(|v| v.checked_div(Self::SLOTS_PER_YEAR))
            .ok_or(LendingError::MathOverflow)?;

        Self::INITIAL_BORROW_RATE.checked_add(rate_per_slot).ok_or(
            LendingError::MathOverflow.into()
        )
    }

    pub fn accrue_interest(&mut self, current_slot: u64) -> Result<()> {
        let slots_elapsed = current_slot
            .checked_sub(self.last_update_slot)
            .ok_or(LendingError::MathOverflow)?;

        if slots_elapsed == 0 {
            return Ok(());
        }

        if self.liquidity_borrowed_amount_wads == 0 {
            msg!("No borrows, skipping accrue_interest");
            return Ok(());
        }

        let capped_slots = slots_elapsed.min(Self::MAX_ACCRUE_SLOTS);

        if slots_elapsed > Self::MAX_ACCRUE_SLOTS {
            msg!(
                "WARNING: Slot gap {} exceeds max {}, capping accrue_interest",
                slots_elapsed,
                Self::MAX_ACCRUE_SLOTS
            );
        }

        let utilization_rate = self.calculate_utilization_rate()?;

        let current_borrow_rate = self.calculate_borrow_rate(utilization_rate)?;

        if current_borrow_rate == 0 {
            msg!("Borrow rate is 0, skipping accrue_interest");
            return Ok(());
        }

        msg!(
            "Accruing interest: slots={}, util_rate={}, borrow_rate={}",
            capped_slots,
            utilization_rate,
            current_borrow_rate
        );

        let compound_rate = self.compound_interest(current_borrow_rate, capped_slots as u128)?;

        require!(compound_rate <= Self::INITIAL_BORROW_RATE * 2, LendingError::MathOverflow);

        self.liquidity_cumulative_borrow_rate_wads = self.liquidity_cumulative_borrow_rate_wads
            .checked_mul(compound_rate)
            .and_then(|v| v.checked_div(Self::INITIAL_BORROW_RATE))
            .ok_or(LendingError::MathOverflow)?;

        let new_borrowed_amount = self.liquidity_borrowed_amount_wads
            .checked_mul(compound_rate)
            .and_then(|v| v.checked_div(Self::INITIAL_BORROW_RATE))
            .ok_or(LendingError::MathOverflow)?;

        let interest_earned = new_borrowed_amount
            .checked_sub(self.liquidity_borrowed_amount_wads)
            .ok_or(LendingError::MathOverflow)?;

        let interest_tokens = interest_earned
            .checked_div(Self::INITIAL_BORROW_RATE)
            .ok_or(LendingError::MathOverflow)? as u64;

        self.liquidity_available_amount = self.liquidity_available_amount
            .checked_add(interest_tokens)
            .ok_or(LendingError::MathOverflow)?;

        self.liquidity_borrowed_amount_wads = new_borrowed_amount;

        msg!(
            "Accrued interest: {} tokens over {} slots (rate: {})",
            interest_tokens,
            capped_slots,
            current_borrow_rate
        );

        Ok(())
    }

    pub fn borrow(&mut self, borrow_amount: u64) -> Result<(u64, u64, u64)> {
        require!(borrow_amount > 0, LendingError::InvalidAmount);

        require!(
            self.liquidity_available_amount >= borrow_amount,
            LendingError::InsufficientLiquidity
        );

        let (borrow_fee, host_fee) = self.calculate_borrow_fee(borrow_amount)?;

        let receive_amount = borrow_amount
            .checked_sub(borrow_fee)
            .ok_or(LendingError::MathOverflow)?;

        require!(receive_amount > 0, LendingError::BorrowTooSmall);

        self.liquidity_available_amount = self.liquidity_available_amount
            .checked_sub(borrow_amount)
            .ok_or(LendingError::MathOverflow)?;

        let borrow_wads = (borrow_amount as u128)
            .checked_mul(Self::INITIAL_BORROW_RATE)
            .ok_or(LendingError::MathOverflow)?;

        self.liquidity_borrowed_amount_wads = self.liquidity_borrowed_amount_wads
            .checked_add(borrow_wads)
            .ok_or(LendingError::MathOverflow)?;

        Ok((receive_amount, borrow_fee, host_fee))
    }

    pub fn repay(&mut self, repay_amount: u64) -> Result<u64> {
        require!(repay_amount > 0, LendingError::InvalidAmount);

        let repay_wads = (repay_amount as u128)
            .checked_mul(Self::INITIAL_BORROW_RATE)
            .ok_or(LendingError::MathOverflow)?;

        let settle_amount = repay_wads.min(self.liquidity_borrowed_amount_wads);

        require!(settle_amount > 0, LendingError::RepayTooSmall);

        self.liquidity_borrowed_amount_wads = self.liquidity_borrowed_amount_wads
            .checked_sub(settle_amount)
            .ok_or(LendingError::MathOverflow)?;

        self.liquidity_available_amount = self.liquidity_available_amount
            .checked_add(repay_amount)
            .ok_or(LendingError::MathOverflow)?;

        let settled_tokens = settle_amount
            .checked_div(Self::INITIAL_BORROW_RATE)
            .ok_or(LendingError::MathOverflow)? as u64;

        Ok(settled_tokens)
    }

    pub fn calculate_borrow_fee(&self, amount: u64) -> Result<(u64, u64)> {
        let amount_wad = (amount as u128)
            .checked_mul(Self::INITIAL_BORROW_RATE)
            .ok_or(LendingError::MathOverflow)?;

        let borrow_fee = amount_wad
            .checked_mul(self.config.fees.borrow_fee_wad as u128)
            .and_then(|v| v.checked_div(Self::INITIAL_BORROW_RATE))
            .and_then(|v| v.checked_div(Self::INITIAL_BORROW_RATE))
            .ok_or(LendingError::MathOverflow)? as u64;

        let host_fee = if self.config.fees.host_fee_percentage > 0 {
            (borrow_fee as u128)
                .checked_mul(self.config.fees.host_fee_percentage as u128)
                .and_then(|v| v.checked_div(100))
                .ok_or(LendingError::MathOverflow)? as u64
        } else {
            0
        };

        Ok((borrow_fee, host_fee))
    }

    pub fn redeem_collateral(&self, collateral_amount: u64) -> Result<u64> {
        require!(collateral_amount > 0, LendingError::InvalidAmount);

        require!(
            self.collateral_mint_total_supply >= collateral_amount,
            LendingError::InvalidAmount
        );

        let exchange_rate = self.collateral_exchange_rate()?;

        let liquidity_amount = (collateral_amount as u128)
            .checked_mul(exchange_rate)
            .and_then(|v| v.checked_div(Self::INITIAL_BORROW_RATE))
            .ok_or(LendingError::MathOverflow)?;

        let liquidity_amount_u64 = u64
            ::try_from(liquidity_amount)
            .map_err(|_| LendingError::MathOverflow)?;

        let borrowed_liquidity = self.liquidity_borrowed_amount_wads
            .checked_div(Self::INITIAL_BORROW_RATE)
            .ok_or(LendingError::MathOverflow)? as u64;

        let total_liquidity = self.liquidity_available_amount
            .checked_add(borrowed_liquidity)
            .ok_or(LendingError::MathOverflow)?;

        require!(liquidity_amount_u64 <= total_liquidity, LendingError::MathOverflow);

        Ok(liquidity_amount_u64)
    }
}
