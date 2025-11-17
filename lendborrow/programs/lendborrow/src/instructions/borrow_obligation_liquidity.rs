use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::{calculate_borrow, refresh_obligation_internal};
use crate::states::{LendingMarket, Reserve, Obligation, ObligationLiquidity};
use crate::errors::LendingError;

pub fn handler(
    ctx: Context<BorrowObligationLiquidity>,
    liquidity_amount: u64,
) -> Result<()> {
    require!(liquidity_amount > 0, LendingError::InvalidAmount);

    let obligation = &mut ctx.accounts.obligation;
    let borrow_reserve = &mut ctx.accounts.borrow_reserve;
    let clock = Clock::get()?;

    require!(
        obligation.last_update_slot == clock.slot,
        LendingError::ObligationStale
    );

    require!(
        borrow_reserve.last_update_slot == clock.slot,
        LendingError::ReserveStale
    );

    require!(
        obligation.deposits_len > 0,
        LendingError::ObligationDepositsEmpty
    );

    require!(
        obligation.deposited_value > 0,
        LendingError::ObligationDepositsZero
    );

    let remaining_borrow_value = obligation.remaining_borrow_value()?;
    require!(
        remaining_borrow_value > 0,
        LendingError::BorrowTooLarge
    );

    let borrow_result = calculate_borrow(
        borrow_reserve,
        liquidity_amount,
        remaining_borrow_value,
    )?;

    require!(
        borrow_result.receive_amount > 0,
        LendingError::BorrowTooSmall
    );

    borrow_reserve.liquidity_borrowed_amount_wads = borrow_reserve
        .liquidity_borrowed_amount_wads
        .checked_add(borrow_result.borrow_amount_wads)
        .ok_or(LendingError::MathOverflow)?;

    borrow_reserve.liquidity_available_amount = borrow_reserve
        .liquidity_available_amount
        .checked_sub(liquidity_amount)
        .ok_or(LendingError::InsufficientLiquidity)?;

    let borrow_index = obligation.find_or_add_liquidity(borrow_reserve.key())?;
    let (mut liquidity, _) = obligation.find_liquidity_by_index(borrow_index)?;

    liquidity.borrow(borrow_result.borrow_amount_wads)?;
    obligation.update_liquidity(borrow_index, liquidity)?;

    let expected_deposits = obligation.deposits_len as usize;
    let expected_borrows = obligation.borrows_len as usize;
    let expected_total = expected_deposits + expected_borrows;
    
    require!(
        ctx.remaining_accounts.len() == expected_total,
        LendingError::InvalidReserveCount
    );

    refresh_obligation_internal(
        obligation,
        ctx.remaining_accounts,
        &clock,
    )?;

    obligation.verify_healthy()?;

    borrow_reserve.last_update_slot = clock.slot;

    let lending_market_key = ctx.accounts.lending_market.key();
    let authority_bump = ctx.bumps.lending_market_authority;
    let authority_seeds = &[
        b"authority",
        lending_market_key.as_ref(),
        &[authority_bump]
    ];
    let signer_seeds = &[&authority_seeds[..]];

    if borrow_result.owner_fee > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.source_liquidity.to_account_info(),
            to: ctx.accounts.borrow_reserve_liquidity_fee_receiver.to_account_info(),
            authority: ctx.accounts.lending_market_authority.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );

        token::transfer(cpi_ctx, borrow_result.owner_fee)?;
    }

    if borrow_result.host_fee > 0 {
        if let Some(host_fee_receiver) = ctx.accounts.host_fee_receiver.as_ref() {
            let cpi_accounts = Transfer {
                from: ctx.accounts.source_liquidity.to_account_info(),
                to: host_fee_receiver.to_account_info(),
                authority: ctx.accounts.lending_market_authority.to_account_info(),
            };

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            );

            token::transfer(cpi_ctx, borrow_result.host_fee)?;
        }
    }

    let cpi_accounts = Transfer {
        from: ctx.accounts.source_liquidity.to_account_info(),
        to: ctx.accounts.destination_liquidity.to_account_info(),
        authority: ctx.accounts.lending_market_authority.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );

    token::transfer(cpi_ctx, borrow_result.receive_amount)?;

    emit!(LiquidityBorrowed {
        obligation: obligation.key(),
        reserve: borrow_reserve.key(),
        liquidity_amount: liquidity_amount,
        borrow_amount_wads: borrow_result.borrow_amount_wads,
        receive_amount: borrow_result.receive_amount,
        borrow_fee: borrow_result.borrow_fee,
        host_fee: borrow_result.host_fee,
        owner: ctx.accounts.obligation_owner.key(),
        slot: clock.slot,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct BorrowObligationLiquidity<'info> {
    #[account(
        mut,
        constraint = source_liquidity.key() == borrow_reserve.liquidity_supply 
            @ LendingError::InvalidLiquiditySupply,
    )]
    pub source_liquidity: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = destination_liquidity.owner == obligation_owner.key()
            @ LendingError::InvalidDestinationAccount,
    )]
    pub destination_liquidity: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = borrow_reserve.lending_market == lending_market.key() 
            @ LendingError::InvalidLendingMarket,
    )]
    pub borrow_reserve: Box<Account<'info, Reserve>>,

    #[account(
        mut,
        constraint = borrow_reserve_liquidity_fee_receiver.key() 
            == borrow_reserve.liquidity_fee_receiver 
            @ LendingError::InvalidFeeReceiver,
    )]
    pub borrow_reserve_liquidity_fee_receiver: Box<Account<'info, TokenAccount>>,

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

    /// CHECK: Lending market authority PDA
    #[account(
        seeds = [b"authority", lending_market.key().as_ref()],
        bump
    )]
    pub lending_market_authority: UncheckedAccount<'info>,

    pub obligation_owner: Signer<'info>,

    /// CHECK: Validated in handler if present
    pub host_fee_receiver: Option<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[event]
pub struct LiquidityBorrowed {
    pub obligation: Pubkey,
    pub reserve: Pubkey,
    pub liquidity_amount: u64,
    pub borrow_amount_wads: u128,
    pub receive_amount: u64,
    pub borrow_fee: u64,
    pub host_fee: u64,
    pub owner: Pubkey,
    pub slot: u64,
}

