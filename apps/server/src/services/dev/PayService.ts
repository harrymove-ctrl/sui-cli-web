/**
 * PayService - Multi-recipient payment operations
 */

import { SuiCliExecutor } from '../../cli/SuiCliExecutor';

export interface PayRequest {
  recipients: string[];
  amounts: string[];
  inputCoins?: string[];
  gasBudget?: string;
  dryRun?: boolean;
}

export interface PayResult {
  success: boolean;
  digest?: string;
  effects?: any;
  gasUsed?: {
    computationCost: string;
    storageCost: string;
    storageRebate: string;
  };
  error?: string;
}

export interface PayAllSuiRequest {
  recipient: string;
  inputCoins: string[];
  gasBudget?: string;
  dryRun?: boolean;
}

export class PayService {
  private executor: SuiCliExecutor;

  constructor() {
    this.executor = SuiCliExecutor.getInstance();
  }

  /**
   * Validate pay request
   */
  private validatePayRequest(request: PayRequest): string | null {
    if (!request.recipients || request.recipients.length === 0) {
      return 'At least one recipient is required';
    }

    if (!request.amounts || request.amounts.length === 0) {
      return 'At least one amount is required';
    }

    if (request.recipients.length !== request.amounts.length) {
      return 'Number of recipients must match number of amounts';
    }

    // Validate addresses
    for (const recipient of request.recipients) {
      if (!recipient.startsWith('0x')) {
        return `Invalid recipient address: ${recipient}`;
      }
    }

    // Validate amounts
    for (const amount of request.amounts) {
      const num = BigInt(amount);
      if (num <= 0) {
        return `Invalid amount: ${amount}`;
      }
    }

    return null;
  }

  /**
   * Pay using any coins (not just SUI)
   * sui client pay --recipients <RECIPIENTS>... --amounts <AMOUNTS>... [--input-coins <INPUT_COINS>...]
   */
  async pay(request: PayRequest): Promise<PayResult> {
    const validationError = this.validatePayRequest(request);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const args = ['client', 'pay'];

    // Add recipients
    args.push('--recipients');
    args.push(...request.recipients);

    // Add amounts
    args.push('--amounts');
    args.push(...request.amounts);

    // Add input coins if specified
    if (request.inputCoins && request.inputCoins.length > 0) {
      args.push('--input-coins');
      args.push(...request.inputCoins);
    }

    // Add gas budget if specified
    if (request.gasBudget) {
      args.push('--gas-budget', request.gasBudget);
    }

    // Add dry run flag
    if (request.dryRun) {
      args.push('--dry-run');
    }

    args.push('--json');

    try {
      const result = await this.executor.executeJson<any>(args, { timeout: 120000 });

      return {
        success: true,
        digest: result.digest,
        effects: result.effects,
        gasUsed: result.effects?.gasUsed,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Pay using SUI coins specifically
   * sui client pay-sui --recipients <RECIPIENTS>... --amounts <AMOUNTS>... [--input-coins <INPUT_COINS>...]
   */
  async paySui(request: PayRequest): Promise<PayResult> {
    const validationError = this.validatePayRequest(request);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const args = ['client', 'pay-sui'];

    // Add recipients
    args.push('--recipients');
    args.push(...request.recipients);

    // Add amounts
    args.push('--amounts');
    args.push(...request.amounts);

    // Add input coins if specified
    if (request.inputCoins && request.inputCoins.length > 0) {
      args.push('--input-coins');
      args.push(...request.inputCoins);
    }

    // Add gas budget if specified
    if (request.gasBudget) {
      args.push('--gas-budget', request.gasBudget);
    }

    // Add dry run flag
    if (request.dryRun) {
      args.push('--dry-run');
    }

    args.push('--json');

    try {
      const result = await this.executor.executeJson<any>(args, { timeout: 120000 });

      return {
        success: true,
        digest: result.digest,
        effects: result.effects,
        gasUsed: result.effects?.gasUsed,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Pay all remaining SUI to one recipient
   * sui client pay-all-sui --recipient <RECIPIENT> --input-coins <INPUT_COINS>...
   */
  async payAllSui(request: PayAllSuiRequest): Promise<PayResult> {
    if (!request.recipient || !request.recipient.startsWith('0x')) {
      return { success: false, error: 'Valid recipient address is required' };
    }

    if (!request.inputCoins || request.inputCoins.length === 0) {
      return { success: false, error: 'At least one input coin is required' };
    }

    const args = ['client', 'pay-all-sui'];

    // Add recipient
    args.push('--recipient', request.recipient);

    // Add input coins
    args.push('--input-coins');
    args.push(...request.inputCoins);

    // Add gas budget if specified
    if (request.gasBudget) {
      args.push('--gas-budget', request.gasBudget);
    }

    // Add dry run flag
    if (request.dryRun) {
      args.push('--dry-run');
    }

    args.push('--json');

    try {
      const result = await this.executor.executeJson<any>(args, { timeout: 120000 });

      return {
        success: true,
        digest: result.digest,
        effects: result.effects,
        gasUsed: result.effects?.gasUsed,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Calculate total amount to be paid
   */
  calculateTotal(amounts: string[]): string {
    let total = BigInt(0);
    for (const amount of amounts) {
      total += BigInt(amount);
    }
    return total.toString();
  }

  /**
   * Format payment summary
   */
  formatPaymentSummary(request: PayRequest): {
    totalAmount: string;
    totalAmountSui: string;
    recipients: Array<{ address: string; amount: string; amountSui: string }>;
  } {
    const total = this.calculateTotal(request.amounts);
    const totalSui = (Number(total) / 1_000_000_000).toFixed(9);

    const recipients = request.recipients.map((address, i) => ({
      address,
      amount: request.amounts[i],
      amountSui: (Number(request.amounts[i]) / 1_000_000_000).toFixed(9),
    }));

    return {
      totalAmount: total,
      totalAmountSui: totalSui,
      recipients,
    };
  }
}
