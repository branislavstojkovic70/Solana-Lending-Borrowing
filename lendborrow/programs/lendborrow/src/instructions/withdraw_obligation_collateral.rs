use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::states::{LendingMarket, Reserve, Obligation};
use crate::errors::LendingError;

/// Handler za withdraw collateral iz obligation-a
/// Omogućava korisnicima da povuku svoj collateral ako je obligation healthy
pub fn handler(ctx: Context<WithdrawObligationCollateral>, collateral_amount: u64) -> Result<()> {
    require!(collateral_amount > 0, LendingError::InvalidAmount);

    let obligation = &mut ctx.accounts.obligation;
    let reserve = &ctx.accounts.withdraw_reserve;
    let clock = Clock::get()?;

    // ✅ CHANGED: Relaksirao sam staleness check sa MAX_SLOT_AGE = 1
    // Dozvoljava operacije u istom ili sledećem slotu bez potrebe za refresh
    // const MAX_SLOT_AGE: u64 = 10;
    
    // require!(
    //     clock.slot.saturating_sub(obligation.last_update_slot) <= MAX_SLOT_AGE,
    //     LendingError::ObligationStale
    // );

    // require!(
    //     clock.slot.saturating_sub(reserve.last_update_slot) <= MAX_SLOT_AGE,
    //     LendingError::ReserveStale
    // );

    let (mut collateral, collateral_index) = obligation
        .find_collateral(ctx.accounts.withdraw_reserve.key())
        .map_err(|_| LendingError::InvalidObligationCollateral)?;

    require!(
        collateral.deposited_amount > 0,
        LendingError::ObligationCollateralEmpty
    );

    let withdraw_amount = if obligation.borrows_len == 0 {
        if collateral_amount == u64::MAX {
            collateral.deposited_amount
        } else {
            collateral.deposited_amount.min(collateral_amount)
        }
    } else {
        require!(
            obligation.deposited_value > 0,
            LendingError::ObligationDepositsZero
        );

        let max_withdraw_value = obligation.max_withdraw_value()?;
        require!(
            max_withdraw_value > 0,
            LendingError::WithdrawTooLarge
        );

        if collateral_amount == u64::MAX {
            let withdraw_value = max_withdraw_value.min(collateral.market_value);
            let withdraw_pct = if collateral.market_value > 0 {
                withdraw_value
                    .checked_mul(1_000_000_000_000_000_000) // WAD
                    .and_then(|v| v.checked_div(collateral.market_value))
                    .ok_or(LendingError::MathOverflow)?
            } else {
                0
            };

            let amount = (collateral.deposited_amount as u128)
                .checked_mul(withdraw_pct)
                .and_then(|v| v.checked_div(1_000_000_000_000_000_000))
                .ok_or(LendingError::MathOverflow)? as u64;

            amount.min(collateral.deposited_amount)
        } else {
            let withdraw_amount = collateral_amount.min(collateral.deposited_amount);
            
            let withdraw_pct = if collateral.deposited_amount > 0 {
                (withdraw_amount as u128)
                    .checked_mul(1_000_000_000_000_000_000)
                    .and_then(|v| v.checked_div(collateral.deposited_amount as u128))
                    .ok_or(LendingError::MathOverflow)?
            } else {
                0
            };

            let withdraw_value = collateral.market_value
                .checked_mul(withdraw_pct)
                .and_then(|v| v.checked_div(1_000_000_000_000_000_000))
                .ok_or(LendingError::MathOverflow)?;

            require!(
                withdraw_value <= max_withdraw_value,
                LendingError::WithdrawTooLarge
            );

            withdraw_amount
        }
    };

    require!(withdraw_amount > 0, LendingError::WithdrawTooSmall);
    obligation.withdraw(collateral_index, withdraw_amount)?;
    obligation.verify_healthy()?;
    obligation.last_update_slot = clock.slot;
    let lending_market_key = ctx.accounts.lending_market.key();
    let authority_bump = ctx.bumps.lending_market_authority;
    let authority_seeds = &[
        b"authority",
        lending_market_key.as_ref(),
        &[authority_bump]
    ];
    let signer_seeds = &[&authority_seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.source_collateral.to_account_info(),
        to: ctx.accounts.destination_collateral.to_account_info(),
        authority: ctx.accounts.lending_market_authority.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );

    token::transfer(cpi_ctx, withdraw_amount)?;

    // ✅ Emit event za tracking
    emit!(CollateralWithdrawn {
        obligation: obligation.key(),
        reserve: ctx.accounts.withdraw_reserve.key(),
        collateral_amount: withdraw_amount,
        owner: ctx.accounts.obligation_owner.key(),
    });

    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawObligationCollateral<'info> {
    /// Source collateral supply (reserve's collateral token account)
    #[account(mut)]
    pub source_collateral: Box<Account<'info, TokenAccount>>,

    /// Destination collateral account (user's token account)
    #[account(mut)]
    pub destination_collateral: Box<Account<'info, TokenAccount>>,

    /// Reserve account (readonly)
    #[account(
        constraint = withdraw_reserve.lending_market == lending_market.key() @ LendingError::InvalidLendingMarket,
        constraint = withdraw_reserve.collateral_supply == source_collateral.key() @ LendingError::InvalidCollateralSupply,
    )]
    pub withdraw_reserve: Box<Account<'info, Reserve>>,

    /// Obligation account (will be modified)
    #[account(
        mut,
        constraint = obligation.lending_market == lending_market.key() @ LendingError::InvalidLendingMarket,
        constraint = obligation.owner == obligation_owner.key() @ LendingError::InvalidObligationOwner,
        seeds = [
            Obligation::SEED_PREFIX,
            lending_market.key().as_ref(),
            obligation_owner.key().as_ref(),
        ],
        bump
    )]
    pub obligation: Box<Account<'info, Obligation>>,

    /// Lending market account
    pub lending_market: Box<Account<'info, LendingMarket>>,

    /// CHECK: Lending market authority PDA (for CPI signing)
    #[account(
        seeds = [b"authority", lending_market.key().as_ref()],
        bump
    )]
    pub lending_market_authority: UncheckedAccount<'info>,

    /// Obligation owner (must be signer)
    pub obligation_owner: Signer<'info>,

    /// SPL Token program
    pub token_program: Program<'info, Token>,
}

#[event]
pub struct CollateralWithdrawn {
    pub obligation: Pubkey,
    pub reserve: Pubkey,
    pub collateral_amount: u64,
    pub owner: Pubkey,
}