use anchor_lang::prelude::*;

use crate::errors::EscrowError;
use crate::state::{EscrowState, EscrowStatus};

#[derive(Accounts)]
pub struct FileDispute<'info> {
    /// Either buyer or seller can file a dispute
    pub disputer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow_state.trade_id.as_ref(), escrow_state.seller.as_ref()],
        bump = escrow_state.bump,
    )]
    pub escrow_state: Account<'info, EscrowState>,
}

pub fn handle_dispute(ctx: Context<FileDispute>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow_state;
    let disputer = ctx.accounts.disputer.key();

    // Only buyer or seller can dispute
    require!(
        disputer == escrow.buyer || disputer == escrow.seller,
        EscrowError::UnauthorizedBuyer
    );

    // Can only dispute from Locked or PaymentSent
    require!(
        escrow.status == EscrowStatus::Locked || escrow.status == EscrowStatus::PaymentSent,
        EscrowError::InvalidStatus
    );

    escrow.status = EscrowStatus::Disputed;

    msg!("Dispute filed by {}", disputer);
    Ok(())
}
