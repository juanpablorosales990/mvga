use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked,
    CloseAccount, close_account,
};

use crate::errors::EscrowError;
use crate::state::{EscrowState, EscrowStatus};

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    /// Seller requesting the refund (must be the original seller)
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        constraint = mint.key() == escrow_state.mint @ EscrowError::InvalidMint,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = escrow_state.seller == seller.key() @ EscrowError::UnauthorizedSeller,
        seeds = [b"escrow", escrow_state.trade_id.as_ref(), escrow_state.seller.as_ref()],
        bump = escrow_state.bump,
    )]
    pub escrow_state: Account<'info, EscrowState>,

    /// Vault holding escrowed tokens
    #[account(
        mut,
        token::mint = mint,
        token::authority = escrow_state,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// Seller's token account to receive refund
    #[account(
        mut,
        token::mint = mint,
        token::authority = seller,
    )]
    pub seller_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_refund(ctx: Context<RefundEscrow>) -> Result<()> {
    let escrow = &ctx.accounts.escrow_state;

    // Seller can only self-refund if status is Locked AND timeout has elapsed
    match escrow.status {
        EscrowStatus::Locked => {
            let clock = Clock::get()?;
            let deadline = escrow
                .locked_at
                .checked_add(escrow.timeout_seconds as i64)
                .ok_or(EscrowError::TimeoutOverflow)?;
            require!(clock.unix_timestamp >= deadline, EscrowError::NotTimedOut);
        }
        // Disputed status refund is handled by resolve_dispute (admin only)
        _ => return Err(EscrowError::InvalidStatus.into()),
    }

    let amount = escrow.amount;
    let decimals = ctx.accounts.mint.decimals;

    let trade_id = escrow.trade_id;
    let seller_key = escrow.seller;
    let bump = escrow.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"escrow",
        trade_id.as_ref(),
        seller_key.as_ref(),
        &[bump],
    ]];

    // Transfer tokens from vault back to seller
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.seller_token_account.to_account_info(),
        authority: ctx.accounts.escrow_state.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
        .with_signer(signer_seeds);
    transfer_checked(cpi_ctx, amount, decimals)?;

    // Close vault account
    let close_accounts = CloseAccount {
        account: ctx.accounts.vault.to_account_info(),
        destination: ctx.accounts.seller.to_account_info(),
        authority: ctx.accounts.escrow_state.to_account_info(),
    };
    let close_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), close_accounts)
        .with_signer(signer_seeds);
    close_account(close_ctx)?;

    // Update status
    let escrow = &mut ctx.accounts.escrow_state;
    escrow.status = EscrowStatus::Refunded;

    msg!("Escrow refunded: {} tokens returned to seller", amount);
    Ok(())
}
