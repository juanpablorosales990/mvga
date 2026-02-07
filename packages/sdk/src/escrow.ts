import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import BN from 'bn.js';

// ---------------------------------------------------------------------------
// Program ID — replace with actual deployed program ID
// ---------------------------------------------------------------------------

export const ESCROW_PROGRAM_ID = new PublicKey(
  process.env.ESCROW_PROGRAM_ID || '6GXdYCDckUVEFBaQSgfQGX95gZSNN7FWN19vRDSyTJ5E'
);

// ---------------------------------------------------------------------------
// Types (mirroring on-chain state)
// ---------------------------------------------------------------------------

export type EscrowStatus = 'locked' | 'paymentSent' | 'released' | 'refunded' | 'disputed';

export interface EscrowAccount {
  tradeId: number[];
  seller: PublicKey;
  buyer: PublicKey;
  mint: PublicKey;
  amount: BN;
  status: EscrowStatus;
  admin: PublicKey;
  lockedAt: BN;
  timeoutSeconds: BN;
  bump: number;
}

export enum Resolution {
  ReleaseToBuyer = 0,
  RefundToSeller = 1,
}

// ---------------------------------------------------------------------------
// PDA derivation helpers
// ---------------------------------------------------------------------------

export function findEscrowPDA(
  tradeId: number[] | Uint8Array,
  seller: PublicKey,
  programId: PublicKey = ESCROW_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), Buffer.from(tradeId), seller.toBuffer()],
    programId
  );
}

export function findVaultPDA(
  escrowState: PublicKey,
  programId: PublicKey = ESCROW_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), escrowState.toBuffer()],
    programId
  );
}

// ---------------------------------------------------------------------------
// Trade ID helper — convert UUID string to 16-byte array
// ---------------------------------------------------------------------------

export function uuidToTradeId(uuid: string): number[] {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) throw new Error('Invalid UUID');
  const bytes: number[] = [];
  for (let i = 0; i < 32; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return bytes;
}

export function tradeIdToUuid(tradeId: number[]): string {
  const hex = tradeId.map((b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

// ---------------------------------------------------------------------------
// Anchor discriminators — first 8 bytes of SHA-256("global:<method_name>")
// Precomputed for each instruction.
// ---------------------------------------------------------------------------

// Discriminators from the generated IDL (packages/contracts/target/idl/mvga_escrow.json).
// These MUST match — if you change instruction names, rebuild with `anchor build` and
// update these from the new IDL.
const DISCRIMINATORS = {
  initializeEscrow: Buffer.from([243, 160, 77, 153, 11, 92, 48, 209]),
  markPaid: Buffer.from([51, 120, 9, 160, 70, 29, 18, 205]),
  releaseEscrow: Buffer.from([146, 253, 129, 233, 20, 145, 181, 206]),
  refundEscrow: Buffer.from([107, 186, 89, 99, 26, 194, 23, 204]),
  fileDispute: Buffer.from([210, 63, 221, 114, 212, 97, 195, 156]),
  resolveDispute: Buffer.from([231, 6, 202, 6, 96, 103, 12, 230]),
};

// ---------------------------------------------------------------------------
// Instruction builders
// ---------------------------------------------------------------------------

/**
 * Build an `initialize_escrow` instruction.
 * Seller locks `amount` tokens into a PDA vault.
 */
export function buildInitializeEscrowIx(params: {
  seller: PublicKey;
  buyer: PublicKey;
  admin: PublicKey;
  mint: PublicKey;
  tradeId: number[];
  amount: BN;
  timeoutSeconds: BN;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId ?? ESCROW_PROGRAM_ID;
  const [escrowState] = findEscrowPDA(params.tradeId, params.seller, programId);
  const [vault] = findVaultPDA(escrowState, programId);
  const sellerAta = getAssociatedTokenAddressSync(params.mint, params.seller);

  // Serialize instruction data: discriminator + trade_id[16] + amount(u64) + timeout(u64)
  const data = Buffer.alloc(8 + 16 + 8 + 8);
  DISCRIMINATORS.initializeEscrow.copy(data, 0);
  Buffer.from(params.tradeId).copy(data, 8);
  data.writeBigUInt64LE(BigInt(params.amount.toString()), 24);
  data.writeBigUInt64LE(BigInt(params.timeoutSeconds.toString()), 32);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.seller, isSigner: true, isWritable: true },
      { pubkey: params.buyer, isSigner: false, isWritable: false },
      { pubkey: params.admin, isSigner: false, isWritable: false },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: escrowState, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: sellerAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Build a `mark_paid` instruction.
 * Buyer signals off-chain payment was sent.
 */
export function buildMarkPaidIx(params: {
  buyer: PublicKey;
  escrowState: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId ?? ESCROW_PROGRAM_ID;

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.buyer, isSigner: true, isWritable: false },
      { pubkey: params.escrowState, isSigner: false, isWritable: true },
    ],
    data: DISCRIMINATORS.markPaid,
  });
}

/**
 * Build a `release_escrow` instruction.
 * Seller confirms off-chain payment received; tokens go to buyer.
 */
export function buildReleaseEscrowIx(params: {
  seller: PublicKey;
  buyer: PublicKey;
  mint: PublicKey;
  escrowState: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId ?? ESCROW_PROGRAM_ID;
  const [vault] = findVaultPDA(params.escrowState, programId);
  const buyerAta = getAssociatedTokenAddressSync(params.mint, params.buyer);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.seller, isSigner: true, isWritable: true },
      { pubkey: params.buyer, isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: params.escrowState, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: buyerAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISCRIMINATORS.releaseEscrow,
  });
}

/**
 * Build a `refund_escrow` instruction.
 * Seller self-refunds after timeout has elapsed.
 */
export function buildRefundEscrowIx(params: {
  seller: PublicKey;
  mint: PublicKey;
  escrowState: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId ?? ESCROW_PROGRAM_ID;
  const [vault] = findVaultPDA(params.escrowState, programId);
  const sellerAta = getAssociatedTokenAddressSync(params.mint, params.seller);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.seller, isSigner: true, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: params.escrowState, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: sellerAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISCRIMINATORS.refundEscrow,
  });
}

/**
 * Build a `file_dispute` instruction.
 * Either buyer or seller can file.
 */
export function buildFileDisputeIx(params: {
  disputer: PublicKey;
  escrowState: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId ?? ESCROW_PROGRAM_ID;

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.disputer, isSigner: true, isWritable: false },
      { pubkey: params.escrowState, isSigner: false, isWritable: true },
    ],
    data: DISCRIMINATORS.fileDispute,
  });
}

/**
 * Build a `resolve_dispute` instruction.
 * Admin resolves — releases to buyer or refunds to seller.
 */
export function buildResolveDisputeIx(params: {
  admin: PublicKey;
  seller: PublicKey;
  buyer: PublicKey;
  mint: PublicKey;
  escrowState: PublicKey;
  resolution: Resolution;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = params.programId ?? ESCROW_PROGRAM_ID;
  const [vault] = findVaultPDA(params.escrowState, programId);

  const recipient = params.resolution === Resolution.ReleaseToBuyer ? params.buyer : params.seller;
  const recipientAta = getAssociatedTokenAddressSync(params.mint, recipient);

  // Serialize: discriminator + resolution enum (1 byte)
  const data = Buffer.alloc(8 + 1);
  DISCRIMINATORS.resolveDispute.copy(data, 0);
  data.writeUInt8(params.resolution, 8);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: params.admin, isSigner: true, isWritable: true },
      { pubkey: params.seller, isSigner: false, isWritable: true },
      { pubkey: params.buyer, isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: params.escrowState, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: recipientAta, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}
