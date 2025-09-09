use anchor_lang::prelude::*;

#[account]
#[derive(Debug)]
pub struct Fees {
    pub trade_fee_numerator: u64,
    pub trade_fee_denominator: u64,
    pub owner_trade_fee_numerator: u64,
    pub owner_trade_fee_denominator: u64,
    pub owner_withdraw_fee_numerator: u64,
    pub owner_withdraw_fee_denominator: u64,
    pub host_fee_numerator: u64,
    pub host_fee_denominator: u64,
}

#[account]
#[derive(Debug)]
pub struct SwapCurve {
    pub curve_type: u8,
    pub calculator: [u8; 32],
}

#[account]
#[derive(Debug)]
pub struct SwapV1 {
    pub is_initialized: bool,
    pub bump_seed: u8,
    pub token_program_id: Pubkey,
    pub token_a: Pubkey,
    pub token_b: Pubkey,
    pub pool_mint: Pubkey,
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub pool_fee_account: Pubkey,
    pub fees: Fees,
    pub swap_curve: SwapCurve,
}

