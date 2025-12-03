use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
/// Global configuration account for a lending market.
///
/// `LendingMarket` represents a single lending protocol instance on Solana:
/// - defines who controls the market (`owner`),
/// - defines the PDA authority that owns all vaults and mints (`authority`),
/// - stores the program/version metadata,
/// - defines the quote currency (e.g. "USD", "USDC") used for pricing,
/// - stores which token program is used (classic SPL or Token-2022).
pub struct LendingMarket {
    pub owner: Pubkey,
    pub authority: Pubkey,      
    pub authority_bump: u8,      
    pub version: u64,           
    pub bump_seed: u8,
    pub quote_currency: [u8; 32],
    pub token_program_id: Pubkey,
}

impl LendingMarket {
    pub const AUTHORITY_SEED: &'static [u8] = b"lending-market-auth";

    pub const PROGRAM_VERSION: u8 = 1;

    pub const SEED_PREFIX: &'static [u8] = b"lending-market";
    
    /// Validates the `quote_currency` field.
    ///
    /// The function tries two strategies:
    ///
    /// 1. Interpret the bytes as UTF-8:
    ///    - trim trailing `\0` characters,
    ///    - require:
    ///        - non-empty string,
    ///        - all characters are ASCII alphanumeric (A–Z, a–z, 0–9).
    ///
    /// 2. Fallback if UTF-8 fails:
    ///    - count how many bytes are non-zero,
    ///    - consider valid if there are at least 20 non-zero bytes.
    ///
    /// The goal is:
    /// - in the common case, accept clean ASCII identifiers like "USD" / "USDC",
    /// - but still allow a more opaque binary ID if needed, as long as it is
    ///   clearly not "mostly zeroes".
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
