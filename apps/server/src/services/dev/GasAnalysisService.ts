/**
 * GasAnalysisService - Analyze and optimize gas usage
 */

import { SuiCliExecutor } from '../../cli/SuiCliExecutor';

export interface GasBreakdown {
  computationCost: string;
  storageCost: string;
  storageRebate: string;
  nonRefundableStorageFee: string;
  totalGasUsed: string;
  totalGasBudget: string;
  efficiency: number; // Percentage of budget used (0-100)
}

export interface GasOptimization {
  type: 'warning' | 'suggestion' | 'info';
  category: 'budget' | 'storage' | 'computation' | 'general';
  message: string;
  potentialSavings?: string;
  details?: string;
}

export interface GasAnalysisResult {
  success: boolean;
  breakdown?: GasBreakdown;
  optimizations: GasOptimization[];
  referenceGasPrice?: string;
  error?: string;
}

export interface GasEstimate {
  success: boolean;
  estimatedGas?: string;
  breakdown?: Partial<GasBreakdown>;
  error?: string;
}

export class GasAnalysisService {
  private executor: SuiCliExecutor;

  constructor() {
    this.executor = SuiCliExecutor.getInstance();
  }

  /**
   * Convert MIST to SUI string
   */
  private mistToSui(mist: string | number): string {
    const mistNum = BigInt(mist);
    const suiNum = Number(mistNum) / 1_000_000_000;
    return suiNum.toFixed(9).replace(/\.?0+$/, '');
  }

  /**
   * Parse gas numbers safely
   */
  private parseGas(value: any): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    return '0';
  }

  /**
   * Analyze gas from a transaction digest
   */
  async analyzeTransaction(digest: string): Promise<GasAnalysisResult> {
    try {
      const args = ['client', 'tx-block', digest];
      const result = await this.executor.executeJson<any>(args);

      if (!result || !result.effects) {
        return {
          success: false,
          optimizations: [],
          error: 'Transaction not found or no effects available',
        };
      }

      const gasUsed = result.effects.gasUsed;
      const gasObject = result.effects.gasObject;

      // Get gas budget from transaction data
      const gasBudget = result.transaction?.data?.gasData?.budget || '0';

      const breakdown = this.buildBreakdown(gasUsed, gasBudget);
      const optimizations = this.generateOptimizations(breakdown, result);

      // Get current reference gas price
      let referenceGasPrice: string | undefined;
      try {
        const envResult = await this.executor.executeJson<any>(['client', 'envs']);
        // Reference gas price needs to be fetched via RPC
      } catch {
        // Ignore
      }

      return {
        success: true,
        breakdown,
        optimizations,
        referenceGasPrice,
      };
    } catch (error) {
      return {
        success: false,
        optimizations: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build gas breakdown from gas used object
   */
  private buildBreakdown(gasUsed: any, gasBudget: string): GasBreakdown {
    const computationCost = this.parseGas(gasUsed?.computationCost);
    const storageCost = this.parseGas(gasUsed?.storageCost);
    const storageRebate = this.parseGas(gasUsed?.storageRebate);
    const nonRefundableStorageFee = this.parseGas(gasUsed?.nonRefundableStorageFee);

    // Calculate total gas used
    const totalUsed = BigInt(computationCost) + BigInt(storageCost) - BigInt(storageRebate);
    const totalGasUsed = totalUsed.toString();

    // Calculate efficiency
    const budgetNum = BigInt(gasBudget || '0');
    const efficiency = budgetNum > 0 ? Number((totalUsed * 100n) / budgetNum) : 0;

    return {
      computationCost,
      storageCost,
      storageRebate,
      nonRefundableStorageFee,
      totalGasUsed,
      totalGasBudget: gasBudget,
      efficiency: Math.min(100, Math.round(efficiency)),
    };
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizations(breakdown: GasBreakdown, txResult?: any): GasOptimization[] {
    const optimizations: GasOptimization[] = [];

    const budget = BigInt(breakdown.totalGasBudget);
    const used = BigInt(breakdown.totalGasUsed);
    const computation = BigInt(breakdown.computationCost);
    const storage = BigInt(breakdown.storageCost);

    // Check if budget is significantly higher than used
    if (budget > 0 && breakdown.efficiency < 25) {
      const suggestedBudget = (used * 150n) / 100n; // 1.5x of actual use
      optimizations.push({
        type: 'warning',
        category: 'budget',
        message: `Gas budget is ${Math.round(100 / breakdown.efficiency)}x higher than needed`,
        potentialSavings: `Consider reducing budget to ~${this.mistToSui(suggestedBudget.toString())} SUI`,
        details: `You used ${breakdown.efficiency}% of your gas budget. A budget of 1.5x actual usage would be sufficient.`,
      });
    }

    // Check storage vs computation ratio
    const total = computation + storage;
    if (total > 0) {
      const storageRatio = Number((storage * 100n) / total);

      if (storageRatio > 70) {
        optimizations.push({
          type: 'suggestion',
          category: 'storage',
          message: `Storage cost is ${storageRatio}% of total gas`,
          details: 'Large objects are being created or modified. Consider lazy initialization or breaking up large data structures.',
        });
      }

      if (storageRatio < 10 && computation > 10_000_000n) {
        optimizations.push({
          type: 'suggestion',
          category: 'computation',
          message: 'High computation cost relative to storage',
          details: 'The transaction is computation-heavy. Consider optimizing loops or complex calculations.',
        });
      }
    }

    // Check for high rebate (might indicate inefficient deletes)
    const rebate = BigInt(breakdown.storageRebate);
    if (rebate > storage && rebate > 1_000_000n) {
      optimizations.push({
        type: 'info',
        category: 'storage',
        message: 'High storage rebate received',
        details: `You received ${this.mistToSui(rebate.toString())} SUI back from deleting objects. Good job cleaning up!`,
      });
    }

    // Check object changes if available
    if (txResult?.objectChanges) {
      const created = txResult.objectChanges.filter((c: any) => c.type === 'created').length;
      const deleted = txResult.objectChanges.filter((c: any) => c.type === 'deleted').length;

      if (created > 5) {
        optimizations.push({
          type: 'info',
          category: 'storage',
          message: `${created} new objects created`,
          details: 'Creating many objects increases storage costs. Consider consolidating data when possible.',
        });
      }
    }

    // General tips if no specific issues found
    if (optimizations.length === 0) {
      optimizations.push({
        type: 'info',
        category: 'general',
        message: 'Gas usage looks efficient',
        details: 'No obvious optimizations detected. The transaction is using gas reasonably.',
      });
    }

    return optimizations;
  }

  /**
   * Estimate gas for a dry run
   */
  async estimateGas(txBytes: string): Promise<GasEstimate> {
    try {
      // Use dev-inspect or dry-run to estimate gas
      const args = ['client', 'serialized-tx', '--tx-bytes', txBytes, '--dry-run'];
      const result = await this.executor.executeJson<any>(args);

      if (result?.effects?.gasUsed) {
        const breakdown = this.buildBreakdown(result.effects.gasUsed, '0');
        return {
          success: true,
          estimatedGas: breakdown.totalGasUsed,
          breakdown,
        };
      }

      return {
        success: false,
        error: 'Could not estimate gas from dry run',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get reference gas price from the network
   */
  async getReferenceGasPrice(): Promise<{ success: boolean; price?: string; error?: string }> {
    try {
      // This would typically use RPC, but we can also parse from sui client output
      const args = ['client', 'gas'];
      const result = await this.executor.executeJson<any>(args);

      // The reference gas price might be in the response or we need to fetch it separately
      // For now, return a default
      return {
        success: true,
        price: '1000', // Default reference gas price in MIST
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Format gas breakdown for display
   */
  formatBreakdown(breakdown: GasBreakdown): {
    items: Array<{ label: string; mist: string; sui: string }>;
    total: { mist: string; sui: string };
    efficiency: string;
  } {
    return {
      items: [
        {
          label: 'Computation Cost',
          mist: breakdown.computationCost,
          sui: this.mistToSui(breakdown.computationCost),
        },
        {
          label: 'Storage Cost',
          mist: breakdown.storageCost,
          sui: this.mistToSui(breakdown.storageCost),
        },
        {
          label: 'Storage Rebate',
          mist: `-${breakdown.storageRebate}`,
          sui: `-${this.mistToSui(breakdown.storageRebate)}`,
        },
        {
          label: 'Non-refundable Fee',
          mist: breakdown.nonRefundableStorageFee,
          sui: this.mistToSui(breakdown.nonRefundableStorageFee),
        },
      ],
      total: {
        mist: breakdown.totalGasUsed,
        sui: this.mistToSui(breakdown.totalGasUsed),
      },
      efficiency: `${breakdown.efficiency}%`,
    };
  }
}
