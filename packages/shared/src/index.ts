// Shared types for Sui CLI Web

/**
 * Ports a client scans to find the local server, in order.
 *
 * This is the contract between "where the server listens" and "where clients
 * look". A server started outside this list is invisible to every client and
 * presents exactly like one that failed to start, which is the least
 * debuggable outcome there is - so the list lives here, imported by the web
 * UI and the MCP server alike, rather than being copied into each.
 */
export const COMMON_SERVER_PORTS = [3001, 3002, 3003, 3004, 3005, 4001, 4002, 8001, 8080] as const;

/** Default port the server binds when PORT is unset. */
export const DEFAULT_SERVER_PORT = 3001;

export interface SuiAddress {
  address: string;
  alias?: string;
  isActive: boolean;
  balance?: string;
  objectCount?: number;
}

export interface SuiEnvironment {
  alias: string;
  rpc: string;
  ws?: string;
  isActive: boolean;
}

export interface SuiObject {
  objectId: string;
  version: string;
  digest: string;
  type: string;
  owner: string;
  previousTransaction?: string;
  storageRebate?: string;
  content?: Record<string, unknown>;
}

export interface GasCoin {
  coinObjectId: string;
  balance: string;
  version: string;
  digest: string;
}

export interface SuiKey {
  suiAddress: string;
  publicBase64Key: string;
  keyScheme: string;
  alias?: string;
  flag?: number;
  peerId?: string;
}

export interface FaucetResponse {
  success: boolean;
  message: string;
  txDigest?: string;
  error?: string;
}

export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
  rawOutput?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// API Request types
export interface SwitchAddressRequest {
  address: string;
}

export interface CreateAddressRequest {
  keyScheme?: 'ed25519' | 'secp256k1' | 'secp256r1';
  alias?: string;
}

export interface SwitchEnvironmentRequest {
  alias: string;
}

export interface AddEnvironmentRequest {
  alias: string;
  rpc: string;
  ws?: string;
}

export interface FaucetRequest {
  address?: string;
  network?: 'devnet' | 'testnet' | 'localnet';
}

export interface SplitCoinRequest {
  coinId: string;
  amounts: string[];
  gasBudget?: string;
}

export interface MergeCoinRequest {
  primaryCoinId: string;
  coinIdsToMerge: string[];
  gasBudget?: string;
}

// Transfer types
export interface TransferSuiRequest {
  to: string;
  amount: string;
  coinId?: string;
  gasBudget?: string;
}

export interface TransferObjectRequest {
  to: string;
  objectId: string;
  gasBudget?: string;
}

export interface TransferResult {
  digest: string;
  success: boolean;
  gasUsed?: string;
  error?: string;
}

export interface DryRunResult {
  success: boolean;
  estimatedGas: string;
  effects?: any;
  error?: string;
}

export interface TransferableCoin {
  coinObjectId: string;
  balance: string;
  balanceSui: string;
}

export interface TransferableObject {
  objectId: string;
  type: string;
  owner: string;
  digest: string;
}

// Key management types
export interface ExportKeyRequest {
  address: string;
  confirmationCode: string;
}

export interface ExportKeyResponse {
  privateKey: string;
  keyScheme: string;
  publicKey: string;
  warning: string;
}

export interface ImportKeyRequest {
  type: 'mnemonic' | 'privatekey';
  input: string;
  keyScheme: 'ed25519' | 'secp256k1' | 'secp256r1';
  alias?: string;
}

export interface ImportKeyResponse {
  address: string;
  alias?: string;
}

// Command types for the palette
export interface Command {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  category: string;
  keywords?: string[];
  action: string;
}

export const CATEGORIES = {
  ADDRESS: 'Addresses',
  ENVIRONMENT: 'Environment',
  OBJECTS: 'Objects & Assets',
  GAS: 'Gas',
  FAUCET: 'Faucet',
  KEYS: 'Keys & Security',
} as const;

export const DEFAULT_COMMANDS: Command[] = [
  {
    id: 'addresses',
    title: 'Manage Addresses',
    subtitle: 'View, switch, and create addresses',
    icon: '👤',
    category: CATEGORIES.ADDRESS,
    keywords: ['wallet', 'account', 'address'],
    action: 'addresses',
  },
  {
    id: 'environments',
    title: 'Switch Environment',
    subtitle: 'Change network (devnet, testnet, mainnet)',
    icon: '🌐',
    category: CATEGORIES.ENVIRONMENT,
    keywords: ['network', 'rpc', 'devnet', 'testnet', 'mainnet'],
    action: 'environments',
  },
  {
    id: 'objects',
    title: 'My Objects',
    subtitle: 'Browse owned objects',
    icon: '📦',
    category: CATEGORIES.OBJECTS,
    keywords: ['nft', 'coin', 'token', 'asset'],
    action: 'objects',
  },
  {
    id: 'gas',
    title: 'Gas Coins',
    subtitle: 'Manage gas coins (split, merge)',
    icon: '⛽',
    category: CATEGORIES.GAS,
    keywords: ['gas', 'coin', 'split', 'merge', 'sui'],
    action: 'gas',
  },
  {
    id: 'faucet',
    title: 'Request Faucet',
    subtitle: 'Get test tokens from faucet',
    icon: '🚰',
    category: CATEGORIES.FAUCET,
    keywords: ['faucet', 'free', 'token', 'test'],
    action: 'faucet',
  },
];

// Constants
// Default API URL for local development - clients should override via env vars
export const API_BASE_URL = 'http://localhost:3001/api';

export const NETWORKS = {
  devnet: {
    rpc: 'https://fullnode.devnet.sui.io:443',
    faucet: 'https://faucet.devnet.sui.io/v2/gas',
  },
  testnet: {
    rpc: 'https://fullnode.testnet.sui.io:443',
    faucet: 'https://faucet.testnet.sui.io/v2/gas',
  },
  mainnet: {
    rpc: 'https://fullnode.mainnet.sui.io:443',
    faucet: null,
  },
  localnet: {
    rpc: 'http://127.0.0.1:9000',
    faucet: 'http://127.0.0.1:9123/v2/gas',
  },
} as const;

// Faucet sources - multiple providers for better availability
export interface FaucetSource {
  id: string;
  name: string;
  description: string;
  networks: ('devnet' | 'testnet')[];
  type: 'api' | 'web' | 'discord';
  url?: string; // For web/discord types
  apiUrl?: string; // For api types
  apiFormat?: 'sui-official' | 'mysten'; // API request format
  dailyLimit?: string;
  perRequestAmount?: string;
}

// ====== Coin Management Types ======

export interface CoinInfo {
  coinObjectId: string;
  coinType: string;
  balance: string;
  version: string;
  digest: string;
}

export interface CoinGroup {
  coinType: string;
  symbol: string;
  name: string;
  decimals: number;
  totalBalance: string;
  formattedBalance: string;
  coins: CoinInfo[];
  coinCount: number;
  iconUrl?: string;
  // Package/contract info
  packageId: string;
  moduleName: string;
  isVerified?: boolean;
  description?: string;
}

export interface CoinGroupedResponse {
  groups: CoinGroup[];
  totalCoinTypes: number;
  totalCoins: number;
}

export interface PublishedPackageInfo {
  packageId: string;
  upgradeCapId: string;
  version: string;
  policy: number;
}

/** One combined per-wallet fetch (objects, coins, published packages) instead of 3
 * separate requests each spawning their own `sui` CLI subprocess - see /addresses/:address/summary. */
export interface WalletSummary {
  objectCount: number;
  packages: PublishedPackageInfo[];
  coinGroups: CoinGroupedResponse;
}

export interface CoinMetadata {
  coinType: string;
  name: string;
  symbol: string;
  decimals: number;
  description?: string;
  iconUrl?: string;
}

export interface GenericSplitRequest {
  coinId: string;
  coinType: string;
  amounts: string[];
  gasBudget?: string;
}

export interface GenericMergeRequest {
  primaryCoinId: string;
  coinIdsToMerge: string[];
  coinType: string;
  gasBudget?: string;
}

export interface GenericTransferCoinRequest {
  coinId: string;
  coinType: string;
  to: string;
  amount: string;
  gasBudget?: string;
}

export interface CoinOperationResult {
  success: boolean;
  digest?: string;
  gasUsed?: string;
  error?: string;
  newCoinIds?: string[];
}

// Helper to extract coin type from full Move type
// "0x2::coin::Coin<0x2::sui::SUI>" -> "0x2::sui::SUI"
export function extractCoinType(fullType: string): string | null {
  const match = fullType.match(/Coin<(.+)>/);
  return match ? match[1] : null;
}

// Helper to check if a type is a Coin type
// Matches on the module path only ("::coin::Coin<"), not the package address prefix - the
// framework package address can arrive as short-form ("0x2") or full 32-byte zero-padded
// canonical form ("0x000...0002") depending on the CLI/RPC version, and a strict "0x2::coin::
// Coin<" prefix match silently misses every object using the canonical form (real bug: this
// hid the Coin Balance section - and Transfer/Split/Merge actions with it - for such objects).
export function isCoinType(type: string): boolean {
  return type.includes('::coin::Coin<');
}

// Helper to get short symbol from coin type
// "0x2::sui::SUI" -> "SUI"
// "0x5d4b...::coin::USDC" -> "USDC"
export function getShortSymbol(coinType: string): string {
  const parts = coinType.split('::');
  return parts[parts.length - 1] || coinType;
}

export const FAUCET_SOURCES: FaucetSource[] = [
  {
    id: 'sui-official',
    name: 'Sui Official Faucet',
    description: 'Official Sui Foundation faucet',
    networks: ['devnet', 'testnet'],
    type: 'api',
    apiFormat: 'sui-official',
    dailyLimit: '10 requests/day',
    perRequestAmount: '1 SUI',
  },
  {
    id: 'sui-web-faucet',
    name: 'Sui Web Faucet',
    description: 'Official web faucet by Mysten Labs',
    networks: ['devnet', 'testnet'],
    type: 'web',
    url: 'https://faucet.sui.io/',
    dailyLimit: 'Rate limited',
    perRequestAmount: '1 SUI',
  },
  {
    id: 'blockbolt-faucet',
    name: 'Blockbolt Faucet',
    description: 'Community faucet - no captcha',
    networks: ['devnet', 'testnet'],
    type: 'web',
    url: 'https://faucet.blockbolt.io/',
    dailyLimit: 'Limited',
    perRequestAmount: '1 SUI',
  },
  {
    id: 'n1stake-faucet',
    name: 'n1stake Faucet',
    description: 'Fast faucet - no registration',
    networks: ['testnet'],
    type: 'web',
    url: 'https://faucet.n1stake.com/',
    dailyLimit: '1 request/day',
    perRequestAmount: '0.5 SUI',
  },
  {
    id: 'stakely-faucet',
    name: 'Stakely Faucet',
    description: 'Requires captcha verification',
    networks: ['testnet'],
    type: 'web',
    url: 'https://stakely.io/faucet/sui-testnet-sui',
    dailyLimit: '1 request/day',
    perRequestAmount: '0.5 SUI',
  },
  {
    id: 'sui-discord',
    name: 'Sui Discord Faucet',
    description: 'Get tokens via Discord bot #devnet-faucet or #testnet-faucet channel',
    networks: ['devnet', 'testnet'],
    type: 'discord',
    url: 'https://discord.gg/sui',
    dailyLimit: 'Varies',
    perRequestAmount: 'Varies',
  },
];
