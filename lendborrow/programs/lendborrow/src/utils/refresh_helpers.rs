// states/obligation_helpers.rs
use crate::errors::LendingError;
use crate::states::{Obligation, Reserve};
use anchor_lang::prelude::*;

const WAD: u128 = 1_000_000_000_000_000_000;

pub struct CollateralRefreshResult {
    pub market_value: u128,
    pub allowed_borrow_value: u128,
    pub unhealthy_borrow_value: u128,
}

/// Refresh a single collateral position in an obligation
pub fn refresh_collateral(
    obligation: &mut Obligation,
    collateral_index: usize,
    deposit_reserve: &Reserve,
) -> Result<CollateralRefreshResult> {
    // Get mutable reference to collateral
    let (mut collateral, index) = obligation.find_collateral_by_index(collateral_index)?;

    // Verify reserve is not stale
    let clock = Clock::get()?;
    require!(
        !deposit_reserve.is_stale(clock.slot)?,
        LendingError::ReserveStale
    );

    // Convert collateral to liquidity amount
    let liquidity_amount = deposit_reserve.collateral_to_liquidity(collateral.deposited_amount)?;

    // Calculate decimals for price normalization
    let decimals = 10u128
        .checked_pow(deposit_reserve.liquidity_mint_decimals as u32)
        .ok_or(LendingError::MathOverflow)?;

    // Calculate market value (price * amount / decimals)
    let market_value = deposit_reserve
        .liquidity_market_price
        .checked_mul(liquidity_amount as u128)
        .and_then(|v| v.checked_div(decimals))
        .ok_or(LendingError::MathOverflow)?;

    // Update collateral market value
    collateral.market_value = market_value;

    // Calculate allowed borrow value (market_value * LTV)
    let allowed_borrow_value = market_value
        .checked_mul(deposit_reserve.config.loan_to_value_ratio as u128)
        .and_then(|v| v.checked_div(100))
        .ok_or(LendingError::MathOverflow)?;

    // Calculate liquidation threshold value
    let unhealthy_borrow_value = market_value
        .checked_mul(deposit_reserve.config.liquidation_threshold as u128)
        .and_then(|v| v.checked_div(100))
        .ok_or(LendingError::MathOverflow)?;

    // Update collateral in obligation
    obligation.update_collateral(index, collateral)?;

    msg!(
        "Refreshed collateral {}: value=${}, LTV=${}, threshold=${}",
        index,
        market_value,
        allowed_borrow_value,
        unhealthy_borrow_value
    );

    Ok(CollateralRefreshResult {
        market_value,
        allowed_borrow_value,
        unhealthy_borrow_value,
    })
}

/// Refresh a single liquidity (borrow) position in an obligation
pub fn refresh_liquidity(
    obligation: &mut Obligation,
    liquidity_index: usize,
    borrow_reserve: &Reserve,
) -> Result<u128> {
    // Get mutable reference to liquidity
    let (mut liquidity, index) = obligation.find_liquidity_by_index(liquidity_index)?;

    // Verify reserve is not stale
    let clock = Clock::get()?;
    require!(
        !borrow_reserve.is_stale(clock.slot)?,
        LendingError::ReserveStale
    );

    // Accrue interest if cumulative rate has changed
    if borrow_reserve.liquidity_cumulative_borrow_rate_wads
        != liquidity.cumulative_borrow_rate_wads
    {
        // Calculate compound interest multiplier
        let compounded_interest_rate = borrow_reserve
            .liquidity_cumulative_borrow_rate_wads
            .checked_mul(WAD)
            .and_then(|v| v.checked_div(liquidity.cumulative_borrow_rate_wads))
            .ok_or(LendingError::MathOverflow)?;

        // Apply compound interest to borrowed amount
        let accrued_borrow_amount = liquidity
            .borrowed_amount_wads
            .checked_mul(compounded_interest_rate)
            .and_then(|v| v.checked_div(WAD))
            .ok_or(LendingError::MathOverflow)?;

        msg!(
            "Accrued interest on borrow: {} -> {} WADs",
            liquidity.borrowed_amount_wads,
            accrued_borrow_amount
        );

        // Update borrowed amount and cumulative rate
        liquidity.borrowed_amount_wads = accrued_borrow_amount;
        liquidity.cumulative_borrow_rate_wads =
            borrow_reserve.liquidity_cumulative_borrow_rate_wads;
    }

    // Calculate decimals for price normalization
    let decimals = 10u128
        .checked_pow(borrow_reserve.liquidity_mint_decimals as u32)
        .ok_or(LendingError::MathOverflow)?;

    // Calculate market value (borrowed_amount * price / decimals)
    let market_value = liquidity
        .borrowed_amount_wads
        .checked_mul(borrow_reserve.liquidity_market_price)
        .and_then(|v| v.checked_div(WAD))
        .and_then(|v| v.checked_div(decimals))
        .ok_or(LendingError::MathOverflow)?;

    // Update liquidity market value
    liquidity.market_value = market_value;

    // Update liquidity in obligation
    obligation.update_liquidity(index, liquidity)?;

    msg!(
        "Refreshed liquidity {}: borrowed_wads={}, value=${}",
        index,
        liquidity.borrowed_amount_wads,
        market_value
    );

    Ok(market_value)
}

/// Deserialize reserve from AccountInfo (helper for CPI contexts)
pub fn deserialize_reserve(account_info: &AccountInfo) -> Result<Reserve> {
    let reserve_data = account_info.try_borrow_data()?;
    let mut reserve_data_slice: &[u8] = &reserve_data;
    Reserve::try_deserialize(&mut reserve_data_slice)
}

/// Verify reserve is fresh (updated recently)
pub fn verify_reserve_freshness(reserve: &Reserve, current_slot: u64) -> Result<()> {
    // Allow 1 slot of staleness for edge cases
    require!(
        reserve.last_update_slot >= current_slot.saturating_sub(1),
        LendingError::ReserveStale
    );
    Ok(())
}

/// Batch refresh all collaterals in an obligation
/// 
/// # Arguments
/// * `obligation` - The obligation to refresh
/// * `deposit_reserves` - Array of reserves matching obligation.deposits order
/// 
/// # Returns
/// Tuple of (total_market_value, total_allowed_borrow, total_unhealthy_threshold)
pub fn refresh_all_collaterals(
    obligation: &mut Obligation,
    deposit_reserves: &[Reserve],
) -> Result<(u128, u128, u128)> {
    // ✅ FIXED: Use deposits_len instead of .len()
    require!(
        obligation.deposits_len as usize == deposit_reserves.len(),
        LendingError::InvalidAccountInput
    );

    let mut total_market_value = 0u128;
    let mut total_allowed_borrow = 0u128;
    let mut total_unhealthy_threshold = 0u128;

    // Iterate up to deposits_len
    for index in 0..obligation.deposits_len as usize {
        let reserve = &deposit_reserves[index];
        let result = refresh_collateral(obligation, index, reserve)?;
        
        total_market_value = total_market_value
            .checked_add(result.market_value)
            .ok_or(LendingError::MathOverflow)?;
        
        total_allowed_borrow = total_allowed_borrow
            .checked_add(result.allowed_borrow_value)
            .ok_or(LendingError::MathOverflow)?;
        
        total_unhealthy_threshold = total_unhealthy_threshold
            .checked_add(result.unhealthy_borrow_value)
            .ok_or(LendingError::MathOverflow)?;
    }

    msg!(
        "Refreshed {} collaterals: total_value=${}, allowed_borrow=${}, threshold=${}",
        obligation.deposits_len,
        total_market_value,
        total_allowed_borrow,
        total_unhealthy_threshold
    );

    Ok((total_market_value, total_allowed_borrow, total_unhealthy_threshold))
}

/// Batch refresh all borrows in an obligation
/// 
/// # Arguments
/// * `obligation` - The obligation to refresh
/// * `borrow_reserves` - Array of reserves matching obligation.borrows order
/// 
/// # Returns
/// Total borrowed value across all positions
pub fn refresh_all_borrows(
    obligation: &mut Obligation,
    borrow_reserves: &[Reserve],
) -> Result<u128> {
    // ✅ FIXED: Use borrows_len instead of .len()
    require!(
        obligation.borrows_len as usize == borrow_reserves.len(),
        LendingError::InvalidAccountInput
    );

    let mut total_borrowed_value = 0u128;

    // Iterate up to borrows_len
    for index in 0..obligation.borrows_len as usize {
        let reserve = &borrow_reserves[index];
        let market_value = refresh_liquidity(obligation, index, reserve)?;
        
        total_borrowed_value = total_borrowed_value
            .checked_add(market_value)
            .ok_or(LendingError::MathOverflow)?;
    }

    msg!(
        "Refreshed {} borrows: total_value=${}",
        obligation.borrows_len,
        total_borrowed_value
    );

    Ok(total_borrowed_value)
}

/// Complete refresh of an obligation (all deposits + all borrows)
/// Updates obligation's aggregated values
pub fn refresh_obligation_complete(
    obligation: &mut Obligation,
    deposit_reserves: &[Reserve],
    borrow_reserves: &[Reserve],
) -> Result<()> {
    // Refresh all collaterals
    let (deposited_value, allowed_borrow_value, unhealthy_borrow_value) =
        refresh_all_collaterals(obligation, deposit_reserves)?;

    // Refresh all borrows
    let borrowed_value = refresh_all_borrows(obligation, borrow_reserves)?;

    // Update obligation aggregated values
    obligation.deposited_value = deposited_value;
    obligation.allowed_borrow_value = allowed_borrow_value;
    obligation.unhealthy_borrow_value = unhealthy_borrow_value;
    obligation.borrowed_value = borrowed_value;

    // Update last refresh slot
    let clock = Clock::get()?;
    obligation.last_update_slot = clock.slot;

    msg!(
        "Obligation fully refreshed: deposits=${}, borrows=${}, health={}%",
        deposited_value,
        borrowed_value,
        if deposited_value > 0 {
            borrowed_value
                .checked_mul(100)
                .and_then(|v| v.checked_div(deposited_value))
                .unwrap_or(0)
        } else {
            0
        }
    );

    Ok(())
}