/**
 * Gas Breakdown - Clean Terminal Style
 */
import { motion } from 'framer-motion';
import { formatMistToSui, type TransactionSummary } from '@/utils/transactionAnalyzer';

interface GasBreakdownProps {
  gasUsed: TransactionSummary['gasUsed'];
}

export function GasBreakdown({ gasUsed }: GasBreakdownProps) {
  const totalCost = gasUsed.computation + gasUsed.storage;
  const computationPercent = totalCost > 0 ? (gasUsed.computation / totalCost) * 100 : 0;
  const storagePercent = totalCost > 0 ? (gasUsed.storage / totalCost) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      className="bg-card border border-border rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
          Gas Breakdown
        </span>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Total */}
        <div className="text-center py-2">
          <div className="text-2xl font-mono text-foreground font-medium">
            {formatMistToSui(gasUsed.total)} SUI
          </div>
          <div className="text-xs text-tertiary font-mono mt-1">
            Total Gas Cost
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Breakdown Bars */}
        <div className="space-y-3">
          {/* Computation */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-muted-foreground">Computation</span>
              <span className="text-foreground">{computationPercent.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${computationPercent}%` }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="h-full bg-foreground/40 rounded-full"
              />
            </div>
            <div className="text-xs font-mono text-tertiary">
              {formatMistToSui(gasUsed.computation)} SUI
            </div>
          </div>

          {/* Storage */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-muted-foreground">Storage</span>
              <span className="text-foreground">{storagePercent.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${storagePercent}%` }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="h-full bg-foreground/40 rounded-full"
              />
            </div>
            <div className="text-xs font-mono text-tertiary">
              {formatMistToSui(gasUsed.storage)} SUI
            </div>
          </div>

          {/* Rebate */}
          {gasUsed.storageRebate > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-border">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">Storage Rebate</span>
                <span className="text-green-400">-{formatMistToSui(gasUsed.storageRebate)} SUI</span>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Reference */}
        <div className="space-y-2">
          <div className="text-tertiary text-xs font-mono">Typical costs</div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="flex justify-between text-tertiary">
              <span>Transfer</span>
              <span>~0.001 SUI</span>
            </div>
            <div className="flex justify-between text-tertiary">
              <span>Contract</span>
              <span>~0.005 SUI</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
