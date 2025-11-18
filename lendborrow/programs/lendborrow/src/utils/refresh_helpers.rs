use crate::errors::LendingError;
use crate::states::{Obligation, ObligationCollateral, ObligationLiquidity, Reserve};
use anchor_lang::prelude::*;

const WAD: u128 = 1_000_000_000_000_000_000;

/// Refreshuje jedan collateral deposit i vraća contribution za totale
pub struct CollateralRefreshResult {
    pub market_value: u128,
    pub allowed_borrow_value: u128,
    pub unhealthy_borrow_value: u128,
}

pub fn refresh_collateral(
    obligation: &mut Obligation,
    collateral_index: usize,
    deposit_reserve: &Reserve,
) -> Result<CollateralRefreshResult> {
    let (mut collateral, index) = obligation.find_collateral_by_index(collateral_index)?;

    // Calculate liquidity amount from collateral
    let liquidity_amount = deposit_reserve.collateral_to_liquidity(collateral.deposited_amount)?;

    // Calculate market value
    let decimals = 10u128
        .checked_pow(deposit_reserve.liquidity_mint_decimals as u32)
        .ok_or(LendingError::MathOverflow)?;

    let market_value = (deposit_reserve.liquidity_market_price as u128)
        .checked_mul(liquidity_amount as u128)
        .and_then(|v| v.checked_div(decimals))
        .and_then(|v| v.checked_div(decimals))
        .ok_or(LendingError::MathOverflow)?;

    // Update collateral with new market value
    collateral.market_value = market_value;

    // Calculate LTV-based allowed borrow value
    let allowed_borrow_value = market_value
        .checked_mul(deposit_reserve.config.loan_to_value_ratio as u128)
        .and_then(|v| v.checked_div(100))
        .ok_or(LendingError::MathOverflow)?;

    // Calculate liquidation threshold-based unhealthy value
    let unhealthy_borrow_value = market_value
        .checked_mul(deposit_reserve.config.liquidation_threshold as u128)
        .and_then(|v| v.checked_div(100))
        .ok_or(LendingError::MathOverflow)?;

    // Save updated collateral
    obligation.update_collateral(index, collateral)?;

    Ok(CollateralRefreshResult {
        market_value,
        allowed_borrow_value,
        unhealthy_borrow_value,
    })
}

/// Refreshuje jedan liquidity borrow i vraća contribution za total borrowed value
pub fn refresh_liquidity(
    obligation: &mut Obligation,
    liquidity_index: usize,
    borrow_reserve: &Reserve,
) -> Result<u128> {
    let (mut liquidity, index) = obligation.find_liquidity_by_index(liquidity_index)?;

    // Accrue interest if rate has changed
    if borrow_reserve.liquidity_cumulative_borrow_rate_wads != liquidity.cumulative_borrow_rate_wads
    {
        let compounded_interest_rate = borrow_reserve
            .liquidity_cumulative_borrow_rate_wads
            .checked_mul(WAD)
            .and_then(|v| v.checked_div(liquidity.cumulative_borrow_rate_wads))
            .ok_or(LendingError::MathOverflow)?;

        let accrued_borrow_amount = liquidity
            .borrowed_amount_wads
            .checked_mul(compounded_interest_rate)
            .and_then(|v| v.checked_div(WAD))
            .ok_or(LendingError::MathOverflow)?;

        liquidity.borrowed_amount_wads = accrued_borrow_amount;
        liquidity.cumulative_borrow_rate_wads =
            borrow_reserve.liquidity_cumulative_borrow_rate_wads;
    }

    // Calculate market value
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

    // Update liquidity with new market value
    liquidity.market_value = market_value;

    // Save updated liquidity
    obligation.update_liquidity(index, liquidity)?;

    Ok(market_value)
}

/// Deserializuje Reserve iz AccountInfo
pub fn deserialize_reserve(account_info: &AccountInfo) -> Result<Reserve> {
    let reserve_data = account_info.try_borrow_data()?;
    let mut reserve_data_slice: &[u8] = &reserve_data;
    Reserve::try_deserialize(&mut reserve_data_slice)
}

/// Verifikuje da li je reserve fresh (updated u trenutnom ili prethodnom slotu)
pub fn verify_reserve_freshness(reserve: &Reserve, current_slot: u64) -> Result<()> {
    require!(
        reserve.last_update_slot >= current_slot.saturating_sub(1),
        LendingError::ReserveStale
    );
    Ok(())
}
