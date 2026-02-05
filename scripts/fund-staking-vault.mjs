import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token';
import { readFileSync } from 'fs';
import { join } from 'path';

const MINT = 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh';
const VAULT = 'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh';
const DECIMALS = 9;
const AMOUNT = 100_000_000; // 100M MVGA
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  const keypairPath = join(process.env.HOME, '.config/solana/mvga-deployer.json');
  const payer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(keypairPath, 'utf-8'))));
  const mintPubkey = new PublicKey(MINT);
  const vaultPubkey = new PublicKey(VAULT);

  console.log(`Deployer: ${payer.publicKey.toBase58()}`);
  console.log(`Vault:    ${VAULT}`);
  console.log(`Amount:   ${AMOUNT.toLocaleString()} MVGA`);
  console.log(`Mode:     ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  const solBalance = await connection.getBalance(payer.publicKey);
  console.log(`SOL Balance: ${solBalance / 1e9} SOL`);

  // Check current vault balance
  const vaultATA = await getOrCreateAssociatedTokenAccount(
    connection, payer, mintPubkey, vaultPubkey,
  );
  const currentVaultBalance = Number(vaultATA.amount) / 10 ** DECIMALS;
  console.log(`Current vault balance: ${currentVaultBalance.toLocaleString()} MVGA`);
  console.log(`After transfer: ${(currentVaultBalance + AMOUNT).toLocaleString()} MVGA\n`);

  if (DRY_RUN) {
    console.log('[DRY RUN] Would transfer 100,000,000 MVGA to staking vault');
    return;
  }

  const senderATA = await getOrCreateAssociatedTokenAccount(
    connection, payer, mintPubkey, payer.publicKey,
  );

  const amount = BigInt(AMOUNT) * BigInt(10 ** DECIMALS);
  console.log('Transferring...');
  const sig = await transfer(
    connection, payer,
    senderATA.address, vaultATA.address,
    payer.publicKey, amount,
  );
  console.log(`TX: https://solscan.io/tx/${sig}`);

  // Verify
  const updatedVault = await getOrCreateAssociatedTokenAccount(
    connection, payer, mintPubkey, vaultPubkey,
  );
  console.log(`New vault balance: ${(Number(updatedVault.amount) / 10 ** DECIMALS).toLocaleString()} MVGA`);
  console.log('Done!');
}

main().catch(err => { console.error(err); process.exit(1); });
