use crate::errors::LendingError;
use crate::states::{LendingMarket, Obligation, Reserve};
use crate::utils::calculate_liquidation;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

pub fn handler(ctx: Context<LiquidateObligation>, liquidity_amount: u64) -> Result<()> {
    require!(liquidity_amount > 0, LendingError::InvalidAmount);

    let obligation = &mut ctx.accounts.obligation;
    let repay_reserve = &mut ctx.accounts.repay_reserve;  
    let withdraw_reserve = &ctx.accounts.withdraw_reserve;
    let clock = Clock::get()?;

    require!(
        obligation.last_update_slot == clock.slot,
        LendingError::ObligationStale
    );

    require!(
        repay_reserve.last_update_slot == clock.slot,
        LendingError::ReserveStale
    );

    require!(
        withdraw_reserve.last_update_slot == clock.slot,
        LendingError::ReserveStale
    );

    require!(
        obligation.borrowed_value > obligation.unhealthy_borrow_value,
        LendingError::ObligationHealthy
    );

    let (liquidity, liquidity_index) = obligation
        .find_liquidity(repay_reserve.key())
        .map_err(|_| LendingError::ObligationLiquidityNotFound)?;

    require!(
        liquidity.borrowed_amount_wads > 0,
        LendingError::ObligationLiquidityEmpty
    );

    let (collateral, collateral_index) = obligation
        .find_collateral(withdraw_reserve.key())
        .map_err(|_| LendingError::InvalidObligationCollateral)?;

    require!(
        collateral.deposited_amount > 0,
        LendingError::ObligationCollateralEmpty
    );

    let liquidation_result = calculate_liquidation(
        repay_reserve,
        withdraw_reserve,
        liquidity_amount,
        &liquidity,
        &collateral,
        obligation,
    )?;

    require!(
        liquidation_result.repay_amount > 0,
        LendingError::LiquidationTooSmall
    );

    require!(
        liquidation_result.withdraw_collateral > 0,
        LendingError::LiquidationTooSmall
    );

    repay_reserve.liquidity_borrowed_amount_wads = repay_reserve
        .liquidity_borrowed_amount_wads
        .checked_sub(liquidation_result.settle_amount_wads)
        .ok_or(LendingError::MathOverflow)?;

    repay_reserve.liquidity_available_amount = repay_reserve
        .liquidity_available_amount
        .checked_add(liquidation_result.repay_amount)
        .ok_or(LendingError::MathOverflow)?;

    
    obligation.repay(liquidity_index, liquidation_result.settle_amount_wads)?;
    obligation.withdraw(collateral_index, liquidation_result.withdraw_collateral)?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.source_liquidity.to_account_info(),
                to: ctx.accounts.destination_liquidity.to_account_info(),
                authority: ctx.accounts.user_transfer_authority.to_account_info(),
            },
        ),
        liquidation_result.repay_amount,
    )?;

    let lending_market_key = ctx.accounts.lending_market.key();
    let authority_bump = ctx.bumps.lending_market_authority;
    let authority_seeds = &[b"authority", lending_market_key.as_ref(), &[authority_bump]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx
                    .accounts
                    .withdraw_reserve_collateral_supply
                    .to_account_info(),
                to: ctx.accounts.destination_collateral.to_account_info(),
                authority: ctx.accounts.lending_market_authority.to_account_info(),
            },
            &[authority_seeds],
        ),
        liquidation_result.withdraw_collateral,
    )?;

    emit!(ObligationLiquidated {
        obligation: obligation.key(),
        repay_reserve: repay_reserve.key(),
        withdraw_reserve: withdraw_reserve.key(),
        liquidity_amount,
        repay_amount: liquidation_result.repay_amount,
        settle_amount_wads: liquidation_result.settle_amount_wads,
        withdraw_collateral: liquidation_result.withdraw_collateral,
        liquidator: ctx.accounts.user_transfer_authority.key(),
        slot: clock.slot,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct LiquidateObligation<'info> {
    #[account(
        mut,
        constraint = source_liquidity.key() != repay_reserve.liquidity_supply 
            @ LendingError::InvalidAccountInput,
    )]
    pub source_liquidity: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = destination_collateral.key() != withdraw_reserve.collateral_supply 
            @ LendingError::InvalidAccountInput,
    )]
    pub destination_collateral: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = repay_reserve.lending_market == lending_market.key() 
            @ LendingError::InvalidLendingMarket,
    )]
    pub repay_reserve: Box<Account<'info, Reserve>>,

    #[account(
        mut,
        constraint = destination_liquidity.key() == repay_reserve.liquidity_supply 
            @ LendingError::InvalidLiquiditySupply,
    )]
    pub destination_liquidity: Box<Account<'info, TokenAccount>>,

    #[account(
        constraint = withdraw_reserve.lending_market == lending_market.key() 
            @ LendingError::InvalidLendingMarket,
    )]
    pub withdraw_reserve: Box<Account<'info, Reserve>>,

    #[account(
        mut,
        constraint = withdraw_reserve_collateral_supply.key() == withdraw_reserve.collateral_supply 
            @ LendingError::InvalidCollateralSupply,
    )]
    pub withdraw_reserve_collateral_supply: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = obligation.lending_market == lending_market.key() 
            @ LendingError::InvalidLendingMarket,
        seeds = [
            Obligation::SEED_PREFIX,
            lending_market.key().as_ref(),
            obligation.owner.as_ref(),
        ],
        bump
    )]
    pub obligation: Box<Account<'info, Obligation>>,

    pub lending_market: Box<Account<'info, LendingMarket>>,

    /// CHECK: Lending market authority PDA
    #[account(
        seeds = [b"authority", lending_market.key().as_ref()],
        bump
    )]
    pub lending_market_authority: UncheckedAccount<'info>,

    pub user_transfer_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[event]
pub struct ObligationLiquidated {
    pub obligation: Pubkey,
    pub repay_reserve: Pubkey,
    pub withdraw_reserve: Pubkey,
    pub liquidity_amount: u64,
    pub repay_amount: u64,
    pub settle_amount_wads: u128,
    pub withdraw_collateral: u64,
    pub liquidator: Pubkey,
    pub slot: u64,
}