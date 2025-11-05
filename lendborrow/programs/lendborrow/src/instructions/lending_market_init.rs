use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenInterface;

use crate::errors::LendingError;
use crate::states::lending_market::LendingMarket;

pub fn lending_market_init(
    ctx: Context<InitLendingMarket>,
    quote_currency: [u8; 32],
) -> Result<()> {
    require!(
        LendingMarket::validate_quote_currency(&quote_currency),
        LendingError::InvalidQuoteCurrency
    );

    let lending_market = &mut ctx.accounts.lending_market;
    let bump = ctx.bumps.lending_market;

    lending_market.owner = ctx.accounts.owner.key();
    lending_market.version = LendingMarket::PROGRAM_VERSION;
    lending_market.bump_seed = bump;
    lending_market.quote_currency = quote_currency;
    lending_market.token_program_id = ctx.accounts.token_program.key();

    emit!(LendingMarketInitialized {
        lending_market: lending_market.key(),
        owner: lending_market.owner,
        quote_currency,
        bump,
    });

    //TODO: Remove that after code testing !
    msg!("   Lending market initialized");
    msg!("   Market: {}", lending_market.key());
    msg!("   Owner: {}", lending_market.owner);
    msg!(
        "   Quote: {}",
        std::str::from_utf8(&quote_currency)
            .unwrap_or("binary")
            .trim_end_matches('\0')
    );

    Ok(())
}

#[derive(Accounts)]
pub struct InitLendingMarket<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + LendingMarket::INIT_SPACE,
        seeds = [LendingMarket::SEED_PREFIX, owner.key().as_ref()],
        bump
    )]
    pub lending_market: Account<'info, LendingMarket>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct LendingMarketInitialized {
    pub lending_market: Pubkey,
    pub owner: Pubkey,
    pub quote_currency: [u8; 32],
    pub bump: u8,
}
