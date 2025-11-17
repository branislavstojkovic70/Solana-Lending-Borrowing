use anchor_lang::prelude::*;

#[error_code]
pub enum LendingError {
    #[msg("Invalid quote currency format. Must be valid UTF-8 string or non-zero pubkey")]
    InvalidQuoteCurrency, // 6000
    
    #[msg("Invalid owner. Only the market owner can perform this action")]
    InvalidOwner, // 6001
    
    #[msg("Market already initialized")]
    MarketAlreadyInitialized, // 6002
    
    #[msg("Invalid amount")]
    InvalidAmount, // 6003
    
    #[msg("New owner must be different from current owner")]
    SameOwner, // 6004
    
    #[msg("Invalid new owner. Cannot be default pubkey")]
    InvalidNewOwner, // 6005
    
    #[msg("Invalid reserve configuration")]
    InvalidReserveConfig, // 6006
    
    #[msg("Invalid liquidity amount")]
    InvalidLiquidityAmount, // 6007
    
    #[msg("Invalid lending market")]
    InvalidLendingMarket, // 6008
    
    #[msg("Invalid liquidity mint")]
    InvalidLiquidityMint, // 6009
    
    #[msg("Invalid liquidity supply")]
    InvalidLiquiditySupply, // 6010
    
    #[msg("Invalid collateral mint")]
    InvalidCollateralMint, // 6011
    
    #[msg("Math overflow")]
    MathOverflow, // 6012
    
    #[msg("Reserve is stale and must be refreshed")]
    ReserveStale, // 6013
    
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity, // 6014
    
    #[msg("Obligation cannot have more than 10 deposits and borrows combined")]
    ObligationReserveLimit, // 6015
    
    #[msg("Obligation has no deposits")]
    ObligationDepositsEmpty, // 6016
    
    #[msg("Obligation has no borrows")]
    ObligationBorrowsEmpty, // 6017
    
    #[msg("Obligation deposits have zero value")]
    ObligationDepositsZero, // 6018
    
    #[msg("Obligation borrows have zero value")]
    ObligationBorrowsZero, // 6019
    
    #[msg("Obligation is healthy and cannot be liquidated")]
    ObligationHealthy, // 6020
    
    #[msg("Obligation is stale and must be refreshed")]
    ObligationStale, // 6021
    
    #[msg("Invalid obligation owner")]
    InvalidObligationOwner, // 6022
    
    #[msg("Invalid obligation collateral")]
    InvalidObligationCollateral, // 6023
    
    #[msg("Invalid obligation liquidity")]
    InvalidObligationLiquidity, // 6024
    
    #[msg("Invalid obligation index")]
    InvalidObligationIndex, // 6025
    
    #[msg("Invalid obligation data")]
    InvalidObligationData, // 6026
    
    #[msg("Invalid reserve count")]
    InvalidReserveCount, // 6027
    
    #[msg("No reserves to refresh")]
    NoReservesToRefresh, // 6028
    
    #[msg("Invalid reserve for obligation")]
    InvalidReserveForObligation, // 6029
    
    #[msg("Invalid market")]
    InvalidMarket, // 6030
    
    #[msg("Invalid collateral supply")]
    InvalidCollateralSupply, // 6031
    
    #[msg("Withdraw amount is too large")]
    WithdrawTooLarge, // 6032
    
    #[msg("Withdraw amount is too small")]
    WithdrawTooSmall, // 6033
    
    #[msg("Obligation collateral is empty")]
    ObligationCollateralEmpty, // 6034
    
    #[msg("Reserve collateral is disabled")]
    ReserveCollateralDisabled, // 6035
    
    #[msg("Negative interest rate")]
    NegativeInterestRate, // 6036
    
    #[msg("Obligation is unhealthy")]
    ObligationUnhealthy, // 6037
    
    #[msg("Liquidation amount is too small")]
    LiquidationTooSmall, // 6038
    
    #[msg("Liquidation amount is too large")]
    LiquidationTooLarge, // 6039
    
    #[msg("Cannot liquidate own obligation")]
    CannotLiquidateOwnObligation, // 6040
    
    #[msg("Market not initialized")]
    MarketNotInitialized, // 6041
    
    #[msg("Invalid oracle configuration")]
    InvalidOracleConfig, // 6042
    
    #[msg("Oracle price is stale")]
    OraclePriceStale, // 6043
    
    #[msg("Oracle price is invalid or negative")]
    OraclePriceInvalid, // 6044
    
    #[msg("Oracle price confidence interval too wide")]
    OraclePriceConfidenceTooWide, // 6045
    
    #[msg("Invalid account input")]
    InvalidAccountInput, // 6046
    
    #[msg("Invalid mint")]
    InvalidMint, // 6047
    
    #[msg("Insufficient collateral to borrow the requested amount")]
    InsufficientCollateral, // 6048
    
    #[msg("Borrow amount exceeds reserve liquidity")]
    BorrowExceedsLiquidity, // 6049
    
    #[msg("Borrow amount exceeds user borrow limit")]
    BorrowExceedsUserLimit, // 6050
    
    #[msg("Repay amount exceeds user borrow balance")]
    RepayExceedsUserBalance, // 6051
    
    #[msg("Borrow amount is too large")]
    BorrowTooLarge, // 6052
    
    #[msg("Borrow amount is too small")]
    BorrowTooSmall, // 6053
    
    #[msg("Invalid fee receiver")]
    InvalidFeeReceiver, // 6054
    
    #[msg("Invalid destination account")]
    InvalidDestinationAccount, // 6055


    #[msg("Repay amount is too small")]
    RepayTooSmall,

    #[msg("Obligation liquidity not found")]
    ObligationLiquidityNotFound,

    #[msg("Obligation liquidity is empty")]
    ObligationLiquidityEmpty,

    #[msg("Invalid market authority")]
    InvalidMarketAuthority,

}
