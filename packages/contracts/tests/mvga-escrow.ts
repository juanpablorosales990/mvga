import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import {
  createMint,
  mintTo,
  getAssociatedTokenAddress,
  createAssociatedTokenAccount,
  getAccount,
} from '@solana/spl-token';
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { expect } from 'chai';
import { MvgaEscrow } from '../target/types/mvga_escrow';

describe('mvga-escrow', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MvgaEscrow as Program<MvgaEscrow>;

  let mint: PublicKey;
  let seller: Keypair;
  let buyer: Keypair;
  let admin: Keypair;
  let sellerAta: PublicKey;
  let buyerAta: PublicKey;

  const DECIMALS = 6; // USDC-like
  const AMOUNT = 1_000_000; // 1 USDC
  const TIMEOUT = 7200; // 2 hours

  function makeTradeId(): number[] {
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  }

  function findEscrowPDA(tradeId: number[], sellerKey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), Buffer.from(tradeId), sellerKey.toBuffer()],
      program.programId
    );
  }

  function findVaultPDA(escrowState: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), escrowState.toBuffer()],
      program.programId
    );
  }

  before(async () => {
    seller = Keypair.generate();
    buyer = Keypair.generate();
    admin = Keypair.generate();

    // Fund accounts
    for (const kp of [seller, buyer, admin]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 10 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);
    }

    // Create mint
    mint = await createMint(provider.connection, seller, seller.publicKey, null, DECIMALS);

    // Create ATAs
    sellerAta = await createAssociatedTokenAccount(
      provider.connection,
      seller,
      mint,
      seller.publicKey
    );
    buyerAta = await createAssociatedTokenAccount(
      provider.connection,
      buyer,
      mint,
      buyer.publicKey
    );

    // Mint tokens to seller
    await mintTo(provider.connection, seller, mint, sellerAta, seller, 100 * AMOUNT);
  });

  describe('initialize_escrow', () => {
    it('locks tokens in vault', async () => {
      const tradeId = makeTradeId();
      const [escrowState] = findEscrowPDA(tradeId, seller.publicKey);
      const [vault] = findVaultPDA(escrowState);

      await program.methods
        .initializeEscrow(tradeId, new anchor.BN(AMOUNT), new anchor.BN(TIMEOUT))
        .accounts({
          seller: seller.publicKey,
          buyer: buyer.publicKey,
          admin: admin.publicKey,
          mint,
          escrowState,
          vault,
          sellerTokenAccount: sellerAta,
        })
        .signers([seller])
        .rpc();

      // Verify escrow state
      const escrow = await program.account.escrowState.fetch(escrowState);
      expect(escrow.seller.toBase58()).to.equal(seller.publicKey.toBase58());
      expect(escrow.buyer.toBase58()).to.equal(buyer.publicKey.toBase58());
      expect(escrow.amount.toNumber()).to.equal(AMOUNT);
      expect(escrow.status).to.deep.equal({ locked: {} });
      expect(escrow.timeoutSeconds.toNumber()).to.equal(TIMEOUT);

      // Verify vault balance
      const vaultAccount = await getAccount(provider.connection, vault);
      expect(Number(vaultAccount.amount)).to.equal(AMOUNT);
    });

    it('rejects zero amount', async () => {
      const tradeId = makeTradeId();
      const [escrowState] = findEscrowPDA(tradeId, seller.publicKey);
      const [vault] = findVaultPDA(escrowState);

      try {
        await program.methods
          .initializeEscrow(tradeId, new anchor.BN(0), new anchor.BN(TIMEOUT))
          .accounts({
            seller: seller.publicKey,
            buyer: buyer.publicKey,
            admin: admin.publicKey,
            mint,
            escrowState,
            vault,
            sellerTokenAccount: sellerAta,
          })
          .signers([seller])
          .rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal('ZeroAmount');
      }
    });
  });

  describe('mark_paid', () => {
    let tradeId: number[];
    let escrowState: PublicKey;

    before(async () => {
      tradeId = makeTradeId();
      [escrowState] = findEscrowPDA(tradeId, seller.publicKey);
      const [vault] = findVaultPDA(escrowState);

      await program.methods
        .initializeEscrow(tradeId, new anchor.BN(AMOUNT), new anchor.BN(TIMEOUT))
        .accounts({
          seller: seller.publicKey,
          buyer: buyer.publicKey,
          admin: admin.publicKey,
          mint,
          escrowState,
          vault,
          sellerTokenAccount: sellerAta,
        })
        .signers([seller])
        .rpc();
    });

    it('buyer marks payment as sent', async () => {
      await program.methods
        .markPaid()
        .accounts({ buyer: buyer.publicKey, escrowState })
        .signers([buyer])
        .rpc();

      const escrow = await program.account.escrowState.fetch(escrowState);
      expect(escrow.status).to.deep.equal({ paymentSent: {} });
    });

    it('rejects non-buyer', async () => {
      const tradeId2 = makeTradeId();
      const [es2] = findEscrowPDA(tradeId2, seller.publicKey);
      const [v2] = findVaultPDA(es2);

      await program.methods
        .initializeEscrow(tradeId2, new anchor.BN(AMOUNT), new anchor.BN(TIMEOUT))
        .accounts({
          seller: seller.publicKey,
          buyer: buyer.publicKey,
          admin: admin.publicKey,
          mint,
          escrowState: es2,
          vault: v2,
          sellerTokenAccount: sellerAta,
        })
        .signers([seller])
        .rpc();

      try {
        await program.methods
          .markPaid()
          .accounts({ buyer: seller.publicKey, escrowState: es2 })
          .signers([seller])
          .rpc();
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal('UnauthorizedBuyer');
      }
    });
  });

  describe('release_escrow', () => {
    it('releases tokens to buyer after seller confirms', async () => {
      const tradeId = makeTradeId();
      const [escrowState] = findEscrowPDA(tradeId, seller.publicKey);
      const [vault] = findVaultPDA(escrowState);

      // Initialize
      await program.methods
        .initializeEscrow(tradeId, new anchor.BN(AMOUNT), new anchor.BN(TIMEOUT))
        .accounts({
          seller: seller.publicKey,
          buyer: buyer.publicKey,
          admin: admin.publicKey,
          mint,
          escrowState,
          vault,
          sellerTokenAccount: sellerAta,
        })
        .signers([seller])
        .rpc();

      // Mark paid
      await program.methods
        .markPaid()
        .accounts({ buyer: buyer.publicKey, escrowState })
        .signers([buyer])
        .rpc();

      // Get buyer balance before
      const buyerBefore = await getAccount(provider.connection, buyerAta);
      const beforeBalance = Number(buyerBefore.amount);

      // Release
      await program.methods
        .releaseEscrow()
        .accounts({
          seller: seller.publicKey,
          buyer: buyer.publicKey,
          mint,
          escrowState,
          vault,
          buyerTokenAccount: buyerAta,
        })
        .signers([seller])
        .rpc();

      // Verify buyer received tokens
      const buyerAfter = await getAccount(provider.connection, buyerAta);
      expect(Number(buyerAfter.amount) - beforeBalance).to.equal(AMOUNT);

      // Verify status
      const escrow = await program.account.escrowState.fetch(escrowState);
      expect(escrow.status).to.deep.equal({ released: {} });
    });
  });

  describe('file_dispute', () => {
    it('buyer can file dispute', async () => {
      const tradeId = makeTradeId();
      const [escrowState] = findEscrowPDA(tradeId, seller.publicKey);
      const [vault] = findVaultPDA(escrowState);

      await program.methods
        .initializeEscrow(tradeId, new anchor.BN(AMOUNT), new anchor.BN(TIMEOUT))
        .accounts({
          seller: seller.publicKey,
          buyer: buyer.publicKey,
          admin: admin.publicKey,
          mint,
          escrowState,
          vault,
          sellerTokenAccount: sellerAta,
        })
        .signers([seller])
        .rpc();

      await program.methods
        .fileDispute()
        .accounts({ disputer: buyer.publicKey, escrowState })
        .signers([buyer])
        .rpc();

      const escrow = await program.account.escrowState.fetch(escrowState);
      expect(escrow.status).to.deep.equal({ disputed: {} });
    });
  });

  describe('resolve_dispute', () => {
    it('admin releases to buyer on dispute', async () => {
      const tradeId = makeTradeId();
      const [escrowState] = findEscrowPDA(tradeId, seller.publicKey);
      const [vault] = findVaultPDA(escrowState);

      await program.methods
        .initializeEscrow(tradeId, new anchor.BN(AMOUNT), new anchor.BN(TIMEOUT))
        .accounts({
          seller: seller.publicKey,
          buyer: buyer.publicKey,
          admin: admin.publicKey,
          mint,
          escrowState,
          vault,
          sellerTokenAccount: sellerAta,
        })
        .signers([seller])
        .rpc();

      // File dispute
      await program.methods
        .fileDispute()
        .accounts({ disputer: seller.publicKey, escrowState })
        .signers([seller])
        .rpc();

      const buyerBefore = await getAccount(provider.connection, buyerAta);
      const beforeBalance = Number(buyerBefore.amount);

      // Admin resolves → release to buyer
      await program.methods
        .resolveDispute({ releaseToBuyer: {} })
        .accounts({
          admin: admin.publicKey,
          seller: seller.publicKey,
          buyer: buyer.publicKey,
          mint,
          escrowState,
          vault,
          recipientTokenAccount: buyerAta,
          recipient: buyer.publicKey,
        })
        .signers([admin])
        .rpc();

      const buyerAfter = await getAccount(provider.connection, buyerAta);
      expect(Number(buyerAfter.amount) - beforeBalance).to.equal(AMOUNT);

      const escrow = await program.account.escrowState.fetch(escrowState);
      expect(escrow.status).to.deep.equal({ released: {} });
    });

    it('admin refunds to seller on dispute', async () => {
      const tradeId = makeTradeId();
      const [escrowState] = findEscrowPDA(tradeId, seller.publicKey);
      const [vault] = findVaultPDA(escrowState);

      await program.methods
        .initializeEscrow(tradeId, new anchor.BN(AMOUNT), new anchor.BN(TIMEOUT))
        .accounts({
          seller: seller.publicKey,
          buyer: buyer.publicKey,
          admin: admin.publicKey,
          mint,
          escrowState,
          vault,
          sellerTokenAccount: sellerAta,
        })
        .signers([seller])
        .rpc();

      await program.methods
        .fileDispute()
        .accounts({ disputer: buyer.publicKey, escrowState })
        .signers([buyer])
        .rpc();

      const sellerBefore = await getAccount(provider.connection, sellerAta);
      const beforeBalance = Number(sellerBefore.amount);

      // Admin resolves → refund to seller
      await program.methods
        .resolveDispute({ refundToSeller: {} })
        .accounts({
          admin: admin.publicKey,
          seller: seller.publicKey,
          buyer: buyer.publicKey,
          mint,
          escrowState,
          vault,
          recipientTokenAccount: sellerAta,
          recipient: seller.publicKey,
        })
        .signers([admin])
        .rpc();

      const sellerAfter = await getAccount(provider.connection, sellerAta);
      expect(Number(sellerAfter.amount) - beforeBalance).to.equal(AMOUNT);

      const escrow = await program.account.escrowState.fetch(escrowState);
      expect(escrow.status).to.deep.equal({ refunded: {} });
    });
  });
});
