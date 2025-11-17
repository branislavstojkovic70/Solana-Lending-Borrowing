use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod states;
pub mod utils;

use instructions::*;
use states::*;
pub use utils::*;
declare_id!("BEu3NGWrqp2HX98HMSqSHgmr2d2A8gXHzrJgPtanvK1M");

#[program]
pub mod lendborrow {
    use crate::states::ReserveConfig;

    use super::*;

    pub fn init_lending_market(
        ctx: Context<InitLendingMarket>,
        quote_currency: [u8; 32],
    ) -> Result<()> {
        instructions::lending_market_init(ctx, quote_currency)
    }

    pub fn set_lending_market_owner(
        ctx: Context<SetLendingMarketOwner>,
        new_owner: Pubkey,
    ) -> Result<()> {
        instructions::set_lending_market_owner::handler(ctx, new_owner)
    }

    pub fn init_reserve(
        ctx: Context<InitReserve>,
        liquidity_amount: u64,
        config: ReserveConfig,
    ) -> Result<()> {
        instructions::reserve_init::handler(ctx, liquidity_amount, config)
    }

    pub fn init_obligation(ctx: Context<InitObligation>) -> Result<()> {
        instructions::obligation_init::handler(ctx)
    }
    pub fn refresh_obligation(ctx: Context<RefreshObligation>) -> Result<()> {
        instructions::refresh_obligation::handler(ctx)
    }

    pub fn deposit_obligation_collateral(
        ctx: Context<DepositObligationCollateral>,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::deposit_obligation_collateral::handler(ctx, collateral_amount)
    }
    pub fn withdraw_obligation_collateral(
        ctx: Context<WithdrawObligationCollateral>,
        collateral_amount: u64,
    ) -> Result<()> {
        instructions::withdraw_obligation_collateral::handler(ctx, collateral_amount)
    }

    pub fn borrow_obligation_liquidity(
        ctx: Context<BorrowObligationLiquidity>,
        liquidity_amount: u64,
    ) -> Result<()> {
        instructions::borrow_obligation_liquidity::handler(ctx, liquidity_amount)
    }

    pub fn refresh_reserve(ctx: Context<RefreshReserve>) -> Result<()> {
        instructions::refresh_reserve::handler(ctx)
    }

    pub fn repay_obligation_liquidity(
        ctx: Context<RepayObligationLiquidity>,
        liquidity_amount: u64,
    ) -> Result<()> {
        instructions::repay_obligation_liquidity::handler(ctx, liquidity_amount)
    }

    pub fn liquidate_obligation(
        ctx: Context<LiquidateObligation>,
        liquidity_amount: u64,
    ) -> Result<()> {
        instructions::liquidate_obligation::handler(ctx, liquidity_amount)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
