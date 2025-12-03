// instructions/refresh_reserve.rs
use crate::errors::LendingError;
use crate::states::{LendingMarket, Reserve};
use anchor_lang::prelude::*;

#[cfg(not(feature = "testing"))]
use crate::utils::oracle::validate_pyth_price;

pub fn handler(ctx: Context<RefreshReserve>) -> Result<()> {
    let reserve = &mut ctx.accounts.reserve;
    let clock = Clock::get()?;

    if reserve.last_update_slot == clock.slot {
        msg!("Reserve already fresh for slot {}", clock.slot);
        return Ok(());
    }

    let slots_elapsed = clock.slot
        .checked_sub(reserve.last_update_slot)
        .ok_or(LendingError::MathOverflow)?;
    
    if slots_elapsed > Reserve::MAX_STALE_SLOTS * 2 {
        msg!("WARNING: Reserve was stale for {} slots", slots_elapsed);
    }

    #[cfg(feature = "testing")]
    {
        reserve.liquidity_market_price = 1_000_000u128;
        
        msg!("Testing mode: Mock price = {}", reserve.liquidity_market_price);
    }

    #[cfg(not(feature = "testing"))]
    {
        let current_price = validate_pyth_price(
            &ctx.accounts.pyth_price,
            &ctx.accounts.lending_market,
            reserve.config.pyth_price_feed_id.clone(),
        )?;
        
        reserve.liquidity_market_price = current_price;
        msg!("Production: Pyth price = {}", current_price);
    }

    reserve.accrue_interest(clock.slot)?;

    reserve.last_update_slot = clock.slot;

    emit!(ReserveRefreshed {
        reserve: reserve.key(),
        slot: clock.slot,
        market_price: reserve.liquidity_market_price,
        cumulative_borrow_rate: reserve.liquidity_cumulative_borrow_rate_wads,
        utilization_rate: reserve.calculate_utilization_rate()?,
        borrowed_amount: reserve.liquidity_borrowed_amount_wads,
        available_amount: reserve.liquidity_available_amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RefreshReserve<'info> {
    #[account(
        mut,
        has_one = lending_market @ LendingError::InvalidLendingMarket,
    )]
    pub reserve: Account<'info, Reserve>,

    pub lending_market: Account<'info, LendingMarket>,

    /// CHECK: Pyth price account validated in handler for production
    pub pyth_price: UncheckedAccount<'info>,
}

#[event]
pub struct ReserveRefreshed {
    pub reserve: Pubkey,
    pub slot: u64,
    pub market_price: u128,
    pub cumulative_borrow_rate: u128,
    pub utilization_rate: u128,
    pub borrowed_amount: u128,
    pub available_amount: u64,
}