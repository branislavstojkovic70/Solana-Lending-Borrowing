use anchor_lang::prelude::*;

#[error_code]
pub enum LendingError {
    #[msg("Invalid quote currency format. Must be valid UTF-8 string or non-zero pubkey")]
    InvalidQuoteCurrency,

    #[msg("Invalid owner. Only the market owner can perform this action")]
    InvalidOwner,

    #[msg("Market already initialized")]
    MarketAlreadyInitialized,

    #[msg("Market not initialized")]
    MarketNotInitialized,

    #[msg("New owner must be different from current owner")]
    SameOwner,

    #[msg("Invalid new owner. Cannot be default pubkey")]
    InvalidNewOwner,

    #[msg("Invalid reserve configuration")]
    InvalidReserveConfig, 

    #[msg("Invalid liquidity amount")]
    InvalidLiquidityAmount, 
}
