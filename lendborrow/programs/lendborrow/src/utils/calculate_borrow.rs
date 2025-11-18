use crate::errors::LendingError;
use crate::states::{Obligation, Reserve};
use anchor_lang::prelude::*;

#[derive(Debug)]
pub struct CalculateBorrowResult {
    pub borrow_amount_wads: u128,
    pub receive_amount: u64,
    pub borrow_fee: u64,
    pub host_fee: u64,
    pub owner_fee: u64,
}

pub fn calculate_borrow(
    reserve: &Reserve,
    liquidity_amount: u64,
    remaining_borrow_value: u128,
) -> Result<CalculateBorrowResult> {
    require!(
        reserve.liquidity_available_amount >= liquidity_amount,
        LendingError::InsufficientLiquidity
    );

    const WAD: u128 = 1_000_000_000_000_000_000;

    let decimals = 10u128
        .checked_pow(reserve.liquidity_mint_decimals as u32)
        .ok_or(LendingError::MathOverflow)?;

    let borrow_value = (liquidity_amount as u128)
        .checked_mul(reserve.liquidity_market_price)
        .and_then(|v| v.checked_div(decimals))
        .and_then(|v| v.checked_div(decimals))
        .ok_or(LendingError::MathOverflow)?;

    require!(
        borrow_value <= remaining_borrow_value,
        LendingError::BorrowTooLarge
    );

    let borrow_fee_wad = reserve.config.fees.borrow_fee_wad;

    let borrow_fee = (liquidity_amount as u128)
        .checked_mul(borrow_fee_wad as u128)
        .and_then(|v| v.checked_div(WAD))
        .ok_or(LendingError::MathOverflow)? as u64;

    let host_fee = (borrow_fee as u128)
        .checked_mul(reserve.config.fees.host_fee_percentage as u128)
        .and_then(|v| v.checked_div(100))
        .ok_or(LendingError::MathOverflow)? as u64;

    let owner_fee = borrow_fee
        .checked_sub(host_fee)
        .ok_or(LendingError::MathOverflow)?;

    let receive_amount = liquidity_amount
        .checked_sub(borrow_fee)
        .ok_or(LendingError::MathOverflow)?;

    let borrow_amount_wads = (liquidity_amount as u128)
        .checked_mul(WAD)
        .ok_or(LendingError::MathOverflow)?;

    Ok(CalculateBorrowResult {
        borrow_amount_wads,
        receive_amount,
        borrow_fee,
        host_fee,
        owner_fee,
    })
}

pub fn refresh_obligation_internal(
    obligation: &mut Obligation,
    reserve_accounts: &[AccountInfo],
    clock: &Clock,
) -> Result<()> {
    let expected_reserves = obligation.deposits_len as usize + obligation.borrows_len as usize;
    require!(
        reserve_accounts.len() == expected_reserves,
        LendingError::InvalidReserveCount
    );

    let mut total_deposited_value: u128 = 0;
    let mut total_allowed_borrow_value: u128 = 0;
    let mut total_unhealthy_borrow_value: u128 = 0;
    let mut total_borrowed_value: u128 = 0;

    let mut reserve_index = 0;
    const WAD: u128 = 1_000_000_000_000_000_000;

    for i in 0..obligation.deposits_len as usize {
        let deposit_reserve_info = &reserve_accounts[reserve_index];
        reserve_index += 1;

        let (mut collateral, index) = obligation.find_collateral_by_index(i)?;

        require!(
            deposit_reserve_info.key() == collateral.deposit_reserve,
            LendingError::InvalidReserveForObligation
        );

        let reserve_data = deposit_reserve_info.try_borrow_data()?;
        let mut reserve_data_slice: &[u8] = &reserve_data;
        let deposit_reserve = Reserve::try_deserialize(&mut reserve_data_slice)?;

        require!(
            deposit_reserve.last_update_slot == clock.slot,
            LendingError::ReserveStale
        );

        let liquidity_amount =
            deposit_reserve.collateral_to_liquidity(collateral.deposited_amount)?;

        let decimals = 10u128
            .checked_pow(deposit_reserve.liquidity_mint_decimals as u32)
            .ok_or(LendingError::MathOverflow)?;

        let market_value = (deposit_reserve.liquidity_market_price as u128)
            .checked_mul(liquidity_amount as u128)
            .and_then(|v| v.checked_div(decimals))
            .and_then(|v| v.checked_div(decimals))
            .ok_or(LendingError::MathOverflow)?;

        collateral.market_value = market_value;

        total_deposited_value = total_deposited_value
            .checked_add(market_value)
            .ok_or(LendingError::MathOverflow)?;

        let allowed_value = market_value
            .checked_mul(deposit_reserve.config.loan_to_value_ratio as u128)
            .and_then(|v| v.checked_div(100))
            .ok_or(LendingError::MathOverflow)?;

        total_allowed_borrow_value = total_allowed_borrow_value
            .checked_add(allowed_value)
            .ok_or(LendingError::MathOverflow)?;

        let unhealthy_value = market_value
            .checked_mul(deposit_reserve.config.liquidation_threshold as u128)
            .and_then(|v| v.checked_div(100))
            .ok_or(LendingError::MathOverflow)?;

        total_unhealthy_borrow_value = total_unhealthy_borrow_value
            .checked_add(unhealthy_value)
            .ok_or(LendingError::MathOverflow)?;

        obligation.update_collateral(index, collateral)?;
    }

    for i in 0..obligation.borrows_len as usize {
        let borrow_reserve_info = &reserve_accounts[reserve_index];
        reserve_index += 1;

        let (mut liquidity, index) = obligation.find_liquidity_by_index(i)?;

        require!(
            borrow_reserve_info.key() == liquidity.borrow_reserve,
            LendingError::InvalidReserveForObligation
        );

        let reserve_data = borrow_reserve_info.try_borrow_data()?;
        let mut reserve_data_slice: &[u8] = &reserve_data;
        let borrow_reserve = Reserve::try_deserialize(&mut reserve_data_slice)?;

        require!(
            borrow_reserve.last_update_slot == clock.slot,
            LendingError::ReserveStale
        );

        liquidity.accrue_interest(borrow_reserve.liquidity_cumulative_borrow_rate_wads)?;

        let decimals = 10u128
            .checked_pow(borrow_reserve.liquidity_mint_decimals as u32)
            .ok_or(LendingError::MathOverflow)?;

        let market_value = liquidity
            .borrowed_amount_wads
            .checked_mul(borrow_reserve.liquidity_market_price)
            .and_then(|v| v.checked_div(WAD))
            .and_then(|v| v.checked_div(decimals))
            .and_then(|v| v.checked_div(decimals))
            .ok_or(LendingError::MathOverflow)?;

        liquidity.market_value = market_value;

        total_borrowed_value = total_borrowed_value
            .checked_add(market_value)
            .ok_or(LendingError::MathOverflow)?;

        obligation.update_liquidity(index, liquidity)?;
    }

    obligation.deposited_value = total_deposited_value;
    obligation.borrowed_value = total_borrowed_value;
    obligation.allowed_borrow_value = total_allowed_borrow_value;
    obligation.unhealthy_borrow_value = total_unhealthy_borrow_value;
    obligation.last_update_slot = clock.slot;

    Ok(())
}
