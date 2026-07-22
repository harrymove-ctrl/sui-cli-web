import { SuiCliExecutor } from '../cli/SuiCliExecutor';
import { ConfigParser } from '../cli/ConfigParser';
import { InspectorService, FunctionInfo, ParameterInfo } from './dev/InspectorService';

// Type categories for parameter classification
export type ParameterCategory =
  | 'reference_mut'   // &mut T - mutable reference, needs owned object
  | 'reference'       // &T - immutable reference
  | 'owned'           // T (struct) - owned object
  | 'primitive_u8'    // u8
  | 'primitive_u16'   // u16
  | 'primitive_u32'   // u32
  | 'primitive_u64'   // u64
  | 'primitive_u128'  // u128
  | 'primitive_u256'  // u256
  | 'primitive_bool'  // bool
  | 'primitive_address' // address
  | 'vector_u8'       // vector<u8> - commonly used for strings
  | 'vector'          // vector<T> (other types)
  | 'option'          // Option<T>
  | 'type_param'      // Generic T
  | 'unknown';

export interface ParsedType {
  category: ParameterCategory;
  rawType: string;
  baseType: string;
  genericParams: string[];
  isMutable: boolean;
  isReference: boolean;
  isVector: boolean;
  isOption: boolean;
}

export interface ParameterSuggestion {
  type: 'object' | 'value' | 'address' | 'coin';
  label: string;
  value: string;
  metadata?: {
    objectId?: string;
    type?: string;
    version?: string;
    digest?: string;
    balance?: string;
    fields?: Record<string, unknown>;
  };
}

export interface AnalyzedParameter {
  name: string;
  type: string;
  parsedType: ParsedType;
  suggestions: ParameterSuggestion[];
  autoFilled?: {
    value: string;
    reason: 'only_one_option' | 'default_value' | 'user_preference';
  };
  examples: string[];
  validation?: {
    pattern?: string;
    min?: string;
    max?: string;
    message?: string;
  };
  helpText?: string;
}

export interface AnalyzeParametersResult {
  success: boolean;
  parameters?: AnalyzedParameter[];
  function?: {
    name: string;
    visibility: string;
  };
  error?: string;
}

// Constants for type bounds
const TYPE_BOUNDS = {
  u8: { min: '0', max: '255' },
  u16: { min: '0', max: '65535' },
  u32: { min: '0', max: '4294967295' },
  u64: { min: '0', max: '18446744073709551615' },
  u128: { min: '0', max: '340282366920938463463374607431768211455' },
  u256: { min: '0', max: '115792089237316195423570985008687907853269984665640564039457584007913129639935' },
};

// Common Sui types
const COMMON_TYPES = {
  SUI_COIN: '0x2::sui::SUI',
  COIN_TYPE: '0x2::coin::Coin',
  CLOCK: '0x6', // Clock is a shared object at 0x6
};

const FETCH_TIMEOUT_MS = 5000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export class ParameterHelperService {
  private executor: SuiCliExecutor;
  private configParser: ConfigParser;
  private inspectorService: InspectorService;

  constructor() {
    this.executor = SuiCliExecutor.getInstance();
    this.configParser = ConfigParser.getInstance();
    this.inspectorService = new InspectorService();
  }

  /**
   * Analyze function parameters and provide suggestions
   */
  public async analyzeParameters(
    packageId: string,
    moduleName: string,
    functionName: string,
    userAddress: string
  ): Promise<AnalyzeParametersResult> {
    try {
      // Get function info from package
      const packageResult = await this.inspectorService.inspectPackage(packageId);

      if (!packageResult.success || !packageResult.modules) {
        return {
          success: false,
          error: packageResult.error || 'Failed to inspect package',
        };
      }

      // Find the module
      const module = packageResult.modules.find(m => m.name === moduleName);
      if (!module) {
        return {
          success: false,
          error: `Module '${moduleName}' not found in package`,
        };
      }

      // Find the function
      const func = module.functions.find(f => f.name === functionName);
      if (!func) {
        return {
          success: false,
          error: `Function '${functionName}' not found in module '${moduleName}'`,
        };
      }

      // Get user's objects for suggestions
      const userObjects = await this.getUserObjects(userAddress);

      // Analyze each parameter
      const analyzedParams: AnalyzedParameter[] = [];

      for (const param of func.parameters) {
        const analyzed = await this.analyzeParameter(param, userObjects, userAddress);
        analyzedParams.push(analyzed);
      }

      return {
        success: true,
        parameters: analyzedParams,
        function: {
          name: func.name,
          visibility: func.visibility,
        },
      };
    } catch (error: any) {
      console.error('[ParameterHelperService] analyzeParameters error:', error);
      return {
        success: false,
        error: error.message || 'Failed to analyze parameters',
      };
    }
  }

  /**
   * Parse a Move type string into structured format
   */
  public parseTypeString(typeStr: string): ParsedType {
    const trimmed = typeStr.trim();

    // Check for reference modifiers
    let isMutable = false;
    let isReference = false;
    let baseTypeStr = trimmed;

    if (trimmed.startsWith('&mut ')) {
      isMutable = true;
      isReference = true;
      baseTypeStr = trimmed.substring(5).trim();
    } else if (trimmed.startsWith('&')) {
      isReference = true;
      baseTypeStr = trimmed.substring(1).trim();
    }

    // Check for vector
    const isVector = baseTypeStr.startsWith('vector<');

    // Check for Option
    const isOption = baseTypeStr.includes('::option::Option<');

    // Extract generic parameters
    const genericParams: string[] = [];
    const genericMatch = baseTypeStr.match(/<(.+)>$/);
    if (genericMatch) {
      // Simple split - doesn't handle nested generics perfectly but works for common cases
      const innerTypes = this.splitGenericParams(genericMatch[1]);
      genericParams.push(...innerTypes);
    }

    // Get base type (without generics)
    const baseType = baseTypeStr.replace(/<.+>$/, '').trim();

    // Determine category
    const category = this.categorizeType(trimmed, baseType, isReference, isMutable, isVector, isOption, genericParams);

    return {
      category,
      rawType: typeStr,
      baseType,
      genericParams,
      isMutable,
      isReference,
      isVector,
      isOption,
    };
  }

  /**
   * Split generic parameters handling nested generics
   */
  private splitGenericParams(params: string): string[] {
    const result: string[] = [];
    let depth = 0;
    let current = '';

    for (const char of params) {
      if (char === '<') {
        depth++;
        current += char;
      } else if (char === '>') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  }

  /**
   * Categorize a type based on its structure
   */
  private categorizeType(
    rawType: string,
    baseType: string,
    isReference: boolean,
    isMutable: boolean,
    isVector: boolean,
    isOption: boolean,
    genericParams: string[]
  ): ParameterCategory {
    // Handle reference types
    if (isReference && isMutable) {
      return 'reference_mut';
    }
    if (isReference && !isMutable) {
      return 'reference';
    }

    // Handle vector types
    if (isVector) {
      if (genericParams[0] === 'u8') {
        return 'vector_u8';
      }
      return 'vector';
    }

    // Handle Option type
    if (isOption) {
      return 'option';
    }

    // Handle primitive types
    switch (baseType) {
      case 'u8': return 'primitive_u8';
      case 'u16': return 'primitive_u16';
      case 'u32': return 'primitive_u32';
      case 'u64': return 'primitive_u64';
      case 'u128': return 'primitive_u128';
      case 'u256': return 'primitive_u256';
      case 'bool': return 'primitive_bool';
      case 'address': return 'primitive_address';
    }

    // Check for generic type parameter (single uppercase letter)
    if (/^[A-Z]$/.test(baseType)) {
      return 'type_param';
    }

    // Check if it's a struct type (contains ::)
    if (baseType.includes('::')) {
      return 'owned';
    }

    return 'unknown';
  }

  /**
   * Analyze a single parameter and get suggestions
   */
  private async analyzeParameter(
    param: ParameterInfo,
    userObjects: any[],
    userAddress: string
  ): Promise<AnalyzedParameter> {
    const parsedType = this.parseTypeString(param.type);
    const suggestions: ParameterSuggestion[] = [];
    const examples: string[] = [];
    let helpText = '';
    let autoFilled: AnalyzedParameter['autoFilled'] | undefined;
    let validation: AnalyzedParameter['validation'] | undefined;

    switch (parsedType.category) {
      case 'reference_mut':
      case 'reference':
      case 'owned': {
        // Find matching objects from user's wallet
        const matchingObjects = this.filterObjectsByType(userObjects, parsedType);

        for (const obj of matchingObjects) {
          const objType = obj.type || obj.data?.type || '';
          const objId = obj.objectId || obj.data?.objectId || '';

          suggestions.push({
            type: 'object',
            label: this.formatObjectLabel(obj),
            value: objId,
            metadata: {
              objectId: objId,
              type: objType,
              version: obj.version || obj.data?.version,
              digest: obj.digest || obj.data?.digest,
              fields: obj.content?.fields || obj.data?.content?.fields,
            },
          });
        }

        // Auto-fill if only one matching object
        if (suggestions.length === 1) {
          autoFilled = {
            value: suggestions[0].value,
            reason: 'only_one_option',
          };
        }

        // Add help text
        if (parsedType.category === 'reference_mut') {
          helpText = `Select an object of type ${parsedType.baseType} that you own. This object will be modified.`;
        } else if (parsedType.category === 'reference') {
          helpText = `Select an object of type ${parsedType.baseType}. This is a read-only reference.`;
        } else {
          helpText = `Select an object of type ${parsedType.baseType} to transfer.`;
        }

        if (suggestions.length === 0) {
          helpText += ` You don't own any objects of this type.`;
        }

        examples.push('0x...(object ID)');
        break;
      }

      case 'primitive_u8':
      case 'primitive_u16':
      case 'primitive_u32':
      case 'primitive_u64':
      case 'primitive_u128':
      case 'primitive_u256': {
        const typeName = parsedType.baseType as keyof typeof TYPE_BOUNDS;
        validation = {
          min: TYPE_BOUNDS[typeName].min,
          max: TYPE_BOUNDS[typeName].max,
          pattern: '^[0-9]+$',
          message: `Must be a non-negative integer between ${TYPE_BOUNDS[typeName].min} and ${TYPE_BOUNDS[typeName].max}`,
        };

        examples.push('0', '1', '100');

        // Special case for u64 often used for amounts (SUI in MIST)
        if (parsedType.category === 'primitive_u64') {
          examples.push('1000000000 (1 SUI in MIST)');
          helpText = 'Enter an unsigned 64-bit integer. For SUI amounts, use MIST (1 SUI = 1,000,000,000 MIST).';
        } else {
          helpText = `Enter an unsigned ${parsedType.baseType.substring(1)}-bit integer.`;
        }
        break;
      }

      case 'primitive_bool': {
        suggestions.push(
          { type: 'value', label: 'true', value: 'true' },
          { type: 'value', label: 'false', value: 'false' }
        );
        examples.push('true', 'false');
        helpText = 'Select true or false.';
        break;
      }

      case 'primitive_address': {
        // Suggest user's own address
        suggestions.push({
          type: 'address',
          label: `Your address: ${this.truncateAddress(userAddress)}`,
          value: userAddress,
        });

        validation = {
          pattern: '^0x[a-fA-F0-9]{64}$',
          message: 'Must be a valid Sui address (0x followed by 64 hex characters)',
        };

        examples.push(userAddress);
        helpText = 'Enter a valid Sui address (0x followed by 64 hex characters).';
        break;
      }

      case 'vector_u8': {
        examples.push(
          '"hello" (as string)',
          '0x68656c6c6f (as hex)',
          '[104, 101, 108, 108, 111] (as bytes)'
        );
        helpText = 'Enter a string (will be converted to bytes), hex string (0x...), or byte array.';
        break;
      }

      case 'vector': {
        const innerType = parsedType.genericParams[0] || 'unknown';
        examples.push(`[value1, value2] (array of ${innerType})`);
        helpText = `Enter an array of ${innerType} values.`;
        break;
      }

      case 'option': {
        const innerType = parsedType.genericParams[0] || 'unknown';
        suggestions.push({
          type: 'value',
          label: 'None (empty)',
          value: 'none',
        });
        examples.push('none', `some(value) where value is ${innerType}`);
        helpText = `Optional ${innerType}. Use 'none' for empty or provide a value.`;
        break;
      }

      case 'type_param': {
        helpText = `Generic type parameter. The specific type will be determined by the type arguments.`;
        break;
      }

      default: {
        helpText = `Enter a value of type ${param.type}.`;
        break;
      }
    }

    return {
      name: param.name,
      type: param.type,
      parsedType,
      suggestions,
      autoFilled,
      examples,
      validation,
      helpText,
    };
  }

  /**
   * Filter user's objects by type
   */
  private filterObjectsByType(objects: any[], parsedType: ParsedType): any[] {
    return objects.filter(obj => {
      const objType = obj.type || obj.data?.type || '';

      // For reference types, extract the referenced type
      let targetType = parsedType.baseType;
      if (parsedType.isReference) {
        targetType = parsedType.baseType;
      }

      // Match by full type or partial match
      if (objType === targetType) {
        return true;
      }

      // Extract module::struct from full type
      const typeMatch = targetType.match(/([^:]+)::([^:]+)::([^<]+)/);
      const objTypeMatch = objType.match(/([^:]+)::([^:]+)::([^<]+)/);

      if (typeMatch && objTypeMatch) {
        // Compare module::struct (ignoring package ID which might differ)
        if (typeMatch[2] === objTypeMatch[2] && typeMatch[3] === objTypeMatch[3]) {
          return true;
        }
      }

      // For generic types like Coin<T>, check if object matches
      if (parsedType.genericParams.length > 0 && objType.includes(parsedType.baseType)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Format object label for display
   */
  private formatObjectLabel(obj: any): string {
    const objId = obj.objectId || obj.data?.objectId || '';
    const objType = obj.type || obj.data?.type || '';

    // Try to get a display name from fields
    const fields = obj.content?.fields || obj.data?.content?.fields || {};
    const displayName = fields.name || fields.title || fields.id;

    // Extract short type name
    const typeMatch = objType.match(/::([^:]+)$/);
    const shortType = typeMatch ? typeMatch[1].replace(/<.+>/, '') : 'Object';

    if (displayName) {
      return `${displayName} (${shortType})`;
    }

    return `${shortType}: ${this.truncateAddress(objId)}`;
  }

  /**
   * Truncate address for display
   */
  private truncateAddress(address: string): string {
    if (!address || address.length < 20) return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  /**
   * Get user's objects via CLI or RPC
   */
  private async getUserObjects(address: string): Promise<any[]> {
    try {
      // Try RPC first for faster response
      const rpcUrl = await this.getActiveRpcUrl();
      if (rpcUrl) {
        try {
          return await this.fetchObjectsViaRpc(address, rpcUrl);
        } catch {
          // Fall back to CLI
        }
      }

      // CLI fallback
      const output = await this.executor.execute(['client', 'objects', address], { json: true });
      const data = JSON.parse(output);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('[ParameterHelperService] Failed to get user objects:', error);
      return [];
    }
  }

  /**
   * Fetch objects via RPC
   */
  private async fetchObjectsViaRpc(address: string, rpcUrl: string): Promise<any[]> {
    const response = await fetchWithTimeout(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'suix_getOwnedObjects',
        params: [
          address,
          {
            options: {
              showType: true,
              showContent: true,
              showOwner: true,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const result = await response.json() as { result?: { data?: any[] } };
    return result.result?.data || [];
  }

  /**
   * Get objects filtered by type pattern
   */
  public async getObjectsByType(address: string, typePattern: string): Promise<any[]> {
    const allObjects = await this.getUserObjects(address);

    return allObjects.filter(obj => {
      const objType = obj.type || obj.data?.type || '';

      // Exact match
      if (objType === typePattern) {
        return true;
      }

      // Partial match (for shorter type patterns)
      if (objType.includes(typePattern)) {
        return true;
      }

      // Regex match for patterns
      try {
        const regex = new RegExp(typePattern.replace(/\*/g, '.*'));
        if (regex.test(objType)) {
          return true;
        }
      } catch {
        // Invalid regex, ignore
      }

      return false;
    });
  }

  /**
   * Get detailed metadata for an object
   */
  public async getObjectMetadata(objectId: string): Promise<any> {
    try {
      const rpcUrl = await this.getActiveRpcUrl();

      if (rpcUrl) {
        try {
          const response = await fetchWithTimeout(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'sui_getObject',
              params: [
                objectId,
                {
                  showType: true,
                  showContent: true,
                  showOwner: true,
                  showDisplay: true,
                },
              ],
            }),
          });

          if (response.ok) {
            const result = await response.json() as { result?: { data?: any } };
            return result.result?.data;
          }
        } catch {
          // Fall back to CLI
        }
      }

      // CLI fallback
      const output = await this.executor.execute(['client', 'object', objectId], { json: true });
      return JSON.parse(output);
    } catch (error) {
      console.error('[ParameterHelperService] Failed to get object metadata:', error);
      return null;
    }
  }

  /**
   * Get the active RPC URL from config
   */
  private async getActiveRpcUrl(): Promise<string | null> {
    try {
      const config = await this.configParser.getConfig();
      if (config) {
        const activeEnv = config.envs.find(e => e.alias === config.active_env);
        return activeEnv?.rpc || null;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  /**
   * Convert string to vector<u8> format
   */
  public stringToVectorU8(str: string): string {
    // Convert string to array of byte values
    const bytes = Array.from(Buffer.from(str, 'utf-8'));
    return `[${bytes.join(',')}]`;
  }

  /**
   * Convert hex string to vector<u8> format
   */
  public hexToVectorU8(hex: string): string {
    // Remove 0x prefix if present
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

    // Convert hex pairs to bytes
    const bytes: number[] = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes.push(parseInt(cleanHex.substr(i, 2), 16));
    }

    return `[${bytes.join(',')}]`;
  }

  /**
   * Detect input format and convert to appropriate CLI format
   */
  public formatParameterValue(value: string, parsedType: ParsedType): string {
    if (!value) return value;

    // Handle vector<u8> special cases
    if (parsedType.category === 'vector_u8') {
      // Already in array format
      if (value.startsWith('[') && value.endsWith(']')) {
        return value;
      }

      // Hex format
      if (value.startsWith('0x')) {
        return this.hexToVectorU8(value);
      }

      // Quoted string
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        return this.stringToVectorU8(value.slice(1, -1));
      }

      // Plain string
      return this.stringToVectorU8(value);
    }

    // Handle other types as-is
    return value;
  }
}
