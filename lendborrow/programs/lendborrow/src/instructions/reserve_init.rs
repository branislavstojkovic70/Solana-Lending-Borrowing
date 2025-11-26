use crate::errors::LendingError;
use crate::states::{LendingMarket, Reserve, ReserveConfig};
#[cfg(not(feature = "testing"))]
use crate::utils::oracle::validate_pyth_price;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer},
};

pub fn handler(
    ctx: Context<InitReserve>,
    liquidity_amount: u64,
    config: ReserveConfig,
) -> Result<()> {
    require!(liquidity_amount > 0, LendingError::InvalidLiquidityAmount);

    require!(
        ctx.accounts.source_liquidity.amount >= liquidity_amount,
        LendingError::InsufficientLiquidity
    );

    require!(
        ctx.accounts.source_liquidity.key() != ctx.accounts.liquidity_supply.key(),
        LendingError::InvalidAccountInput
    );
    config.validate()?;

    #[cfg(not(feature = "testing"))]
    let initial_price = validate_pyth_price(
        &ctx.accounts.pyth_price,
        &ctx.accounts.lending_market,
        &config.pyth_price_feed_id,
    )?;

    #[cfg(feature = "testing")]
    let initial_price: u128 = {
        msg!("Testing mode: using mock price");
        1_000_000
    };

    let reserve = &mut ctx.accounts.reserve;
    let clock = Clock::get()?;

    reserve.version = Reserve::PROGRAM_VERSION;
    reserve.last_update_slot = clock.slot;
    reserve.lending_market = ctx.accounts.lending_market.key();

    reserve.liquidity_mint = ctx.accounts.liquidity_mint.key();
    reserve.liquidity_mint_decimals = ctx.accounts.liquidity_mint.decimals;
    reserve.liquidity_supply = ctx.accounts.liquidity_supply.key();
    reserve.liquidity_fee_receiver = ctx.accounts.liquidity_fee_receiver.key();
    reserve.liquidity_oracle = ctx.accounts.pyth_price.key();
    reserve.liquidity_available_amount = liquidity_amount;
    reserve.liquidity_borrowed_amount_wads = 0;
    reserve.liquidity_cumulative_borrow_rate_wads = Reserve::INITIAL_BORROW_RATE;
    reserve.liquidity_market_price = initial_price;

    reserve.collateral_mint = ctx.accounts.collateral_mint.key();
    reserve.collateral_supply = ctx.accounts.collateral_supply.key();
    reserve.collateral_mint_total_supply = liquidity_amount;

    reserve.config = config;

    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.source_liquidity.to_account_info(),
                to: ctx.accounts.liquidity_supply.to_account_info(),
                authority: ctx.accounts.user_transfer_authority.to_account_info(),
            },
        ),
        liquidity_amount,
    )?;

    let lending_market_key = ctx.accounts.lending_market.key();
    let authority_bump = ctx.bumps.lending_market_authority;
    let authority_seeds = &[b"authority", lending_market_key.as_ref(), &[authority_bump]];
    let signer_seeds = &[&authority_seeds[..]];

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.destination_collateral.to_account_info(),
                authority: ctx.accounts.lending_market_authority.to_account_info(),
            },
            signer_seeds,
        ),
        liquidity_amount,
    )?;

    emit!(ReserveInitialized {
        reserve: reserve.key(),
        lending_market: ctx.accounts.lending_market.key(),
        liquidity_mint: ctx.accounts.liquidity_mint.key(),
        collateral_mint: ctx.accounts.collateral_mint.key(),
        liquidity_amount,
        initial_price,
        config: config.clone(),
    });

    Ok(())
}

#[derive(Accounts)]
pub struct InitReserve<'info> {
    #[account(
        mut,
        constraint = source_liquidity.mint == liquidity_mint.key() 
            @ LendingError::InvalidMint,
    )]
    pub source_liquidity: Box<Account<'info, TokenAccount>>,

    pub liquidity_mint: Box<Account<'info, Mint>>,

    #[account(
        has_one = owner @ LendingError::InvalidOwner
    )]
    pub lending_market: Box<Account<'info, LendingMarket>>,

    /// CHECK: Lending market authority PDA
    #[account(
        seeds = [b"authority", lending_market.key().as_ref()],
        bump
    )]
    pub lending_market_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Reserve::INIT_SPACE,
        seeds = [
            Reserve::SEED_PREFIX,
            lending_market.key().as_ref(),
            liquidity_mint.key().as_ref(),
        ],
        bump
    )]
    pub reserve: Box<Account<'info, Reserve>>,

    #[account(
        init,
        payer = owner,
        token::mint = liquidity_mint,
        token::authority = lending_market_authority,
        seeds = [
            b"liquidity-supply",
            lending_market.key().as_ref(),
            liquidity_mint.key().as_ref(),
        ],
        bump
    )]
    pub liquidity_supply: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = owner,
        token::mint = liquidity_mint,
        token::authority = lending_market_authority,
        seeds = [
            b"fee-receiver",
            lending_market.key().as_ref(),
            liquidity_mint.key().as_ref(),
        ],
        bump
    )]
    pub liquidity_fee_receiver: Box<Account<'info, TokenAccount>>,

    /// CHECK: Pyth price account - validated in handler
    pub pyth_price: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        mint::decimals = liquidity_mint.decimals,
        mint::authority = lending_market_authority,
        seeds = [
            b"collateral-mint",
            lending_market.key().as_ref(),
            liquidity_mint.key().as_ref(),
        ],
        bump
    )]
    pub collateral_mint: Box<Account<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = collateral_mint,
        associated_token::authority = owner,
    )]
    pub destination_collateral: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = owner,
        token::mint = collateral_mint,
        token::authority = lending_market_authority,
        seeds = [
            b"collateral-supply",
            lending_market.key().as_ref(),
            liquidity_mint.key().as_ref(),
        ],
        bump
    )]
    pub collateral_supply: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub user_transfer_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

#[event]
pub struct ReserveInitialized {
    pub reserve: Pubkey,
    pub lending_market: Pubkey,
    pub liquidity_mint: Pubkey,
    pub collateral_mint: Pubkey,
    pub liquidity_amount: u64,
    pub initial_price: u128,
    pub config: ReserveConfig,
}
