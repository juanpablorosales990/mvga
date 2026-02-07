use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("Invalid escrow status for this operation")]
    InvalidStatus,
    #[msg("Unauthorized: only the seller can perform this action")]
    UnauthorizedSeller,
    #[msg("Unauthorized: only the buyer can perform this action")]
    UnauthorizedBuyer,
    #[msg("Unauthorized: only the admin can perform this action")]
    UnauthorizedAdmin,
    #[msg("Escrow has not timed out yet")]
    NotTimedOut,
    #[msg("Escrow amount must be greater than zero")]
    ZeroAmount,
    #[msg("Timeout duration must be greater than zero")]
    ZeroTimeout,
    #[msg("Invalid dispute resolution: must be 'release' or 'refund'")]
    InvalidResolution,
}
