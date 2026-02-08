/**
 * Replace Squads v4 placeholder members with new keypairs.
 *
 * This script replaces the 2 placeholder members (generated during multisig creation)
 * with 2 newly generated keypairs stored in .keys/.
 *
 * Flow:
 *   1. Read current multisig state
 *   2. Create config transaction: RemoveMember(old2) + AddMember(new2) + RemoveMember(old3) + AddMember(new3)
 *   3. Create proposal
 *   4. Approve with deployer (auto-approves as creator)
 *   5. Approve with old member 2 (meets 2-of-3 threshold)
 *   6. Execute config transaction
 *   7. Verify new members
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/replace-squad-members.ts           # dry run
 *   npx ts-node --transpile-only scripts/replace-squad-members.ts --live    # execute on devnet
 */

import * as multisig from '@sqds/multisig';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

const { Permissions } = multisig.types;

// Multisig PDA (from create-squad.ts output)
const MULTISIG_PDA = new PublicKey('26Q5NhhNSC4HoDpAZkixcpYEynWgLr5vsYsQiZThC5M3');
const LIVE = process.argv.includes('--live');

async function main() {
  console.log(`\n=== SQUADS MEMBER REPLACEMENT (${LIVE ? 'LIVE' : 'DRY RUN'}) ===\n`);

  // 1. Load all keypairs
  console.log('[1/7] Loading keypairs...');

  const deployerPath = path.resolve(process.env.HOME!, '.config/solana/mvga-deployer.json');
  const deployer = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(deployerPath, 'utf-8')))
  );
  console.log('  Deployer:', deployer.publicKey.toBase58());

  const oldMember2 = Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(fs.readFileSync(path.resolve('scripts/squad-member-2.json'), 'utf-8'))
    )
  );
  const oldMember3 = Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(fs.readFileSync(path.resolve('scripts/squad-member-3.json'), 'utf-8'))
    )
  );
  console.log('  Old Member 2:', oldMember2.publicKey.toBase58());
  console.log('  Old Member 3:', oldMember3.publicKey.toBase58());

  const newMember2 = Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(fs.readFileSync(path.resolve('.keys/squad-member-2-new.json'), 'utf-8'))
    )
  );
  const newMember3 = Keypair.fromSecretKey(
    new Uint8Array(
      JSON.parse(fs.readFileSync(path.resolve('.keys/squad-member-3-new.json'), 'utf-8'))
    )
  );
  console.log('  New Member 2:', newMember2.publicKey.toBase58());
  console.log('  New Member 3:', newMember3.publicKey.toBase58());

  // 2. Connect and read current state
  console.log('\n[2/7] Reading multisig state...');
  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    'confirmed'
  );

  const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
    connection,
    MULTISIG_PDA
  );

  console.log('  Threshold:', multisigAccount.threshold);
  console.log('  Transaction index:', multisigAccount.transactionIndex.toString());
  console.log('  Members:');
  for (const member of multisigAccount.members) {
    const isDeployer = member.key.toBase58() === deployer.publicKey.toBase58();
    const isOld2 = member.key.toBase58() === oldMember2.publicKey.toBase58();
    const isOld3 = member.key.toBase58() === oldMember3.publicKey.toBase58();
    const label = isDeployer
      ? '(deployer)'
      : isOld2
        ? '(placeholder 2)'
        : isOld3
          ? '(placeholder 3)'
          : '(unknown)';
    console.log(`    ${member.key.toBase58()} ${label}`);
  }

  // Verify old members are actually in the multisig
  const memberKeys = multisigAccount.members.map((m: { key: PublicKey }) => m.key.toBase58());
  if (!memberKeys.includes(oldMember2.publicKey.toBase58())) {
    console.error('ERROR: Old member 2 not found in multisig!');
    process.exit(1);
  }
  if (!memberKeys.includes(oldMember3.publicKey.toBase58())) {
    console.error('ERROR: Old member 3 not found in multisig!');
    process.exit(1);
  }

  // Check deployer SOL balance
  const balance = await connection.getBalance(deployer.publicKey);
  console.log(`  Deployer balance: ${(balance / 1e9).toFixed(4)} SOL`);
  if (balance < 0.05 * 1e9) {
    console.error('ERROR: Deployer needs at least 0.05 SOL for transaction fees');
    process.exit(1);
  }

  // 3. Create config transaction with all 4 actions
  // transactionIndex stores the last used index — next available is +1
  const txIndex = BigInt(multisigAccount.transactionIndex.toString()) + 1n;
  console.log(`\n[3/7] Creating config transaction (index: ${txIndex})...`);
  console.log('  Actions:');
  console.log(`    - RemoveMember: ${oldMember2.publicKey.toBase58()}`);
  console.log(`    - AddMember:    ${newMember2.publicKey.toBase58()} (all permissions)`);
  console.log(`    - RemoveMember: ${oldMember3.publicKey.toBase58()}`);
  console.log(`    - AddMember:    ${newMember3.publicKey.toBase58()} (all permissions)`);

  if (!LIVE) {
    console.log('\n  [DRY RUN] Would create config transaction — skipping');
    console.log('\n  Run with --live to execute on devnet');
    printSummary(deployer, oldMember2, oldMember3, newMember2, newMember3, false);
    return;
  }

  const configSig = await multisig.rpc.configTransactionCreate({
    connection,
    feePayer: deployer,
    multisigPda: MULTISIG_PDA,
    transactionIndex: txIndex,
    creator: deployer.publicKey,
    actions: [
      {
        __kind: 'RemoveMember' as const,
        oldMember: oldMember2.publicKey,
      },
      {
        __kind: 'AddMember' as const,
        newMember: {
          key: newMember2.publicKey,
          permissions: Permissions.all(),
        },
      },
      {
        __kind: 'RemoveMember' as const,
        oldMember: oldMember3.publicKey,
      },
      {
        __kind: 'AddMember' as const,
        newMember: {
          key: newMember3.publicKey,
          permissions: Permissions.all(),
        },
      },
    ],
  });
  console.log('  Config tx signature:', configSig);

  // 4. Create proposal (creator = deployer, auto-approves)
  console.log('\n[4/7] Creating proposal...');
  const proposalSig = await multisig.rpc.proposalCreate({
    connection,
    feePayer: deployer,
    creator: deployer,
    multisigPda: MULTISIG_PDA,
    transactionIndex: txIndex,
    isDraft: false,
  });
  console.log('  Proposal signature:', proposalSig);

  // 5. Approve with deployer (first approval)
  console.log('\n[5/7] Approving with deployer...');
  const approveSig1 = await multisig.rpc.proposalApprove({
    connection,
    feePayer: deployer,
    member: deployer,
    multisigPda: MULTISIG_PDA,
    transactionIndex: txIndex,
  });
  console.log('  Deployer approval:', approveSig1);

  // 6. Approve with old member 2 (second approval — meets 2-of-3 threshold)
  console.log('\n[6/7] Approving with old member 2 (meets threshold)...');
  const approveSig2 = await multisig.rpc.proposalApprove({
    connection,
    feePayer: deployer,
    member: oldMember2,
    multisigPda: MULTISIG_PDA,
    transactionIndex: txIndex,
  });
  console.log('  Old member 2 approval:', approveSig2);

  // Wait a moment for state to propagate
  await new Promise((r) => setTimeout(r, 2000));

  // 7. Execute config transaction
  console.log('\n[7/7] Executing config transaction...');
  const executeSig = await multisig.rpc.configTransactionExecute({
    connection,
    feePayer: deployer,
    multisigPda: MULTISIG_PDA,
    transactionIndex: txIndex,
    member: deployer,
    rentPayer: deployer,
  });
  console.log('  Execute signature:', executeSig);

  // Verify new state
  await new Promise((r) => setTimeout(r, 3000));
  console.log('\n=== VERIFICATION ===');
  const updatedMs = await multisig.accounts.Multisig.fromAccountAddress(connection, MULTISIG_PDA);

  console.log('  Threshold:', updatedMs.threshold);
  console.log('  Members:');
  for (const member of updatedMs.members) {
    const isDeployer = member.key.toBase58() === deployer.publicKey.toBase58();
    const isNew2 = member.key.toBase58() === newMember2.publicKey.toBase58();
    const isNew3 = member.key.toBase58() === newMember3.publicKey.toBase58();
    const label = isDeployer
      ? '(deployer)'
      : isNew2
        ? '(NEW member 2)'
        : isNew3
          ? '(NEW member 3)'
          : '(unknown)';
    console.log(`    ${member.key.toBase58()} ${label}`);
  }

  // Verify replacement
  const newMemberKeys = updatedMs.members.map((m: { key: PublicKey }) => m.key.toBase58());
  const hasNew2 = newMemberKeys.includes(newMember2.publicKey.toBase58());
  const hasNew3 = newMemberKeys.includes(newMember3.publicKey.toBase58());
  const hasOld2 = newMemberKeys.includes(oldMember2.publicKey.toBase58());
  const hasOld3 = newMemberKeys.includes(oldMember3.publicKey.toBase58());

  if (hasNew2 && hasNew3 && !hasOld2 && !hasOld3) {
    console.log('\n  STATUS: ALL MEMBERS REPLACED SUCCESSFULLY');
  } else {
    console.error('\n  WARNING: Member replacement may be incomplete!');
    console.log(`    New member 2 present: ${hasNew2}`);
    console.log(`    New member 3 present: ${hasNew3}`);
    console.log(`    Old member 2 removed: ${!hasOld2}`);
    console.log(`    Old member 3 removed: ${!hasOld3}`);
  }

  printSummary(deployer, oldMember2, oldMember3, newMember2, newMember3, true);
}

function printSummary(
  deployer: Keypair,
  oldMember2: Keypair,
  oldMember3: Keypair,
  newMember2: Keypair,
  newMember3: Keypair,
  executed: boolean
) {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           SQUADS MEMBER REPLACEMENT SUMMARY                ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║ Multisig:    ${MULTISIG_PDA.toBase58()}`);
  console.log(`║ Status:      ${executed ? 'EXECUTED' : 'DRY RUN'}`);
  console.log('║');
  console.log('║ Member 1 (deployer — unchanged):');
  console.log(`║   ${deployer.publicKey.toBase58()}`);
  console.log('║');
  console.log('║ Member 2:');
  console.log(`║   Old: ${oldMember2.publicKey.toBase58()}`);
  console.log(`║   New: ${newMember2.publicKey.toBase58()}`);
  console.log(`║   Key: .keys/squad-member-2-new.json`);
  console.log('║');
  console.log('║ Member 3:');
  console.log(`║   Old: ${oldMember3.publicKey.toBase58()}`);
  console.log(`║   New: ${newMember3.publicKey.toBase58()}`);
  console.log(`║   Key: .keys/squad-member-3-new.json`);
  console.log('║');
  console.log('║ Threshold: 2-of-3');
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
