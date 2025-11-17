use crate::errors::LendingError;
use crate::states::Obligation;
use crate::utils::{deserialize_reserve, verify_reserve_freshness, refresh_collateral, refresh_liquidity};
use anchor_lang::prelude::*;

pub fn handler(ctx: Context<RefreshObligation>) -> Result<()> {
    let obligation = &mut ctx.accounts.obligation;
    let clock = Clock::get()?;
    let reserve_accounts = ctx.remaining_accounts;

    let expected_reserves = obligation.deposits_len as usize + obligation.borrows_len as usize;
    require!(
        reserve_accounts.len() == expected_reserves,
        LendingError::InvalidReserveCount
    );
    require!(expected_reserves > 0, LendingError::NoReservesToRefresh);

    let mut total_deposited_value: u128 = 0;
    let mut total_allowed_borrow_value: u128 = 0;
    let mut total_unhealthy_borrow_value: u128 = 0;
    let mut total_borrowed_value: u128 = 0;

    let mut reserve_index = 0;

    for i in 0..obligation.deposits_len as usize {
        let deposit_reserve_info = &reserve_accounts[reserve_index];
        reserve_index += 1;

        let (collateral, _) = obligation.find_collateral_by_index(i)?;
        require!(
            deposit_reserve_info.key() == collateral.deposit_reserve,
            LendingError::InvalidReserveForObligation
        );

        let deposit_reserve = deserialize_reserve(deposit_reserve_info)?;
        verify_reserve_freshness(&deposit_reserve, clock.slot)?;

        let result = refresh_collateral(obligation, i, &deposit_reserve)?;
        
        total_deposited_value = total_deposited_value
            .checked_add(result.market_value)
            .ok_or(LendingError::MathOverflow)?;
        
        total_allowed_borrow_value = total_allowed_borrow_value
            .checked_add(result.allowed_borrow_value)
            .ok_or(LendingError::MathOverflow)?;
        
        total_unhealthy_borrow_value = total_unhealthy_borrow_value
            .checked_add(result.unhealthy_borrow_value)
            .ok_or(LendingError::MathOverflow)?;
    }

    for i in 0..obligation.borrows_len as usize {
        let borrow_reserve_info = &reserve_accounts[reserve_index];
        reserve_index += 1;

        let (liquidity, _) = obligation.find_liquidity_by_index(i)?;
        require!(
            borrow_reserve_info.key() == liquidity.borrow_reserve,
            LendingError::InvalidReserveForObligation
        );

        let borrow_reserve = deserialize_reserve(borrow_reserve_info)?;
        verify_reserve_freshness(&borrow_reserve, clock.slot)?;

        let market_value = refresh_liquidity(obligation, i, &borrow_reserve)?;
        
        total_borrowed_value = total_borrowed_value
            .checked_add(market_value)
            .ok_or(LendingError::MathOverflow)?;
    }
    obligation.deposited_value = total_deposited_value;
    obligation.borrowed_value = total_borrowed_value;
    obligation.allowed_borrow_value = total_allowed_borrow_value;
    obligation.unhealthy_borrow_value = total_unhealthy_borrow_value;
    obligation.last_update_slot = clock.slot;

    emit!(ObligationRefreshed {
        obligation: obligation.key(),
        slot: clock.slot,
        deposited_value: total_deposited_value,
        borrowed_value: total_borrowed_value,
        allowed_borrow_value: total_allowed_borrow_value,
        unhealthy_borrow_value: total_unhealthy_borrow_value,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RefreshObligation<'info> {
    #[account(mut)]
    pub obligation: Box<Account<'info, Obligation>>,
}

#[event]
pub struct ObligationRefreshed {
    pub obligation: Pubkey,
    pub slot: u64,
    pub deposited_value: u128,
    pub borrowed_value: u128,
    pub allowed_borrow_value: u128,
    pub unhealthy_borrow_value: u128,
}