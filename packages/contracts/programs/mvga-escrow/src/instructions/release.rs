use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked,
    CloseAccount, close_account,
};

use crate::errors::EscrowError;
use crate::state::{EscrowReleased, EscrowState, EscrowStatus};

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    /// Seller confirms they received off-chain payment
    #[account(mut)]
    pub seller: Signer<'info>,

    /// CHECK: Buyer receives the escrowed tokens
    #[account(
        mut,
        constraint = buyer.key() == escrow_state.buyer @ EscrowError::UnauthorizedBuyer,
    )]
    pub buyer: UncheckedAccount<'info>,

    #[account(
        constraint = mint.key() == escrow_state.mint @ EscrowError::InvalidMint,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        close = seller,
        constraint = escrow_state.seller == seller.key() @ EscrowError::UnauthorizedSeller,
        constraint = escrow_state.status == EscrowStatus::PaymentSent @ EscrowError::InvalidStatus,
        seeds = [b"escrow", escrow_state.trade_id.as_ref(), escrow_state.seller.as_ref()],
        bump = escrow_state.bump,
    )]
    pub escrow_state: Account<'info, EscrowState>,

    /// Vault holding the escrowed tokens
    #[account(
        mut,
        token::mint = mint,
        token::authority = escrow_state,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// Buyer's token account to receive funds
    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = buyer,
        associated_token::token_program = token_program,
    )]
    pub buyer_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_release(ctx: Context<ReleaseEscrow>) -> Result<()> {
    let escrow = &ctx.accounts.escrow_state;
    let amount = escrow.amount;
    let decimals = ctx.accounts.mint.decimals;

    // PDA signer seeds for the escrow state (vault authority)
    let trade_id = escrow.trade_id;
    let seller_key = escrow.seller;
    let bump = escrow.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"escrow",
        trade_id.as_ref(),
        seller_key.as_ref(),
        &[bump],
    ]];

    // Transfer tokens from vault to buyer
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.buyer_token_account.to_account_info(),
        authority: ctx.accounts.escrow_state.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
        .with_signer(signer_seeds);
    transfer_checked(cpi_ctx, amount, decimals)?;

    // Close vault account, return rent to seller
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
    escrow.status = EscrowStatus::Released;

    emit!(EscrowReleased {
        trade_id,
        seller: seller_key,
        buyer: ctx.accounts.buyer.key(),
        amount,
    });

    msg!("Escrow released: {} tokens sent to buyer", amount);
    Ok(())
}
