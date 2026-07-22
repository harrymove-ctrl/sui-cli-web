/**
 * Transaction Analyzer Utility
 * Analyzes Sui transaction data to extract meaningful insights
 */

export interface TransactionType {
  type: string;
  icon: string;
  explanation: string;
  color: string;
}

export interface TransactionSummary {
  type: TransactionType;
  status: 'success' | 'failed';
  sender?: string;
  timestamp?: number;
  blockHeight?: number;
  gasUsed: {
    computation: number; // in MIST
    storage: number;
    storageRebate: number;
    total: number;
  };
  objectChanges: {
    created: number;
    mutated: number;
    deleted: number;
    wrapped: number;
  };
  eventsCount: number;
}

/**
 * Detect transaction type from transaction data
 */
export function detectTransactionType(txData: any): TransactionType {
  // Default type
  let detectedType: TransactionType = {
    type: 'Unknown',
    icon: '❓',
    explanation: 'Unable to determine transaction type',
    color: 'gray',
  };

  // Check transaction structure
  const transaction = txData?.transaction?.data?.transaction;
  const effects = txData?.effects || txData?.V2;

  if (!transaction && !effects) {
    return detectedType;
  }

  // Check for Move Call
  if (transaction?.V1 || transaction?.kind === 'ProgrammableTransaction') {
    const commands = transaction?.V1?.transactions || transaction?.transactions || [];

    // Check for Publish
    if (commands.some((cmd: any) => cmd.Publish || cmd.publish)) {
      return {
        type: 'Package Publish',
        icon: '📦',
        explanation: 'Deployed a new smart contract package to the blockchain',
        color: 'purple',
      };
    }

    // Check for Upgrade
    if (commands.some((cmd: any) => cmd.Upgrade || cmd.upgrade)) {
      return {
        type: 'Package Upgrade',
        icon: '🔄',
        explanation: 'Upgraded an existing smart contract package',
        color: 'blue',
      };
    }

    // Check for TransferObjects
    if (commands.some((cmd: any) => cmd.TransferObjects || cmd.transferObjects)) {
      const hasMoveCall = commands.some((cmd: any) => cmd.MoveCall || cmd.moveCall);
      if (!hasMoveCall) {
        return {
          type: 'Simple Transfer',
          icon: '💸',
          explanation: 'Transferred coins or objects from one address to another',
          color: 'green',
        };
      }
    }

    // Check for SplitCoins or MergeCoins
    const hasSplitMerge = commands.some((cmd: any) =>
      cmd.SplitCoins || cmd.splitCoins || cmd.MergeCoins || cmd.mergeCoins
    );
    if (hasSplitMerge) {
      return {
        type: 'Coin Split/Merge',
        icon: '🪙',
        explanation: 'Split or merged coin objects for better denomination',
        color: 'yellow',
      };
    }

    // Check for MoveCall
    if (commands.some((cmd: any) => cmd.MoveCall || cmd.moveCall)) {
      const moveCallCount = commands.filter((cmd: any) => cmd.MoveCall || cmd.moveCall).length;
      if (moveCallCount > 1 || commands.length > 2) {
        return {
          type: 'Complex PTB',
          icon: '🎮',
          explanation: 'Complex programmable transaction with multiple operations',
          color: 'orange',
        };
      }
      return {
        type: 'Contract Call',
        icon: '📞',
        explanation: 'Called a function in a deployed smart contract',
        color: 'cyan',
      };
    }
  }

  return detectedType;
}

/**
 * Analyze gas usage from transaction effects
 */
export function analyzeGasUsage(effects: any): TransactionSummary['gasUsed'] {
  const gasUsed = {
    computation: 0,
    storage: 0,
    storageRebate: 0,
    total: 0,
  };

  // V2 format (newer)
  if (effects?.V2?.gas_used) {
    const gas = effects.V2.gas_used;
    gasUsed.computation = parseInt(gas.computationCost || '0');
    gasUsed.storage = parseInt(gas.storageCost || '0');
    gasUsed.storageRebate = parseInt(gas.storageRebate || '0');
  }
  // V1 format (older)
  else if (effects?.gasUsed) {
    const gas = effects.gasUsed;
    gasUsed.computation = parseInt(gas.computationCost || '0');
    gasUsed.storage = parseInt(gas.storageCost || '0');
    gasUsed.storageRebate = parseInt(gas.storageRebate || '0');
  }

  gasUsed.total = gasUsed.computation + gasUsed.storage - gasUsed.storageRebate;

  return gasUsed;
}

/**
 * Analyze object changes from transaction effects
 */
export function analyzeObjectChanges(effects: any): TransactionSummary['objectChanges'] {
  const changes = {
    created: 0,
    mutated: 0,
    deleted: 0,
    wrapped: 0,
  };

  // V2 format
  if (effects?.V2?.changed_objects) {
    const changedObjects = effects.V2.changed_objects;
    for (const [_, changeData] of changedObjects) {
      const idOp = changeData?.id_operation;
      if (idOp === 'Created') changes.created++;
      else if (idOp === 'Deleted') changes.deleted++;
      else if (changeData?.output_state) changes.mutated++;
    }
  }
  // V1 format
  else if (effects?.created) {
    changes.created = effects.created.length || 0;
  }
  if (effects?.mutated) {
    changes.mutated = effects.mutated.length || 0;
  }
  if (effects?.deleted) {
    changes.deleted = effects.deleted.length || 0;
  }
  if (effects?.wrapped) {
    changes.wrapped = effects.wrapped.length || 0;
  }

  return changes;
}

/**
 * Create a complete transaction summary
 */
export function analyzeTransaction(txData: any): TransactionSummary {
  const effects = txData?.effects || txData;
  const status = effects?.V2?.status || effects?.status;

  const summary: TransactionSummary = {
    type: detectTransactionType(txData),
    status: status === 'Success' || status?.status === 'success' ? 'success' : 'failed',
    gasUsed: analyzeGasUsage(effects),
    objectChanges: analyzeObjectChanges(effects),
    eventsCount: txData?.events?.length || 0,
  };

  // Extract sender if available
  if (txData?.transaction?.data?.sender) {
    summary.sender = txData.transaction.data.sender;
  }

  // Extract timestamp if available
  if (txData?.timestampMs) {
    summary.timestamp = parseInt(txData.timestampMs);
  }

  // Extract block height
  if (effects?.V2?.executed_epoch) {
    summary.blockHeight = parseInt(effects.V2.executed_epoch);
  }

  return summary;
}

/**
 * Format MIST to SUI with proper decimals
 */
export function formatMistToSui(mist: number): string {
  const sui = mist / 1_000_000_000;
  if (sui < 0.001) {
    return sui.toExponential(2);
  }
  return sui.toFixed(4);
}

/**
 * Format address for display (shortened)
 */
export function formatAddress(address: string): string {
  if (!address) return 'Unknown';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format relative time (e.g., "2 mins ago")
 */
export function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return 'Unknown';

  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  return `${seconds} sec${seconds > 1 ? 's' : ''} ago`;
}

/**
 * Get gas optimization tips based on usage
 */
export function getGasOptimizationTips(gasUsed: TransactionSummary['gasUsed'], objectChanges: TransactionSummary['objectChanges']): string[] {
  const tips: string[] = [];

  // High storage cost
  if (gasUsed.storage > gasUsed.computation * 2) {
    tips.push('Consider reusing existing objects to reduce storage costs (~30% savings)');
  }

  // Many objects created
  if (objectChanges.created > 3) {
    tips.push('Creating many objects increases storage costs - consider batching operations');
  }

  // Good rebate
  if (gasUsed.storageRebate > gasUsed.storage * 0.3) {
    tips.push('✅ Good storage rebate from cleaning up old objects!');
  }

  // High computation
  if (gasUsed.computation > 5_000_000) {
    tips.push('High computation cost - look for ways to optimize contract logic');
  }

  if (tips.length === 0) {
    tips.push('✅ Gas usage looks optimal for this operation');
  }

  return tips;
}
