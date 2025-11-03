use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod states;

use instructions::*;

declare_id!("BEu3NGWrqp2HX98HMSqSHgmr2d2A8gXHzrJgPtanvK1M");

#[program]
pub mod lendborrow {
    use super::*;

    pub fn init_lending_market(
        ctx: Context<InitLendingMarket>,
        quote_currency: [u8; 32],
    ) -> Result<()> {
        instructions::lending_market_init(ctx, quote_currency)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
