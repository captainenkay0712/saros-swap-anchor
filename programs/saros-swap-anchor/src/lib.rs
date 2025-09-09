pub mod context;
pub mod convert;
pub mod state;
pub mod error;

use anchor_lang::prelude::*;

use crate::context::*;
use crate::state::*;

declare_id!("DWzSYaJwRNeuXMbsGKB59DCkp1QaFjvbv4WcaSNmqu8g");

#[program]
pub mod saros_swap_anchor {
    use super::*;

    pub fn wrap_to_anchor_format<'info>(
        ctx: Context<'_, '_, '_, 'info, ConvertAccount<'info>>,
    ) -> Result<()> {
        convert::wrap_solana_account(
            &ctx.accounts.solana_account,
            1, // skip version byte for SwapV1
            convert::calculate_discriminator("SwapV1"),
        )?;

        // let swap_data = &mut (*ctx.accounts.solana_account.data).borrow_mut();
        // let swap_account = SwapV1::try_from_slice(&swap_data).unwrap();


        // convert::wrap_solana_account(
        //     &ctx.accounts.token_account, 
        //     0, // no init bytes to skip
        //     convert::calculate_discriminator("TokenAccount")
        // )?;

        // let token_data = &mut (*ctx.accounts.token_account.data).borrow_mut();
        // let token_account = TokenAccount::try_from_slice(&token_data).unwrap();

        // convert::wrap_solana_account(
        //     &ctx.accounts.mint_account, 
        //     0,
        //     convert::calculate_discriminator("Mint")
        // )?;

        // println!("SwapV1 is_initialized: {}", swap_account.is_initialized);
        // println!("SwapV1 bump_seed: {}", swap_account.bump_seed);

        println!("✅ Wrap to Anchor format completed");
        
        Ok(())
    }

    pub fn unwrap_to_solana_format<'info>(
        ctx: Context<'_, '_, '_, 'info, ConvertAccount<'info>>,
        init_bytes: Option<Vec<u8>>,
    ) -> Result<()> {
        convert::unwrap_solana_account(&ctx.accounts.solana_account, init_bytes)
    }
}