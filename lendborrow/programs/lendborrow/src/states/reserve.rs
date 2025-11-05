use anchor_lang::prelude::*;
use super::reserve_config::*;

#[account]
#[derive(InitSpace)] 
pub struct Reserve {
    pub version: u8,
    pub last_update_slot: u64,
    pub lending_market: Pubkey,
    pub liquidity_mint: Pubkey,
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
    
}