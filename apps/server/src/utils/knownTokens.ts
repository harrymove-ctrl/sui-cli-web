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
    // The native coin's own on-chain metadata has an empty `iconUrl` on every network
    // (confirmed via suix_getCoinMetadata) - client falls back to this registry entry.
    // CoinGecko's coin id "sui" (coins/images/26375) - verified against their public API.
    iconUrl: 'https://coin-images.coingecko.com/coins/images/26375/large/sui-ocean-square.png',
  },
  '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL': {
    name: 'WAL Token',
    symbol: 'WAL',
    priority: 2,
    verified: true,
    description: 'The native token for the Walrus Protocol',
    // CoinGecko id "walrus-2" (coins/images/54914) - the official full-color Walrus mark,
    // verified against their public API. The walrus.xyz domain's own icon asset (used here
    // previously) rendered as a generic dark "W" monogram, not the actual brand logo.
    iconUrl:
      'https://coin-images.coingecko.com/coins/images/54914/large/Walrus_Token_Full_Color_200x200.png',
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
    iconUrl: 'https://coin-images.coingecko.com/coins/images/26375/large/sui-ocean-square.png',
  },
  // Testnet WAL (if available) - same static icon as mainnet WAL; testnet's on-chain
  // CoinMetadata for this coin type doesn't exist (suix_getCoinMetadata returns null),
  // so without this the client fell back to a generic coin placeholder.
  '0x9f992cc2430a1f442ca7a5ca7638169f5d5c00e0ebc3977a65e9ac6e497fe5ef::wal::WAL': {
    name: 'WAL Token',
    symbol: 'WAL',
    priority: 2,
    verified: true,
    description: 'The native token for the Walrus Protocol (Testnet)',
    // CoinGecko id "walrus-2" (coins/images/54914) - the official full-color Walrus mark,
    // verified against their public API. The walrus.xyz domain's own icon asset (used here
    // previously) rendered as a generic dark "W" monogram, not the actual brand logo.
    iconUrl:
      'https://coin-images.coingecko.com/coins/images/54914/large/Walrus_Token_Full_Color_200x200.png',
  },
};

export const KNOWN_TOKENS_DEVNET: Record<string, KnownToken> = {
  '0x2::sui::SUI': {
    name: 'Sui',
    symbol: 'SUI',
    priority: 1,
    verified: true,
    description: 'Native token of the Sui network',
    iconUrl: 'https://coin-images.coingecko.com/coins/images/26375/large/sui-ocean-square.png',
  },
};

/**
 * Get known tokens registry for a specific network
 */
export function getKnownTokens(
  network: 'mainnet' | 'testnet' | 'devnet' | 'localnet'
): Record<string, KnownToken> {
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

// Struct names too generic to safely suffix-match (many unrelated tokens share these,
// e.g. mainnet USDC/USDT/wETH are all literally `coin::COIN` - matching on that alone
// would slap the wrong icon on an unrelated token).
const AMBIGUOUS_STRUCT_NAMES = new Set(['coin::COIN']);

function moduleStructSuffix(coinType: string): string {
  const parts = coinType.split('::');
  return parts.slice(-2).join('::');
}

/**
 * Get token info if known
 */
export function getKnownToken(coinType: string, network: string): KnownToken | null {
  const tokens = getKnownTokens(network as any);
  if (tokens[coinType]) return tokens[coinType];

  // Exact package-address match failed - fall back to matching on `module::StructName`
  // alone for tokens whose name is specific enough to be unambiguous (SUI, WAL). This
  // covers custom/local test deployments of a well-known token under a different
  // package id than the canonical one hardcoded above (e.g. a locally-published WAL
  // test package) - same class of address-canonicalization gap as `isCoinType`.
  const suffix = moduleStructSuffix(coinType);
  if (AMBIGUOUS_STRUCT_NAMES.has(suffix)) return null;
  for (const [knownType, token] of Object.entries(tokens)) {
    if (moduleStructSuffix(knownType) === suffix) return token;
  }
  return null;
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
