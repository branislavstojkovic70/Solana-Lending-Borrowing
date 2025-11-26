use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo};

use crate::{errors::LendingError, states::{LendingMarket, Reserve}};

pub fn handler(ctx: Context<DepositReserveLiquidity>, liquidity_amount: u64) -> Result<()> {
    require!(liquidity_amount > 0, LendingError::InvalidAmount);

    let reserve = &mut ctx.accounts.reserve;
    let clock = Clock::get()?;

    require!(
        !reserve.is_stale(clock.slot)?,
        LendingError::ReserveStale
    );

    let collateral_amount = reserve.deposit_liquidity(liquidity_amount)?;

    reserve.last_update_slot = clock.slot;

    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.source_liquidity.to_account_info(),
            to: ctx.accounts.reserve_liquidity_supply.to_account_info(),
            authority: ctx.accounts.user_transfer_authority.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, liquidity_amount)?;

    let lending_market_key = ctx.accounts.lending_market.key();
    let authority_bump = ctx.bumps.lending_market_authority; 
    let seeds = &[b"authority", lending_market_key.as_ref(), &[authority_bump]];
    let signer_seeds = &[&seeds[..]];

    let mint_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.reserve_collateral_mint.to_account_info(),
            to: ctx.accounts.destination_collateral.to_account_info(),
            authority: ctx.accounts.lending_market_authority.to_account_info(),
        },
        signer_seeds,
    );
    token::mint_to(mint_ctx, collateral_amount)?;

    emit!(LiquidityDeposited {
        reserve: reserve.key(),
        liquidity_amount,
        collateral_amount,
        depositor: ctx.accounts.user_transfer_authority.key(),
        slot: clock.slot,
    });

    msg!(
        "Deposited {} liquidity, minted {} collateral",
        liquidity_amount,
        collateral_amount
    );

    Ok(())
}

#[derive(Accounts)]
pub struct DepositReserveLiquidity<'info> {
    #[account(mut)]
    pub source_liquidity: Account<'info, TokenAccount>,

    #[account(mut)]
    pub destination_collateral: Account<'info, TokenAccount>,

    #[account(
        mut,
        has_one = lending_market,
        constraint = reserve.liquidity_supply == reserve_liquidity_supply.key() 
            @ LendingError::InvalidAccountInput,
        constraint = reserve.collateral_mint == reserve_collateral_mint.key() 
            @ LendingError::InvalidAccountInput,
        constraint = reserve.liquidity_supply != source_liquidity.key() 
            @ LendingError::InvalidAccountInput,
        constraint = reserve.collateral_supply != destination_collateral.key() 
            @ LendingError::InvalidAccountInput,
    )]
    pub reserve: Account<'info, Reserve>,

    #[account(mut)]
    pub reserve_liquidity_supply: Account<'info, TokenAccount>,

    #[account(mut)]
    pub reserve_collateral_mint: Account<'info, Mint>,

    #[account(
        constraint = lending_market.token_program_id == token_program.key() 
            @ LendingError::InvalidTokenProgram
    )]
    pub lending_market: Account<'info, LendingMarket>,

    /// CHECK: PDA derived with "authority" seed
    #[account(
        seeds = [b"authority", lending_market.key().as_ref()],
        bump
    )]
    pub lending_market_authority: UncheckedAccount<'info>,

    pub user_transfer_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[event]
pub struct LiquidityDeposited {
    pub reserve: Pubkey,
    pub liquidity_amount: u64,
    pub collateral_amount: u64,
    pub depositor: Pubkey,
    pub slot: u64,
}