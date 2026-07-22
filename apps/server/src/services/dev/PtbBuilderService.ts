/**
 * PtbBuilderService - Build and execute Programmable Transaction Blocks
 */

import { SuiCliExecutor } from '../../cli/SuiCliExecutor';

export type PtbCommandType =
  | 'split-coins'
  | 'merge-coins'
  | 'transfer-objects'
  | 'move-call'
  | 'make-move-vec'
  | 'assign'
  | 'publish'
  | 'upgrade';

export interface PtbCommand {
  id: string;
  type: PtbCommandType;
  params: Record<string, any>;
  resultVar?: string;
}

export interface SplitCoinsParams {
  coin: string; // 'gas' or object ID
  amounts: string[];
}

export interface MergeCoinsParams {
  intoCoin: string;
  coins: string[];
}

export interface TransferObjectsParams {
  objects: string[];
  to: string;
}

export interface MoveCallParams {
  target: string; // package::module::function
  typeArgs?: string[];
  args?: string[];
}

export interface MakeMoveVecParams {
  type: string;
  values: string[];
}

export interface AssignParams {
  name: string;
  value?: string; // If not provided, uses result of previous command
}

export interface PtbBuildRequest {
  commands: PtbCommand[];
  gasBudget?: string;
  gasCoin?: string;
  gasPrice?: string;
  dryRun?: boolean;
  devInspect?: boolean;
  sender?: string;
}

export interface ValidationError {
  commandId: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface Variable {
  name: string;
  type: string;
  source: string; // Command ID that produced this variable
}

export interface PtbResult {
  success: boolean;
  digest?: string;
  effects?: any;
  events?: any[];
  gasUsed?: {
    computationCost: string;
    storageCost: string;
    storageRebate: string;
  };
  error?: string;
  cliCommand?: string; // The full CLI command for reference
}

export interface PtbTemplate {
  name: string;
  description: string;
  commands: PtbCommand[];
}

export class PtbBuilderService {
  private executor: SuiCliExecutor;

  constructor() {
    this.executor = SuiCliExecutor.getInstance();
  }

  /**
   * Validate PTB command sequence
   */
  validateCommands(commands: PtbCommand[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const definedVars = new Set<string>(['gas']); // 'gas' is always available

    for (const cmd of commands) {
      switch (cmd.type) {
        case 'split-coins': {
          const params = cmd.params as SplitCoinsParams;
          if (!params.coin) {
            errors.push({ commandId: cmd.id, field: 'coin', message: 'Coin is required' });
          } else if (params.coin !== 'gas' && !params.coin.startsWith('@') && !params.coin.startsWith('$')) {
            if (!params.coin.startsWith('0x')) {
              errors.push({ commandId: cmd.id, field: 'coin', message: 'Invalid coin: must be "gas", variable ($var), or object ID (0x...)' });
            }
          }
          if (!params.amounts || params.amounts.length === 0) {
            errors.push({ commandId: cmd.id, field: 'amounts', message: 'At least one amount is required' });
          }
          break;
        }

        case 'merge-coins': {
          const params = cmd.params as MergeCoinsParams;
          if (!params.intoCoin) {
            errors.push({ commandId: cmd.id, field: 'intoCoin', message: 'Target coin is required' });
          }
          if (!params.coins || params.coins.length === 0) {
            errors.push({ commandId: cmd.id, field: 'coins', message: 'At least one coin to merge is required' });
          }
          break;
        }

        case 'transfer-objects': {
          const params = cmd.params as TransferObjectsParams;
          if (!params.objects || params.objects.length === 0) {
            errors.push({ commandId: cmd.id, field: 'objects', message: 'At least one object is required' });
          }
          if (!params.to) {
            errors.push({ commandId: cmd.id, field: 'to', message: 'Recipient address is required' });
          }
          break;
        }

        case 'move-call': {
          const params = cmd.params as MoveCallParams;
          if (!params.target) {
            errors.push({ commandId: cmd.id, field: 'target', message: 'Target function is required' });
          } else {
            const parts = params.target.split('::');
            if (parts.length !== 3) {
              errors.push({ commandId: cmd.id, field: 'target', message: 'Target must be in format package::module::function' });
            }
          }
          break;
        }

        case 'make-move-vec': {
          const params = cmd.params as MakeMoveVecParams;
          if (!params.type) {
            errors.push({ commandId: cmd.id, field: 'type', message: 'Vector type is required' });
          }
          break;
        }

        case 'assign': {
          const params = cmd.params as AssignParams;
          if (!params.name) {
            errors.push({ commandId: cmd.id, field: 'name', message: 'Variable name is required' });
          } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(params.name)) {
            errors.push({ commandId: cmd.id, field: 'name', message: 'Invalid variable name' });
          }
          break;
        }
      }

      // Track defined variables
      if (cmd.resultVar) {
        definedVars.add(cmd.resultVar);
      }
      if (cmd.type === 'assign' && (cmd.params as AssignParams).name) {
        definedVars.add((cmd.params as AssignParams).name);
      }
    }

    // Check for undefined variable references
    for (const cmd of commands) {
      const paramStr = JSON.stringify(cmd.params);
      const varRefs = paramStr.match(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
      for (const ref of varRefs) {
        const varName = ref.substring(1);
        if (!definedVars.has(varName)) {
          warnings.push(`Command ${cmd.id} references undefined variable: ${varName}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Build CLI args from commands
   */
  buildCliArgs(request: PtbBuildRequest): string[] {
    const args: string[] = ['client', 'ptb'];

    for (const cmd of request.commands) {
      switch (cmd.type) {
        case 'split-coins': {
          const params = cmd.params as SplitCoinsParams;
          const amountsStr = `[${params.amounts.join(', ')}]`;
          args.push('--split-coins', params.coin, amountsStr);
          break;
        }

        case 'merge-coins': {
          const params = cmd.params as MergeCoinsParams;
          const coinsStr = `[${params.coins.join(', ')}]`;
          args.push('--merge-coins', params.intoCoin, coinsStr);
          break;
        }

        case 'transfer-objects': {
          const params = cmd.params as TransferObjectsParams;
          const objectsStr = `[${params.objects.join(', ')}]`;
          args.push('--transfer-objects', objectsStr, params.to);
          break;
        }

        case 'move-call': {
          const params = cmd.params as MoveCallParams;
          const callArgs: string[] = [params.target];
          if (params.typeArgs && params.typeArgs.length > 0) {
            callArgs.push(`<${params.typeArgs.join(', ')}>`);
          }
          if (params.args && params.args.length > 0) {
            callArgs.push(...params.args);
          }
          args.push('--move-call', ...callArgs);
          break;
        }

        case 'make-move-vec': {
          const params = cmd.params as MakeMoveVecParams;
          const valuesStr = params.values.length > 0 ? `[${params.values.join(', ')}]` : '[]';
          args.push('--make-move-vec', `<${params.type}>`, valuesStr);
          break;
        }

        case 'assign': {
          const params = cmd.params as AssignParams;
          if (params.value) {
            args.push('--assign', params.name, params.value);
          } else {
            args.push('--assign', params.name);
          }
          break;
        }
      }

      // Add result variable assignment if specified
      if (cmd.resultVar && cmd.type !== 'assign') {
        args.push('--assign', cmd.resultVar);
      }
    }

    // Add execution options
    if (request.gasBudget) {
      args.push('--gas-budget', request.gasBudget);
    }

    if (request.gasCoin) {
      args.push('--gas-coin', request.gasCoin);
    }

    if (request.gasPrice) {
      args.push('--gas-price', request.gasPrice);
    }

    if (request.sender) {
      args.push('--sender', request.sender);
    }

    if (request.dryRun) {
      args.push('--dry-run');
    }

    if (request.devInspect) {
      args.push('--dev-inspect');
    }

    args.push('--json');

    return args;
  }

  /**
   * Execute PTB
   */
  async executePtb(request: PtbBuildRequest): Promise<PtbResult> {
    // Validate first
    const validation = this.validateCommands(request.commands);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
      };
    }

    const args = this.buildCliArgs(request);
    const cliCommand = `sui ${args.join(' ')}`;

    try {
      const result = await this.executor.executeJson<any>(args, { timeout: 120000 });

      if (result.effects) {
        return {
          success: true,
          digest: result.digest,
          effects: result.effects,
          events: result.events,
          gasUsed: result.effects?.gasUsed,
          cliCommand,
        };
      }

      // Dry run result
      if (result.dryRunTransactionBlockResponse || result.input) {
        return {
          success: true,
          effects: result.dryRunTransactionBlockResponse?.effects || result.effects,
          events: result.dryRunTransactionBlockResponse?.events || result.events,
          gasUsed: result.dryRunTransactionBlockResponse?.effects?.gasUsed,
          cliCommand,
        };
      }

      return {
        success: true,
        ...result,
        cliCommand,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        cliCommand,
      };
    }
  }

  /**
   * Get available variables from command sequence
   */
  getAvailableVariables(commands: PtbCommand[], currentIndex: number): Variable[] {
    const variables: Variable[] = [
      { name: 'gas', type: 'Coin<SUI>', source: 'builtin' },
    ];

    for (let i = 0; i < currentIndex; i++) {
      const cmd = commands[i];

      if (cmd.resultVar) {
        let type = 'unknown';
        switch (cmd.type) {
          case 'split-coins':
            type = 'vector<Coin>';
            break;
          case 'merge-coins':
            type = 'Coin';
            break;
          case 'move-call':
            type = 'Result';
            break;
          case 'make-move-vec':
            type = `vector<${(cmd.params as MakeMoveVecParams).type}>`;
            break;
        }
        variables.push({ name: cmd.resultVar, type, source: cmd.id });
      }

      if (cmd.type === 'assign') {
        const params = cmd.params as AssignParams;
        variables.push({ name: params.name, type: 'any', source: cmd.id });
      }
    }

    return variables;
  }

  /**
   * Get common PTB templates
   */
  getTemplates(): PtbTemplate[] {
    return [
      {
        name: 'Split and Transfer',
        description: 'Split coins and transfer to multiple recipients',
        commands: [
          {
            id: '1',
            type: 'split-coins',
            params: { coin: 'gas', amounts: ['1000000000', '1000000000'] },
            resultVar: 'split_coins',
          },
          {
            id: '2',
            type: 'transfer-objects',
            params: { objects: ['$split_coins'], to: '@recipient' },
          },
        ],
      },
      {
        name: 'Merge All Coins',
        description: 'Merge multiple coins into one',
        commands: [
          {
            id: '1',
            type: 'merge-coins',
            params: { intoCoin: 'gas', coins: ['@coin1', '@coin2'] },
          },
        ],
      },
      {
        name: 'Batch NFT Transfer',
        description: 'Transfer multiple NFTs to a single recipient',
        commands: [
          {
            id: '1',
            type: 'transfer-objects',
            params: { objects: ['@nft1', '@nft2', '@nft3'], to: '@recipient' },
          },
        ],
      },
      {
        name: 'Move Call with Type Args',
        description: 'Call a generic Move function',
        commands: [
          {
            id: '1',
            type: 'move-call',
            params: {
              target: '0x2::coin::split',
              typeArgs: ['0x2::sui::SUI'],
              args: ['gas', '1000000000'],
            },
            resultVar: 'new_coin',
          },
        ],
      },
    ];
  }

  /**
   * Get common Move types for make-move-vec
   */
  getCommonTypes(): string[] {
    return [
      'u8',
      'u16',
      'u32',
      'u64',
      'u128',
      'u256',
      'bool',
      'address',
      '0x1::string::String',
      '0x1::ascii::String',
      '0x1::option::Option<u64>',
      '0x2::sui::SUI',
      '0x2::coin::Coin<0x2::sui::SUI>',
    ];
  }
}
