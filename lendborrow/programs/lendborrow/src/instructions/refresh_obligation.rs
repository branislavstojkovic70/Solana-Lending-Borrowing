use anchor_lang::prelude::*;
use crate::states::{Obligation, Reserve};
use crate::errors::LendingError;

pub fn handler(ctx: Context<RefreshObligation>) -> Result<()> {
    let obligation = &mut ctx.accounts.obligation;
    let clock = Clock::get()?;
    
    obligation.last_update_slot = clock.slot;
    
    let reserve_accounts = ctx.remaining_accounts;
    
    let expected_reserves = obligation.deposits_len as usize + obligation.borrows_len as usize;
    require!(
        reserve_accounts.len() == expected_reserves,
        LendingError::InvalidReserveCount
    );
    
    require!(
        expected_reserves > 0,
        LendingError::NoReservesToRefresh
    );
    
    let mut total_deposited_value: u128 = 0;
    let mut total_allowed_borrow_value: u128 = 0;
    let mut total_unhealthy_borrow_value: u128 = 0;
    let mut total_borrowed_value: u128 = 0;
    
    let mut reserve_index = 0;
    
    // Step 1: Refresh all collateral deposits
    for i in 0..obligation.deposits_len as usize {
        let deposit_reserve_info = &reserve_accounts[reserve_index];
        reserve_index += 1;
        
        let (mut collateral, index) = obligation.find_collateral_by_index(i)?;
        
        require!(
            deposit_reserve_info.key() == collateral.deposit_reserve,
            LendingError::InvalidReserveForObligation
        );
        
        // FIX: Deserialize direktno iz AccountInfo data
        let reserve_data = deposit_reserve_info.try_borrow_data()?;
        let mut reserve_data_slice: &[u8] = &reserve_data;
        let deposit_reserve = Reserve::try_deserialize(&mut reserve_data_slice)?;
        
        require!(
            deposit_reserve.last_update_slot >= clock.slot.saturating_sub(1),
            LendingError::ReserveStale
        );
        
        // Calculate market value of deposited collateral
        let liquidity_amount = deposit_reserve.collateral_to_liquidity(collateral.deposited_amount)?;
        
        let market_value = (deposit_reserve.liquidity_market_price as u128)
            .checked_mul(liquidity_amount as u128)
            .ok_or(LendingError::MathOverflow)?;
        
        collateral.market_value = market_value;
        
        total_deposited_value = total_deposited_value
            .checked_add(market_value)
            .ok_or(LendingError::MathOverflow)?;
        
        // Calculate allowed borrow value based on LTV ratio
        let allowed_value = market_value
            .checked_mul(deposit_reserve.config.loan_to_value_ratio as u128)
            .and_then(|v| v.checked_div(100))
            .ok_or(LendingError::MathOverflow)?;
        
        total_allowed_borrow_value = total_allowed_borrow_value
            .checked_add(allowed_value)
            .ok_or(LendingError::MathOverflow)?;
        
        // Calculate unhealthy borrow value based on liquidation threshold
        let unhealthy_value = market_value
            .checked_mul(deposit_reserve.config.liquidation_threshold as u128)
            .and_then(|v| v.checked_div(100))
            .ok_or(LendingError::MathOverflow)?;
        
        total_unhealthy_borrow_value = total_unhealthy_borrow_value
            .checked_add(unhealthy_value)
            .ok_or(LendingError::MathOverflow)?;
        
        obligation.update_collateral(index, collateral)?;
    }
    
    // Step 2: Refresh all liquidity borrows
    for i in 0..obligation.borrows_len as usize {
        let borrow_reserve_info = &reserve_accounts[reserve_index];
        reserve_index += 1;
        
        let (mut liquidity, index) = obligation.find_liquidity_by_index(i)?;
        
        require!(
            borrow_reserve_info.key() == liquidity.borrow_reserve,
            LendingError::InvalidReserveForObligation
        );
        
        // FIX: Isti pristup kao gore
        let reserve_data = borrow_reserve_info.try_borrow_data()?;
        let mut reserve_data_slice: &[u8] = &reserve_data;
        let borrow_reserve = Reserve::try_deserialize(&mut reserve_data_slice)?;
        
        require!(
            borrow_reserve.last_update_slot >= clock.slot.saturating_sub(1),
            LendingError::ReserveStale
        );
        
        // Accrue interest on the borrowed amount
        let compounded_interest_rate = borrow_reserve
            .liquidity_cumulative_borrow_rate_wads
            .checked_div(liquidity.cumulative_borrow_rate_wads)
            .ok_or(LendingError::MathOverflow)?;
        
        let accrued_borrow_amount = liquidity.borrowed_amount_wads
            .checked_mul(compounded_interest_rate)
            .and_then(|v| v.checked_div(Reserve::INITIAL_BORROW_RATE))
            .ok_or(LendingError::MathOverflow)?;
        
        liquidity.borrowed_amount_wads = accrued_borrow_amount;
        liquidity.cumulative_borrow_rate_wads = borrow_reserve.liquidity_cumulative_borrow_rate_wads;
        
        // Calculate market value of borrowed liquidity
        let borrowed_amount = accrued_borrow_amount
            .checked_div(Reserve::INITIAL_BORROW_RATE)
            .ok_or(LendingError::MathOverflow)?;
        
        let market_value = borrow_reserve
            .liquidity_market_price
            .checked_mul(borrowed_amount)
            .ok_or(LendingError::MathOverflow)?;
        
        liquidity.market_value = market_value;
        
        total_borrowed_value = total_borrowed_value
            .checked_add(market_value)
            .ok_or(LendingError::MathOverflow)?;
        
        obligation.update_liquidity(index, liquidity)?;
    }
    
    // Step 3: Update obligation totals
    obligation.deposited_value = total_deposited_value;
    obligation.borrowed_value = total_borrowed_value;
    obligation.allowed_borrow_value = total_allowed_borrow_value;
    obligation.unhealthy_borrow_value = total_unhealthy_borrow_value;
    
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