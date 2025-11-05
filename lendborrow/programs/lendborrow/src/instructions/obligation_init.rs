use anchor_lang::prelude::*;
use crate::states::{LendingMarket, Obligation};
use crate::errors::LendingError;

pub fn handler(ctx: Context<InitObligation>) -> Result<()> {
    let obligation = &mut ctx.accounts.obligation;
    let clock = Clock::get()?;

    obligation.version = Obligation::PROGRAM_VERSION;
    obligation.last_update_slot = clock.slot;
    obligation.lending_market = ctx.accounts.lending_market.key();
    obligation.owner = ctx.accounts.owner.key();
    obligation.deposited_value = 0;
    obligation.borrowed_value = 0;
    obligation.allowed_borrow_value = 0;
    obligation.unhealthy_borrow_value = 0;
    obligation.deposits_len = 0;
    obligation.borrows_len = 0;
    obligation.data_flat = Vec::new();

    emit!(ObligationInitialized {
        obligation: obligation.key(),
        lending_market: ctx.accounts.lending_market.key(),
        owner: ctx.accounts.owner.key(),
        slot: clock.slot,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct InitObligation<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Obligation::INIT_SPACE,
        seeds = [
            Obligation::SEED_PREFIX,
            lending_market.key().as_ref(),
            owner.key().as_ref(),
        ],
        bump
    )]
    pub obligation: Box<Account<'info, Obligation>>,

    pub lending_market: Box<Account<'info, LendingMarket>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,

    pub rent: Sysvar<'info, Rent>,
}

#[event]
pub struct ObligationInitialized {
    pub obligation: Pubkey,
    pub lending_market: Pubkey,
    pub owner: Pubkey,
    pub slot: u64,
}