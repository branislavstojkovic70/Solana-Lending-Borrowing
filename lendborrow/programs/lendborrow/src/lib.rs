use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod states;

use instructions::*;
use states::*;

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

    pub fn init_obligation(
        ctx: Context<InitObligation>,
    ) -> Result<()> {
        instructions::obligation_init::handler(ctx)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
