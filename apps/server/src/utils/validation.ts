// Validation utilities for Sui addresses and object IDs

// Sui address format: 0x followed by 1-64 hex characters (will be normalized to 64)
const SUI_ADDRESS_REGEX = /^0x[a-fA-F0-9]{1,64}$/;

// Object ID has the same format as address
const OBJECT_ID_REGEX = /^0x[a-fA-F0-9]{1,64}$/;

// Valid key schemes
const VALID_KEY_SCHEMES = ['ed25519', 'secp256k1', 'secp256r1'] as const;

// Alias: alphanumeric with underscores/hyphens, 1-50 chars
const ALIAS_REGEX = /^[a-zA-Z0-9_-]{1,50}$/;

// Network types
const VALID_NETWORKS = ['testnet', 'devnet', 'localnet'] as const;

// Normalize Sui address to full 64 hex chars (pad with zeros)
export function normalizeSuiAddress(address: string): string {
  if (!address.startsWith('0x')) {
    return address;
  }
  // Remove 0x prefix, pad to 64 chars, add 0x back
  const hex = address.slice(2).toLowerCase();
  return '0x' + hex.padStart(64, '0');
}

export function isValidSuiAddress(address: string): boolean {
  return typeof address === 'string' && SUI_ADDRESS_REGEX.test(address);
}

export function isValidObjectId(objectId: string): boolean {
  return typeof objectId === 'string' && OBJECT_ID_REGEX.test(objectId);
}

export function isValidKeyScheme(scheme: string): scheme is 'ed25519' | 'secp256k1' | 'secp256r1' {
  return VALID_KEY_SCHEMES.includes(scheme as any);
}

export function isValidAlias(alias: string): boolean {
  return typeof alias === 'string' && ALIAS_REGEX.test(alias);
}

export function isValidNetwork(network: string): network is 'testnet' | 'devnet' | 'localnet' {
  return VALID_NETWORKS.includes(network as any);
}

export function isValidRpcUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidAmount(amount: string): boolean {
  // Must be a positive integer string
  return typeof amount === 'string' && /^[1-9]\d*$/.test(amount);
}

export function isValidGasBudget(budget: string): boolean {
  // Must be a positive integer string, reasonable range (1 to 50 billion MIST)
  if (typeof budget !== 'string' || !/^[1-9]\d*$/.test(budget)) {
    return false;
  }
  const value = BigInt(budget);
  return value >= 1n && value <= 50_000_000_000n;
}

// Validation result type
export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationException extends Error {
  public errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super(errors.map((e) => `${e.field}: ${e.message}`).join(', '));
    this.errors = errors;
    this.name = 'ValidationException';
  }
}

// Helper to validate and throw (normalizes address to 64 chars)
export function validateAddress(address: unknown, fieldName = 'address'): string {
  if (typeof address !== 'string' || !isValidSuiAddress(address)) {
    throw new ValidationException([
      { field: fieldName, message: 'Invalid Sui address format (expected 0x + hex chars)' },
    ]);
  }
  return normalizeSuiAddress(address);
}

export function validateObjectId(objectId: unknown, fieldName = 'objectId'): string {
  if (typeof objectId !== 'string' || !isValidObjectId(objectId)) {
    throw new ValidationException([
      { field: fieldName, message: 'Invalid object ID format (expected 0x + hex chars)' },
    ]);
  }
  return normalizeSuiAddress(objectId); // Same normalization as address
}

export function validateOptionalAlias(alias: unknown): string | undefined {
  if (alias === undefined || alias === null || alias === '') {
    return undefined;
  }
  if (typeof alias !== 'string' || !isValidAlias(alias)) {
    throw new ValidationException([
      { field: 'alias', message: 'Invalid alias (1-50 alphanumeric chars, underscores, hyphens)' },
    ]);
  }
  return alias;
}

export function validateKeyScheme(
  scheme: unknown
): 'ed25519' | 'secp256k1' | 'secp256r1' | undefined {
  if (scheme === undefined || scheme === null) {
    return undefined;
  }
  if (typeof scheme !== 'string' || !isValidKeyScheme(scheme)) {
    throw new ValidationException([
      {
        field: 'keyScheme',
        message: 'Invalid key scheme (expected ed25519, secp256k1, or secp256r1)',
      },
    ]);
  }
  return scheme;
}

export function validateNetwork(network: unknown): 'testnet' | 'devnet' | 'localnet' {
  if (typeof network !== 'string' || !isValidNetwork(network)) {
    throw new ValidationException([
      { field: 'network', message: 'Invalid network (expected testnet, devnet, or localnet)' },
    ]);
  }
  return network;
}

export function validateRpcUrl(url: unknown, fieldName = 'rpc'): string {
  if (typeof url !== 'string' || !isValidRpcUrl(url)) {
    throw new ValidationException([
      { field: fieldName, message: 'Invalid RPC URL (expected http:// or https://)' },
    ]);
  }
  return url;
}

export function validateAmounts(amounts: unknown): string[] {
  if (!Array.isArray(amounts) || amounts.length === 0) {
    throw new ValidationException([
      { field: 'amounts', message: 'Amounts must be a non-empty array' },
    ]);
  }
  for (let i = 0; i < amounts.length; i++) {
    if (!isValidAmount(amounts[i])) {
      throw new ValidationException([
        { field: `amounts[${i}]`, message: 'Each amount must be a positive integer string' },
      ]);
    }
  }
  return amounts;
}

export function validateCoinIds(coinIds: unknown, fieldName = 'coinIds'): string[] {
  if (!Array.isArray(coinIds) || coinIds.length === 0) {
    throw new ValidationException([
      { field: fieldName, message: 'Coin IDs must be a non-empty array' },
    ]);
  }
  for (let i = 0; i < coinIds.length; i++) {
    if (!isValidObjectId(coinIds[i])) {
      throw new ValidationException([
        { field: `${fieldName}[${i}]`, message: 'Invalid coin ID format' },
      ]);
    }
  }
  return coinIds;
}

export function validateOptionalGasBudget(budget: unknown): string | undefined {
  if (budget === undefined || budget === null || budget === '') {
    return undefined;
  }
  if (typeof budget !== 'string' || !isValidGasBudget(budget)) {
    throw new ValidationException([
      { field: 'gasBudget', message: 'Invalid gas budget (positive integer, max 50 billion)' },
    ]);
  }
  return budget;
}

// Move module name: alphanumeric with underscores, starts with letter or underscore
const MODULE_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/;

// Move function name: same as module name
const FUNCTION_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/;

// Type args: safe characters for generic type parameters (e.g., "0x2::sui::SUI")
const TYPE_ARG_REGEX = /^[a-zA-Z0-9_:<>,\s]+$/;

// Transaction digest: base58 (43-44 chars) OR hex (0x + 64 hex chars)
const TX_DIGEST_BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const TX_DIGEST_HEX_REGEX = /^0x[a-fA-F0-9]{64}$/;

// Shell metacharacters to block in args
// Allow: [] for vector args, ' for strings, " for strings
// Block: ; & | ` $ ( ) { } \ < > ! # ~ * ?
const SHELL_METACHAR_REGEX = /[;&|`$(){}\\<>!#~*?]/;

export function isValidModuleName(name: string): boolean {
  return typeof name === 'string' && MODULE_NAME_REGEX.test(name);
}

export function isValidFunctionName(name: string): boolean {
  return typeof name === 'string' && FUNCTION_NAME_REGEX.test(name);
}

export function isValidTypeArg(arg: string): boolean {
  return typeof arg === 'string' && TYPE_ARG_REGEX.test(arg) && arg.length <= 256;
}

export function isValidTxDigest(digest: string): boolean {
  return (
    typeof digest === 'string' &&
    (TX_DIGEST_BASE58_REGEX.test(digest) || TX_DIGEST_HEX_REGEX.test(digest))
  );
}

export function isSafeArg(arg: string): boolean {
  return typeof arg === 'string' && !SHELL_METACHAR_REGEX.test(arg) && arg.length <= 1024;
}

export function validateModuleName(module: unknown, fieldName = 'module'): string {
  if (typeof module !== 'string' || !isValidModuleName(module)) {
    throw new ValidationException([
      {
        field: fieldName,
        message:
          'Invalid module name (alphanumeric/underscore, starts with letter/underscore, max 128 chars)',
      },
    ]);
  }
  return module;
}

export function validateFunctionName(functionName: unknown, fieldName = 'function'): string {
  if (typeof functionName !== 'string' || !isValidFunctionName(functionName)) {
    throw new ValidationException([
      {
        field: fieldName,
        message:
          'Invalid function name (alphanumeric/underscore, starts with letter/underscore, max 128 chars)',
      },
    ]);
  }
  return functionName;
}

export function validateTypeArgs(typeArgs: unknown): string[] {
  if (typeArgs === undefined || typeArgs === null) {
    return [];
  }
  if (!Array.isArray(typeArgs)) {
    throw new ValidationException([
      { field: 'typeArgs', message: 'Type arguments must be an array' },
    ]);
  }
  for (let i = 0; i < typeArgs.length; i++) {
    if (!isValidTypeArg(typeArgs[i])) {
      throw new ValidationException([
        { field: `typeArgs[${i}]`, message: 'Invalid type argument format' },
      ]);
    }
  }
  return typeArgs;
}

export function validateMoveArgs(args: unknown): string[] {
  if (args === undefined || args === null) {
    return [];
  }
  if (!Array.isArray(args)) {
    throw new ValidationException([{ field: 'args', message: 'Arguments must be an array' }]);
  }
  for (let i = 0; i < args.length; i++) {
    if (!isSafeArg(args[i])) {
      throw new ValidationException([
        {
          field: `args[${i}]`,
          message: 'Invalid argument (contains forbidden characters or too long)',
        },
      ]);
    }
  }
  return args;
}

export function validateTxDigest(digest: unknown, fieldName = 'digest'): string {
  if (typeof digest !== 'string' || !isValidTxDigest(digest)) {
    throw new ValidationException([
      {
        field: fieldName,
        message:
          'Invalid transaction digest format (expected base58 43-44 chars OR hex 0x + 64 chars)',
      },
    ]);
  }
  return digest;
}

// Output IDs are always generated server-side via crypto.randomUUID() - a
// caller-supplied value that isn't a UUID has no legitimate use and, if
// interpolated into a file path, is how `../../..` traversal happens.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateOutputId(id: unknown, fieldName = 'id'): string {
  if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
    throw new ValidationException([{ field: fieldName, message: 'Invalid output ID format' }]);
  }
  return id;
}

// Package path validation - prevent path traversal attacks
const PACKAGE_PATH_REGEX = /^[a-zA-Z0-9/_-]+$/;

export function validatePackagePath(packagePath: unknown): string {
  if (typeof packagePath !== 'string' || !packagePath.trim()) {
    throw new ValidationException([{ field: 'packagePath', message: 'Package path is required' }]);
  }

  const trimmed = packagePath.trim();

  // Check for path traversal attempts
  if (trimmed.includes('..')) {
    throw new ValidationException([
      { field: 'packagePath', message: 'Package path cannot contain ".."' },
    ]);
  }

  // Must be absolute path on Unix/Linux or valid Windows path
  const isUnixAbsolute = trimmed.startsWith('/');
  const isWindowsAbsolute = /^[A-Za-z]:[/\\]/.test(trimmed);

  if (!isUnixAbsolute && !isWindowsAbsolute) {
    throw new ValidationException([
      { field: 'packagePath', message: 'Package path must be absolute' },
    ]);
  }

  // Check length
  if (trimmed.length > 1024) {
    throw new ValidationException([
      { field: 'packagePath', message: 'Package path too long (max 1024 characters)' },
    ]);
  }

  return trimmed;
}

// Private key validation (Bech32 format starting with "suiprivkey")
const PRIVATE_KEY_REGEX = /^suiprivkey[a-zA-Z0-9]+$/;

export function isValidPrivateKey(privateKey: string): boolean {
  return typeof privateKey === 'string' && PRIVATE_KEY_REGEX.test(privateKey);
}

// Mnemonic validation (12, 15, 18, 21, or 24 words)
export function isValidMnemonic(mnemonic: string): boolean {
  if (typeof mnemonic !== 'string') return false;

  const words = mnemonic.trim().split(/\s+/);
  const validWordCounts = [12, 15, 18, 21, 24];
  return validWordCounts.includes(words.length);
}

// Amount validation for transfers (must be positive decimal)
export function isValidTransferAmount(amount: string): boolean {
  if (typeof amount !== 'string') return false;

  // Allow decimal amounts like "0.1", "1", "100.5"
  const amountRegex = /^(\d+\.?\d*|\d*\.\d+)$/;
  if (!amountRegex.test(amount)) return false;

  const numValue = parseFloat(amount);
  return !isNaN(numValue) && numValue > 0;
}

export function validateTransferAmount(amount: unknown, fieldName = 'amount'): string {
  if (!isValidTransferAmount(amount as string)) {
    throw new ValidationException([
      { field: fieldName, message: 'Invalid amount (must be a positive decimal number)' },
    ]);
  }
  return amount as string;
}

export function validatePrivateKey(privateKey: unknown, fieldName = 'privateKey'): string {
  if (typeof privateKey !== 'string' || !isValidPrivateKey(privateKey)) {
    throw new ValidationException([
      {
        field: fieldName,
        message: 'Invalid private key format (expected Bech32 starting with "suiprivkey")',
      },
    ]);
  }
  return privateKey;
}

export function validateMnemonic(mnemonic: unknown, fieldName = 'mnemonic'): string {
  if (typeof mnemonic !== 'string' || !isValidMnemonic(mnemonic)) {
    throw new ValidationException([
      { field: fieldName, message: 'Invalid mnemonic (expected 12, 15, 18, 21, or 24 words)' },
    ]);
  }
  return mnemonic;
}

// Base64 string validation (for public keys, signatures, etc.)
const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

export function isValidBase64(str: string): boolean {
  if (typeof str !== 'string' || str.length === 0) return false;
  // Must be valid base64 and reasonable length
  return BASE64_REGEX.test(str) && str.length >= 4 && str.length <= 10000;
}

export function validateBase64(data: unknown, fieldName = 'data'): string {
  if (typeof data !== 'string' || !isValidBase64(data)) {
    throw new ValidationException([{ field: fieldName, message: 'Invalid base64 string' }]);
  }
  return data;
}

// Hex string validation (for transaction bytes, data to sign, etc.)
const HEX_STRING_REGEX = /^(0x)?[a-fA-F0-9]+$/;

export function isValidHexString(str: string): boolean {
  if (typeof str !== 'string' || str.length === 0) return false;
  return HEX_STRING_REGEX.test(str) && str.length <= 100000;
}

export function validateHexString(data: unknown, fieldName = 'data'): string {
  if (typeof data !== 'string' || !isValidHexString(data)) {
    throw new ValidationException([
      {
        field: fieldName,
        message: 'Invalid hex string (expected hex digits with optional 0x prefix)',
      },
    ]);
  }
  return data;
}

// Public key validation (Base64 or hex)
export function validatePublicKey(publicKey: unknown, fieldName = 'publicKey'): string {
  if (typeof publicKey !== 'string' || publicKey.length === 0) {
    throw new ValidationException([{ field: fieldName, message: 'Public key is required' }]);
  }

  // Accept either base64 or hex format
  if (!isValidBase64(publicKey) && !isValidHexString(publicKey)) {
    throw new ValidationException([
      { field: fieldName, message: 'Invalid public key format (expected base64 or hex)' },
    ]);
  }

  return publicKey;
}

// Signature validation (Base64 or hex)
export function validateSignature(signature: unknown, fieldName = 'signature'): string {
  if (typeof signature !== 'string' || signature.length === 0) {
    throw new ValidationException([{ field: fieldName, message: 'Signature is required' }]);
  }

  // Accept either base64 or hex format
  if (!isValidBase64(signature) && !isValidHexString(signature)) {
    throw new ValidationException([
      { field: fieldName, message: 'Invalid signature format (expected base64 or hex)' },
    ]);
  }

  return signature;
}
