use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use anchor_spl::token_interface::TokenInterface;
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
    const MAX_SLOT_AGE: u64 = 10;
    
    require!(
        clock.slot.saturating_sub(reserve.last_update_slot) <= MAX_SLOT_AGE,
        LendingError::ReserveStale
    );


    require!(
        obligation.lending_market == ctx.accounts.lending_market.key(),
        LendingError::InvalidLendingMarket
    );

    require!(
        reserve.lending_market == ctx.accounts.lending_market.key(),
        LendingError::InvalidLendingMarket
    );

    require!(
        reserve.config.loan_to_value_ratio > 0,
        LendingError::ReserveCollateralDisabled
    );

    let cpi_accounts = Transfer {
        from: ctx.accounts.source_collateral.to_account_info(),
        to: ctx.accounts.destination_collateral.to_account_info(),
        authority: ctx.accounts.user_transfer_authority.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, collateral_amount)?;

    match obligation.find_collateral(reserve.key()) {
        Ok((mut collateral, index)) => {
            msg!("   ✅ Found existing collateral at index {}", index);
            collateral.deposit(collateral_amount)?;
            obligation.update_collateral(index, collateral)?;
        }
        Err(_) => {
            msg!("   ✅ Creating new collateral entry");
            let index = obligation.find_or_add_collateral(reserve.key())?;
            let (mut collateral, _) = obligation.find_collateral_by_index(index)?;
            collateral.deposit(collateral_amount)?;
            obligation.update_collateral(index, collateral)?;
        }
    }

    obligation.last_update_slot = clock.slot;
    
    msg!("   ✅ Deposit successful!");
    msg!("   New deposited_amount: {}", {
        let (col, _) = obligation.find_collateral(reserve.key()).unwrap();
        col.deposited_amount
    });

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
        constraint = reserve.lending_market == lending_market.key() @ LendingError::InvalidLendingMarket
    )]
    pub reserve: Box<Account<'info, Reserve>>,

    #[account(
        mut,
        constraint = obligation.owner == obligation_owner.key() @ LendingError::InvalidObligationOwner,
        constraint = obligation.lending_market == lending_market.key() @ LendingError::InvalidLendingMarket,
        seeds = [
            Obligation::SEED_PREFIX,
            lending_market.key().as_ref(),
            obligation_owner.key().as_ref(),
        ],
        bump
    )]
    pub obligation: Box<Account<'info, Obligation>>,

    pub lending_market: Box<Account<'info, LendingMarket>>,

    ///CHECK: authority PDA checked in CPI
    #[account(
        seeds = [b"authority", lending_market.key().as_ref()],
        bump,
    )]
    pub lending_market_authority: AccountInfo<'info>,

    #[account(mut)]
    pub obligation_owner: Signer<'info>,

    pub user_transfer_authority: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[event]
pub struct CollateralDeposited {
    pub obligation: Pubkey,
    pub reserve: Pubkey,
    pub amount: u64,
    pub slot: u64,
}