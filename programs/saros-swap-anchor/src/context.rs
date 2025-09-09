use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ConvertAccount<'info> {
    /// CHECK: Testing
    pub solana_account: AccountInfo<'info>,
    /// CHECK: Testing
    pub token_account: AccountInfo<'info>,
    /// CHECK: Testing
    pub mint_account: AccountInfo<'info>,
}