// states/reserve.rs
use anchor_lang::prelude::*;
use super::reserve_config::*;

#[account]
#[derive(InitSpace)] 
pub struct Reserve {
    pub version: u8,
    pub last_update_slot: u64,
    pub lending_market: Pubkey,
    pub liquidity_mint: Pubkey,
    pub liquidity_mint_decimals: u8,  // ✅ ADDED!
    pub liquidity_supply: Pubkey,
    pub liquidity_fee_receiver: Pubkey,
    pub liquidity_oracle: Pubkey,
    pub liquidity_available_amount: u64,
    pub liquidity_borrowed_amount_wads: u128,
    pub liquidity_cumulative_borrow_rate_wads: u128,
    pub liquidity_market_price: u128,
    pub collateral_mint: Pubkey,
    pub collateral_supply: Pubkey,
    pub collateral_mint_total_supply: u64,
    pub config: ReserveConfig,
}

impl Reserve {
    pub const PROGRAM_VERSION: u8 = 1;
    pub const SEED_PREFIX: &'static [u8] = b"reserve";
    pub const INITIAL_BORROW_RATE: u128 = 1_000_000_000_000_000_000;
    
    /// Calculate the collateral exchange rate
    /// Returns how much liquidity 1 collateral token is worth
    pub fn collateral_exchange_rate(&self) -> Result<u128> {
        if self.collateral_mint_total_supply == 0 {
            return Ok(Reserve::INITIAL_BORROW_RATE);
        }
        
        // Total liquidity = available + borrowed
        let total_liquidity = self.liquidity_available_amount as u128
            + self.liquidity_borrowed_amount_wads
                .checked_div(Reserve::INITIAL_BORROW_RATE)
                .ok_or(crate::errors::LendingError::MathOverflow)?;
        
        // Exchange rate = total_liquidity / collateral_supply (in WAD precision)
        let exchange_rate = (total_liquidity as u128)
            .checked_mul(Reserve::INITIAL_BORROW_RATE)
            .and_then(|v| v.checked_div(self.collateral_mint_total_supply as u128))
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        
        Ok(exchange_rate)
    }
    
    /// Convert collateral amount to liquidity amount
    pub fn collateral_to_liquidity(&self, collateral_amount: u64) -> Result<u64> {
        let exchange_rate = self.collateral_exchange_rate()?;
        
        let liquidity_amount = (collateral_amount as u128)
            .checked_mul(exchange_rate)
            .and_then(|v| v.checked_div(Reserve::INITIAL_BORROW_RATE))
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        
        Ok(liquidity_amount as u64)
    }
}