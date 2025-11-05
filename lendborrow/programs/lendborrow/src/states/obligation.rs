// states/obligation.rs
use anchor_lang::prelude::*;

pub const MAX_OBLIGATION_RESERVES: usize = 10;

#[account]
#[derive(InitSpace)]
pub struct Obligation {
    pub version: u8,
    pub last_update_slot: u64,
    pub lending_market: Pubkey,
    pub owner: Pubkey,
    pub deposited_value: u128,
    pub borrowed_value: u128,
    pub allowed_borrow_value: u128,
    pub unhealthy_borrow_value: u128,
    pub deposits_len: u8,
    pub borrows_len: u8,
    #[max_len(896)] 
    pub data_flat: Vec<u8>,
}

impl Obligation {
    pub const PROGRAM_VERSION: u8 = 1;
    pub const SEED_PREFIX: &'static [u8] = b"obligation";
    
    pub fn add_collateral(&mut self, collateral: ObligationCollateral) -> Result<()> {
        require!(
            (self.deposits_len as usize + self.borrows_len as usize) < MAX_OBLIGATION_RESERVES,
            crate::errors::LendingError::ObligationReserveLimit
        );
        
        let mut collateral_bytes = Vec::new();
        collateral.serialize(&mut collateral_bytes)?;
        self.data_flat.extend_from_slice(&collateral_bytes);
        
        self.deposits_len = self.deposits_len.checked_add(1).unwrap();
        Ok(())
    }
    
    pub fn add_liquidity(&mut self, liquidity: ObligationLiquidity) -> Result<()> {
        require!(
            (self.deposits_len as usize + self.borrows_len as usize) < MAX_OBLIGATION_RESERVES,
            crate::errors::LendingError::ObligationReserveLimit
        );
        
        let mut liquidity_bytes = Vec::new();
        liquidity.serialize(&mut liquidity_bytes)?;
        self.data_flat.extend_from_slice(&liquidity_bytes);
        
        self.borrows_len = self.borrows_len.checked_add(1).unwrap();
        Ok(())
    }
    
    pub fn find_collateral(&self, deposit_reserve: Pubkey) -> Option<(ObligationCollateral, usize)> {
        let mut offset = 0;
        
        for i in 0..self.deposits_len as usize {
            if offset + ObligationCollateral::LEN > self.data_flat.len() {
                return None;
            }
            
            let collateral_slice = &self.data_flat[offset..offset + ObligationCollateral::LEN];
            if let Ok(collateral) = ObligationCollateral::deserialize(&mut &collateral_slice[..]) {
                if collateral.deposit_reserve == deposit_reserve {
                    return Some((collateral, i));
                }
            }
            offset += ObligationCollateral::LEN;
        }
        
        None
    }
    
    pub fn find_liquidity(&self, borrow_reserve: Pubkey) -> Option<(ObligationLiquidity, usize)> {
        let mut offset = self.deposits_len as usize * ObligationCollateral::LEN;
        
        for i in 0..self.borrows_len as usize {
            if offset + ObligationLiquidity::LEN > self.data_flat.len() {
                return None;
            }
            
            let liquidity_slice = &self.data_flat[offset..offset + ObligationLiquidity::LEN];
            if let Ok(liquidity) = ObligationLiquidity::deserialize(&mut &liquidity_slice[..]) {
                if liquidity.borrow_reserve == borrow_reserve {
                    return Some((liquidity, i));
                }
            }
            offset += ObligationLiquidity::LEN;
        }
        
        None
    }
    
    pub fn find_collateral_by_index(&self, index: usize) -> Result<(ObligationCollateral, usize)> {
        require!(
            index < self.deposits_len as usize,
            crate::errors::LendingError::InvalidObligationIndex
        );
        
        let offset = index * ObligationCollateral::LEN;
        require!(
            offset + ObligationCollateral::LEN <= self.data_flat.len(),
            crate::errors::LendingError::InvalidObligationData
        );
        
        let collateral_slice = &self.data_flat[offset..offset + ObligationCollateral::LEN];
        let collateral = ObligationCollateral::deserialize(&mut &collateral_slice[..])?;
        
        Ok((collateral, index))
    }
    
    pub fn find_liquidity_by_index(&self, index: usize) -> Result<(ObligationLiquidity, usize)> {
        require!(
            index < self.borrows_len as usize,
            crate::errors::LendingError::InvalidObligationIndex
        );
        
        let offset = (self.deposits_len as usize * ObligationCollateral::LEN) 
            + (index * ObligationLiquidity::LEN);
        require!(
            offset + ObligationLiquidity::LEN <= self.data_flat.len(),
            crate::errors::LendingError::InvalidObligationData
        );
        
        let liquidity_slice = &self.data_flat[offset..offset + ObligationLiquidity::LEN];
        let liquidity = ObligationLiquidity::deserialize(&mut &liquidity_slice[..])?;
        
        Ok((liquidity, index))
    }
    
    pub fn update_collateral(&mut self, index: usize, collateral: ObligationCollateral) -> Result<()> {
        let offset = index * ObligationCollateral::LEN;
        let mut collateral_bytes = Vec::new();
        collateral.serialize(&mut collateral_bytes)?;
        
        self.data_flat[offset..offset + ObligationCollateral::LEN]
            .copy_from_slice(&collateral_bytes);
        
        Ok(())
    }
    
    pub fn update_liquidity(&mut self, index: usize, liquidity: ObligationLiquidity) -> Result<()> {
        let offset = (self.deposits_len as usize * ObligationCollateral::LEN) 
            + (index * ObligationLiquidity::LEN);
        let mut liquidity_bytes = Vec::new();
        liquidity.serialize(&mut liquidity_bytes)?;
        
        self.data_flat[offset..offset + ObligationLiquidity::LEN]
            .copy_from_slice(&liquidity_bytes);
        
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub struct ObligationCollateral {
    pub deposit_reserve: Pubkey,
    pub deposited_amount: u64,
    pub market_value: u128,
}

impl ObligationCollateral {
    pub const LEN: usize = 32 + 8 + 16;
    
    pub fn new(deposit_reserve: Pubkey) -> Self {
        Self {
            deposit_reserve,
            deposited_amount: 0,
            market_value: 0,
        }
    }
    
    pub fn deposit(&mut self, collateral_amount: u64) -> Result<()> {
        self.deposited_amount = self
            .deposited_amount
            .checked_add(collateral_amount)
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        Ok(())
    }
    
    pub fn withdraw(&mut self, collateral_amount: u64) -> Result<()> {
        self.deposited_amount = self
            .deposited_amount
            .checked_sub(collateral_amount)
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub struct ObligationLiquidity {
    pub borrow_reserve: Pubkey,
    pub cumulative_borrow_rate_wads: u128,
    pub borrowed_amount_wads: u128,
    pub market_value: u128,
}

impl ObligationLiquidity {
    pub const LEN: usize = 32 + 16 + 16 + 16;
    pub const INITIAL_BORROW_RATE: u128 = 1_000_000_000_000_000_000;
    
    pub fn new(borrow_reserve: Pubkey) -> Self {
        Self {
            borrow_reserve,
            cumulative_borrow_rate_wads: Self::INITIAL_BORROW_RATE,
            borrowed_amount_wads: 0,
            market_value: 0,
        }
    }
    
    pub fn borrow(&mut self, borrow_amount: u128) -> Result<()> {
        self.borrowed_amount_wads = self
            .borrowed_amount_wads
            .checked_add(borrow_amount)
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        Ok(())
    }
    
    pub fn repay(&mut self, repay_amount: u128) -> Result<()> {
        self.borrowed_amount_wads = self
            .borrowed_amount_wads
            .checked_sub(repay_amount)
            .ok_or(crate::errors::LendingError::MathOverflow)?;
        Ok(())
    }
}