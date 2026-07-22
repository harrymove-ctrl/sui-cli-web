/**
 * Registry of known/verified tokens on Sui
 * These tokens are displayed with priority and verified badge
 */

export interface KnownToken {
  name: string;
  symbol: string;
  priority: number; // Lower = higher priority (1 = first)
  verified: boolean;
  description?: string;
  iconUrl?: string;
}

// Known tokens registry - separated by network
// coinType -> KnownToken
export const KNOWN_TOKENS_MAINNET: Record<string, KnownToken> = {
  '0x2::sui::SUI': {
    name: 'Sui',
    symbol: 'SUI',
    priority: 1,
    verified: true,
    description: 'Native token of the Sui network',
  },
  '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL': {
    name: 'WAL Token',
    symbol: 'WAL',
    priority: 2,
    verified: true,
    description: 'The native token for the Walrus Protocol',
    iconUrl: 'https://www.walrus.xyz/wal-icon.svg',
  },
  // USDC on Sui (Circle official)
  '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN': {
    name: 'USD Coin',
    symbol: 'USDC',
    priority: 3,
    verified: true,
    description: 'USD Coin by Circle',
  },
  // USDT on Sui
  '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN': {
    name: 'Tether USD',
    symbol: 'USDT',
    priority: 4,
    verified: true,
    description: 'Tether USD stablecoin',
  },
  // wETH on Sui
  '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN': {
    name: 'Wrapped Ether',
    symbol: 'wETH',
    priority: 5,
    verified: true,
    description: 'Wrapped Ethereum on Sui',
  },
};

export const KNOWN_TOKENS_TESTNET: Record<string, KnownToken> = {
  '0x2::sui::SUI': {
    name: 'Sui',
    symbol: 'SUI',
    priority: 1,
    verified: true,
    description: 'Native token of the Sui network',
  },
  // Testnet WAL (if available)
  '0x9f992cc2430a1f442ca7a5ca7638169f5d5c00e0ebc3977a65e9ac6e497fe5ef::wal::WAL': {
    name: 'WAL Token',
    symbol: 'WAL',
    priority: 2,
    verified: true,
    description: 'The native token for the Walrus Protocol (Testnet)',
  },
};

export const KNOWN_TOKENS_DEVNET: Record<string, KnownToken> = {
  '0x2::sui::SUI': {
    name: 'Sui',
    symbol: 'SUI',
    priority: 1,
    verified: true,
    description: 'Native token of the Sui network',
  },
};

/**
 * Get known tokens registry for a specific network
 */
export function getKnownTokens(network: 'mainnet' | 'testnet' | 'devnet' | 'localnet'): Record<string, KnownToken> {
  switch (network) {
    case 'mainnet':
      return KNOWN_TOKENS_MAINNET;
    case 'testnet':
      return KNOWN_TOKENS_TESTNET;
    case 'devnet':
    case 'localnet':
      return KNOWN_TOKENS_DEVNET;
    default:
      return KNOWN_TOKENS_TESTNET;
  }
}

/**
 * Get token info if known
 */
export function getKnownToken(coinType: string, network: string): KnownToken | null {
  const tokens = getKnownTokens(network as any);
  return tokens[coinType] || null;
}

/**
 * Check if a token is verified/known
 */
export function isVerifiedToken(coinType: string, network: string): boolean {
  const token = getKnownToken(coinType, network);
  return token?.verified ?? false;
}

/**
 * Get priority for sorting (lower = higher priority)
 * Returns 999 for unknown tokens
 */
export function getTokenPriority(coinType: string, network: string): number {
  const token = getKnownToken(coinType, network);
  return token?.priority ?? 999;
}
