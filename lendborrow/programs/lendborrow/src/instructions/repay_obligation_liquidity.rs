use crate::calculate_repay;
use crate::errors::LendingError;
use crate::states::{LendingMarket, Obligation, Reserve};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

pub fn handler(ctx: Context<RepayObligationLiquidity>, liquidity_amount: u64) -> Result<()> {
    require!(liquidity_amount > 0, LendingError::InvalidAmount);

    let obligation = &mut ctx.accounts.obligation;
    let repay_reserve = &mut ctx.accounts.repay_reserve;
    let clock = Clock::get()?;

    require!(
        obligation.last_update_slot == clock.slot,
        LendingError::ObligationStale
    );

    require!(
        repay_reserve.last_update_slot == clock.slot,
        LendingError::ReserveStale
    );

    let (mut liquidity, liquidity_index) = obligation
        .find_liquidity(repay_reserve.key())
        .map_err(|_| LendingError::ObligationLiquidityNotFound)?;

    require!(
        liquidity.borrowed_amount_wads > 0,
        LendingError::ObligationLiquidityEmpty
    );

    let repay_result = calculate_repay(
        repay_reserve,
        liquidity_amount,
        liquidity.borrowed_amount_wads,
    )?;

    let actual_repay_amount = if liquidity_amount == u64::MAX {
        let user_balance = ctx.accounts.source_liquidity.amount;
        let actual_amount = std::cmp::min(repay_result.repay_amount, user_balance);
        actual_amount
    } else {
        repay_result.repay_amount
    };

    let actual_settle_amount = if actual_repay_amount < repay_result.repay_amount {
        const WAD: u128 = 1_000_000_000_000_000_000;
        (actual_repay_amount as u128)
            .checked_mul(WAD)
            .ok_or(LendingError::MathOverflow)?
            .min(repay_result.settle_amount_wads)
    } else {
        repay_result.settle_amount_wads
    };

    require!(
        ctx.accounts.source_liquidity.amount >= actual_repay_amount,
        LendingError::InsufficientLiquidity
    );

    require!(actual_repay_amount > 0, LendingError::RepayTooSmall);

    repay_reserve.liquidity_borrowed_amount_wads = repay_reserve
        .liquidity_borrowed_amount_wads
        .checked_sub(actual_settle_amount)
        .ok_or(LendingError::MathOverflow)?;

    repay_reserve.liquidity_available_amount = repay_reserve
        .liquidity_available_amount
        .checked_add(actual_repay_amount)
        .ok_or(LendingError::MathOverflow)?;

    obligation.repay(liquidity_index, actual_settle_amount)?;
    repay_reserve.last_update_slot = clock.slot;

    let cpi_accounts = Transfer {
        from: ctx.accounts.source_liquidity.to_account_info(),
        to: ctx.accounts.destination_liquidity.to_account_info(),
        authority: ctx.accounts.user_transfer_authority.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);

    token::transfer(cpi_ctx, actual_repay_amount)?;

    emit!(LiquidityRepaid {
        obligation: obligation.key(),
        reserve: repay_reserve.key(),
        liquidity_amount: liquidity_amount,
        settle_amount_wads: actual_settle_amount,
        repay_amount: actual_repay_amount,
        owner: ctx.accounts.obligation_owner.key(),
        slot: clock.slot,
    });
    Ok(())
}

/// Accounts context for repaying borrowed liquidity.
///
/// User is paying SPL liquidity back into the reserve's liquidity vault.
/// No PDA signing is needed because repayment always comes from user's tokens.
#[derive(Accounts)]
pub struct RepayObligationLiquidity<'info> {
    #[account(mut)]
    pub source_liquidity: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = destination_liquidity.key() == repay_reserve.liquidity_supply 
            @ LendingError::InvalidLiquiditySupply,
    )]
    pub destination_liquidity: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = repay_reserve.lending_market == lending_market.key() 
            @ LendingError::InvalidLendingMarket,
    )]
    pub repay_reserve: Box<Account<'info, Reserve>>,

    #[account(
        mut,
        constraint = obligation.owner == obligation_owner.key() 
            @ LendingError::InvalidObligationOwner,
        constraint = obligation.lending_market == lending_market.key() 
            @ LendingError::InvalidLendingMarket,
        seeds = [
            Obligation::SEED_PREFIX,
            lending_market.key().as_ref(),
            obligation_owner.key().as_ref(),
        ],
        bump
    )]
    pub obligation: Box<Account<'info, Obligation>>,

    pub lending_market: Box<Account<'info, LendingMarket>>,

    pub obligation_owner: Signer<'info>,

    pub user_transfer_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[event]
pub struct LiquidityRepaid {
    pub obligation: Pubkey,
    pub reserve: Pubkey,
    pub liquidity_amount: u64,
    pub settle_amount_wads: u128,
    pub repay_amount: u64,
    pub owner: Pubkey,
    pub slot: u64,
}
