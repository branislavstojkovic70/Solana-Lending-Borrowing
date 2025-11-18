use anchor_lang::prelude::*;

use crate::{errors::LendingError, states::Reserve};

#[derive(Debug)]
pub struct CalculateRepayResult {
    pub settle_amount_wads: u128,
    pub repay_amount: u64,
}

pub fn calculate_repay(
    reserve: &Reserve,
    liquidity_amount: u64,
    borrowed_amount_wads: u128,
) -> Result<CalculateRepayResult> {
    const WAD: u128 = 1_000_000_000_000_000_000;

    let tokens_needed_for_full_repay = borrowed_amount_wads
        .checked_add(WAD - 1)
        .ok_or(LendingError::MathOverflow)?
        .checked_div(WAD)
        .ok_or(LendingError::MathOverflow)?;

    if liquidity_amount == u64::MAX || (liquidity_amount as u128) >= tokens_needed_for_full_repay {
        let repay_amount = if tokens_needed_for_full_repay > u64::MAX as u128 {
            return Err(LendingError::MathOverflow.into());
        } else {
            tokens_needed_for_full_repay as u64
        };

        return Ok(CalculateRepayResult {
            settle_amount_wads: borrowed_amount_wads,
            repay_amount,
        });
    }

    let repay_amount = liquidity_amount;

    let settle_amount_wads = (repay_amount as u128)
        .checked_mul(WAD)
        .ok_or(LendingError::MathOverflow)?;

    let settle_amount_wads = settle_amount_wads.min(borrowed_amount_wads);

    require!(settle_amount_wads > 0, LendingError::InvalidAmount);

    require!(
        settle_amount_wads <= borrowed_amount_wads,
        LendingError::InvalidAmount
    );

    Ok(CalculateRepayResult {
        settle_amount_wads,
        repay_amount,
    })
}
