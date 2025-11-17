use anchor_lang::prelude::*;
use crate::errors::LendingError;
use crate::states::{Obligation, Reserve,ObligationLiquidity,ObligationCollateral};

#[derive(Debug)]
pub struct LiquidationResult {
    pub settle_amount_wads: u128,
    pub repay_amount: u64,
    pub withdraw_collateral: u64,
}

pub fn calculate_liquidation(
    repay_reserve: &Reserve,
    withdraw_reserve: &Reserve,
    liquidity_amount: u64,
    liquidity: &ObligationLiquidity,
    collateral: &ObligationCollateral,
    obligation: &Obligation,
) -> Result<LiquidationResult> {
    const WAD: u128 = 1_000_000_000_000_000_000;
    const LIQUIDATION_CLOSE_FACTOR_PCT: u128 = 50; // 50% max liquidation

    let max_liquidation_value = obligation
        .borrowed_value
        .checked_mul(LIQUIDATION_CLOSE_FACTOR_PCT)
        .and_then(|v| v.checked_div(100))
        .ok_or(LendingError::MathOverflow)?;

    let repay_amount = liquidity_amount.min(
        liquidity
            .borrowed_amount_wads
            .checked_div(WAD)
            .ok_or(LendingError::MathOverflow)? as u64,
    );

    let settle_amount_wads = (repay_amount as u128)
        .checked_mul(WAD)
        .ok_or(LendingError::MathOverflow)?
        .min(liquidity.borrowed_amount_wads);

    let liquidation_bonus = withdraw_reserve.config.liquidation_bonus as u128;
    let bonus_rate = 100u128
        .checked_add(liquidation_bonus)
        .ok_or(LendingError::MathOverflow)?;

    let repay_value = (repay_amount as u128)
        .checked_mul(repay_reserve.liquidity_market_price)
        .ok_or(LendingError::MathOverflow)?;

    let collateral_value_with_bonus = repay_value
        .checked_mul(bonus_rate)
        .and_then(|v| v.checked_div(100))
        .ok_or(LendingError::MathOverflow)?;

    let withdraw_collateral = if withdraw_reserve.liquidity_market_price > 0 {
        collateral_value_with_bonus
            .checked_div(withdraw_reserve.liquidity_market_price)
            .ok_or(LendingError::MathOverflow)? as u64
    } else {
        return Err(LendingError::InvalidOracleConfig.into());
    };

    let withdraw_collateral = withdraw_collateral.min(collateral.deposited_amount);

    Ok(LiquidationResult {
        settle_amount_wads,
        repay_amount,
        withdraw_collateral,
    })
}
