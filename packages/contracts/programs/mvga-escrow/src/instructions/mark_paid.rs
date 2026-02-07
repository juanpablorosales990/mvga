use anchor_lang::prelude::*;

use crate::errors::EscrowError;
use crate::state::{EscrowState, EscrowStatus, PaymentMarked};

#[derive(Accounts)]
pub struct MarkPaid<'info> {
    /// Buyer who marks the off-chain payment as sent
    pub buyer: Signer<'info>,

    /// Escrow state — must be in Locked status
    #[account(
        mut,
        constraint = escrow_state.buyer == buyer.key() @ EscrowError::UnauthorizedBuyer,
        constraint = escrow_state.status == EscrowStatus::Locked @ EscrowError::InvalidStatus,
        seeds = [b"escrow", escrow_state.trade_id.as_ref(), escrow_state.seller.as_ref()],
        bump = escrow_state.bump,
    )]
    pub escrow_state: Account<'info, EscrowState>,
}

pub fn handle_mark_paid(ctx: Context<MarkPaid>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow_state;
    escrow.status = EscrowStatus::PaymentSent;

    emit!(PaymentMarked {
        trade_id: escrow.trade_id,
        buyer: ctx.accounts.buyer.key(),
    });

    msg!("Buyer marked payment as sent");
    Ok(())
}
