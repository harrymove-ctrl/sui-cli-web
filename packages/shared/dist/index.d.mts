interface SuiAddress {
    address: string;
    alias?: string;
    isActive: boolean;
    balance?: string;
    objectCount?: number;
}
interface SuiEnvironment {
    alias: string;
    rpc: string;
    ws?: string;
    isActive: boolean;
}
interface SuiObject {
    objectId: string;
    version: string;
    digest: string;
    type: string;
    owner: string;
    previousTransaction?: string;
    storageRebate?: string;
    content?: Record<string, unknown>;
}
interface GasCoin {
    coinObjectId: string;
    balance: string;
    version: string;
    digest: string;
}
interface SuiKey {
    suiAddress: string;
    publicBase64Key: string;
    keyScheme: string;
    alias?: string;
    flag?: number;
    peerId?: string;
}
interface FaucetResponse {
    success: boolean;
    message: string;
    txDigest?: string;
    error?: string;
}
interface CommandResult {
    success: boolean;
    data?: unknown;
    error?: string;
    rawOutput?: string;
}
interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}
interface SwitchAddressRequest {
    address: string;
}
interface CreateAddressRequest {
    keyScheme?: 'ed25519' | 'secp256k1' | 'secp256r1';
    alias?: string;
}
interface SwitchEnvironmentRequest {
    alias: string;
}
interface AddEnvironmentRequest {
    alias: string;
    rpc: string;
    ws?: string;
}
interface FaucetRequest {
    address?: string;
    network?: 'devnet' | 'testnet' | 'localnet';
}
interface SplitCoinRequest {
    coinId: string;
    amounts: string[];
    gasBudget?: string;
}
interface MergeCoinRequest {
    primaryCoinId: string;
    coinIdsToMerge: string[];
    gasBudget?: string;
}
interface TransferSuiRequest {
    to: string;
    amount: string;
    coinId?: string;
    gasBudget?: string;
}
interface TransferObjectRequest {
    to: string;
    objectId: string;
    gasBudget?: string;
}
interface TransferResult {
    digest: string;
    success: boolean;
    gasUsed?: string;
    error?: string;
}
interface DryRunResult {
    success: boolean;
    estimatedGas: string;
    effects?: any;
    error?: string;
}
interface TransferableCoin {
    coinObjectId: string;
    balance: string;
    balanceSui: string;
}
interface TransferableObject {
    objectId: string;
    type: string;
    owner: string;
    digest: string;
}
interface ExportKeyRequest {
    address: string;
    confirmationCode: string;
}
interface ExportKeyResponse {
    privateKey: string;
    keyScheme: string;
    publicKey: string;
    warning: string;
}
interface ImportKeyRequest {
    type: 'mnemonic' | 'privatekey';
    input: string;
    keyScheme: 'ed25519' | 'secp256k1' | 'secp256r1';
    alias?: string;
}
interface ImportKeyResponse {
    address: string;
    alias?: string;
}
interface Command {
    id: string;
    title: string;
    subtitle?: string;
    icon?: string;
    category: string;
    keywords?: string[];
    action: string;
}
declare const CATEGORIES: {
    readonly ADDRESS: "Addresses";
    readonly ENVIRONMENT: "Environment";
    readonly OBJECTS: "Objects & Assets";
    readonly GAS: "Gas";
    readonly FAUCET: "Faucet";
    readonly KEYS: "Keys & Security";
};
declare const DEFAULT_COMMANDS: Command[];
declare const API_BASE_URL = "http://localhost:3001/api";
declare const NETWORKS: {
    readonly devnet: {
        readonly rpc: "https://fullnode.devnet.sui.io:443";
        readonly faucet: "https://faucet.devnet.sui.io/v2/gas";
    };
    readonly testnet: {
        readonly rpc: "https://fullnode.testnet.sui.io:443";
        readonly faucet: "https://faucet.testnet.sui.io/v2/gas";
    };
    readonly mainnet: {
        readonly rpc: "https://fullnode.mainnet.sui.io:443";
        readonly faucet: null;
    };
    readonly localnet: {
        readonly rpc: "http://127.0.0.1:9000";
        readonly faucet: "http://127.0.0.1:9123/v2/gas";
    };
};
interface FaucetSource {
    id: string;
    name: string;
    description: string;
    networks: ('devnet' | 'testnet')[];
    type: 'api' | 'web' | 'discord';
    url?: string;
    apiUrl?: string;
    apiFormat?: 'sui-official' | 'mysten';
    dailyLimit?: string;
    perRequestAmount?: string;
}
interface CoinInfo {
    coinObjectId: string;
    coinType: string;
    balance: string;
    version: string;
    digest: string;
}
interface CoinGroup {
    coinType: string;
    symbol: string;
    name: string;
    decimals: number;
    totalBalance: string;
    formattedBalance: string;
    coins: CoinInfo[];
    coinCount: number;
    iconUrl?: string;
    packageId: string;
    moduleName: string;
    isVerified?: boolean;
    description?: string;
}
interface CoinGroupedResponse {
    groups: CoinGroup[];
    totalCoinTypes: number;
    totalCoins: number;
}
interface PublishedPackageInfo {
    packageId: string;
    upgradeCapId: string;
    version: string;
    policy: number;
}
/** One combined per-wallet fetch (objects, coins, published packages) instead of 3
 * separate requests each spawning their own `sui` CLI subprocess - see /addresses/:address/summary. */
interface WalletSummary {
    objectCount: number;
    packages: PublishedPackageInfo[];
    coinGroups: CoinGroupedResponse;
}
interface CoinMetadata {
    coinType: string;
    name: string;
    symbol: string;
    decimals: number;
    description?: string;
    iconUrl?: string;
}
interface GenericSplitRequest {
    coinId: string;
    coinType: string;
    amounts: string[];
    gasBudget?: string;
}
interface GenericMergeRequest {
    primaryCoinId: string;
    coinIdsToMerge: string[];
    coinType: string;
    gasBudget?: string;
}
interface GenericTransferCoinRequest {
    coinId: string;
    coinType: string;
    to: string;
    amount: string;
    gasBudget?: string;
}
interface CoinOperationResult {
    success: boolean;
    digest?: string;
    gasUsed?: string;
    error?: string;
    newCoinIds?: string[];
}
declare function extractCoinType(fullType: string): string | null;
declare function isCoinType(type: string): boolean;
declare function getShortSymbol(coinType: string): string;
declare const FAUCET_SOURCES: FaucetSource[];

export { API_BASE_URL, type AddEnvironmentRequest, type ApiResponse, CATEGORIES, type CoinGroup, type CoinGroupedResponse, type CoinInfo, type CoinMetadata, type CoinOperationResult, type Command, type CommandResult, type CreateAddressRequest, DEFAULT_COMMANDS, type DryRunResult, type ExportKeyRequest, type ExportKeyResponse, FAUCET_SOURCES, type FaucetRequest, type FaucetResponse, type FaucetSource, type GasCoin, type GenericMergeRequest, type GenericSplitRequest, type GenericTransferCoinRequest, type ImportKeyRequest, type ImportKeyResponse, type MergeCoinRequest, NETWORKS, type PublishedPackageInfo, type SplitCoinRequest, type SuiAddress, type SuiEnvironment, type SuiKey, type SuiObject, type SwitchAddressRequest, type SwitchEnvironmentRequest, type TransferObjectRequest, type TransferResult, type TransferSuiRequest, type TransferableCoin, type TransferableObject, type WalletSummary, extractCoinType, getShortSymbol, isCoinType };
