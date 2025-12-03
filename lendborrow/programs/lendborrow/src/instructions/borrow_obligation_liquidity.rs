use crate::errors::LendingError;
use crate::states::{LendingMarket, Obligation, Reserve};
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

pub fn handler(ctx: Context<BorrowObligationLiquidity>, liquidity_amount: u64) -> Result<()> {
    require!(liquidity_amount > 0, LendingError::InvalidAmount);

    let obligation = &mut ctx.accounts.obligation;
    let borrow_reserve = &mut ctx.accounts.borrow_reserve;
    let clock = Clock::get()?;

    require!(
        !obligation.last_update_slot != clock.slot, 
        LendingError::ObligationStale
    );

    require!(
        !borrow_reserve.is_stale(clock.slot)?, 
        LendingError::ReserveStale
    );

    require!(
        obligation.deposits_len > 0,
        LendingError::ObligationDepositsEmpty
    );

    require!(
        obligation.deposited_value > 0,
        LendingError::ObligationDepositsZero
    );

    let remaining_borrow_value = obligation.remaining_borrow_value()?;
    require!(
        remaining_borrow_value > 0, 
        LendingError::BorrowTooLarge
    );

    let borrow_result = calculate_borrow(
        borrow_reserve, 
        liquidity_amount, 
        remaining_borrow_value
    )?;

    require!(
        borrow_result.receive_amount > 0,
        LendingError::BorrowTooSmall
    );

    borrow_reserve.liquidity_borrowed_amount_wads = borrow_reserve
        .liquidity_borrowed_amount_wads
        .checked_add(borrow_result.borrow_amount_wads)
        .ok_or(LendingError::MathOverflow)?;

    borrow_reserve.liquidity_available_amount = borrow_reserve
        .liquidity_available_amount
        .checked_sub(liquidity_amount)
        .ok_or(LendingError::InsufficientLiquidity)?;

    borrow_reserve.mark_stale();

    let borrow_index = obligation.find_or_add_liquidity(borrow_reserve.key())?;
    let (mut liquidity, _) = obligation.find_liquidity_by_index(borrow_index)?;

    liquidity.borrow(borrow_result.borrow_amount_wads)?;
    
    if liquidity.cumulative_borrow_rate_wads == 0 {
        liquidity.cumulative_borrow_rate_wads = 
            borrow_reserve.liquidity_cumulative_borrow_rate_wads;
    }
    
    obligation.update_liquidity(borrow_index, liquidity)?;


    let expected_deposits = obligation.deposits_len as usize;
    let expected_borrows = obligation.borrows_len as usize;
    let expected_total = expected_deposits + expected_borrows;

    require!(
        ctx.remaining_accounts.len() == expected_total,
        LendingError::InvalidReserveCount
    );

    refresh_obligation_internal(obligation, ctx.remaining_accounts, &clock)?;

    obligation.verify_healthy()?;

    let lending_market_key = ctx.accounts.lending_market.key();
    let authority_bump = ctx.bumps.lending_market_authority;
    let authority_seeds = &[b"authority", lending_market_key.as_ref(), &[authority_bump]];
    let signer_seeds = &[&authority_seeds[..]];

    if borrow_result.owner_fee > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.source_liquidity.to_account_info(),
                    to: ctx.accounts.borrow_reserve_liquidity_fee_receiver.to_account_info(),
                    authority: ctx.accounts.lending_market_authority.to_account_info(),
                },
                signer_seeds,
            ),
            borrow_result.owner_fee,
        )?;
    }

    if borrow_result.host_fee > 0 {
        if let Some(host_fee_receiver) = &ctx.accounts.host_fee_receiver {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.source_liquidity.to_account_info(),
                        to: host_fee_receiver.to_account_info(),
                        authority: ctx.accounts.lending_market_authority.to_account_info(),
                    },
                    signer_seeds,
                ),
                borrow_result.host_fee,
            )?;
        }
    }

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.source_liquidity.to_account_info(),
                to: ctx.accounts.destination_liquidity.to_account_info(),
                authority: ctx.accounts.lending_market_authority.to_account_info(),
            },
            signer_seeds,
        ),
        borrow_result.receive_amount,
    )?;

    emit!(LiquidityBorrowed {
        obligation: obligation.key(),
        reserve: borrow_reserve.key(),
        liquidity_amount,
        borrow_amount_wads: borrow_result.borrow_amount_wads,
        receive_amount: borrow_result.receive_amount,
        borrow_fee: borrow_result.borrow_fee,
        host_fee: borrow_result.host_fee,
        owner_fee: borrow_result.owner_fee, 
        owner: ctx.accounts.obligation_owner.key(),
        slot: clock.slot,
    });

    msg!(
        "Borrowed {} tokens: receive={}, fee={} (owner={}, host={})",
        liquidity_amount,
        borrow_result.receive_amount,
        borrow_result.borrow_fee,
        borrow_result.owner_fee,
        borrow_result.host_fee
    );

    Ok(())
}


#[derive(Debug)]
pub struct CalculateBorrowResult {
    pub borrow_amount_wads: u128,
    pub receive_amount: u64,
    pub borrow_fee: u64,
    pub host_fee: u64,
    pub owner_fee: u64,
}

fn calculate_borrow(
    reserve: &Reserve,
    liquidity_amount: u64,
    remaining_borrow_value: u128,
) -> Result<CalculateBorrowResult> {
    require!(
        reserve.liquidity_available_amount >= liquidity_amount,
        LendingError::InsufficientLiquidity
    );

    const WAD: u128 = 1_000_000_000_000_000_000;

    let decimals = 10u128
        .checked_pow(reserve.liquidity_mint_decimals as u32)
        .ok_or(LendingError::MathOverflow)?;

    let borrow_value = (liquidity_amount as u128)
        .checked_mul(reserve.liquidity_market_price)
        .and_then(|v| v.checked_div(decimals)) 
        .ok_or(LendingError::MathOverflow)?;

    require!(
        borrow_value <= remaining_borrow_value,
        LendingError::BorrowTooLarge
    );

    let borrow_fee_wad = reserve.config.fees.borrow_fee_wad;
    let borrow_fee = (liquidity_amount as u128)
        .checked_mul(borrow_fee_wad as u128)
        .and_then(|v| v.checked_div(WAD))
        .ok_or(LendingError::MathOverflow)? as u64;

    let host_fee = (borrow_fee as u128)
        .checked_mul(reserve.config.fees.host_fee_percentage as u128)
        .and_then(|v| v.checked_div(100))
        .ok_or(LendingError::MathOverflow)? as u64;

    let owner_fee = borrow_fee
        .checked_sub(host_fee)
        .ok_or(LendingError::MathOverflow)?;

    let receive_amount = liquidity_amount
        .checked_sub(borrow_fee)
        .ok_or(LendingError::MathOverflow)?;

    let borrow_amount_wads = (liquidity_amount as u128)
        .checked_mul(WAD)
        .ok_or(LendingError::MathOverflow)?;

    Ok(CalculateBorrowResult {
        borrow_amount_wads,
        receive_amount,
        borrow_fee,
        host_fee,
        owner_fee,
    })
}

fn refresh_obligation_internal(
    obligation: &mut Obligation,
    reserve_accounts: &[AccountInfo],
    clock: &Clock,
) -> Result<()> {
    let expected_reserves = obligation.deposits_len as usize + obligation.borrows_len as usize;
    require!(
        reserve_accounts.len() == expected_reserves,
        LendingError::InvalidReserveCount
    );

    let mut total_deposited_value: u128 = 0;
    let mut total_allowed_borrow_value: u128 = 0;
    let mut total_unhealthy_borrow_value: u128 = 0;
    let mut total_borrowed_value: u128 = 0;

    const WAD: u128 = 1_000_000_000_000_000_000;

    for i in 0..obligation.deposits_len as usize {
        let deposit_reserve_info = &reserve_accounts[i];
        let (mut collateral, index) = obligation.find_collateral_by_index(i)?;

        require!(
            deposit_reserve_info.key() == collateral.deposit_reserve,
            LendingError::InvalidReserveForObligation
        );

        let reserve_data = deposit_reserve_info.try_borrow_data()?;
        let mut reserve_data_slice: &[u8] = &reserve_data;
        let deposit_reserve = Reserve::try_deserialize(&mut reserve_data_slice)?;

        require!(
            !deposit_reserve.is_stale(clock.slot)?,
            LendingError::ReserveStale
        );

        let liquidity_amount =
            deposit_reserve.collateral_to_liquidity(collateral.deposited_amount)?;

        let decimals = 10u128
            .checked_pow(deposit_reserve.liquidity_mint_decimals as u32)
            .ok_or(LendingError::MathOverflow)?;

        let market_value = (deposit_reserve.liquidity_market_price as u128)
            .checked_mul(liquidity_amount as u128)
            .and_then(|v| v.checked_div(decimals)) // ✅ FIXED: Only one division
            .ok_or(LendingError::MathOverflow)?;

        collateral.market_value = market_value;

        total_deposited_value = total_deposited_value
            .checked_add(market_value)
            .ok_or(LendingError::MathOverflow)?;

        let allowed_value = market_value
            .checked_mul(deposit_reserve.config.loan_to_value_ratio as u128)
            .and_then(|v| v.checked_div(100))
            .ok_or(LendingError::MathOverflow)?;

        total_allowed_borrow_value = total_allowed_borrow_value
            .checked_add(allowed_value)
            .ok_or(LendingError::MathOverflow)?;

        let unhealthy_value = market_value
            .checked_mul(deposit_reserve.config.liquidation_threshold as u128)
            .and_then(|v| v.checked_div(100))
            .ok_or(LendingError::MathOverflow)?;

        total_unhealthy_borrow_value = total_unhealthy_borrow_value
            .checked_add(unhealthy_value)
            .ok_or(LendingError::MathOverflow)?;

        obligation.update_collateral(index, collateral)?;
    }

    let borrow_reserves_start = obligation.deposits_len as usize;

    for i in 0..obligation.borrows_len as usize {
        let borrow_reserve_info = &reserve_accounts[borrow_reserves_start + i];
        let (mut liquidity, index) = obligation.find_liquidity_by_index(i)?;

        require!(
            borrow_reserve_info.key() == liquidity.borrow_reserve,
            LendingError::InvalidReserveForObligation
        );

        let reserve_data = borrow_reserve_info.try_borrow_data()?;
        let mut reserve_data_slice: &[u8] = &reserve_data;
        let borrow_reserve = Reserve::try_deserialize(&mut reserve_data_slice)?;

        require!(
            !borrow_reserve.is_stale(clock.slot)?,
            LendingError::ReserveStale
        );

        liquidity.accrue_interest(borrow_reserve.liquidity_cumulative_borrow_rate_wads)?;

        let decimals = 10u128
            .checked_pow(borrow_reserve.liquidity_mint_decimals as u32)
            .ok_or(LendingError::MathOverflow)?;

        let market_value = liquidity
            .borrowed_amount_wads
            .checked_mul(borrow_reserve.liquidity_market_price)
            .and_then(|v| v.checked_div(WAD))
            .and_then(|v| v.checked_div(decimals)) // ✅ FIXED: Only one division
            .ok_or(LendingError::MathOverflow)?;

        liquidity.market_value = market_value;

        total_borrowed_value = total_borrowed_value
            .checked_add(market_value)
            .ok_or(LendingError::MathOverflow)?;

        obligation.update_liquidity(index, liquidity)?;
    }
    
    obligation.deposited_value = total_deposited_value;
    obligation.borrowed_value = total_borrowed_value;
    obligation.allowed_borrow_value = total_allowed_borrow_value;
    obligation.unhealthy_borrow_value = total_unhealthy_borrow_value;
    obligation.last_update_slot = clock.slot;

    Ok(())
}

#[derive(Accounts)]
pub struct BorrowObligationLiquidity<'info> {
    #[account(
        mut,
        constraint = source_liquidity.key() == borrow_reserve.liquidity_supply 
            @ LendingError::InvalidLiquiditySupply,
    )]
    pub source_liquidity: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = destination_liquidity.owner == obligation_owner.key()
            @ LendingError::InvalidDestinationAccount,
        constraint = destination_liquidity.mint == borrow_reserve.liquidity_mint
            @ LendingError::InvalidMint, // ✅ ADDED
    )]
    pub destination_liquidity: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = borrow_reserve.lending_market == lending_market.key() 
            @ LendingError::InvalidLendingMarket,
    )]
    pub borrow_reserve: Box<Account<'info, Reserve>>,

    #[account(
        mut,
        constraint = borrow_reserve_liquidity_fee_receiver.key() 
            == borrow_reserve.liquidity_fee_receiver 
            @ LendingError::InvalidFeeReceiver,
    )]
    pub borrow_reserve_liquidity_fee_receiver: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = obligation.owner == obligation_owner.key() 
            @ LendingError::InvalidObligationOwner,
        constraint = obligation.lending_market == lending_market.key() 
            @ LendingError::InvalidLendingMarket,
        seeds = [
            Obligation::SEED_PREFIX,
            lending_market.key().as_ref(),
            obligation_owner.key().as_ref(),
        ],
        bump
    )]
    pub obligation: Box<Account<'info, Obligation>>,

    pub lending_market: Box<Account<'info, LendingMarket>>,

    /// CHECK: Lending market authority PDA
    #[account(
        seeds = [b"authority", lending_market.key().as_ref()],
        bump
    )]
    pub lending_market_authority: UncheckedAccount<'info>,

    pub obligation_owner: Signer<'info>,

    /// CHECK: Optional host fee receiver (validated if present)
    pub host_fee_receiver: Option<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[event]
pub struct LiquidityBorrowed {
    pub obligation: Pubkey,
    pub reserve: Pubkey,
    pub liquidity_amount: u64,
    pub borrow_amount_wads: u128,
    pub receive_amount: u64,
    pub borrow_fee: u64,
    pub host_fee: u64,
    pub owner_fee: u64, 
    pub owner: Pubkey,
    pub slot: u64,
}