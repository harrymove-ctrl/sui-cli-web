import { SuiCliExecutor } from '../cli/SuiCliExecutor';
import { ConfigParser } from '../cli/ConfigParser';
import { AddressService } from './AddressService';
import { sanitizeErrorMessage } from '../utils/errorHandler';

const MIST_PER_SUI = 1_000_000_000;

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

export class TransferService {
  private executor: SuiCliExecutor;
  private configParser: ConfigParser;
  private addressService: AddressService;

  constructor() {
    this.executor = SuiCliExecutor.getInstance();
    this.configParser = ConfigParser.getInstance();
    this.addressService = new AddressService();
  }

  /**
   * Transfer SUI from active address to recipient
   * @param to Recipient address
   * @param amount Amount in SUI (will be converted to MIST)
   * @param coinId Optional specific coin to use
   * @param gasBudget Optional gas budget in MIST (default: 10000000)
   */
  public async transferSui(
    to: string,
    amount: string,
    coinId?: string,
    gasBudget: string = '10000000'
  ): Promise<TransferResult> {
    try {
      // Convert SUI amount to MIST
      const amountInMist = this.suiToMist(amount);

      const args = [
        'client',
        'transfer-sui',
        '--to',
        to,
        '--amount',
        amountInMist,
        '--gas-budget',
        gasBudget,
      ];

      // Add coin ID if specified
      if (coinId) {
        args.push('--sui-coin-object-id', coinId);
      }

      const output = await this.executor.execute(args, { json: true });
      const data = JSON.parse(output);

      // Extract transaction digest and gas used
      const digest = data.digest || data.txDigest || data.transaction?.digest;
      const gasUsed = this.extractGasUsed(data);

      if (!digest) {
        throw new Error('Transfer completed but no transaction digest returned');
      }

      return {
        success: true,
        digest,
        gasUsed,
      };
    } catch (error) {
      console.error('[TransferService] Transfer SUI failed:', error);
      return {
        success: false,
        digest: '',
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Dry run transfer SUI to estimate gas
   */
  public async dryRunTransferSui(
    to: string,
    amount: string,
    coinId?: string,
    gasBudget: string = '10000000'
  ): Promise<DryRunResult> {
    try {
      const amountInMist = this.suiToMist(amount);

      // If no coin ID provided, get the active address and select the first available coin
      let selectedCoinId = coinId;
      if (!selectedCoinId) {
        const activeAddress = await this.addressService.getActiveAddress();
        if (!activeAddress) {
          throw new Error('No active address found');
        }

        const coins = await this.getTransferableCoins(activeAddress);
        if (coins.length === 0) {
          throw new Error('No available coins found for gas estimation');
        }

        // Select the coin with sufficient balance
        const sufficientCoin = coins.find(coin => parseFloat(coin.balance) >= parseFloat(amountInMist));
        selectedCoinId = sufficientCoin ? sufficientCoin.coinObjectId : coins[0].coinObjectId;
      }

      const args = [
        'client',
        'transfer-sui',
        '--to',
        to,
        '--amount',
        amountInMist,
        '--gas-budget',
        gasBudget,
        '--sui-coin-object-id',
        selectedCoinId,
        '--dry-run',
      ];

      const output = await this.executor.execute(args, { json: true });
      const data = JSON.parse(output);

      const estimatedGas = this.extractGasUsed(data) || gasBudget;

      return {
        success: true,
        estimatedGas,
        effects: data.effects || data,
      };
    } catch (error) {
      console.error('[TransferService] Dry run transfer SUI failed:', error);
      return {
        success: false,
        estimatedGas: '0',
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Get transferable coins (gas coins) for an address
   */
  public async getTransferableCoins(address: string): Promise<TransferableCoin[]> {
    try {
      const output = await this.executor.execute(['client', 'gas', address], { json: true });
      const data = JSON.parse(output);

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((coin: any) => {
        const balanceMist = String(coin.mistBalance || coin.mist_balance || coin.balance || 0);
        const balanceSui = (parseInt(balanceMist) / MIST_PER_SUI).toFixed(4);

        return {
          coinObjectId: coin.gasCoinId || coin.gas_coin_id || coin.id?.id || '',
          balance: balanceMist,
          balanceSui,
        };
      });
    } catch (error) {
      console.error('[TransferService] Get transferable coins failed:', error);
      return [];
    }
  }

  /**
   * Transfer an object/NFT to recipient
   * @param to Recipient address
   * @param objectId Object ID to transfer
   * @param gasBudget Optional gas budget in MIST
   */
  public async transferObject(
    to: string,
    objectId: string,
    gasBudget: string = '10000000'
  ): Promise<TransferResult> {
    try {
      const args = [
        'client',
        'transfer',
        '--to',
        to,
        '--object-id',
        objectId,
        '--gas-budget',
        gasBudget,
      ];

      const output = await this.executor.execute(args, { json: true });
      const data = JSON.parse(output);

      const digest = data.digest || data.txDigest || data.transaction?.digest;
      const gasUsed = this.extractGasUsed(data);

      if (!digest) {
        throw new Error('Transfer completed but no transaction digest returned');
      }

      return {
        success: true,
        digest,
        gasUsed,
      };
    } catch (error) {
      console.error('[TransferService] Transfer object failed:', error);
      return {
        success: false,
        digest: '',
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Dry run transfer object to estimate gas
   */
  public async dryRunTransferObject(
    to: string,
    objectId: string,
    gasBudget: string = '10000000'
  ): Promise<DryRunResult> {
    try {
      const args = [
        'client',
        'transfer',
        '--to',
        to,
        '--object-id',
        objectId,
        '--gas-budget',
        gasBudget,
        '--dry-run',
      ];

      const output = await this.executor.execute(args, { json: true });
      const data = JSON.parse(output);

      const estimatedGas = this.extractGasUsed(data) || gasBudget;

      return {
        success: true,
        estimatedGas,
        effects: data.effects || data,
      };
    } catch (error) {
      console.error('[TransferService] Dry run transfer object failed:', error);
      return {
        success: false,
        estimatedGas: '0',
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Get transferable objects for an address (excludes coins)
   */
  public async getTransferableObjects(address: string): Promise<TransferableObject[]> {
    try {
      const output = await this.executor.execute(['client', 'objects', address], { json: true });
      const data = JSON.parse(output);

      if (!Array.isArray(data)) {
        return [];
      }

      // Filter out SUI coin objects - we only want transferable objects/NFTs
      return data
        .filter((obj: any) => {
          const type = obj.type || obj.data?.type || '';
          // Exclude Coin<SUI> type objects
          return !type.includes('0x2::coin::Coin') && !type.includes('sui::SUI');
        })
        .map((obj: any) => ({
          objectId: obj.objectId || obj.data?.objectId || '',
          type: obj.type || obj.data?.type || '',
          owner: obj.owner || obj.data?.owner || '',
          digest: obj.digest || obj.data?.digest || '',
        }))
        .filter((obj: TransferableObject) => obj.objectId !== '');
    } catch (error) {
      console.error('[TransferService] Get transferable objects failed:', error);
      return [];
    }
  }

  /**
   * Verify ownership of an object before transfer
   */
  public async verifyObjectOwnership(objectId: string, expectedOwner: string): Promise<boolean> {
    try {
      const output = await this.executor.execute(['client', 'object', objectId], { json: true });
      const data = JSON.parse(output);

      const owner = data.owner || data.data?.owner || '';

      // Handle different owner formats
      if (typeof owner === 'string') {
        return owner === expectedOwner;
      }

      if (typeof owner === 'object' && owner.AddressOwner) {
        return owner.AddressOwner === expectedOwner;
      }

      return false;
    } catch (error) {
      console.error('[TransferService] Verify object ownership failed:', error);
      return false;
    }
  }

  // Helper: Convert SUI to MIST
  private suiToMist(suiAmount: string): string {
    const amount = parseFloat(suiAmount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid SUI amount');
    }
    return Math.floor(amount * MIST_PER_SUI).toString();
  }

  // Helper: Extract gas used from transaction result
  private extractGasUsed(data: any): string | undefined {
    // Try different possible locations for gas information
    const gasUsed =
      data.effects?.gasUsed?.computationCost ||
      data.gasUsed?.computationCost ||
      data.effects?.gasUsed ||
      data.gasUsed;

    if (gasUsed) {
      return String(gasUsed);
    }

    return undefined;
  }
}
