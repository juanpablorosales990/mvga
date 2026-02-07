/**
 * BIP39 mnemonic generation + SLIP-0010 ed25519 HD key derivation for Solana.
 * Uses Phantom/Backpack-compatible derivation path: m/44'/501'/{account}'/0'
 */

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import HDKey from 'micro-key-producer/slip10.js';
import { Keypair } from '@solana/web3.js';

const SOLANA_DERIVATION_PREFIX = "m/44'/501'";

/** Generate a new 12-word BIP39 mnemonic. */
export function createMnemonic(): string {
  return generateMnemonic(wordlist, 128);
}

/** Validate a BIP39 mnemonic string. */
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic, wordlist);
}

/**
 * Derive a Solana Keypair from a BIP39 mnemonic.
 * Uses the Phantom/Backpack-compatible path: m/44'/501'/{accountIndex}'/0'
 */
export function deriveKeypairFromMnemonic(mnemonic: string, accountIndex: number = 0): Keypair {
  const seed = mnemonicToSeedSync(mnemonic, '');
  const hdkey = HDKey.fromMasterSeed(seed);
  const path = `${SOLANA_DERIVATION_PREFIX}/${accountIndex}'/0'`;
  const derived = hdkey.derive(path);
  return Keypair.fromSeed(derived.privateKey);
}

/** Get the derivation path string for display. */
export function getDerivationPath(accountIndex: number = 0): string {
  return `${SOLANA_DERIVATION_PREFIX}/${accountIndex}'/0'`;
}
