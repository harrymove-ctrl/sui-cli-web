import fs from 'fs';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1';
import type { Keypair } from '@mysten/sui/cryptography';
import { fromBase64 } from '@mysten/sui/utils';
import { ConfigParser } from '../cli/ConfigParser';

/**
 * Loads the local Keypair for `address` directly from the `sui.keystore` file -
 * the exact same file (and trust boundary) the `sui` CLI already reads for
 * every signing operation this server shells out for. Used only in-process
 * (e.g. to produce a SEAL SessionKey signature); the key material is never
 * logged, persisted elsewhere, or returned in any API response.
 *
 * Returns `null` if the keystore file is missing or no entry matches `address`
 * (never throws on a "not found" - only on a genuinely unreadable/malformed file).
 */
export async function loadLocalKeypairForAddress(address: string): Promise<Keypair | null> {
  const config = await ConfigParser.getInstance().getConfig();
  const keystorePath = config?.keystore?.File;
  if (!keystorePath || !fs.existsSync(keystorePath)) return null;

  const raw = await fs.promises.readFile(keystorePath, 'utf8');
  const entries: string[] = JSON.parse(raw);
  const normalized = address.toLowerCase();

  for (const entry of entries) {
    const bytes = fromBase64(entry);
    const flag = bytes[0];
    const secretKey = bytes.slice(1);

    let keypair: Keypair;
    try {
      if (flag === 0) keypair = Ed25519Keypair.fromSecretKey(secretKey);
      else if (flag === 1) keypair = Secp256k1Keypair.fromSecretKey(secretKey);
      else if (flag === 2) keypair = Secp256r1Keypair.fromSecretKey(secretKey);
      else continue;
    } catch {
      continue;
    }

    if (keypair.getPublicKey().toSuiAddress().toLowerCase() === normalized) {
      return keypair;
    }
  }

  return null;
}
