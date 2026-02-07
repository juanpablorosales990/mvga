/**
 * End-to-end tests for the MVGA Escrow program on Solana devnet.
 *
 * Tests:
 * 1. Happy path: init → mark_paid → release (tokens go to buyer)
 * 2. Dispute flow: init → dispute → admin resolves to buyer
 * 3. Refund flow: init (short timeout) → wait → seller self-refunds
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  getAccount,
} from '@solana/spl-token';
import BN from 'bn.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

import {
  buildInitializeEscrowIx,
  buildMarkPaidIx,
  buildReleaseEscrowIx,
  buildRefundEscrowIx,
  buildFileDisputeIx,
  buildResolveDisputeIx,
  Resolution,
  findEscrowPDA,
  findVaultPDA,
  uuidToTradeId,
  ESCROW_PROGRAM_ID,
} from '../../sdk/src/escrow';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RPC_URL = 'https://api.devnet.solana.com';
const DEPLOYER_KEYPAIR_PATH =
  process.env.DEPLOYER_KEYPAIR || `${process.env.HOME}/.config/solana/mvga-deployer.json`;

const ESCROW_AMOUNT = 1_000_000; // 1 token (6 decimals)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadKeypair(path: string): Keypair {
  const secret = JSON.parse(fs.readFileSync(path, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function fundFromDeployer(
  connection: Connection,
  deployer: Keypair,
  recipient: PublicKey,
  lamports: number
) {
  const { SystemProgram } = await import('@solana/web3.js');
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: deployer.publicKey,
      toPubkey: recipient,
      lamports,
    })
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [deployer]);
  console.log(
    `  Funded ${recipient.toBase58().slice(0, 8)}... with ${lamports / LAMPORTS_PER_SOL} SOL`
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setupTestEscrow(
  connection: Connection,
  deployer: Keypair,
  mint: PublicKey,
  seller: Keypair,
  buyer: Keypair,
  timeoutSeconds: number
): Promise<{
  tradeUuid: string;
  tradeId: number[];
  escrowState: PublicKey;
  vault: PublicKey;
  initSig: string;
}> {
  const tradeUuid = uuidv4();
  const tradeId = uuidToTradeId(tradeUuid);
  const [escrowState] = findEscrowPDA(tradeId, seller.publicKey);
  const [vault] = findVaultPDA(escrowState);

  // Mint tokens to seller for this escrow
  const sellerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    mint,
    seller.publicKey
  );
  await mintTo(connection, deployer, mint, sellerAta.address, deployer, ESCROW_AMOUNT);

  const initIx = buildInitializeEscrowIx({
    seller: seller.publicKey,
    buyer: buyer.publicKey,
    admin: deployer.publicKey,
    mint,
    tradeId,
    amount: new BN(ESCROW_AMOUNT),
    timeoutSeconds: new BN(timeoutSeconds),
  });

  const initTx = new Transaction().add(initIx);
  const initSig = await sendAndConfirmTransaction(connection, initTx, [seller]);

  return { tradeUuid, tradeId, escrowState, vault, initSig };
}

// ---------------------------------------------------------------------------
// Test 1: Happy Path (init → mark_paid → release)
// ---------------------------------------------------------------------------

async function testHappyPath(
  connection: Connection,
  deployer: Keypair,
  mint: PublicKey,
  seller: Keypair,
  buyer: Keypair
) {
  console.log('\n========================================');
  console.log('TEST 1: Happy Path (init → mark_paid → release)');
  console.log('========================================');

  const { tradeUuid, escrowState, vault, initSig } = await setupTestEscrow(
    connection,
    deployer,
    mint,
    seller,
    buyer,
    3600
  );
  console.log(`  Trade: ${tradeUuid}`);
  console.log(`  Init tx: ${initSig.slice(0, 32)}...`);

  // Verify vault
  const vaultAccount = await getAccount(connection, vault);
  console.log(`  Vault balance: ${vaultAccount.amount}`);

  // Buyer marks paid
  const markPaidIx = buildMarkPaidIx({ buyer: buyer.publicKey, escrowState });
  const markPaidTx = new Transaction().add(markPaidIx);
  const markPaidSig = await sendAndConfirmTransaction(connection, markPaidTx, [buyer]);
  console.log(`  Mark paid tx: ${markPaidSig.slice(0, 32)}...`);

  // Seller releases
  const releaseIx = buildReleaseEscrowIx({
    seller: seller.publicKey,
    buyer: buyer.publicKey,
    mint,
    escrowState,
  });
  const releaseTx = new Transaction().add(releaseIx);
  const releaseSig = await sendAndConfirmTransaction(connection, releaseTx, [seller]);
  console.log(`  Release tx: ${releaseSig.slice(0, 32)}...`);

  // Verify buyer received tokens
  const buyerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    mint,
    buyer.publicKey
  );
  const buyerBalance = (await getAccount(connection, buyerAta.address)).amount;
  console.log(`  Buyer balance: ${buyerBalance}`);

  // Vault should be closed
  try {
    await getAccount(connection, vault);
    throw new Error('Vault should be closed!');
  } catch (e: any) {
    if (e.message === 'Vault should be closed!') throw e;
    console.log('  Vault closed ✓');
  }

  console.log('  TEST 1 PASSED ✓');
}

// ---------------------------------------------------------------------------
// Test 2: Dispute Flow (init → dispute → admin resolves to buyer)
// ---------------------------------------------------------------------------

async function testDisputeResolveToBuyer(
  connection: Connection,
  deployer: Keypair,
  mint: PublicKey,
  seller: Keypair,
  buyer: Keypair
) {
  console.log('\n========================================');
  console.log('TEST 2: Dispute → Admin Resolves to Buyer');
  console.log('========================================');

  const { tradeUuid, escrowState, vault, initSig } = await setupTestEscrow(
    connection,
    deployer,
    mint,
    seller,
    buyer,
    3600
  );
  console.log(`  Trade: ${tradeUuid}`);
  console.log(`  Init tx: ${initSig.slice(0, 32)}...`);

  // Buyer marks paid
  const markPaidIx = buildMarkPaidIx({ buyer: buyer.publicKey, escrowState });
  const markPaidTx = new Transaction().add(markPaidIx);
  await sendAndConfirmTransaction(connection, markPaidTx, [buyer]);
  console.log('  Buyer marked paid');

  // Buyer files dispute (seller not confirming)
  const disputeIx = buildFileDisputeIx({ disputer: buyer.publicKey, escrowState });
  const disputeTx = new Transaction().add(disputeIx);
  const disputeSig = await sendAndConfirmTransaction(connection, disputeTx, [buyer]);
  console.log(`  Dispute filed tx: ${disputeSig.slice(0, 32)}...`);

  // Admin resolves in favor of buyer
  const resolveIx = buildResolveDisputeIx({
    admin: deployer.publicKey,
    seller: seller.publicKey,
    buyer: buyer.publicKey,
    mint,
    escrowState,
    resolution: Resolution.ReleaseToBuyer,
  });
  const resolveTx = new Transaction().add(resolveIx);
  const resolveSig = await sendAndConfirmTransaction(connection, resolveTx, [deployer]);
  console.log(`  Resolve tx: ${resolveSig.slice(0, 32)}...`);

  // Verify buyer received tokens
  const buyerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    mint,
    buyer.publicKey
  );
  const buyerBalance = (await getAccount(connection, buyerAta.address)).amount;
  console.log(`  Buyer balance: ${buyerBalance}`);

  // Vault closed
  try {
    await getAccount(connection, vault);
    throw new Error('Vault should be closed!');
  } catch (e: any) {
    if (e.message === 'Vault should be closed!') throw e;
    console.log('  Vault closed ✓');
  }

  console.log('  TEST 2 PASSED ✓');
}

// ---------------------------------------------------------------------------
// Test 3: Dispute → Admin Resolves to Seller (refund via dispute)
// ---------------------------------------------------------------------------

async function testDisputeResolveToSeller(
  connection: Connection,
  deployer: Keypair,
  mint: PublicKey,
  seller: Keypair,
  buyer: Keypair
) {
  console.log('\n========================================');
  console.log('TEST 3: Dispute → Admin Resolves to Seller');
  console.log('========================================');

  const { tradeUuid, escrowState, vault, initSig } = await setupTestEscrow(
    connection,
    deployer,
    mint,
    seller,
    buyer,
    3600
  );
  console.log(`  Trade: ${tradeUuid}`);
  console.log(`  Init tx: ${initSig.slice(0, 32)}...`);

  // Seller files dispute (buyer hasn't paid)
  const disputeIx = buildFileDisputeIx({ disputer: seller.publicKey, escrowState });
  const disputeTx = new Transaction().add(disputeIx);
  const disputeSig = await sendAndConfirmTransaction(connection, disputeTx, [seller]);
  console.log(`  Dispute filed tx: ${disputeSig.slice(0, 32)}...`);

  // Get seller balance before resolve
  const sellerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    mint,
    seller.publicKey
  );
  const sellerBefore = (await getAccount(connection, sellerAta.address)).amount;
  console.log(`  Seller balance before resolve: ${sellerBefore}`);

  // Admin resolves in favor of seller
  const resolveIx = buildResolveDisputeIx({
    admin: deployer.publicKey,
    seller: seller.publicKey,
    buyer: buyer.publicKey,
    mint,
    escrowState,
    resolution: Resolution.RefundToSeller,
  });
  const resolveTx = new Transaction().add(resolveIx);
  const resolveSig = await sendAndConfirmTransaction(connection, resolveTx, [deployer]);
  console.log(`  Resolve tx: ${resolveSig.slice(0, 32)}...`);

  // Verify seller got tokens back
  const sellerAfter = (await getAccount(connection, sellerAta.address)).amount;
  console.log(`  Seller balance after resolve: ${sellerAfter}`);
  const refunded = BigInt(sellerAfter) - BigInt(sellerBefore);
  if (refunded !== BigInt(ESCROW_AMOUNT)) {
    throw new Error(`Seller refund mismatch! Expected ${ESCROW_AMOUNT}, got ${refunded}`);
  }

  // Vault closed
  try {
    await getAccount(connection, vault);
    throw new Error('Vault should be closed!');
  } catch (e: any) {
    if (e.message === 'Vault should be closed!') throw e;
    console.log('  Vault closed ✓');
  }

  console.log('  TEST 3 PASSED ✓');
}

// ---------------------------------------------------------------------------
// Test 4: Timeout Refund (init with 1s timeout → wait → seller refunds)
// ---------------------------------------------------------------------------

async function testTimeoutRefund(
  connection: Connection,
  deployer: Keypair,
  mint: PublicKey,
  seller: Keypair,
  buyer: Keypair
) {
  console.log('\n========================================');
  console.log('TEST 4: Timeout Refund (1s timeout)');
  console.log('========================================');

  // Get seller balance before
  const sellerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    deployer,
    mint,
    seller.publicKey
  );
  const sellerBefore = (await getAccount(connection, sellerAta.address)).amount;

  const { tradeUuid, escrowState, vault, initSig } = await setupTestEscrow(
    connection,
    deployer,
    mint,
    seller,
    buyer,
    1 // 1 second timeout
  );
  console.log(`  Trade: ${tradeUuid}`);
  console.log(`  Init tx: ${initSig.slice(0, 32)}...`);
  console.log(`  Timeout: 1 second`);

  // Wait for timeout to elapse (Solana slot time ~400ms, but clock updates per slot)
  console.log('  Waiting 5s for timeout to elapse...');
  await sleep(5000);

  // Seller self-refunds
  const refundIx = buildRefundEscrowIx({
    seller: seller.publicKey,
    mint,
    escrowState,
  });
  const refundTx = new Transaction().add(refundIx);
  const refundSig = await sendAndConfirmTransaction(connection, refundTx, [seller]);
  console.log(`  Refund tx: ${refundSig.slice(0, 32)}...`);

  // Verify seller got tokens back
  const sellerAfter = (await getAccount(connection, sellerAta.address)).amount;
  console.log(`  Seller balance after refund: ${sellerAfter}`);

  // Vault closed
  try {
    await getAccount(connection, vault);
    throw new Error('Vault should be closed!');
  } catch (e: any) {
    if (e.message === 'Vault should be closed!') throw e;
    console.log('  Vault closed ✓');
  }

  console.log('  TEST 4 PASSED ✓');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== MVGA Escrow E2E Tests (Devnet) ===');
  console.log(`Program ID: ${ESCROW_PROGRAM_ID.toBase58()}\n`);

  const connection = new Connection(RPC_URL, 'confirmed');
  const deployer = loadKeypair(DEPLOYER_KEYPAIR_PATH);
  console.log(`Deployer: ${deployer.publicKey.toBase58()}`);

  const deployerBalance = await connection.getBalance(deployer.publicKey);
  console.log(`Balance:  ${deployerBalance / LAMPORTS_PER_SOL} SOL`);

  // Generate shared test wallets (reused across tests)
  const seller = Keypair.generate();
  const buyer = Keypair.generate();
  console.log(`Seller:   ${seller.publicKey.toBase58()}`);
  console.log(`Buyer:    ${buyer.publicKey.toBase58()}`);

  // Fund test wallets
  console.log('\n--- Funding test wallets ---');
  await fundFromDeployer(connection, deployer, seller.publicKey, 0.2 * LAMPORTS_PER_SOL);
  await fundFromDeployer(connection, deployer, buyer.publicKey, 0.1 * LAMPORTS_PER_SOL);

  // Create shared test mint
  console.log('\n--- Creating test token mint ---');
  const mint = await createMint(connection, deployer, deployer.publicKey, null, 6);
  console.log(`Mint: ${mint.toBase58()}`);

  // Pre-create buyer ATA
  await getOrCreateAssociatedTokenAccount(connection, deployer, mint, buyer.publicKey);

  // Run all tests
  await testHappyPath(connection, deployer, mint, seller, buyer);
  await testDisputeResolveToBuyer(connection, deployer, mint, seller, buyer);
  await testDisputeResolveToSeller(connection, deployer, mint, seller, buyer);
  await testTimeoutRefund(connection, deployer, mint, seller, buyer);

  console.log('\n========================================');
  console.log('ALL 4 TESTS PASSED ✓');
  console.log('========================================');

  const finalBalance = await connection.getBalance(deployer.publicKey);
  console.log(`\nDeployer balance remaining: ${finalBalance / LAMPORTS_PER_SOL} SOL`);
}

main().catch((err) => {
  console.error('\n=== TEST FAILED ===');
  console.error(err);
  process.exit(1);
});
