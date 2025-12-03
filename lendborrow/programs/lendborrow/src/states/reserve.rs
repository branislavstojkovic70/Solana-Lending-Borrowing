use super::reserve_config::*;
use anchor_lang::prelude::*;
use crate::errors::LendingError;

/// High-precision fixed-point WAD (10^18) used throughout rate calculations.
const WAD: u128 = 1_000_000_000_000_000_000;

/// A Reserve represents a liquidity pool inside a lending market.
/// 
/// It tracks:
/// - available liquidity
/// - borrowed liquidity (in WAD precision)
/// - interest rates
/// - cumulative borrow rate
/// - collateral mint and total supply
///
/// Each Reserve is associated with a single liquidity mint (e.g., USDC),
/// and has its own oracle, fees, and configuration parameters.
#[account]
#[derive(InitSpace)]
pub struct Reserve {
    /// Program version for migration compatibility.
    pub version: u8,

    /// Last slot when the reserve was updated (interest + price).
    pub last_update_slot: u64,

    /// Lending market the reserve belongs to.
    pub lending_market: Pubkey,

    /// SPL mint of the underlying liquidity token.
    pub liquidity_mint: Pubkey,

    /// Number of decimals of liquidity mint.
    pub liquidity_mint_decimals: u8,

    /// PDA account holding deposited liquidity (supply vault).
    pub liquidity_supply: Pubkey,

    /// PDA account receiving protocol/host fees.
    pub liquidity_fee_receiver: Pubkey,

    /// Oracle account providing market price for liquidity token.
    pub liquidity_oracle: Pubkey,

    /// Amount of liquidity currently available for withdrawal/borrowing.
    pub liquidity_available_amount: u64,

    /// Borrowed liquidity tracked in WAD for precision.
    pub liquidity_borrowed_amount_wads: u128,

    /// Cumulative borrow interest rate (WAD precision).
    pub liquidity_cumulative_borrow_rate_wads: u128,

    /// Current oracle market price for the liquidity token (WAD precision).
    pub liquidity_market_price: u128,

    /// Mint of the collateral token representing deposit shares.
    pub collateral_mint: Pubkey,

    /// PDA holding all minted collateral tokens.
    pub collateral_supply: Pubkey,

    /// Total supply of collateral tokens (scaled by exchange rate).
    pub collateral_mint_total_supply: u64,

    /// Reserve configuration (rates, LTV, liquidation, fees).
    pub config: ReserveConfig,
}

impl Reserve {
    /// Program version used by this struct.
    pub const PROGRAM_VERSION: u8 = 1;

    /// PDA seed prefix for reserve accounts.
    pub const SEED_PREFIX: &'static [u8] = b"reserve";

    /// Initial WAD borrow rate (1.0).
    pub const INITIAL_BORROW_RATE: u128 = WAD;

    /// Approximate number of slots per year (for interest calculation).
    pub const SLOTS_PER_YEAR: u128 = 63_072_000;

    /// Maximum allowed staleness before repayments/withdraws are blocked.
    pub const MAX_STALE_SLOTS: u64 = 120;

    /// Maximum number of slots interest can accrue in one call.
    pub const MAX_ACCRUE_SLOTS: u64 = 100_000;

    /// Returns `true` if the reserve has not been refreshed for too long,
    /// which indicates that interest and price might be outdated.
    pub fn is_stale(&self, current_slot: u64) -> Result<bool> {
        let slots_elapsed = current_slot
            .checked_sub(self.last_update_slot)
            .ok_or(LendingError::MathOverflow)?;

        Ok(slots_elapsed > Self::MAX_STALE_SLOTS)
    }

    /// Forces the reserve into a “stale” state by artificially pushing the
    /// last update slot backwards. Used primarily during testing.
    pub fn mark_stale(&mut self) {
        self.last_update_slot = self.last_update_slot.saturating_sub(Self::MAX_STALE_SLOTS + 1);
    }

    /// Computes the exchange rate between deposit collateral tokens and underlying liquidity.
    ///
    /// exchange_rate = total_liquidity / collateral_supply
    ///
    /// Used when minting or redeeming collateral.
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

    /// Converts collateral token amount → liquidity token amount using exchange rate.
    pub fn collateral_to_liquidity(&self, collateral_amount: u64) -> Result<u64> {
        let exchange_rate = self.collateral_exchange_rate()?;

        let liquidity_amount = (collateral_amount as u128)
            .checked_mul(exchange_rate)
            .and_then(|v| v.checked_div(Self::INITIAL_BORROW_RATE))
            .ok_or(LendingError::MathOverflow)?;

        Ok(liquidity_amount as u64)
    }

    /// Converts liquidity token amount → collateral token amount using exchange rate.
    pub fn liquidity_to_collateral(&self, liquidity_amount: u64) -> Result<u64> {
        let exchange_rate = self.collateral_exchange_rate()?;

        let collateral_amount = (liquidity_amount as u128)
            .checked_mul(Self::INITIAL_BORROW_RATE)
            .and_then(|v| v.checked_div(exchange_rate))
            .ok_or(LendingError::MathOverflow)?;

        Ok(collateral_amount as u64)
    }

    /// Deposits liquidity into the reserve and returns the amount of collateral minted.
    ///
    /// Also increases liquidity_available_amount and collateral_mint_total_supply.
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

    /// Calculates utilization rate (borrowed / total liquidity) in WAD precision.
    ///
    /// Higher utilization → higher borrow interest rate.
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

    /// Calculates borrow interest rate based on current utilization rate.
    ///
    /// Two-segment piecewise curve:
    /// - below optimal_utilization: linear between min and optimal rate
    /// - above optimal: linear between optimal and max rate
    pub fn calculate_borrow_rate(&self, utilization_rate: u128) -> Result<u128> {
        let optimal_util = (self.config.optimal_utilization_rate as u128)
            .checked_mul(Self::INITIAL_BORROW_RATE)
            .ok_or(LendingError::MathOverflow)?;

        if utilization_rate <= optimal_util {
            // Below optimal utilization → increasing from min → optimal
            let rate_range = self.config.optimal_borrow_rate
                .checked_sub(self.config.min_borrow_rate)
                .ok_or(LendingError::MathOverflow)? as u128;

            let util_ratio = if optimal_util > 0 {
                utilization_rate
                    .checked_mul(Self::INITIAL_BORROW_RATE)
                    .and_then(|v| v.checked_div(optimal_util))
                    .ok_or(LendingError::MathOverflow)?
            } else { 0 };

            let rate = (self.config.min_borrow_rate as u128)
                .checked_add(
                    rate_range
                        .checked_mul(util_ratio)
                        .and_then(|v| v.checked_div(Self::INITIAL_BORROW_RATE))
                        .ok_or(LendingError::MathOverflow)?
                )
                .ok_or(LendingError::MathOverflow)?;

            rate.checked_mul(Self::INITIAL_BORROW_RATE / 100)
                .ok_or(LendingError::MathOverflow.into())
        } else {
            // Above optimal → rising towards max rate
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
            } else { 0 };

            let rate = (self.config.optimal_borrow_rate as u128)
                .checked_add(
                    rate_range
                        .checked_mul(util_ratio)
                        .and_then(|v| v.checked_div(Self::INITIAL_BORROW_RATE))
                        .ok_or(LendingError::MathOverflow)?
                )
                .ok_or(LendingError::MathOverflow)?;

            rate.checked_mul(Self::INITIAL_BORROW_RATE / 100)
                .ok_or(LendingError::MathOverflow.into())
        }
    }

    /// Computes the compounded interest factor over a number of slots.
    ///
    /// Approximates:
    ///   new_rate = 1 + (annual_rate * slots / slots_per_year)
    fn compound_interest(&self, rate: u128, slots: u128) -> Result<u128> {
        let rate_per_slot = rate
            .checked_mul(slots)
            .and_then(|v| v.checked_div(Self::SLOTS_PER_YEAR))
            .ok_or(LendingError::MathOverflow)?;

        Self::INITIAL_BORROW_RATE
            .checked_add(rate_per_slot)
            .ok_or(LendingError::MathOverflow.into())
    }

    /// Accrues interest for a reserve since last update.
    ///
    /// Steps:
    /// 1. calculate utilization rate
    /// 2. calculate borrow rate
    /// 3. compute compound rate for N slots
    /// 4. update cumulative borrow rate
    /// 5. increase borrowed amount
    /// 6. mint interest into available liquidity
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

        require!(
            compound_rate <= Self::INITIAL_BORROW_RATE * 2,
            LendingError::MathOverflow
        );

        // Update cumulative borrow rate
        self.liquidity_cumulative_borrow_rate_wads =
            self.liquidity_cumulative_borrow_rate_wads
                .checked_mul(compound_rate)
                .and_then(|v| v.checked_div(Self::INITIAL_BORROW_RATE))
                .ok_or(LendingError::MathOverflow)?;

        // Calculate interest-backed new borrowed amount
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

        self.liquidity_available_amount = self
            .liquidity_available_amount
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

    /// Borrows liquidity from the reserve.
    ///
    /// Returns:
    /// - receive_amount (after fees)
    /// - borrow_fee
    /// - host_fee
    pub fn borrow(&mut self, borrow_amount: u64) -> Result<(u64, u64, u64)> {
        require!(borrow_amount > 0, LendingError::InvalidAmount);

        require!(
            self.liquidity_available_amount >= borrow_amount,
            LendingError::InsufficientLiquidity
        );

        let (borrow_fee, host_fee) = self.calculate_borrow_fee(borrow_amount)?;

        // Net value user receives
        let receive_amount = borrow_amount
            .checked_sub(borrow_fee)
            .ok_or(LendingError::MathOverflow)?;

        require!(receive_amount > 0, LendingError::BorrowTooSmall);

        // Remove liquidity from pool
        self.liquidity_available_amount = self.liquidity_available_amount
            .checked_sub(borrow_amount)
            .ok_or(LendingError::MathOverflow)?;

        // Add borrowed amount (in WAD)
        let borrow_wads = (borrow_amount as u128)
            .checked_mul(Self::INITIAL_BORROW_RATE)
            .ok_or(LendingError::MathOverflow)?;

        self.liquidity_borrowed_amount_wads = self.liquidity_borrowed_amount_wads
            .checked_add(borrow_wads)
            .ok_or(LendingError::MathOverflow)?;

        Ok((receive_amount, borrow_fee, host_fee))
    }

    /// Repays liquidity back into the reserve.
    ///
    /// Returns the actual number of tokens settled after WAD rounding.
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

    /// Calculates borrow fee and host fee for a borrow transaction.
    ///
    /// Fees are:
    /// - borrow_fee = amount * fee_wad
    /// - host_fee = % of borrow_fee (optional)
    pub fn calculate_borrow_fee(&self, amount: u64) -> Result<(u64, u64)> {
        let amount_wad = (amount as u128)
            .checked_mul(Self::INITIAL_BORROW_RATE)
            .ok_or(LendingError::MathOverflow)?;

        // First divide by WAD to return to token precision
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

    /// Redeems collateral tokens into underlying liquidity tokens.
    ///
    /// Performs exchange rate conversion and validates that the reserve has enough liquidity.
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
