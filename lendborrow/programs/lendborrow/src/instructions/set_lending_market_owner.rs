use anchor_lang::prelude::*;
use crate::states::LendingMarket;
use crate::errors::LendingError;

pub fn handler(
    ctx: Context<SetLendingMarketOwner>,
    new_owner: Pubkey,
) -> Result<()> {
    let lending_market = &mut ctx.accounts.lending_market;
    let current_owner = ctx.accounts.owner.key();

    require!(
        new_owner != current_owner,
        LendingError::SameOwner
    );

    require!(
        new_owner != Pubkey::default(),
        LendingError::InvalidNewOwner
    );

    let old_owner = lending_market.owner;
    
    lending_market.owner = new_owner;

    emit!(LendingMarketOwnerChanged {
        lending_market: lending_market.key(),
        old_owner,
        new_owner,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct SetLendingMarketOwner<'info> {
    #[account(
        mut,
        has_one = owner @ LendingError::InvalidOwner
    )]
    pub lending_market: Account<'info, LendingMarket>,

    pub owner: Signer<'info>,
}

#[event]
pub struct LendingMarketOwnerChanged {
    pub lending_market: Pubkey,
    pub old_owner: Pubkey,
    pub new_owner: Pubkey,
}