/**
 * Kamino Mainnet Dry-Run Test
 *
 * Tests that the Kamino SDK can:
 * 1. Load the mainnet market
 * 2. Read reserve data
 * 3. Build a deposit transaction (unsigned, not sent)
 * 4. Build a withdraw transaction (unsigned, not sent)
 * 5. Fetch APY from DefiLlama
 *
 * No real funds are spent — transactions are built but never signed or sent.
 *
 * Usage: npx ts-node scripts/test-kamino-mainnet.ts
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  KaminoMarket,
  KaminoAction,
  VanillaObligation,
  PROGRAM_ID as KLEND_PROGRAM_ID,
} from '@kamino-finance/klend-sdk';

const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  'https://mainnet.helius-rpc.com/?api-key=4e45b3e7-68cf-44ab-8a18-c5ad93ad4196';

const KAMINO_MAIN_MARKET = new PublicKey('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');

const TOKEN_MINTS: Record<string, string> = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

// Use the deployer wallet as a test address (read-only, no signing)
const TEST_WALLET = new PublicKey('H9j1W4u5LEiw8AZdui6c8AmN6t4tKkPQCAULPW8eMiTE');

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');
  console.log('RPC:', RPC_URL.replace(/api-key=.*/, 'api-key=***'));
  console.log('---');

  // 1. Load market
  console.log('1. Loading Kamino market...');
  const start = Date.now();
  const market = await KaminoMarket.load(connection, KAMINO_MAIN_MARKET, 400);
  if (!market) throw new Error('Failed to load market');
  await market.loadReserves();
  console.log(`   Market loaded in ${Date.now() - start}ms`);
  console.log(`   Reserves: ${market.reserves?.size ?? 'unknown'}`);
  console.log('');

  // 2. Check USDC reserve
  console.log('2. Checking USDC reserve...');
  const usdcMint = new PublicKey(TOKEN_MINTS.USDC);
  const usdcReserve = market.getReserveByMint(usdcMint);
  if (usdcReserve) {
    const stats = usdcReserve.stats as Record<string, unknown>;
    console.log(`   USDC Reserve found`);
    console.log(
      `   Stats keys: ${Object.keys(stats || {})
        .slice(0, 10)
        .join(', ')}...`
    );
    console.log(`   Decimals: ${stats?.decimals}`);
  } else {
    console.log('   USDC reserve NOT found');
  }
  console.log('');

  // 3. Check USDT reserve
  console.log('3. Checking USDT reserve...');
  const usdtMint = new PublicKey(TOKEN_MINTS.USDT);
  const usdtReserve = market.getReserveByMint(usdtMint);
  if (usdtReserve) {
    console.log(`   USDT Reserve found`);
  } else {
    console.log('   USDT reserve NOT found');
  }
  console.log('');

  // Fetch a recent blockhash for serialization test
  const { blockhash } = await connection.getLatestBlockhash('confirmed');

  // 4. Build deposit tx (1 USDC, unsigned)
  console.log('4. Building USDC deposit tx (1 USDC, dry run)...');
  try {
    const depositAmount = BigInt(1_000_000); // 1 USDC (6 decimals)
    const kaminoAction = await KaminoAction.buildDepositTxns(
      market,
      depositAmount.toString(),
      usdcMint,
      TEST_WALLET,
      new VanillaObligation(KLEND_PROGRAM_ID)
    );
    const tx = new Transaction();
    tx.add(...kaminoAction.setupIxs, ...kaminoAction.lendingIxs);
    tx.recentBlockhash = blockhash;
    tx.feePayer = TEST_WALLET;
    console.log(`   Setup instructions: ${kaminoAction.setupIxs.length}`);
    console.log(`   Lending instructions: ${kaminoAction.lendingIxs.length}`);
    console.log(`   Total instructions: ${tx.instructions.length}`);
    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    console.log(`   Serialized size: ${serialized.length} bytes`);
    console.log(`   Base64 length: ${serialized.toString('base64').length} chars`);
    console.log(`   DEPOSIT TX BUILD: OK`);
  } catch (err) {
    console.error(`   DEPOSIT TX BUILD FAILED:`, err);
  }
  console.log('');

  // 5. Build withdraw tx (1 USDC, unsigned)
  console.log('5. Building USDC withdraw tx (1 USDC, dry run)...');
  try {
    const withdrawAmount = BigInt(1_000_000);
    const kaminoAction = await KaminoAction.buildWithdrawTxns(
      market,
      withdrawAmount.toString(),
      usdcMint,
      TEST_WALLET,
      new VanillaObligation(KLEND_PROGRAM_ID)
    );
    const tx = new Transaction();
    tx.add(...kaminoAction.setupIxs, ...kaminoAction.lendingIxs);
    tx.recentBlockhash = blockhash;
    tx.feePayer = TEST_WALLET;
    console.log(`   Setup instructions: ${kaminoAction.setupIxs.length}`);
    console.log(`   Lending instructions: ${kaminoAction.lendingIxs.length}`);
    console.log(`   Total instructions: ${tx.instructions.length}`);
    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    console.log(`   Serialized size: ${serialized.length} bytes`);
    console.log(`   Base64 length: ${serialized.toString('base64').length} chars`);
    console.log(`   WITHDRAW TX BUILD: OK`);
  } catch (err) {
    console.error(`   WITHDRAW TX BUILD FAILED:`, err);
  }
  console.log('');

  // 6. Fetch APY from DefiLlama
  console.log('6. Fetching APY from DefiLlama...');
  try {
    const res = await fetch('https://yields.llama.fi/pools', {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      data: Array<{ project: string; symbol: string; apy: number; pool: string }>;
    };
    const kaminoPools = data.data.filter((p) => p.project === 'kamino-lend');
    const usdc = kaminoPools.find((p) => p.symbol === 'USDC');
    const usdt = kaminoPools.find((p) => p.symbol === 'USDT');
    console.log(`   Kamino pools found: ${kaminoPools.length}`);
    console.log(`   USDC APY: ${usdc ? usdc.apy.toFixed(2) + '%' : 'NOT FOUND'}`);
    console.log(`   USDT APY: ${usdt ? usdt.apy.toFixed(2) + '%' : 'NOT FOUND'}`);
    console.log(`   DEFILLAMA APY: OK`);
  } catch (err) {
    console.error(`   DEFILLAMA APY FAILED:`, err);
  }
  console.log('');

  // 7. Check user obligations (for test wallet)
  console.log('7. Checking obligations for test wallet...');
  try {
    const obligations = await market.getAllUserObligations(TEST_WALLET);
    console.log(`   Obligations found: ${obligations.length}`);
    for (const obligation of obligations) {
      if (!obligation) continue;
      console.log(`   Obligation deposits: ${obligation.deposits?.size ?? 0}`);
      console.log(`   Obligation borrows: ${obligation.borrows?.size ?? 0}`);
    }
    console.log(`   USER OBLIGATIONS: OK`);
  } catch (err) {
    console.error(`   USER OBLIGATIONS FAILED:`, err);
  }

  console.log('');
  console.log('=== ALL KAMINO MAINNET CHECKS COMPLETE ===');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
