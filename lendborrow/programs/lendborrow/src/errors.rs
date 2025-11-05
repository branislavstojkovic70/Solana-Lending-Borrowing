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

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Invalid lending market")]
    InvalidLendingMarket,

    #[msg("Invalid liquidity mint")]
    InvalidLiquidityMint,

    #[msg("Invalid liquidity supply")]
    InvalidLiquiditySupply,

    #[msg("Invalid collateral mint")]
    InvalidCollateralMint,

    #[msg("Math overflow")]
    MathOverflow,

    #[msg("Reserve is stale and must be refreshed")]
    ReserveStale,

    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,

    #[msg("Obligation cannot have more than 10 deposits and borrows combined")]
    ObligationReserveLimit,

    #[msg("Obligation has no deposits")]
    ObligationDepositsEmpty,

    #[msg("Obligation has no borrows")]
    ObligationBorrowsEmpty,

    #[msg("Obligation deposits have zero value")]
    ObligationDepositsZero,

    #[msg("Obligation borrows have zero value")]
    ObligationBorrowsZero,

    #[msg("Obligation is healthy and cannot be liquidated")]
    ObligationHealthy,

    #[msg("Obligation is stale and must be refreshed")]
    ObligationStale,

    #[msg("Invalid obligation owner")]
    InvalidObligationOwner,

    #[msg("Invalid obligation collateral")]
    InvalidObligationCollateral,

    #[msg("Invalid obligation liquidity")]
    InvalidObligationLiquidity,

    #[msg("Invalid obligation index")]
    InvalidObligationIndex,
    
    #[msg("Invalid obligation data")]
    InvalidObligationData,
    
    #[msg("Invalid reserve count")]
    InvalidReserveCount,
    
    #[msg("No reserves to refresh")]
    NoReservesToRefresh,
    
    #[msg("Invalid reserve for obligation")]
    InvalidReserveForObligation,
    
}
