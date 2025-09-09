use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

use crate::error::ErrorCode;

pub const DISCRIMINATOR_LENGTH: u64 = 8;

pub fn calculate_discriminator(account_name: &str) -> [u8; 8] {
    let preimage = format!("account:{}", account_name);
    let hash_result = hash(preimage.as_bytes());
    let mut discriminator = [0 as u8; 8];
    discriminator.copy_from_slice(&hash_result.to_bytes()[..8]);
    discriminator
}

pub fn wrap_solana_account(
    solana_account: &AccountInfo,
    before_bytes_length: u64,
    discriminator: [u8; 8],
) -> Result<()> {
    let account_data = solana_account.data.borrow();

    require!(
        (before_bytes_length as usize) <= account_data.len(),
        ErrorCode::InvalidAccountData
    );

    let new_len = DISCRIMINATOR_LENGTH as usize + account_data.len() - before_bytes_length as usize;

    let mut anchor_data = Vec::with_capacity(new_len);
    anchor_data.extend_from_slice(&discriminator);
    anchor_data.extend_from_slice(&account_data[before_bytes_length as usize..]);

    drop(account_data);

    solana_account.resize(new_len)?;
    solana_account.data.borrow_mut().copy_from_slice(&anchor_data);

    Ok(())
}

pub fn unwrap_solana_account(
    solana_account: &AccountInfo,
    before_bytes: Option<Vec<u8>>,
) -> Result<()> {
    let account_data = solana_account.data.borrow();
    let before_bytes_vec = before_bytes.unwrap_or_default();

    let new_len = before_bytes_vec.len() + account_data.len() - DISCRIMINATOR_LENGTH as usize;

    let mut solana_data = Vec::with_capacity(new_len);
    solana_data.extend_from_slice(&before_bytes_vec);
    solana_data.extend_from_slice(&account_data[DISCRIMINATOR_LENGTH as usize..]);

    drop(account_data);

    solana_account.resize(new_len)?;
    solana_account.data.borrow_mut().copy_from_slice(&solana_data);

    Ok(())
}