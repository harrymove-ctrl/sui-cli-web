// Explorer URL utilities with network awareness

export type NetworkType = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

export interface ExplorerConfig {
  name: string;
  baseUrl: string;
  networks: NetworkType[];
  objectPath: (network: NetworkType, id: string) => string;
  txPath: (network: NetworkType, digest: string) => string;
  addressPath: (network: NetworkType, address: string) => string;
  packagePath: (network: NetworkType, packageId: string) => string;
}

export const EXPLORERS: ExplorerConfig[] = [
  {
    name: 'Suiscan',
    baseUrl: 'https://suiscan.xyz',
    networks: ['mainnet', 'testnet', 'devnet'],
    objectPath: (network, id) => `/${network}/object/${id}`,
    txPath: (network, digest) => `/${network}/tx/${digest}`,
    addressPath: (network, address) => `/${network}/account/${address}`,
    packagePath: (network, packageId) => `/${network}/object/${packageId}`,
  },
  {
    name: 'Sui Explorer',
    baseUrl: 'https://suiexplorer.com',
    networks: ['mainnet', 'testnet', 'devnet'],
    objectPath: (network, id) => `/object/${id}?network=${network}`,
    txPath: (network, digest) => `/txblock/${digest}?network=${network}`,
    addressPath: (network, address) => `/address/${address}?network=${network}`,
    packagePath: (network, packageId) => `/object/${packageId}?network=${network}`,
  },
  {
    name: 'SuiVision',
    baseUrl: 'https://suivision.xyz',
    networks: ['mainnet', 'testnet', 'devnet'],
    objectPath: (network, id) => network === 'mainnet' ? `/object/${id}` : `/${network}/object/${id}`,
    txPath: (network, digest) => network === 'mainnet' ? `/txblock/${digest}` : `/${network}/txblock/${digest}`,
    addressPath: (network, address) => network === 'mainnet' ? `/account/${address}` : `/${network}/account/${address}`,
    packagePath: (network, packageId) => network === 'mainnet' ? `/package/${packageId}` : `/${network}/package/${packageId}`,
  },
];

// Detect network from environment alias or RPC URL
export function detectNetwork(alias?: string, rpcUrl?: string): NetworkType {
  if (alias) {
    const lower = alias.toLowerCase();
    if (lower.includes('mainnet') || lower.includes('main')) return 'mainnet';
    if (lower.includes('testnet') || lower.includes('test')) return 'testnet';
    if (lower.includes('devnet') || lower.includes('dev')) return 'devnet';
    if (lower.includes('local')) return 'localnet';
  }

  if (rpcUrl) {
    if (rpcUrl.includes('mainnet')) return 'mainnet';
    if (rpcUrl.includes('testnet')) return 'testnet';
    if (rpcUrl.includes('devnet')) return 'devnet';
    if (rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost')) return 'localnet';
  }

  return 'mainnet'; // default
}

// Get default explorer (Suiscan)
export function getDefaultExplorer(): ExplorerConfig {
  return EXPLORERS[0];
}

// Get explorer by name
export function getExplorerByName(name: string): ExplorerConfig | undefined {
  return EXPLORERS.find(e => e.name.toLowerCase() === name.toLowerCase());
}

// Build explorer URLs
export function buildExplorerUrl(
  explorer: ExplorerConfig,
  network: NetworkType,
  type: 'object' | 'tx' | 'address' | 'package',
  id: string
): string {
  // For localnet, default to Suiscan devnet since localnet doesn't have explorers
  const effectiveNetwork = network === 'localnet' ? 'devnet' : network;

  if (!explorer.networks.includes(effectiveNetwork)) {
    // Fallback to Suiscan if explorer doesn't support the network
    explorer = EXPLORERS[0];
  }

  let path: string;
  switch (type) {
    case 'object':
      path = explorer.objectPath(effectiveNetwork, id);
      break;
    case 'tx':
      path = explorer.txPath(effectiveNetwork, id);
      break;
    case 'address':
      path = explorer.addressPath(effectiveNetwork, id);
      break;
    case 'package':
      path = explorer.packagePath(effectiveNetwork, id);
      break;
  }

  return `${explorer.baseUrl}${path}`;
}

// Helper to open in explorer with network awareness
export function openInExplorer(
  network: NetworkType,
  type: 'object' | 'tx' | 'address' | 'package',
  id: string,
  explorerName?: string
): void {
  const explorer = explorerName
    ? getExplorerByName(explorerName) || getDefaultExplorer()
    : getDefaultExplorer();

  const url = buildExplorerUrl(explorer, network, type, id);
  // Use noopener,noreferrer to prevent tabnapping attacks
  window.open(url, '_blank', 'noopener,noreferrer');
}
