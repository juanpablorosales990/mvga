/**
 * Upgrade the MVGA escrow program on Solana devnet through a Squads v4 multisig.
 *
 * Usage:
 *   npx ts-node scripts/upgrade-program.ts
 *
 * Prerequisites:
 *   - Built program binary at packages/contracts/target/deploy/mvga_escrow.so
 *   - Deployer keypair at ~/.config/solana/mvga-deployer.json
 *   - Member 2 keypair at scripts/squad-member-2.json
 *   - Program upgrade authority already transferred to Squads Vault 0
 *
 * Flow:
 *   1. Write new program buffer using `solana program write-buffer`
 *   2. Set buffer authority to Squads Vault 0
 *   3. Create a vault transaction with the BPF Upgradeable Loader Upgrade ix
 *   4. Create proposal + deployer (member 1) approves
 *   5. Member 2 approves (reaching 2-of-3 threshold)
 *   6. Execute the vault transaction
 */

import * as multisig from '@sqds/multisig';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  TransactionMessage,
} from '@solana/web3.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ── Constants ────────────────────────────────────────────────────────────────

const PROGRAM_ID = new PublicKey('6GXdYCDckUVEFBaQSgfQGX95gZSNN7FWN19vRDSyTJ5E');
const MULTISIG_PDA = new PublicKey('26Q5NhhNSC4HoDpAZkixcpYEynWgLr5vsYsQiZThC5M3');
const VAULT_INDEX = 0;

// BPF Upgradeable Loader program ID
const BPF_LOADER_UPGRADEABLE = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

// Upgrade instruction discriminator (variant index 3 in BPF Upgradeable Loader)
// https://docs.rs/solana-program/latest/solana_program/bpf_loader_upgradeable/enum.UpgradeableLoaderInstruction.html
const UPGRADE_INSTRUCTION_DISCRIMINATOR = Buffer.alloc(4);
UPGRADE_INSTRUCTION_DISCRIMINATOR.writeUInt32LE(3, 0);

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_SO_PATH = path.resolve('packages/contracts/target/deploy/mvga_escrow.so');

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadKeypair(filePath: string): Keypair {
  const resolved = filePath.startsWith('~')
    ? path.join(process.env.HOME!, filePath.slice(1))
    : path.resolve(filePath);
  const secret = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function confirm(connection: Connection, signature: string): Promise<void> {
  const result = await connection.confirmTransaction(signature, 'confirmed');
  if (result.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(result.value.err)}`);
  }
}

/**
 * Build the BPF Upgradeable Loader "Upgrade" instruction.
 *
 * Accounts (in order):
 *   0. [w]   programData   — PDA derived from program ID
 *   1. [w]   program       — the program account
 *   2. [w]   buffer        — the new buffer with updated bytecode
 *   3. [w]   spillAccount  — receives leftover lamports from old buffer
 *   4. []    rent sysvar
 *   5. []    clock sysvar
 *   6. [s]   upgradeAuthority — must sign (Squads vault in our case)
 */
function buildUpgradeInstruction(
  programId: PublicKey,
  bufferPubkey: PublicKey,
  upgradeAuthority: PublicKey,
  spillAccount: PublicKey
): TransactionInstruction {
  // programData PDA: seeds = [programId], program = BPF_LOADER_UPGRADEABLE
  const [programDataPda] = PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    BPF_LOADER_UPGRADEABLE
  );

  return new TransactionInstruction({
    programId: BPF_LOADER_UPGRADEABLE,
    keys: [
      { pubkey: programDataPda, isSigner: false, isWritable: true },
      { pubkey: programId, isSigner: false, isWritable: true },
      { pubkey: bufferPubkey, isSigner: false, isWritable: true },
      { pubkey: spillAccount, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: upgradeAuthority, isSigner: true, isWritable: false },
    ],
    data: UPGRADE_INSTRUCTION_DISCRIMINATOR,
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');

  // Load keypairs
  const deployer = loadKeypair('~/.config/solana/mvga-deployer.json');
  const member2 = loadKeypair('scripts/squad-member-2.json');

  console.log('=== MVGA Escrow Program Upgrade via Squads Multisig ===\n');
  console.log('Program ID:     ', PROGRAM_ID.toBase58());
  console.log('Multisig PDA:   ', MULTISIG_PDA.toBase58());
  console.log('Deployer:       ', deployer.publicKey.toBase58());
  console.log('Member 2:       ', member2.publicKey.toBase58());
  console.log('RPC:            ', RPC_URL);
  console.log('Program binary: ', PROGRAM_SO_PATH);
  console.log('');

  // Verify binary exists
  if (!fs.existsSync(PROGRAM_SO_PATH)) {
    console.error(`ERROR: Program binary not found at ${PROGRAM_SO_PATH}`);
    console.error('Run `anchor build` in packages/contracts first.');
    process.exit(1);
  }

  const binarySize = fs.statSync(PROGRAM_SO_PATH).size;
  console.log(`Binary size: ${(binarySize / 1024).toFixed(1)} KB`);

  // Check deployer balance
  const balance = await connection.getBalance(deployer.publicKey);
  console.log(`Deployer balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  if (balance < 2 * LAMPORTS_PER_SOL) {
    console.error(
      'WARNING: Low balance. Buffer upload requires ~2-5 SOL depending on binary size.'
    );
  }
  console.log('');

  // Derive Vault 0 PDA
  const [vault0] = multisig.getVaultPda({
    multisigPda: MULTISIG_PDA,
    index: VAULT_INDEX,
  });
  console.log('Vault 0 (upgrade authority):', vault0.toBase58());

  // ── Step 1: Write program buffer ──────────────────────────────────────────

  console.log('\n--- Step 1: Writing program buffer ---');
  console.log('Running: solana program write-buffer ...');

  const deployerKeyPath = path.resolve(process.env.HOME!, '.config/solana/mvga-deployer.json');

  // Use solana CLI to write buffer (handles chunking automatically)
  const writeBufferOutput = execSync(
    `solana program write-buffer "${PROGRAM_SO_PATH}" ` +
      `--keypair "${deployerKeyPath}" ` +
      `--url "${RPC_URL}" ` +
      `--output json`,
    { encoding: 'utf-8', timeout: 300_000 } // 5 min timeout — large binaries take time
  );

  // Parse the buffer address from JSON output
  let bufferAddress: string;
  try {
    const parsed = JSON.parse(writeBufferOutput);
    bufferAddress = parsed.buffer || parsed.Buffer;
    if (!bufferAddress) {
      // Fallback: try to extract from non-JSON output
      throw new Error('No buffer field in JSON');
    }
  } catch {
    // solana CLI sometimes outputs plain text like "Buffer: <address>"
    const match =
      writeBufferOutput.match(/Buffer:\s*(\w+)/i) ||
      writeBufferOutput.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);
    if (!match) {
      console.error('Failed to parse buffer address from output:', writeBufferOutput);
      process.exit(1);
    }
    bufferAddress = match[1];
  }

  const bufferPubkey = new PublicKey(bufferAddress);
  console.log('Buffer written:', bufferPubkey.toBase58());

  // ── Step 2: Set buffer authority to Squads Vault 0 ─────────────────────────

  console.log('\n--- Step 2: Setting buffer authority to Vault 0 ---');

  execSync(
    `solana program set-buffer-authority "${bufferPubkey.toBase58()}" ` +
      `--new-buffer-authority "${vault0.toBase58()}" ` +
      `--keypair "${deployerKeyPath}" ` +
      `--url "${RPC_URL}"`,
    { encoding: 'utf-8', stdio: 'inherit', timeout: 60_000 }
  );

  console.log('Buffer authority set to:', vault0.toBase58());

  // ── Step 3: Read multisig state to get next transaction index ──────────────

  console.log('\n--- Step 3: Fetching multisig state ---');

  const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
    connection,
    MULTISIG_PDA
  );

  // transactionIndex is a bignum — next index is current + 1
  const currentIndex =
    typeof multisigAccount.transactionIndex === 'number'
      ? BigInt(multisigAccount.transactionIndex)
      : BigInt(multisigAccount.transactionIndex.toString());
  const transactionIndex = currentIndex + 1n;

  console.log('Current transaction index:', currentIndex.toString());
  console.log('New transaction index:    ', transactionIndex.toString());

  // ── Step 4: Create vault transaction with Upgrade instruction ──────────────

  console.log('\n--- Step 4: Creating vault transaction ---');

  // Build the BPF Upgrade instruction
  // spillAccount receives leftover lamports from the old buffer — deployer is fine
  const upgradeIx = buildUpgradeInstruction(
    PROGRAM_ID,
    bufferPubkey,
    vault0, // upgrade authority = vault PDA (signer via Squads)
    deployer.publicKey // spill account
  );

  // Wrap into a TransactionMessage (this is what the vault will execute)
  const upgradeMessage = new TransactionMessage({
    payerKey: vault0,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [upgradeIx],
  });

  const vtSig = await multisig.rpc.vaultTransactionCreate({
    connection,
    feePayer: deployer,
    multisigPda: MULTISIG_PDA,
    transactionIndex,
    creator: deployer.publicKey,
    vaultIndex: VAULT_INDEX,
    ephemeralSigners: 0,
    transactionMessage: upgradeMessage,
    memo: 'Upgrade MVGA escrow program',
  });

  await confirm(connection, vtSig);
  console.log('Vault transaction created:', vtSig);

  // ── Step 5: Create proposal + Member 1 (deployer) approves ─────────────────

  console.log('\n--- Step 5: Creating proposal + deployer approval ---');

  // Create proposal (not as draft — immediately active)
  const proposalSig = await multisig.rpc.proposalCreate({
    connection,
    feePayer: deployer,
    creator: deployer,
    multisigPda: MULTISIG_PDA,
    transactionIndex,
    isDraft: false, // active immediately
  });

  await confirm(connection, proposalSig);
  console.log('Proposal created:', proposalSig);

  // Deployer approves
  const approve1Sig = await multisig.rpc.proposalApprove({
    connection,
    feePayer: deployer,
    member: deployer,
    multisigPda: MULTISIG_PDA,
    transactionIndex,
  });

  await confirm(connection, approve1Sig);
  console.log('Deployer approved:', approve1Sig);

  // ── Step 6: Member 2 approves (reaching 2-of-3 threshold) ─────────────────

  console.log('\n--- Step 6: Member 2 approval (threshold reached) ---');

  const approve2Sig = await multisig.rpc.proposalApprove({
    connection,
    feePayer: deployer, // deployer pays fees
    member: member2,
    multisigPda: MULTISIG_PDA,
    transactionIndex,
  });

  await confirm(connection, approve2Sig);
  console.log('Member 2 approved:', approve2Sig);

  // ── Step 7: Execute the vault transaction ──────────────────────────────────

  console.log('\n--- Step 7: Executing upgrade transaction ---');

  const executeSig = await multisig.rpc.vaultTransactionExecute({
    connection,
    feePayer: deployer,
    multisigPda: MULTISIG_PDA,
    transactionIndex,
    member: deployer.publicKey,
    signers: [deployer],
    sendOptions: { skipPreflight: true }, // upgrade txs can be complex for preflight
  });

  await confirm(connection, executeSig);
  console.log('Transaction executed:', executeSig);

  // ── Done ───────────────────────────────────────────────────────────────────

  console.log('\n=== UPGRADE COMPLETE ===');
  console.log('Program:          ', PROGRAM_ID.toBase58());
  console.log('Buffer used:      ', bufferPubkey.toBase58());
  console.log('Transaction index:', transactionIndex.toString());
  console.log('Execute signature:', executeSig);
  console.log('');
  console.log('Verify with:');
  console.log(`  solana program show ${PROGRAM_ID.toBase58()} --url ${RPC_URL}`);
}

main().catch((err) => {
  console.error('\nUpgrade failed:', err);
  process.exit(1);
});
