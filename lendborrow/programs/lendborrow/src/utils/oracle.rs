use anchor_lang::prelude::*;
use crate::errors::LendingError;
use crate::states::LendingMarket;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex,PriceUpdateV2};

#[cfg(not(feature = "testing"))]
pub fn validate_pyth_price(
    pyth_price_account: &UncheckedAccount,
    _lending_market: &LendingMarket,
    feed_hex: [u8; 32],
) -> Result<u128> {
    let price_data = pyth_price_account.try_borrow_data()?;
    
    let price_update = PriceUpdateV2::try_deserialize(&mut &price_data[..])
        .map_err(|_| LendingError::InvalidOracleConfig)?;

    let clock = Clock::get()?;
    const MAX_STALENESS: u64 = 60;
    let feed_id = get_feed_id_from_hex(&hex::encode(&feed_hex))?;
    let price = price_update
        .get_price_no_older_than(&clock, MAX_STALENESS, &feed_id)
        .map_err(|_| LendingError::OraclePriceStale)?;

    require!(price.price > 0, LendingError::OraclePriceInvalid);

    let confidence_pct = (price.conf as u128)
        .checked_mul(100)
        .and_then(|v| v.checked_div(price.price.abs() as u128))
        .ok_or(LendingError::MathOverflow)?;
    require!(
        confidence_pct < 5,
        LendingError::OraclePriceConfidenceTooWide
    );

    let price_abs = price.price.abs() as u128;
    let exponent_abs = price.exponent.abs() as u32;
    let pyth_decimals = (10u128)
        .checked_pow(exponent_abs)
        .ok_or(LendingError::MathOverflow)?;

    const BASE_DECIMALS: u128 = 1_000_000;

    let normalized_price = price_abs
        .checked_mul(BASE_DECIMALS)
        .and_then(|v| v.checked_div(pyth_decimals))
        .ok_or(LendingError::MathOverflow)?;

    Ok(normalized_price)
}

pub fn validate_quote_currency_compatibility(
    lending_market: &LendingMarket,
    _feed_id: &[u8; 32],
) -> Result<()> {
    require!(
        lending_market.quote_currency != [0u8; 32],
        LendingError::InvalidOracleConfig
    );

    Ok(())
}