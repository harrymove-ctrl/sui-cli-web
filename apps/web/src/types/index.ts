// Shared types for Sui CLI Web

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

export interface FaucetResponse {
  success: boolean;
  message: string;
  txDigest?: string;
  error?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
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
  /** Feature flag required to show this command (from Statsig) */
  featureFlag?: 'enable_beta_features' | 'enable_new_ui_features' | 'enable_analytics_tracking';
  /** If true, command is only shown when feature flag is DISABLED (for A/B testing) */
  hideWhenFlagEnabled?: boolean;
}

export const CATEGORIES = {
  ACCOUNT: 'Account',
  ASSETS: 'Assets',
  ACTIONS: 'Actions',
  DEVELOPMENT: 'Development',
  SECURITY: 'Security',
} as const;

export const DEFAULT_COMMANDS: Command[] = [
  // Account - your wallet context
  {
    id: 'addresses',
    title: 'Manage Addresses',
    subtitle: 'View, switch, and create wallets',
    icon: '👤',
    category: CATEGORIES.ACCOUNT,
    keywords: ['wallet', 'account', 'address'],
    action: 'addresses',
  },
  {
    id: 'environments',
    title: 'Switch Network',
    subtitle: 'Change network (devnet, testnet, mainnet)',
    icon: '🌐',
    category: CATEGORIES.ACCOUNT,
    keywords: ['network', 'rpc', 'devnet', 'testnet', 'mainnet', 'environment'],
    action: 'environments',
  },
  // Assets - what you own
  {
    id: 'objects',
    title: 'My Objects',
    subtitle: 'Browse NFTs, capabilities, and owned objects',
    icon: '📦',
    category: CATEGORIES.ASSETS,
    keywords: ['nft', 'object', 'asset', 'capability'],
    action: 'objects',
  },
  {
    id: 'gas',
    title: 'My Coins',
    subtitle: 'View all coin types (SUI, WAL, USDC...)',
    icon: '🪙',
    category: CATEGORIES.ASSETS,
    keywords: ['gas', 'coin', 'split', 'merge', 'sui', 'wal', 'usdc', 'token', 'balance'],
    action: 'gas',
  },
  {
    id: 'dynamic-fields',
    title: 'Dynamic Fields',
    subtitle: 'Query dynamic fields on any object',
    icon: '🔗',
    category: CATEGORIES.ASSETS,
    keywords: ['dynamic', 'field', 'object', 'query', 'explore'],
    action: 'dynamic-fields',
  },
  // Actions - things you do
  {
    id: 'transfer',
    title: 'Transfer',
    subtitle: 'Send SUI or objects to another address',
    icon: '💸',
    category: CATEGORIES.ACTIONS,
    keywords: ['transfer', 'send', 'pay', 'payment', 'sui', 'token'],
    action: 'transfer',
  },
  {
    id: 'faucet',
    title: 'Request Faucet',
    subtitle: 'Get free test tokens',
    icon: '🚰',
    category: CATEGORIES.ACTIONS,
    keywords: ['faucet', 'free', 'token', 'test'],
    action: 'faucet',
  },
  // Development - dev workflow
  {
    id: 'move',
    title: 'Move Studio',
    subtitle: 'Build, test, publish & upgrade packages',
    icon: '📦',
    category: CATEGORIES.DEVELOPMENT,
    keywords: ['move', 'smart contract', 'build', 'test', 'publish', 'upgrade', 'package', 'deploy', 'development'],
    action: 'move',
  },
  {
    id: 'inspector',
    title: 'Transaction Inspector',
    subtitle: 'Inspect & replay transactions',
    icon: '🔍',
    category: CATEGORIES.DEVELOPMENT,
    keywords: ['transaction', 'inspect', 'replay', 'debug', 'debugger', 'bytecode', 'tx'],
    action: 'inspector',
  },
  {
    id: 'devtools',
    title: 'Developer Tools',
    subtitle: 'Coverage, disassembly, package summary',
    icon: '🛠️',
    category: CATEGORIES.DEVELOPMENT,
    keywords: ['coverage', 'disassemble', 'summary', 'bytecode', 'test', 'debug'],
    action: 'devtools',
  },
  // Security - keys and verification
  {
    id: 'keytool',
    title: 'Key Management',
    subtitle: 'Generate keys, sign messages, multi-sig',
    icon: '🔑',
    category: CATEGORIES.SECURITY,
    keywords: ['key', 'generate', 'sign', 'multisig', 'signature', 'keypair'],
    action: 'keytool',
  },
  {
    id: 'security',
    title: 'Verification Tools',
    subtitle: 'Verify source, bytecode, decode transactions',
    icon: '🔒',
    category: CATEGORIES.SECURITY,
    keywords: ['verify', 'source', 'bytecode', 'security', 'decode', 'transaction', 'audit'],
    action: 'security',
  },
];
