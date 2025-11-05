use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::states::{Obligation, Reserve, LendingMarket, ObligationCollateral};
use crate::errors::LendingError;

pub fn handler(
    ctx: Context<DepositObligationCollateral>,
    collateral_amount: u64,
) -> Result<()> {
    require!(collateral_amount > 0, LendingError::InvalidAmount);

    let obligation = &mut ctx.accounts.obligation;
    let reserve = &ctx.accounts.reserve;
    let clock = Clock::get()?;

    require!(
        reserve.last_update_slot >= clock.slot.saturating_sub(1),
        LendingError::ReserveStale
    );

    require!(
        obligation.lending_market == ctx.accounts.lending_market.key(),
        LendingError::InvalidMarket
    );

    require!(
        reserve.lending_market == ctx.accounts.lending_market.key(),
        LendingError::InvalidMarket
    );

    let cpi_accounts = Transfer {
        from: ctx.accounts.source_collateral.to_account_info(),
        to: ctx.accounts.destination_collateral.to_account_info(),
        authority: ctx.accounts.user_transfer_authority.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    token::transfer(cpi_ctx, collateral_amount)?;

    if let Some((mut collateral, index)) = obligation.find_collateral(reserve.key()) {
        collateral.deposit(collateral_amount)?;
        obligation.update_collateral(index, collateral)?;
    } else {
        require!(
            (obligation.deposits_len as usize + obligation.borrows_len as usize) 
                < crate::states::MAX_OBLIGATION_RESERVES,
            LendingError::ObligationReserveLimit
        );

        let mut new_collateral = ObligationCollateral::new(reserve.key());
        new_collateral.deposit(collateral_amount)?;
        obligation.add_collateral(new_collateral)?;
    }

    obligation.last_update_slot = clock.slot;

    emit!(CollateralDeposited {
        obligation: obligation.key(),
        reserve: reserve.key(),
        amount: collateral_amount,
        slot: clock.slot,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct DepositObligationCollateral<'info> {
    #[account(mut)]
    pub source_collateral: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = destination_collateral.mint == reserve.collateral_mint @ LendingError::InvalidCollateralMint,
        constraint = destination_collateral.key() == reserve.collateral_supply @ LendingError::InvalidCollateralSupply,
    )]
    pub destination_collateral: Box<Account<'info, TokenAccount>>,

    #[account(
        constraint = reserve.lending_market == lending_market.key() @ LendingError::InvalidMarket
    )]
    pub reserve: Box<Account<'info, Reserve>>,

    #[account(
        mut,
        constraint = obligation.owner == obligation_owner.key() @ LendingError::InvalidObligationOwner,
        constraint = obligation.lending_market == lending_market.key() @ LendingError::InvalidMarket,
    )]
    pub obligation: Box<Account<'info, Obligation>>,

    pub lending_market: Box<Account<'info, LendingMarket>>,

    /// CHECK: Verified via seeds constraint
    #[account(
        seeds = [lending_market.key().as_ref()],
        bump,
    )]
    pub lending_market_authority: AccountInfo<'info>,

    #[account(mut)]
    pub obligation_owner: Signer<'info>,

    pub user_transfer_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[event]
pub struct CollateralDeposited {
    pub obligation: Pubkey,
    pub reserve: Pubkey,
    pub amount: u64,
    pub slot: u64,
}