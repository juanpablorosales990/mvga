use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use instructions::resolve::Resolution;

declare_id!("EscrowProgramIDPlaceholder1111111111111111111");

#[program]
pub mod mvga_escrow {
    use super::*;

    /// Seller locks tokens into a PDA-controlled vault.
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        trade_id: [u8; 16],
        amount: u64,
        timeout_seconds: u64,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, trade_id, amount, timeout_seconds)
    }

    /// Buyer marks that off-chain payment has been sent.
    pub fn mark_paid(ctx: Context<MarkPaid>) -> Result<()> {
        instructions::mark_paid::handler(ctx)
    }

    /// Seller confirms receipt of off-chain payment → tokens released to buyer.
    pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
        instructions::release::handler(ctx)
    }

    /// Seller self-refunds after timeout (status must be Locked, timeout elapsed).
    pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
        instructions::refund::handler(ctx)
    }

    /// Either buyer or seller files a dispute.
    pub fn file_dispute(ctx: Context<FileDispute>) -> Result<()> {
        instructions::dispute::handler(ctx)
    }

    /// Admin resolves a dispute — releases to buyer or refunds to seller.
    pub fn resolve_dispute(ctx: Context<ResolveDispute>, resolution: Resolution) -> Result<()> {
        instructions::resolve::handler(ctx, resolution)
    }
}
