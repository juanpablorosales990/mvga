import { Connection, Keypair } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token';
import { readFileSync } from 'fs';
import { join } from 'path';

const MINT = 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh';
const DECIMALS = 9;
const DRY_RUN = process.argv.includes('--dry-run');

const ALLOCATIONS = [
  { name: 'Humanitarian Fund (15%)', address: '82XeVLtfjniaE6qvrDiY7UaCHvkimyhVximvRDdQsdqS', tokens: 150_000_000 },
  { name: 'Team Vesting (20%)', address: '8m8L2CGoneYwP3xEYyss5sjbj7GKy7cK3YxDcG2yNbH4', tokens: 200_000_000 },
  { name: 'Marketing (10%)', address: 'DA5VQFLsx87hNQqL2EsM36oVhGnzM2CnqPSe6E9RFpeo', tokens: 100_000_000 },
  { name: 'Advisors (5%)', address: 'Huq3ea9KKf6HFb5Qiacdx2pJDSM4c881WdyMCBHXq4hF', tokens: 50_000_000 },
  { name: 'Staking Vault', address: 'GNhLCjqThNJAJAdDYvRTr2EfWyGXAFUymaPuKaL1duEh', tokens: 100_000_000 },
];
// Remaining 400M stays in deployer (community/liquidity 40%) + 100M startup fund (10%)

async function main() {
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  const keypairPath = join(process.env.HOME, '.config/solana/mvga-deployer.json');
  const payer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(keypairPath, 'utf-8'))));
  const mintPubkey = new (await import('@solana/web3.js')).PublicKey(MINT);

  console.log(`Deployer: ${payer.publicKey.toBase58()}`);
  console.log(`Token Mint: ${MINT}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  const solBalance = await connection.getBalance(payer.publicKey);
  console.log(`SOL Balance: ${solBalance / 1e9} SOL\n`);

  const totalToDistribute = ALLOCATIONS.reduce((sum, a) => sum + a.tokens, 0);
  console.log(`Total to distribute: ${totalToDistribute.toLocaleString()} MVGA`);
  console.log(`Remaining in deployer: ${(1_000_000_000 - totalToDistribute).toLocaleString()} MVGA\n`);

  for (const alloc of ALLOCATIONS) {
    const amount = BigInt(alloc.tokens) * BigInt(10 ** DECIMALS);
    const recipientPubkey = new (await import('@solana/web3.js')).PublicKey(alloc.address);

    console.log(`--- ${alloc.name} ---`);
    console.log(`  Address: ${alloc.address}`);
    console.log(`  Amount: ${alloc.tokens.toLocaleString()} MVGA`);

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would transfer ${alloc.tokens.toLocaleString()} MVGA\n`);
      continue;
    }

    try {
      const recipientATA = await getOrCreateAssociatedTokenAccount(
        connection, payer, mintPubkey, recipientPubkey,
      );
      console.log(`  ATA: ${recipientATA.address.toBase58()}`);

      const senderATA = await getOrCreateAssociatedTokenAccount(
        connection, payer, mintPubkey, payer.publicKey,
      );

      const sig = await transfer(
        connection, payer,
        senderATA.address, recipientATA.address,
        payer.publicKey, amount,
      );
      console.log(`  TX: https://solscan.io/tx/${sig}\n`);
    } catch (err) {
      console.error(`  ERROR: ${err.message}\n`);
    }
  }

  console.log('Done!');
}

main().catch(err => { console.error(err); process.exit(1); });
