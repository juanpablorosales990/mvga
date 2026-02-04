import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import fs from 'fs';

const KEYPAIR_PATH = '/Users/juanrosales/.config/solana/mvga-deployer.json';
const TOTAL_SUPPLY = 1_000_000_000; // 1 billion
const DECIMALS = 9;

async function main() {
  console.log('🚀 Creating MVGA Token on Solana Mainnet...\n');

  // Load keypair
  const secretKey = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log('📍 Payer address:', payer.publicKey.toBase58());

  // Connect to mainnet
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  const balance = await connection.getBalance(payer.publicKey);
  console.log('💰 Balance:', balance / 1e9, 'SOL\n');

  if (balance < 0.05 * 1e9) {
    console.error('❌ Insufficient balance. Need at least 0.05 SOL');
    process.exit(1);
  }

  // Create the token mint
  console.log('🔨 Creating token mint...');
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey, // mint authority
    payer.publicKey, // freeze authority (can be null)
    DECIMALS
  );
  console.log('✅ Token created:', mint.toBase58());

  // Create associated token account for the payer
  console.log('\n📦 Creating token account...');
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );
  console.log('✅ Token account:', tokenAccount.address.toBase58());

  // Mint total supply
  console.log('\n🪙 Minting', TOTAL_SUPPLY.toLocaleString(), 'tokens...');
  const mintAmount = BigInt(TOTAL_SUPPLY) * BigInt(10 ** DECIMALS);
  await mintTo(
    connection,
    payer,
    mint,
    tokenAccount.address,
    payer.publicKey,
    mintAmount
  );
  console.log('✅ Minted', TOTAL_SUPPLY.toLocaleString(), 'MVGA tokens');

  console.log('\n========================================');
  console.log('🎉 MVGA TOKEN CREATED SUCCESSFULLY!');
  console.log('========================================');
  console.log('Token Mint Address:', mint.toBase58());
  console.log('Token Account:', tokenAccount.address.toBase58());
  console.log('Total Supply:', TOTAL_SUPPLY.toLocaleString(), 'MVGA');
  console.log('Decimals:', DECIMALS);
  console.log('\n📝 Save this mint address - you need it for the codebase!');
}

main().catch(console.error);
