use anchor_lang::prelude::*;

#[error_code]
pub enum LendingError {
    #[msg("Invalid quote currency format. Must be valid UTF-8 string or non-zero pubkey")]
    InvalidQuoteCurrency, 

    #[msg("Invalid owner. Only the market owner can perform this action")]
    InvalidOwner, 

    #[msg("Market already initialized")]
    MarketAlreadyInitialized,

    #[msg("Invalid amount")]
    InvalidAmount, 

    #[msg("New owner must be different from current owner")]
    SameOwner, 

    #[msg("Invalid new owner. Cannot be default pubkey")]
    InvalidNewOwner, 

    #[msg("Invalid reserve configuration")]
    InvalidReserveConfig, 

    #[msg("Invalid liquidity amount")]
    InvalidLiquidityAmount, 

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

    #[msg("Invalid market")]
    InvalidMarket, 
    #[msg("Invalid collateral supply")]
    InvalidCollateralSupply, 

    #[msg("Withdraw amount is too large")]
    WithdrawTooLarge, 

    #[msg("Withdraw amount is too small")]
    WithdrawTooSmall, 

    #[msg("Obligation collateral is empty")]
    ObligationCollateralEmpty, 

    #[msg("Reserve collateral is disabled")]
    ReserveCollateralDisabled, 

    #[msg("Negative interest rate")]
    NegativeInterestRate, 

    #[msg("Obligation is unhealthy")]
    ObligationUnhealthy, 

    #[msg("Liquidation amount is too small")]
    LiquidationTooSmall, 

    #[msg("Liquidation amount is too large")]
    LiquidationTooLarge, 

    #[msg("Cannot liquidate own obligation")]
    CannotLiquidateOwnObligation, 

    #[msg("Market not initialized")]
    MarketNotInitialized, 

    #[msg("Invalid oracle configuration")]
    InvalidOracleConfig,

    #[msg("Oracle price is stale")]
    OraclePriceStale, 

    #[msg("Oracle price is invalid or negative")]
    OraclePriceInvalid, 

    #[msg("Oracle price confidence interval too wide")]
    OraclePriceConfidenceTooWide, 

    #[msg("Invalid account input")]
    InvalidAccountInput, 

    #[msg("Invalid mint")]
    InvalidMint, 

    #[msg("Insufficient collateral to borrow the requested amount")]
    InsufficientCollateral, 

    #[msg("Borrow amount exceeds reserve liquidity")]
    BorrowExceedsLiquidity, 

    #[msg("Borrow amount exceeds user borrow limit")]
    BorrowExceedsUserLimit, 

    #[msg("Repay amount exceeds user borrow balance")]
    RepayExceedsUserBalance, 

    #[msg("Borrow amount is too large")]
    BorrowTooLarge, 

    #[msg("Borrow amount is too small")]
    BorrowTooSmall, 

    #[msg("Invalid fee receiver")]
    InvalidFeeReceiver, 

    #[msg("Invalid destination account")]
    InvalidDestinationAccount, 

    #[msg("Repay amount is too small")]
    RepayTooSmall,

    #[msg("Obligation liquidity not found")]
    ObligationLiquidityNotFound,

    #[msg("Obligation liquidity is empty")]
    ObligationLiquidityEmpty,

    #[msg("Invalid market authority")]
    InvalidMarketAuthority,

    #[msg("Invalid Token program")]
    InvalidTokenProgram,

    #[msg("Insufficient owner balance")]
    InsufficientOwnerBalance,

    #[msg("Invalid Config")]
    InvalidConfig,

    #[msg("Invalid market owner")]
    InvalidMarketOwner,

}
