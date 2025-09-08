use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

pub fn calculate_discriminator(account_name: &str) -> [u8; 8] {
    let preimage = format!("account:{}", account_name);
    let hash_result = hash(preimage.as_bytes());
    let mut discriminator = [0 as u8; 8];
    discriminator.copy_from_slice(&hash_result.to_bytes()[..8]);
    discriminator
}

pub fn pack_to_anchor_format(
    solana_account: &AccountInfo,
    init_bytes_length: u64,
    discriminator: [u8; 8],
) -> Vec<u8> {
    let account_data = solana_account.data.borrow();
    let mut anchor_data = Vec::with_capacity(8 + account_data.len() - init_bytes_length as usize);
    
    anchor_data.extend_from_slice(&discriminator);
    
    if account_data.len() > 1 {
        anchor_data.extend_from_slice(&account_data[1..]);
    }
    
    anchor_data
}

pub fn pack_to_anchor_format_auto_discriminator(
    solana_account: &AccountInfo,
    init_bytes_length: u64,
    account_name: &str,
) -> Vec<u8> {
    pack_to_anchor_format(solana_account, init_bytes_length, calculate_discriminator(account_name))
}

pub fn unpack_from_anchor_format(
    anchor_account: &AccountInfo,
    init_bytes: Option<Vec<u8>>,
) -> Vec<u8> {
    let anchor_account_data = anchor_account.data.borrow();
    let mut solana_data = Vec::with_capacity(init_bytes.as_ref().map_or(0, |v| v.len()) + anchor_account_data.len() - 8);
    
    solana_data.extend_from_slice(&init_bytes.unwrap_or_default());
    
    if anchor_account_data.len() > 8 {
        solana_data.extend_from_slice(&anchor_account_data[8..]);
    }
    
    solana_data
}
