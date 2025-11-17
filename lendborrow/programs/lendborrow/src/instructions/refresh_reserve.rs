use crate::errors::LendingError;
use crate::states::{LendingMarket, Reserve};
use anchor_lang::prelude::*;
use crate::utils::oracle::validate_pyth_price;

pub fn handler(ctx: Context<RefreshReserve>) -> Result<()> {
    let reserve = &mut ctx.accounts.reserve;
    let clock = Clock::get()?;

    #[cfg(feature = "testing")]
    {
        reserve.liquidity_market_price = 10u128
        .checked_pow(reserve.liquidity_mint_decimals as u32)
        .unwrap();
    
        reserve.last_update_slot = clock.slot;
        return Ok(());
    }

    #[cfg(not(feature = "testing"))]
    {

        let current_price = validate_pyth_price(
            &ctx.accounts.pyth_price,
            &ctx.accounts.lending_market,
            &reserve.config.pyth_price_feed_id,
        )?;

        reserve.liquidity_market_price = current_price;
        reserve.last_update_slot = clock.slot;
    }

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

    /// CHECK: Pyth price account - only validated in production
    pub pyth_price: UncheckedAccount<'info>,
}
