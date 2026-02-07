use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked,
};

use crate::errors::EscrowError;
use crate::state::{EscrowState, EscrowStatus};

#[derive(Accounts)]
#[instruction(trade_id: [u8; 16])]
pub struct InitializeEscrow<'info> {
    /// Seller who locks funds into escrow
    #[account(mut)]
    pub seller: Signer<'info>,

    /// Buyer's public key (not a signer — just stored for access control)
    /// CHECK: This is the buyer's pubkey stored in the escrow state. Validated off-chain.
    pub buyer: UncheckedAccount<'info>,

    /// Admin authority for dispute resolution
    /// CHECK: Admin pubkey stored for later dispute resolution. Validated off-chain.
    pub admin: UncheckedAccount<'info>,

    /// Token mint being escrowed
    pub mint: InterfaceAccount<'info, Mint>,

    /// Escrow state PDA
    #[account(
        init,
        payer = seller,
        space = 8 + EscrowState::INIT_SPACE,
        seeds = [b"escrow", trade_id.as_ref(), seller.key().as_ref()],
        bump,
    )]
    pub escrow_state: Account<'info, EscrowState>,

    /// Vault token account owned by the escrow PDA
    #[account(
        init,
        payer = seller,
        token::mint = mint,
        token::authority = escrow_state,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// Seller's token account to transfer from
    #[account(
        mut,
        token::mint = mint,
        token::authority = seller,
    )]
    pub seller_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize(
    ctx: Context<InitializeEscrow>,
    trade_id: [u8; 16],
    amount: u64,
    timeout_seconds: u64,
) -> Result<()> {
    require!(amount > 0, EscrowError::ZeroAmount);
    require!(timeout_seconds > 0, EscrowError::ZeroTimeout);

    let clock = Clock::get()?;

    // Initialize escrow state
    let escrow = &mut ctx.accounts.escrow_state;
    escrow.trade_id = trade_id;
    escrow.seller = ctx.accounts.seller.key();
    escrow.buyer = ctx.accounts.buyer.key();
    escrow.mint = ctx.accounts.mint.key();
    escrow.amount = amount;
    escrow.status = EscrowStatus::Locked;
    escrow.admin = ctx.accounts.admin.key();
    escrow.locked_at = clock.unix_timestamp;
    escrow.timeout_seconds = timeout_seconds;
    escrow.bump = ctx.bumps.escrow_state;

    // Transfer tokens from seller to vault
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.seller_token_account.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.seller.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

    msg!("Escrow initialized: {} tokens locked", amount);
    Ok(())
}
