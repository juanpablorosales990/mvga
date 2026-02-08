/**
 * Kamino Live E2E Test
 *
 * Swaps SOL→USDC via Jupiter, deposits into Kamino, withdraws back.
 * Uses the deployer keypair to sign all transactions on mainnet.
 *
 * Usage:
 *   npx ts-node scripts/test-kamino-live.ts           # dry run (no signing)
 *   npx ts-node scripts/test-kamino-live.ts --live     # real transactions
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
// @ts-ignore — type resolution issue with @solana/spl-token under SWC
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import {
  KaminoMarket,
  KaminoAction,
  VanillaObligation,
  PROGRAM_ID as KLEND_PROGRAM_ID,
} from '@kamino-finance/klend-sdk';
import { readFileSync } from 'fs';
import { join } from 'path';

// --- Config ---
const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  'https://mainnet.helius-rpc.com/?api-key=4e45b3e7-68cf-44ab-8a18-c5ad93ad4196';
const JUPITER_API = 'https://lite-api.jup.ag/swap/v1';
const KAMINO_MAIN_MARKET = new PublicKey('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const SWAP_LAMPORTS = 300_000_000; // 0.3 SOL
const MIN_SOL_BALANCE = 0.4; // Abort if below this
const LIVE = process.argv.includes('--live');

// --- Helpers ---
function log(step: number, msg: string) {
  console.log(`[${step}/10] ${msg}`);
}

function solscan(sig: string) {
  return `https://solscan.io/tx/${sig}`;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getUsdcBalance(connection: Connection, wallet: PublicKey): Promise<bigint> {
  try {
    const ata = await getAssociatedTokenAddress(USDC_MINT, wallet);
    const account = await getAccount(connection, ata);
    return account.amount;
  } catch {
    return 0n;
  }
}

// --- Main ---
async function main() {
  console.log(`\n=== KAMINO LIVE E2E TEST (${LIVE ? 'LIVE' : 'DRY RUN'}) ===\n`);

  // Step 1: Load keypair
  log(1, 'Loading deployer keypair...');
  const keypairPath = join(process.env.HOME!, '.config/solana/mvga-deployer.json');
  const payer = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(readFileSync(keypairPath, 'utf-8')))
  );
  const wallet = payer.publicKey;
  console.log(`   Wallet: ${wallet.toBase58()}`);

  // Step 2: Connect
  log(2, 'Connecting to RPC...');
  const connection = new Connection(RPC_URL, 'confirmed');
  console.log(`   RPC: ${RPC_URL.replace(/api-key=.*/, 'api-key=***')}`);

  // Step 3: Check SOL balance
  log(3, 'Checking SOL balance...');
  const solBalance = await connection.getBalance(wallet);
  const solAmount = solBalance / 1e9;
  console.log(`   SOL balance: ${solAmount.toFixed(4)} SOL`);
  if (solAmount < MIN_SOL_BALANCE) {
    console.error(`   ABORT: Need at least ${MIN_SOL_BALANCE} SOL, have ${solAmount.toFixed(4)}`);
    process.exit(1);
  }

  const usdcBefore = await getUsdcBalance(connection, wallet);
  console.log(`   USDC balance: ${(Number(usdcBefore) / 1e6).toFixed(2)} USDC`);

  // Step 4: Swap SOL → USDC via Jupiter (skip if wallet already has USDC)
  let swapSig = '';
  let usdcReceived = 0n;

  if (usdcBefore > 0n) {
    log(4, `Wallet already has ${(Number(usdcBefore) / 1e6).toFixed(2)} USDC — skipping swap`);
    usdcReceived = usdcBefore;
  } else {
    log(4, `Swapping ${SWAP_LAMPORTS / 1e9} SOL → USDC via Jupiter...`);

    // Get quote
    const quoteUrl = new URL(`${JUPITER_API}/quote`);
    quoteUrl.searchParams.set('inputMint', SOL_MINT);
    quoteUrl.searchParams.set('outputMint', USDC_MINT.toBase58());
    quoteUrl.searchParams.set('amount', SWAP_LAMPORTS.toString());
    quoteUrl.searchParams.set('slippageBps', '50');

    const quoteRes = await fetch(quoteUrl.toString());
    if (!quoteRes.ok) throw new Error(`Jupiter quote failed: ${await quoteRes.text()}`);
    const quote = await quoteRes.json();
    console.log(
      `   Quote: ${SWAP_LAMPORTS / 1e9} SOL → ${(Number(quote.outAmount) / 1e6).toFixed(2)} USDC`
    );
    console.log(`   Price impact: ${quote.priceImpactPct}%`);

    if (LIVE) {
      // Get swap tx
      const swapRes = await fetch(`${JUPITER_API}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: wallet.toBase58(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        }),
      });
      if (!swapRes.ok) throw new Error(`Jupiter swap failed: ${await swapRes.text()}`);
      const { swapTransaction } = await swapRes.json();

      // Deserialize VersionedTransaction, sign, send
      const txBuf = Buffer.from(swapTransaction, 'base64');
      const vTx = VersionedTransaction.deserialize(txBuf);
      vTx.sign([payer]);

      console.log('   Sending swap transaction...');
      swapSig = await connection.sendTransaction(vTx, { skipPreflight: false });
      console.log(`   Confirming...`);
      await connection.confirmTransaction(swapSig, 'confirmed');
      console.log(`   SWAP TX: ${solscan(swapSig)}`);

      // Check new USDC balance
      await sleep(2000);
      const usdcAfterSwap = await getUsdcBalance(connection, wallet);
      usdcReceived = usdcAfterSwap - usdcBefore;
      console.log(`   USDC received: ${(Number(usdcReceived) / 1e6).toFixed(2)} USDC`);
    } else {
      console.log('   [DRY RUN] Would swap — skipping');
      usdcReceived = BigInt(quote.outAmount);
    }
  }

  // Step 5: Load Kamino market
  log(5, 'Loading Kamino market...');
  const marketStart = Date.now();
  const market = await KaminoMarket.load(connection, KAMINO_MAIN_MARKET, 400);
  if (!market) throw new Error('Failed to load Kamino market');
  await market.loadReserves();
  console.log(`   Market loaded in ${Date.now() - marketStart}ms`);

  // Step 6: Deposit USDC into Kamino
  const depositAmount = usdcReceived;
  log(6, `Depositing ${(Number(depositAmount) / 1e6).toFixed(2)} USDC into Kamino...`);
  let depositSig = '';

  const depositAction = await KaminoAction.buildDepositTxns(
    market,
    depositAmount.toString(),
    USDC_MINT,
    wallet,
    new VanillaObligation(KLEND_PROGRAM_ID)
  );
  const depositTx = new Transaction();
  depositTx.add(
    ...depositAction.setupIxs,
    ...(depositAction.inBetweenIxs ?? []),
    ...depositAction.lendingIxs,
    ...(depositAction.cleanupIxs ?? [])
  );
  const { blockhash: depositBlockhash } = await connection.getLatestBlockhash('confirmed');
  depositTx.recentBlockhash = depositBlockhash;
  depositTx.feePayer = wallet;

  console.log(
    `   Instructions: ${depositAction.setupIxs.length} setup + ${(depositAction.inBetweenIxs ?? []).length} inBetween + ${depositAction.lendingIxs.length} lending + ${(depositAction.cleanupIxs ?? []).length} cleanup`
  );

  if (LIVE) {
    console.log('   Sending deposit transaction...');
    depositSig = await sendAndConfirmTransaction(connection, depositTx, [payer], {
      commitment: 'confirmed',
    });
    console.log(`   DEPOSIT TX: ${solscan(depositSig)}`);
  } else {
    const serialized = depositTx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    console.log(`   [DRY RUN] Tx size: ${serialized.length} bytes — would send`);
  }

  // Step 7: Wait and check position
  log(7, 'Checking Kamino position...');
  if (LIVE) {
    await sleep(5000);
  }
  const obligations = await market.getAllUserObligations(wallet);
  console.log(`   Obligations found: ${obligations.length}`);
  for (const obligation of obligations) {
    if (!obligation) continue;
    console.log(`   Deposits: ${obligation.deposits?.size ?? 0}`);
    for (const [, deposit] of obligation.deposits) {
      console.log(
        `     Amount: ${deposit.amount.toNumber()} | Market value: ${deposit.marketValueRefreshed.toNumber()}`
      );
    }
  }

  // Step 8: Withdraw USDC from Kamino
  log(8, `Withdrawing ${(Number(depositAmount) / 1e6).toFixed(2)} USDC from Kamino...`);
  let withdrawSig = '';

  // Reload market for fresh state
  await market.loadReserves();

  const withdrawAction = await KaminoAction.buildWithdrawTxns(
    market,
    depositAmount.toString(),
    USDC_MINT,
    wallet,
    new VanillaObligation(KLEND_PROGRAM_ID)
  );
  const withdrawTx = new Transaction();
  withdrawTx.add(
    ...withdrawAction.setupIxs,
    ...(withdrawAction.inBetweenIxs ?? []),
    ...withdrawAction.lendingIxs,
    ...(withdrawAction.cleanupIxs ?? [])
  );
  const { blockhash: withdrawBlockhash } = await connection.getLatestBlockhash('confirmed');
  withdrawTx.recentBlockhash = withdrawBlockhash;
  withdrawTx.feePayer = wallet;

  console.log(
    `   Instructions: ${withdrawAction.setupIxs.length} setup + ${(withdrawAction.inBetweenIxs ?? []).length} inBetween + ${withdrawAction.lendingIxs.length} lending + ${(withdrawAction.cleanupIxs ?? []).length} cleanup`
  );

  if (LIVE) {
    console.log('   Sending withdraw transaction...');
    withdrawSig = await sendAndConfirmTransaction(connection, withdrawTx, [payer], {
      commitment: 'confirmed',
    });
    console.log(`   WITHDRAW TX: ${solscan(withdrawSig)}`);
  } else {
    const serialized = withdrawTx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    console.log(`   [DRY RUN] Tx size: ${serialized.length} bytes — would send`);
  }

  // Step 9: Final balances
  log(9, 'Checking final balances...');
  if (LIVE) {
    await sleep(2000);
  }
  const finalSol = await connection.getBalance(wallet);
  const finalUsdc = await getUsdcBalance(connection, wallet);
  console.log(
    `   SOL: ${(finalSol / 1e9).toFixed(4)} (spent ~${((solBalance - finalSol) / 1e9).toFixed(4)} on fees)`
  );
  console.log(`   USDC: ${(Number(finalUsdc) / 1e6).toFixed(2)}`);

  // Step 10: Summary
  log(10, 'Summary');
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         KAMINO LIVE E2E TEST RESULTS            ║');
  console.log('╠══════════════════════════════════════════════════╣');
  if (LIVE) {
    console.log(`║ Swap:     ${swapSig.slice(0, 40)}...`);
    console.log(`║           ${solscan(swapSig)}`);
    console.log(`║ Deposit:  ${depositSig.slice(0, 40)}...`);
    console.log(`║           ${solscan(depositSig)}`);
    console.log(`║ Withdraw: ${withdrawSig.slice(0, 40)}...`);
    console.log(`║           ${solscan(withdrawSig)}`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║ SOL spent on fees: ~${((solBalance - finalSol) / 1e9).toFixed(4)} SOL`);
    console.log(`║ USDC recovered:    ${(Number(finalUsdc) / 1e6).toFixed(2)} USDC`);
    console.log(`║ Status:            ALL PASSED`);
  } else {
    console.log('║ Mode: DRY RUN — no transactions sent           ║');
    console.log(`║ USDC available: ${(Number(usdcReceived) / 1e6).toFixed(2)} USDC`);
    console.log('║ Would deposit + withdraw via Kamino             ║');
    console.log('║ Run with --live to execute for real             ║');
  }
  console.log('╚══════════════════════════════════════════════════╝');
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
