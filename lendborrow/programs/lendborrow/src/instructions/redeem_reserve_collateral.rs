use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Token, TokenAccount, Mint, Transfer};
use crate::states::{Reserve, LendingMarket};
use crate::errors::LendingError;

/// Redeem collateral tokens for liquidity tokens from a reserve
/// 
/// This is the inverse operation of deposit_reserve_liquidity:
/// - User burns collateral tokens (e.g., lpUSDC)
/// - Reserve transfers liquidity tokens back (e.g., USDC)
/// - Exchange rate determines how much liquidity user receives
/// 
/// # Arguments
/// * `collateral_amount` - Amount of collateral tokens to redeem (burn)
/// 
/// # Example Flow
/// 1. User has 1000 lpUSDC (collateral tokens)
/// 2. Exchange rate is 1.05 (reserve has earned interest)
/// 3. User redeems 1000 lpUSDC → receives 1050 USDC
/// 4. lpUSDC supply decreases, USDC leaves reserve
pub fn handler(
    ctx: Context<RedeemReserveCollateral>,
    collateral_amount: u64,
) -> Result<()> {
    // Validate input
    require!(
        collateral_amount > 0,
        LendingError::InvalidAmount
    );

    let reserve = &mut ctx.accounts.reserve;
    let clock = Clock::get()?;

    // Check reserve is not stale - must be refreshed recently
    require!(
        !reserve.is_stale(clock.slot)?,
        LendingError::ReserveStale
    );

    // Calculate how much liquidity to return based on exchange rate
    // exchange_rate = total_liquidity / collateral_supply
    // liquidity_amount = collateral_amount * exchange_rate
    let liquidity_amount = reserve.redeem_collateral(collateral_amount)?;

    // Validate reserve has enough available liquidity
    require!(
        reserve.liquidity_available_amount >= liquidity_amount,
        LendingError::InsufficientLiquidity
    );

    // Update reserve state
    reserve.liquidity_available_amount = reserve
        .liquidity_available_amount
        .checked_sub(liquidity_amount)
        .ok_or(LendingError::MathOverflow)?;

    reserve.collateral_mint_total_supply = reserve
        .collateral_mint_total_supply
        .checked_sub(collateral_amount)
        .ok_or(LendingError::MathOverflow)?;

    reserve.last_update_slot = clock.slot;

    // Burn collateral tokens from user's account
    let cpi_accounts = Burn {
        mint: ctx.accounts.reserve_collateral_mint.to_account_info(),
        from: ctx.accounts.source_collateral.to_account_info(),
        authority: ctx.accounts.user_transfer_authority.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
    );

    token::burn(cpi_ctx, collateral_amount)?;

    // Transfer liquidity tokens back to user with PDA authority
    let lending_market_key = ctx.accounts.lending_market.key();
    let authority_bump = ctx.bumps.lending_market_authority;
    let seeds = &[
        b"authority",
        lending_market_key.as_ref(),
        &[authority_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.reserve_liquidity_supply.to_account_info(),
        to: ctx.accounts.destination_liquidity.to_account_info(),
        authority: ctx.accounts.lending_market_authority.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );

    token::transfer(cpi_ctx, liquidity_amount)?;

    // Emit event for indexers/monitoring
    emit!(CollateralRedeemed {
        reserve: reserve.key(),
        collateral_amount,
        liquidity_amount,
        redeemer: ctx.accounts.user_transfer_authority.key(),
        slot: clock.slot,
    });

    msg!(
        "Redeemed {} collateral for {} liquidity at exchange rate {}",
        collateral_amount,
        liquidity_amount,
        reserve.collateral_exchange_rate()?
    );

    Ok(())
}

#[derive(Accounts)]
pub struct RedeemReserveCollateral<'info> {
    /// User's collateral token account (lpTokens to burn)
    #[account(mut)]
    pub source_collateral: Account<'info, TokenAccount>,

    /// User's destination for liquidity tokens (USDC, SOL, etc)
    #[account(mut)]
    pub destination_liquidity: Account<'info, TokenAccount>,

    /// Reserve account - stores all reserve state
    #[account(
        mut,
        has_one = lending_market @ LendingError::InvalidMarketAuthority,
        has_one = liquidity_mint @ LendingError::InvalidLiquidityMint,
        has_one = collateral_mint @ LendingError::InvalidCollateralMint,
    )]
    pub reserve: Account<'info, Reserve>,

    /// Reserve's liquidity supply (where USDC/SOL is stored)
    #[account(
        mut,
        constraint = reserve_liquidity_supply.key() == reserve.liquidity_supply @ LendingError::InvalidLiquiditySupply,
        constraint = reserve_liquidity_supply.mint == reserve.liquidity_mint @ LendingError::InvalidLiquidityMint,
    )]
    pub reserve_liquidity_supply: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = reserve_collateral_mint.key() == reserve.collateral_mint @ LendingError::InvalidCollateralMint,
    )]
    pub reserve_collateral_mint: Account<'info, Mint>,

    #[account(
        constraint = liquidity_mint.key() == reserve.liquidity_mint @ LendingError::InvalidLiquidityMint,
    )]
    pub liquidity_mint: Account<'info, Mint>,

    #[account(
        constraint = collateral_mint.key() == reserve.collateral_mint @ LendingError::InvalidCollateralMint,
    )]
    pub collateral_mint: Account<'info, Mint>,

    pub lending_market: Account<'info, LendingMarket>,

    /// CHECK: PDA validated by seeds constraint
    #[account(
        seeds = [b"authority", lending_market.key().as_ref()],
        bump,
    )]
    pub lending_market_authority: UncheckedAccount<'info>,

    /// User authority that owns the collateral tokens
    pub user_transfer_authority: Signer<'info>,

    /// SPL Token program
    pub token_program: Program<'info, Token>,
}

#[event]
pub struct CollateralRedeemed {
    pub reserve: Pubkey,
    pub collateral_amount: u64,
    pub liquidity_amount: u64,
    pub redeemer: Pubkey,
    pub slot: u64,
}