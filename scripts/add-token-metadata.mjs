import { createV1, mplTokenMetadata, TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { mplToolbox } from '@metaplex-foundation/mpl-toolbox';
import { createGenericFile, percentAmount, publicKey, signerIdentity, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { base58 } from '@metaplex-foundation/umi/serializers';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MINT_ADDRESS = 'DRX65kM2n5CLTpdjJCemZvkUwE98ou4RpHrd8Z3GH5Qh';
const KEYPAIR_PATH = path.join(process.env.HOME, '.config/solana/mvga-deployer.json');
const IMAGE_PATH = path.join(__dirname, 'mvga-logo.png');

async function main() {
  console.log('Setting up UMI...');
  const umi = createUmi('https://api.mainnet-beta.solana.com')
    .use(mplTokenMetadata())
    .use(mplToolbox())
    .use(irysUploader());

  // Load keypair
  const keypairData = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf-8'));
  const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(keypairData));
  const signer = createSignerFromKeypair(umi, keypair);
  umi.use(signerIdentity(signer));
  console.log('Wallet:', signer.publicKey);

  // Upload image
  console.log('\nUploading image to Arweave via Irys...');
  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  const imageFile = createGenericFile(imageBuffer, 'mvga-logo.png', {
    tags: [{ name: 'Content-Type', value: 'image/png' }],
  });
  const [imageUri] = await umi.uploader.upload([imageFile]);
  console.log('Image URI:', imageUri);

  // Upload metadata JSON
  console.log('\nUploading metadata JSON...');
  const metadata = {
    name: 'Make Venezuela Great Again',
    symbol: 'MVGA',
    description: 'MVGA is Venezuela\'s open-source financial infrastructure. A community-driven token powering P2P payments, staking, and micro-grants for Venezuelan businesses. Transparent, open source, community-owned.',
    image: imageUri,
    external_url: 'https://mvga.io',
    properties: {
      category: 'fungible',
    },
  };
  const metadataUri = await umi.uploader.uploadJson(metadata);
  console.log('Metadata URI:', metadataUri);

  // Create on-chain metadata
  console.log('\nCreating on-chain metadata...');
  const mint = publicKey(MINT_ADDRESS);

  const tx = await createV1(umi, {
    mint,
    authority: signer,
    payer: signer,
    updateAuthority: signer.publicKey,
    name: 'Make Venezuela Great Again',
    symbol: 'MVGA',
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(0),
    tokenStandard: TokenStandard.Fungible,
  }).sendAndConfirm(umi);

  const txSig = base58.deserialize(tx.signature)[0];
  console.log('\nDone!');
  console.log('Transaction:', `https://solscan.io/tx/${txSig}`);
  console.log('Token:', `https://solscan.io/token/${MINT_ADDRESS}`);
  console.log('\nMetadata:');
  console.log('  Name: Make Venezuela Great Again');
  console.log('  Symbol: MVGA');
  console.log('  Image:', imageUri);
  console.log('  Metadata URI:', metadataUri);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
