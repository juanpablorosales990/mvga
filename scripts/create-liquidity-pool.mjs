import { Raydium, TxVersion, CREATE_CPMM_POOL_PROGRAM, CREATE_CPMM_POOL_FEE_ACC } from '@raydium-io/raydium-sdk-v2';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');

// MVGA Token
const MVGA_MINT = 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh';
const MVGA_DECIMALS = 9;

// Wrapped SOL
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
const WSOL_DECIMALS = 9;

// Initial liquidity:
// Target price: $0.001 per MVGA at ~$92/SOL → 1 SOL = 92,000 MVGA
// We add 0.5 SOL + 46,000 MVGA
const SOL_AMOUNT = 0.5;       // SOL
const MVGA_AMOUNT = 46_000;   // MVGA tokens

async function main() {
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  const keypairPath = join(process.env.HOME, '.config/solana/mvga-deployer.json');
  const owner = Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(keypairPath, 'utf-8'))));

  console.log(`Deployer:   ${owner.publicKey.toBase58()}`);
  console.log(`MVGA Mint:  ${MVGA_MINT}`);
  console.log(`SOL Amount: ${SOL_AMOUNT} SOL`);
  console.log(`MVGA Amount: ${MVGA_AMOUNT.toLocaleString()} MVGA`);
  console.log(`Price:      1 SOL = ${MVGA_AMOUNT / SOL_AMOUNT} MVGA (~$0.001/MVGA at $92/SOL)`);
  console.log(`Mode:       ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  const solBalance = await connection.getBalance(owner.publicKey);
  console.log(`SOL Balance: ${solBalance / 1e9} SOL`);

  if (solBalance / 1e9 < 0.8) {
    console.error('ERROR: Need at least ~0.8 SOL (0.5 liquidity + ~0.3 pool creation fees)');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would create Raydium CPMM pool:');
    console.log(`  Pair: MVGA/SOL`);
    console.log(`  Initial: ${SOL_AMOUNT} SOL + ${MVGA_AMOUNT.toLocaleString()} MVGA`);
    console.log(`  Fee: 0.25% (standard)`);
    console.log(`  Program: ${CREATE_CPMM_POOL_PROGRAM.toBase58()}`);
    return;
  }

  console.log('\nInitializing Raydium SDK...');
  const raydium = await Raydium.load({
    owner,
    connection,
    cluster: 'mainnet',
    disableFeatureCheck: true,
    disableLoadToken: false,
    blockhashCommitment: 'finalized',
  });

  // Provide mint info directly (MVGA is not in standard token list)
  const mintA = {
    address: MVGA_MINT,
    programId: TOKEN_PROGRAM_ID.toBase58(),
    decimals: MVGA_DECIMALS,
  };

  const mintB = {
    address: WSOL_MINT,
    programId: TOKEN_PROGRAM_ID.toBase58(),
    decimals: WSOL_DECIMALS,
  };

  // Get fee configs from Raydium API
  console.log('Fetching fee configs...');
  const feeConfigs = await raydium.api.getCpmmConfigs();
  console.log(`Available fee tiers: ${feeConfigs.map(c => `${c.tradeFeeRate / 10000}%`).join(', ')}`);

  // Pick the 0.25% fee tier (tradeFeeRate = 2500 = 0.25%)
  const feeConfig = feeConfigs.find(c => c.tradeFeeRate === 2500) || feeConfigs[0];
  console.log(`Using fee tier: ${feeConfig.tradeFeeRate / 10000}%\n`);

  // Convert amounts to raw (both 9 decimals)
  const mintAAmount = new BN(MVGA_AMOUNT).mul(new BN(10).pow(new BN(MVGA_DECIMALS)));
  const mintBAmount = new BN(SOL_AMOUNT * 10 ** WSOL_DECIMALS);

  console.log(`Raw MVGA amount: ${mintAAmount.toString()}`);
  console.log(`Raw SOL amount:  ${mintBAmount.toString()}`);
  console.log('\nCreating pool...');

  const { execute, extInfo, transaction } = await raydium.cpmm.createPool({
    programId: CREATE_CPMM_POOL_PROGRAM,
    poolFeeAccount: CREATE_CPMM_POOL_FEE_ACC,
    mintA,
    mintB,
    mintAAmount,
    mintBAmount,
    startTime: new BN(0),
    feeConfig,
    associatedOnly: false,
    ownerInfo: {
      useSOLBalance: true,
    },
    txVersion: TxVersion.V0,
    computeBudgetConfig: {
      units: 600000,
      microLamports: 100000,
    },
  });

  console.log('Sending transaction...');
  const { txId } = await execute({ sendAndConfirm: true });

  const poolKeys = Object.keys(extInfo.address).reduce(
    (acc, cur) => ({
      ...acc,
      [cur]: extInfo.address[cur].toString(),
    }),
    {},
  );

  console.log('\nPool created successfully!');
  console.log(`TX: https://solscan.io/tx/${txId}`);
  console.log('\nPool Keys:');
  console.log(JSON.stringify(poolKeys, null, 2));
  console.log('\nPool ID:', poolKeys.poolId || 'check tx on solscan');
  console.log('\nNext steps:');
  console.log('- The pool will be indexed by Jupiter within ~5-10 minutes');
  console.log('- Users can then swap MVGA <-> SOL on app.mvga.io');
  console.log('- Check Raydium UI: https://raydium.io/liquidity/');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
