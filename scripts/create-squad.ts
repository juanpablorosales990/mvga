/**
 * Create a Squads v4 multisig for MVGA.
 *
 * Usage:
 *   npx ts-node scripts/create-squad.ts
 *
 * This creates a 2-of-3 multisig with:
 *   - Member 1: Your deployer wallet (H9j1W...) — all permissions
 *   - Member 2: Generated keypair — vote only (saved to ./squad-member-2.json)
 *   - Member 3: Generated keypair — vote only (saved to ./squad-member-3.json)
 *
 * After creation, you can replace members 2 & 3 with real keyholders via the Squads app.
 */

import * as multisig from '@sqds/multisig';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const { Permission, Permissions } = multisig.types;

async function main() {
  // Use devnet (same as Solana CLI config)
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  // Load deployer keypair (same as `solana config get` keypair)
  const deployerPath = path.resolve(process.env.HOME!, '.config/solana/mvga-deployer.json');
  const deployerSecret = JSON.parse(fs.readFileSync(deployerPath, 'utf-8'));
  const creator = Keypair.fromSecretKey(Uint8Array.from(deployerSecret));
  console.log('Creator (deployer):', creator.publicKey.toBase58());

  // Check balance
  const balance = await connection.getBalance(creator.publicKey);
  console.log('Balance:', balance / LAMPORTS_PER_SOL, 'SOL');
  if (balance < 0.2 * LAMPORTS_PER_SOL) {
    console.error('Need at least 0.2 SOL to create a Squad');
    process.exit(1);
  }

  // Generate member keypairs (placeholders — replace with real keyholders later)
  const member2 = Keypair.generate();
  const member3 = Keypair.generate();

  // Save member keypairs for future reference
  const scriptsDir = path.resolve('scripts');
  fs.writeFileSync(
    path.join(scriptsDir, 'squad-member-2.json'),
    JSON.stringify(Array.from(member2.secretKey))
  );
  fs.writeFileSync(
    path.join(scriptsDir, 'squad-member-3.json'),
    JSON.stringify(Array.from(member3.secretKey))
  );
  console.log('Member 2:', member2.publicKey.toBase58(), '(saved to squad-member-2.json)');
  console.log('Member 3:', member3.publicKey.toBase58(), '(saved to squad-member-3.json)');

  // Random key to derive the multisig PDA
  const createKey = Keypair.generate();

  // Derive the multisig PDA
  const [multisigPda] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
  });
  console.log('\nMultisig PDA:', multisigPda.toBase58());

  // Get program config (required for v2 creation)
  const programConfigPda = multisig.getProgramConfigPda({})[0];
  console.log('Program Config PDA:', programConfigPda.toBase58());

  let configTreasury: PublicKey;
  try {
    const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(
      connection,
      programConfigPda
    );
    configTreasury = programConfig.treasury;
  } catch (err) {
    console.error(
      'Failed to load ProgramConfig. The Squads v4 program may not be deployed on this cluster.'
    );
    console.error('Error:', err);
    process.exit(1);
  }

  console.log('\nCreating 2-of-3 multisig...');

  // Create the multisig
  const signature = await multisig.rpc.multisigCreateV2({
    connection,
    createKey,
    creator,
    multisigPda,
    configAuthority: null,
    timeLock: 0,
    members: [
      {
        key: creator.publicKey,
        permissions: Permissions.all(),
      },
      {
        key: member2.publicKey,
        permissions: Permissions.all(),
      },
      {
        key: member3.publicKey,
        permissions: Permissions.all(),
      },
    ],
    threshold: 2,
    rentCollector: null,
    treasury: configTreasury,
  });

  await connection.confirmTransaction(signature, 'confirmed');
  console.log('\nMultisig created!');
  console.log('Signature:', signature);

  // Derive vault PDAs
  const [vault0] = multisig.getVaultPda({
    multisigPda,
    index: 0,
  });
  const [vault1] = multisig.getVaultPda({
    multisigPda,
    index: 1,
  });
  const [vault2] = multisig.getVaultPda({
    multisigPda,
    index: 2,
  });

  console.log('\n=== SQUAD INFO (SAVE THIS) ===');
  console.log('Multisig PDA:  ', multisigPda.toBase58());
  console.log('Create Key:    ', createKey.publicKey.toBase58());
  console.log('Vault 0 (Upgrades):', vault0.toBase58());
  console.log('Vault 1 (Treasury):', vault1.toBase58());
  console.log('Vault 2 (Admin):   ', vault2.toBase58());
  console.log('');
  console.log('Members:');
  console.log('  1. (deployer)', creator.publicKey.toBase58(), '- All permissions');
  console.log('  2. (placeholder)', member2.publicKey.toBase58(), '- All permissions');
  console.log('  3. (placeholder)', member3.publicKey.toBase58(), '- All permissions');
  console.log('Threshold: 2-of-3');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Transfer program upgrade authority:');
  console.log(
    `     solana program set-upgrade-authority 6GXdYCDckUVEFBaQSgfQGX95gZSNN7FWN19vRDSyTJ5E --new-upgrade-authority ${vault0.toBase58()}`
  );
  console.log('  2. Set ESCROW_ADMIN_PUBKEY on Railway:');
  console.log(`     railway variables --set 'ESCROW_ADMIN_PUBKEY=${vault2.toBase58()}'`);
  console.log('  3. Replace placeholder members with real keyholders at app.squads.so');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
