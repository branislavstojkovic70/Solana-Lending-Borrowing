use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer},
};

use crate::states::{LendingMarket, Reserve, ReserveConfig};
use crate::errors::LendingError;

pub fn handler(
    ctx: Context<InitReserve>,
    liquidity_amount: u64,
    config: ReserveConfig,
) -> Result<()> {
    require!(liquidity_amount > 0, LendingError::InvalidLiquidityAmount);
    
    config.validate()?;

    let reserve = &mut ctx.accounts.reserve;
    let clock = Clock::get()?;

    reserve.version = Reserve::PROGRAM_VERSION;
    reserve.last_update_slot = clock.slot;
    reserve.lending_market = ctx.accounts.lending_market.key();
    reserve.liquidity_mint = ctx.accounts.liquidity_mint.key();
    reserve.liquidity_supply = ctx.accounts.liquidity_supply.key();
    reserve.liquidity_fee_receiver = ctx.accounts.liquidity_fee_receiver.key();
    reserve.liquidity_oracle = ctx.accounts.pyth_price.key();
    reserve.liquidity_available_amount = liquidity_amount;
    reserve.liquidity_borrowed_amount_wads = 0;
    reserve.liquidity_cumulative_borrow_rate_wads = Reserve::INITIAL_BORROW_RATE;
    reserve.liquidity_market_price = 0;
    reserve.collateral_mint = ctx.accounts.collateral_mint.key();
    reserve.collateral_supply = ctx.accounts.collateral_supply.key();
    reserve.collateral_mint_total_supply = 0;
    reserve.config = config;

    let cpi_accounts = Transfer {
        from: ctx.accounts.source_liquidity.to_account_info(),
        to: ctx.accounts.liquidity_supply.to_account_info(),
        authority: ctx.accounts.user_transfer_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    transfer(cpi_ctx, liquidity_amount)?;

    let lending_market_key = ctx.accounts.lending_market.key();
    let authority_bump = ctx.bumps.lending_market_authority;
    let authority_seeds = &[b"authority", lending_market_key.as_ref(), &[authority_bump]];
    let signer_seeds = &[&authority_seeds[..]];

    let cpi_accounts = MintTo {
        mint: ctx.accounts.collateral_mint.to_account_info(),
        to: ctx.accounts.destination_collateral.to_account_info(),
        authority: ctx.accounts.lending_market_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    mint_to(cpi_ctx, liquidity_amount)?;

    reserve.collateral_mint_total_supply = liquidity_amount;

    emit!(ReserveInitialized {
        reserve: reserve.key(),
        lending_market: ctx.accounts.lending_market.key(),
        liquidity_mint: ctx.accounts.liquidity_mint.key(),
        collateral_mint: ctx.accounts.collateral_mint.key(),
        liquidity_amount,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct InitReserve<'info> {
    #[account(mut)]
    pub source_liquidity: Box<Account<'info, TokenAccount>>,

    pub liquidity_mint: Box<Account<'info, Mint>>,

    #[account(has_one = owner @ LendingError::InvalidOwner)]
    pub lending_market: Box<Account<'info, LendingMarket>>,

    /// CHECK: Lending market authority PDA
    #[account(
        seeds = [b"authority", lending_market.key().as_ref()],
        bump
    )]
    pub lending_market_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + Reserve::INIT_SPACE,
        seeds = [
            Reserve::SEED_PREFIX,
            lending_market.key().as_ref(),
            liquidity_mint.key().as_ref(),
        ],
        bump
    )]
    pub reserve: Box<Account<'info, Reserve>>,

    #[account(
        init,
        payer = owner,
        token::mint = liquidity_mint,
        token::authority = lending_market_authority,
        seeds = [
            b"liquidity-supply",
            lending_market.key().as_ref(),
            liquidity_mint.key().as_ref(),
        ],
        bump
    )]
    pub liquidity_supply: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = owner,
        token::mint = liquidity_mint,
        token::authority = lending_market_authority,
        seeds = [
            b"fee-receiver",
            lending_market.key().as_ref(),
            liquidity_mint.key().as_ref(),
        ],
        bump
    )]
    pub liquidity_fee_receiver: Box<Account<'info, TokenAccount>>,

    /// CHECK: Pyth product account (oracle)
    pub pyth_product: UncheckedAccount<'info>,

    /// CHECK: Pyth price account (oracle)
    pub pyth_price: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        mint::decimals = liquidity_mint.decimals,
        mint::authority = lending_market_authority,
        seeds = [
            b"collateral-mint",
            lending_market.key().as_ref(),
            liquidity_mint.key().as_ref(),
        ],
        bump
    )]
    pub collateral_mint: Box<Account<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = collateral_mint,
        associated_token::authority = owner,
    )]
    pub destination_collateral: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = owner,
        token::mint = collateral_mint,
        token::authority = lending_market_authority,
        seeds = [
            b"collateral-supply",
            lending_market.key().as_ref(),
            liquidity_mint.key().as_ref(),
        ],
        bump
    )]
    pub collateral_supply: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub user_transfer_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[event]
pub struct ReserveInitialized {
    pub reserve: Pubkey,
    pub lending_market: Pubkey,
    pub liquidity_mint: Pubkey,
    pub collateral_mint: Pubkey,
    pub liquidity_amount: u64,
}










// use anchor_lang::prelude::*;
// use anchor_spl::{
//     associated_token::AssociatedToken,
//     token::{mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer},
// };

// use crate::states::{LendingMarket, Reserve, ReserveConfig};
// use crate::{errors::LendingError, states::ReserveFees};

// pub fn handler(
//     ctx: Context<InitReserve>,
//     liquidity_amount: u64,
//     _config: ReserveConfig,  // Preimenuj u _config jer ga ne koristiš
// ) -> Result<()> {
//     msg!("⚡️ Initializing reserve...");

//     // Validate liquidity amount
//     require!(liquidity_amount > 0, LendingError::InvalidLiquidityAmount);

//     // Create config directly (ne kopiramo iz parametra)
//     let config = ReserveConfig {
//         optimal_utilization_rate: 80,
//         loan_to_value_ratio: 50,
//         liquidation_bonus: 5,
//         liquidation_threshold: 55,
//         min_borrow_rate: 0,
//         optimal_borrow_rate: 4,
//         max_borrow_rate: 30,
//         fees: ReserveFees {
//             borrow_fee_wad: 10000000000000000,
//             flash_loan_fee_wad: 9000000000000000,
//             host_fee_percentage: 20,
//         },
//     };

//     config.validate()?;

//     let reserve = &mut ctx.accounts.reserve;
//     let clock = Clock::get()?;

//     // Initialize reserve fields directly - bez STEP 1 (bez inicijalizacije na default)
//     msg!("📝 Setting reserve fields...");
    
//     reserve.version = Reserve::PROGRAM_VERSION;
//     reserve.last_update_slot = clock.slot;
//     reserve.lending_market = ctx.accounts.lending_market.key();
//     reserve.liquidity_mint = ctx.accounts.liquidity_mint.key();
//     reserve.liquidity_supply = ctx.accounts.liquidity_supply.key();
//     reserve.liquidity_fee_receiver = ctx.accounts.liquidity_fee_receiver.key();
//     reserve.liquidity_oracle = ctx.accounts.pyth_price.key();
//     reserve.liquidity_available_amount = liquidity_amount;
//     reserve.liquidity_borrowed_amount_wads = 0;
//     reserve.liquidity_cumulative_borrow_rate_wads = Reserve::INITIAL_BORROW_RATE;
//     reserve.liquidity_market_price = 0;
//     reserve.collateral_mint = ctx.accounts.collateral_mint.key();
//     reserve.collateral_supply = ctx.accounts.collateral_supply.key();
//     reserve.collateral_mint_total_supply = 0;
//     reserve.config = config;

//     msg!("✅ All reserve fields set");

//     // Transfer liquidity from user to reserve
//     msg!("📝 Transferring liquidity...");
//     let cpi_accounts = Transfer {
//         from: ctx.accounts.source_liquidity.to_account_info(),
//         to: ctx.accounts.liquidity_supply.to_account_info(),
//         authority: ctx.accounts.user_transfer_authority.to_account_info(),
//     };
//     let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
//     transfer(cpi_ctx, liquidity_amount)?;
//     msg!("✅ Liquidity transferred");

//     // Mint collateral tokens to user
//     msg!("📝 Minting collateral...");
//     let lending_market_key = ctx.accounts.lending_market.key();
//     let authority_bump = ctx.bumps.lending_market_authority;
//     let authority_seeds = &[b"authority", lending_market_key.as_ref(), &[authority_bump]];
//     let signer_seeds = &[&authority_seeds[..]];

//     let cpi_accounts = MintTo {
//         mint: ctx.accounts.collateral_mint.to_account_info(),
//         to: ctx.accounts.destination_collateral.to_account_info(),
//         authority: ctx.accounts.lending_market_authority.to_account_info(),
//     };
//     let cpi_ctx = CpiContext::new_with_signer(
//         ctx.accounts.token_program.to_account_info(),
//         cpi_accounts,
//         signer_seeds,
//     );
//     mint_to(cpi_ctx, liquidity_amount)?;
//     msg!("✅ Collateral minted");

//     // Update total supply
//     reserve.collateral_mint_total_supply = liquidity_amount;

//     // Emit event
//     emit!(ReserveInitialized {
//         reserve: reserve.key(),
//         lending_market: ctx.accounts.lending_market.key(),
//         liquidity_mint: ctx.accounts.liquidity_mint.key(),
//         collateral_mint: ctx.accounts.collateral_mint.key(),
//         liquidity_amount,
//     });

//     msg!("✅ Reserve initialized successfully!");

//     Ok(())
// }

// #[derive(Accounts)]
// pub struct InitReserve<'info> {
//     /// User's source liquidity token account
//     #[account(mut)]
//     pub source_liquidity: Box<Account<'info, TokenAccount>>,

//     /// The liquidity token mint (e.g., USDC)
//     pub liquidity_mint: Box<Account<'info, Mint>>,

//     /// The lending market this reserve belongs to
//     #[account(has_one = owner @ LendingError::InvalidOwner)]
//     pub lending_market: Box<Account<'info, LendingMarket>>,

//     /// CHECK: Lending market authority PDA
//     #[account(
//         seeds = [b"authority", lending_market.key().as_ref()],
//         bump
//     )]
//     pub lending_market_authority: UncheckedAccount<'info>,

//     /// Reserve account to initialize
//     #[account(
//         init,
//         payer = owner,
//         space = 8 + Reserve::INIT_SPACE,
//         seeds = [
//             Reserve::SEED_PREFIX,
//             lending_market.key().as_ref(),
//             liquidity_mint.key().as_ref(),
//         ],
//         bump
//     )]
//     pub reserve: Box<Account<'info, Reserve>>,

//     /// Reserve's liquidity supply token account
//     #[account(
//         init,
//         payer = owner,
//         token::mint = liquidity_mint,
//         token::authority = lending_market_authority,
//         seeds = [
//             b"liquidity-supply",
//             lending_market.key().as_ref(),
//             liquidity_mint.key().as_ref(),
//         ],
//         bump
//     )]
//     pub liquidity_supply: Box<Account<'info, TokenAccount>>,

//     /// Reserve's liquidity fee receiver token account
//     #[account(
//         init,
//         payer = owner,
//         token::mint = liquidity_mint,
//         token::authority = lending_market_authority,
//         seeds = [
//             b"fee-receiver",
//             lending_market.key().as_ref(),
//             liquidity_mint.key().as_ref(),
//         ],
//         bump
//     )]
//     pub liquidity_fee_receiver: Box<Account<'info, TokenAccount>>,

//     /// CHECK: Pyth product account (oracle)
//     pub pyth_product: UncheckedAccount<'info>,

//     /// CHECK: Pyth price account (oracle)
//     pub pyth_price: UncheckedAccount<'info>,

//     /// Reserve's collateral token mint
//     #[account(
//         init,
//         payer = owner,
//         mint::decimals = liquidity_mint.decimals,
//         mint::authority = lending_market_authority,
//         seeds = [
//             b"collateral-mint",
//             lending_market.key().as_ref(),
//             liquidity_mint.key().as_ref(),
//         ],
//         bump
//     )]
//     pub collateral_mint: Box<Account<'info, Mint>>,

//     /// User's destination for collateral tokens
//     #[account(
//         init_if_needed,
//         payer = owner,
//         associated_token::mint = collateral_mint,
//         associated_token::authority = owner,
//     )]
//     pub destination_collateral: Box<Account<'info, TokenAccount>>,

//     /// Reserve's collateral supply token account
//     #[account(
//         init,
//         payer = owner,
//         token::mint = collateral_mint,
//         token::authority = lending_market_authority,
//         seeds = [
//             b"collateral-supply",
//             lending_market.key().as_ref(),
//             liquidity_mint.key().as_ref(),
//         ],
//         bump
//     )]
//     pub collateral_supply: Box<Account<'info, TokenAccount>>,

//     /// Owner/admin of the lending market
//     #[account(mut)]
//     pub owner: Signer<'info>,

//     /// Authority to transfer user's liquidity tokens
//     pub user_transfer_authority: Signer<'info>,

//     /// SPL Token program
//     pub token_program: Program<'info, Token>,
    
//     /// SPL Associated Token program
//     pub associated_token_program: Program<'info, AssociatedToken>,
    
//     /// System program
//     pub system_program: Program<'info, System>,
    
//     /// Rent sysvar
//     pub rent: Sysvar<'info, Rent>,
// }

// #[event]
// pub struct ReserveInitialized {
//     pub reserve: Pubkey,
//     pub lending_market: Pubkey,
//     pub liquidity_mint: Pubkey,
//     pub collateral_mint: Pubkey,
//     pub liquidity_amount: u64,
// }