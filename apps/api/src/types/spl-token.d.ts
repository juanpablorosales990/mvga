/**
 * Type augmentation for @solana/spl-token v0.4.x
 *
 * The package uses ESM-style .js extensions in its .d.ts re-exports,
 * which moduleResolution:"node" cannot resolve. These declarations
 * expose the functions that exist at runtime but are invisible to tsc.
 */
declare module '@solana/spl-token' {
  import { PublicKey, TransactionInstruction, Commitment, Connection } from '@solana/web3.js';

  export function getAssociatedTokenAddress(
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve?: boolean,
    programId?: PublicKey,
    associatedTokenProgramId?: PublicKey
  ): Promise<PublicKey>;

  export function createTransferInstruction(
    source: PublicKey,
    destination: PublicKey,
    owner: PublicKey,
    amount: number | bigint,
    multiSigners?: never[],
    programId?: PublicKey
  ): TransactionInstruction;

  export function createBurnInstruction(
    account: PublicKey,
    mint: PublicKey,
    owner: PublicKey,
    amount: number | bigint,
    multiSigners?: never[],
    programId?: PublicKey
  ): TransactionInstruction;

  export function createAssociatedTokenAccountInstruction(
    payer: PublicKey,
    associatedToken: PublicKey,
    owner: PublicKey,
    mint: PublicKey,
    programId?: PublicKey,
    associatedTokenProgramId?: PublicKey
  ): TransactionInstruction;

  export function getAccount(
    connection: Connection,
    address: PublicKey,
    commitment?: Commitment,
    programId?: PublicKey
  ): Promise<{
    address: PublicKey;
    mint: PublicKey;
    owner: PublicKey;
    amount: bigint;
    delegate: PublicKey | null;
    delegatedAmount: bigint;
    isInitialized: boolean;
    isFrozen: boolean;
    isNative: boolean;
    rentExemptReserve: bigint | null;
    closeAuthority: PublicKey | null;
  }>;

  export const TOKEN_PROGRAM_ID: PublicKey;
  export const ASSOCIATED_TOKEN_PROGRAM_ID: PublicKey;
}
