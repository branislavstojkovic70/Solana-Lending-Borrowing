use anchor_lang::prelude::*;

declare_id!("BEu3NGWrqp2HX98HMSqSHgmr2d2A8gXHzrJgPtanvK1M");

#[program]
pub mod lendborrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
