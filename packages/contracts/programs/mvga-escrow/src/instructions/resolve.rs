use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked,
    CloseAccount, close_account,
};

use crate::errors::EscrowError;
use crate::state::{DisputeResolved, EscrowState, EscrowStatus};
use crate::AUTHORIZED_ADMIN;

/// Resolution: 0 = release to buyer, 1 = refund to seller
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Resolution {
    ReleaseToBuyer,
    RefundToSeller,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    /// Admin resolving the dispute
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Seller receives rent refund from vault close
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,

    /// CHECK: Buyer may receive tokens if resolution is ReleaseToBuyer
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,

    #[account(
        constraint = mint.key() == escrow_state.mint @ EscrowError::InvalidMint,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        close = seller,
        constraint = escrow_state.admin == admin.key() @ EscrowError::UnauthorizedAdmin,
        constraint = escrow_state.seller == seller.key() @ EscrowError::UnauthorizedSeller,
        constraint = escrow_state.buyer == buyer.key() @ EscrowError::UnauthorizedBuyer,
        seeds = [b"escrow", escrow_state.trade_id.as_ref(), escrow_state.seller.as_ref()],
        bump = escrow_state.bump,
    )]
    pub escrow_state: Account<'info, EscrowState>,

    /// Vault holding escrowed tokens
    #[account(
        mut,
        token::mint = mint,
        token::authority = escrow_state,
        token::token_program = token_program,
        seeds = [b"vault", escrow_state.key().as_ref()],
        bump,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// Recipient's token account (buyer or seller depending on resolution)
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: The recipient — buyer (ReleaseToBuyer) or seller (RefundToSeller).
    /// Validated in handler logic.
    pub recipient: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_resolve(ctx: Context<ResolveDispute>, resolution: Resolution) -> Result<()> {
    // Redundant admin check — verifies against hardcoded constant, not just stored state
    require!(
        ctx.accounts.admin.key() == AUTHORIZED_ADMIN,
        EscrowError::UnauthorizedAdmin
    );

    let escrow = &ctx.accounts.escrow_state;

    // Admin can only resolve disputed escrows
    require!(
        escrow.status == EscrowStatus::Disputed,
        EscrowError::InvalidStatus
    );

    // Validate recipient matches resolution
    match resolution {
        Resolution::ReleaseToBuyer => {
            require!(
                ctx.accounts.recipient.key() == escrow.buyer,
                EscrowError::UnauthorizedBuyer
            );
        }
        Resolution::RefundToSeller => {
            require!(
                ctx.accounts.recipient.key() == escrow.seller,
                EscrowError::UnauthorizedSeller
            );
        }
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

    // Transfer tokens from vault to recipient
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.vault.to_account_info(),
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: ctx.accounts.escrow_state.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
        .with_signer(signer_seeds);
    transfer_checked(cpi_ctx, amount, decimals)?;

    // Close vault, return rent to seller
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
    escrow.status = match resolution {
        Resolution::ReleaseToBuyer => EscrowStatus::Released,
        Resolution::RefundToSeller => EscrowStatus::Refunded,
    };

    emit!(DisputeResolved {
        trade_id: escrow.trade_id,
        admin: ctx.accounts.admin.key(),
        resolution: resolution as u8,
    });

    msg!("Dispute resolved: {:?}", resolution);
    Ok(())
}
