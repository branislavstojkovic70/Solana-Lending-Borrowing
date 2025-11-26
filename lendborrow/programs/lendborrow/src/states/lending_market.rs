use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct LendingMarket {
    pub owner: Pubkey,
    pub authority: Pubkey,      // ← DODAJ
    pub authority_bump: u8,      // ← DODAJ
    pub version: u64,            // ← Promeni u u64
    pub bump_seed: u8,
    pub quote_currency: [u8; 32],
    pub token_program_id: Pubkey,
}

impl LendingMarket {
    pub const AUTHORITY_SEED: &'static [u8] = b"lending-market-auth";

    pub const PROGRAM_VERSION: u8 = 1;

    pub const SEED_PREFIX: &'static [u8] = b"lending-market";

    pub fn validate_quote_currency(currency: &[u8; 32]) -> bool {
        if let Ok(s) = std::str::from_utf8(currency) {
            let trimmed = s.trim_end_matches('\0');

            if trimmed.is_empty() {
                return false;
            }

            if trimmed.chars().all(|c| c.is_ascii_alphanumeric()) {
                return true;
            }

            return false;
        }

        let non_zero_bytes = currency.iter().filter(|&&b| b != 0).count();

        non_zero_bytes >= 20
    }
}
