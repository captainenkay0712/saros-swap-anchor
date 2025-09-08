pub mod convert;

use anchor_lang::prelude::*;

declare_id!("DWzSYaJwRNeuXMbsGKB59DCkp1QaFjvbv4WcaSNmqu8g");

#[event]
pub struct PackResult {
    pub account_name: String,
    pub discriminator: [u8; 8],
    pub packed_data_length: u64,
    pub original_data_length: u64,
}

#[derive(Accounts)]
pub struct ConvertAccount<'info> {
    /// The Solana native account to convert
    /// CHECK: This is a Solana native account
    pub solana_account: AccountInfo<'info>,
}

#[program]
pub mod saros_swap_anchor {
    use super::*;

    pub fn pack_to_anchor_format(
        ctx: Context<ConvertAccount>,
        init_bytes_length: u64,
        account_name: String,
    ) -> Result<Vec<u8>> {
        let result = convert::pack_to_anchor_format_auto_discriminator(&ctx.accounts.solana_account, init_bytes_length, &account_name);
        
        emit!(PackResult {
            account_name: account_name.clone(),
            discriminator: convert::calculate_discriminator(&account_name),
            packed_data_length: result.len() as u64,
            original_data_length: ctx.accounts.solana_account.data_len() as u64,
        });
        
        Ok(result)
    }

    pub fn unpack_from_anchor_format(
        ctx: Context<ConvertAccount>,
    ) -> Result<Vec<u8>> {
        Ok(convert::unpack_from_anchor_format(&ctx.accounts.solana_account, Some(vec![0; 1])))
    }
}