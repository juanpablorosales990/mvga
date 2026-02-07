use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct EscrowState {
    /// Trade UUID (128-bit, matches DB trade ID)
    pub trade_id: [u8; 16],
    /// Seller's public key
    pub seller: Pubkey,
    /// Buyer's public key
    pub buyer: Pubkey,
    /// Token mint (USDC or MVGA)
    pub mint: Pubkey,
    /// Escrowed token amount (raw, in smallest units)
    pub amount: u64,
    /// Current escrow status
    pub status: EscrowStatus,
    /// Admin authority for dispute resolution
    pub admin: Pubkey,
    /// Unix timestamp when escrow was locked
    pub locked_at: i64,
    /// Seconds after which seller can self-refund (e.g. 7200 = 2 hours)
    pub timeout_seconds: u64,
    /// PDA bump seed
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum EscrowStatus {
    /// Funds locked in vault, awaiting buyer's off-chain payment
    Locked,
    /// Buyer has marked off-chain payment as sent
    PaymentSent,
    /// Seller confirmed receipt — funds released to buyer
    Released,
    /// Escrow refunded back to seller
    Refunded,
    /// Under dispute — awaiting admin resolution
    Disputed,
}

// ─── Events ────────────────────────────────────────────────────────────

#[event]
pub struct EscrowInitialized {
    pub trade_id: [u8; 16],
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub timeout_seconds: u64,
}

#[event]
pub struct PaymentMarked {
    pub trade_id: [u8; 16],
    pub buyer: Pubkey,
}

#[event]
pub struct EscrowReleased {
    pub trade_id: [u8; 16],
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowRefunded {
    pub trade_id: [u8; 16],
    pub seller: Pubkey,
    pub amount: u64,
}

#[event]
pub struct DisputeFiled {
    pub trade_id: [u8; 16],
    pub disputer: Pubkey,
}

#[event]
pub struct DisputeResolved {
    pub trade_id: [u8; 16],
    pub admin: Pubkey,
    pub resolution: u8, // 0 = ReleaseToBuyer, 1 = RefundToSeller
}
