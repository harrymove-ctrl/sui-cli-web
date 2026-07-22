/**
 * Transaction Summary - Clean Terminal Style
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  analyzeTransaction,
  formatMistToSui,
  formatAddress,
  formatRelativeTime,
  type TransactionSummary as TxSummary,
} from '@/utils/transactionAnalyzer';

interface TransactionSummaryProps {
  txData: any;
  digest?: string;
}

export function TransactionSummary({ txData, digest }: TransactionSummaryProps) {
  const [showRawData, setShowRawData] = useState(false);
  const summary: TxSummary = analyzeTransaction(txData);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-card border border-border rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
            Transaction Summary
          </span>
          <span className="text-tertiary text-xs font-mono">
            {summary.type.icon} {summary.type.type}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3">
          {summary.status === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400" />
          )}
          <span className={`text-sm font-mono ${summary.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {summary.status === 'success' ? 'Success' : 'Failed'}
          </span>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          {summary.sender && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-tertiary text-xs font-mono">
                <User className="w-3 h-3" />
                Sender
              </div>
              <div className="text-foreground text-xs font-mono truncate">
                {formatAddress(summary.sender)}
              </div>
            </div>
          )}

          {summary.timestamp && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-tertiary text-xs font-mono">
                <Clock className="w-3 h-3" />
                Time
              </div>
              <div className="text-foreground text-xs font-mono">
                {formatRelativeTime(summary.timestamp)}
              </div>
            </div>
          )}

          {summary.blockHeight && (
            <div className="space-y-1">
              <div className="text-tertiary text-xs font-mono">Epoch</div>
              <div className="text-foreground text-xs font-mono">#{summary.blockHeight}</div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Gas Costs */}
        <div className="space-y-2">
          <div className="text-tertiary text-xs uppercase tracking-wider font-medium">Gas</div>
          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Computation</span>
              <span className="text-foreground">{formatMistToSui(summary.gasUsed.computation)} SUI</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Storage</span>
              <span className="text-foreground">{formatMistToSui(summary.gasUsed.storage)} SUI</span>
            </div>
            {summary.gasUsed.storageRebate > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rebate</span>
                <span className="text-green-400">-{formatMistToSui(summary.gasUsed.storageRebate)} SUI</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 border-t border-border">
              <span className="text-foreground">Total</span>
              <span className="text-foreground font-medium">{formatMistToSui(summary.gasUsed.total)} SUI</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Impact */}
        <div className="space-y-2">
          <div className="text-tertiary text-xs uppercase tracking-wider font-medium">Impact</div>
          <div className="space-y-1 text-xs font-mono">
            {summary.objectChanges.created > 0 && (
              <div className="text-foreground">
                + {summary.objectChanges.created} object{summary.objectChanges.created > 1 ? 's' : ''} created
              </div>
            )}
            {summary.objectChanges.mutated > 0 && (
              <div className="text-foreground">
                ~ {summary.objectChanges.mutated} object{summary.objectChanges.mutated > 1 ? 's' : ''} modified
              </div>
            )}
            {summary.objectChanges.deleted > 0 && (
              <div className="text-foreground">
                - {summary.objectChanges.deleted} object{summary.objectChanges.deleted > 1 ? 's' : ''} deleted
              </div>
            )}
            {summary.eventsCount > 0 && (
              <div className="text-foreground">
                {summary.eventsCount} event{summary.eventsCount > 1 ? 's' : ''} emitted
              </div>
            )}
            {summary.objectChanges.created === 0 && summary.objectChanges.mutated === 0 &&
             summary.objectChanges.deleted === 0 && summary.eventsCount === 0 && (
              <div className="text-tertiary">No changes</div>
            )}
          </div>
        </div>

        {/* Raw Data Toggle */}
        <button
          onClick={() => setShowRawData(!showRawData)}
          className="flex items-center gap-2 text-xs text-tertiary hover:text-muted-foreground transition-colors w-full justify-center py-2 font-mono"
        >
          {showRawData ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showRawData ? 'Hide' : 'Show'} Raw Data
        </button>

        <AnimatePresence>
          {showRawData && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-secondary border border-border rounded p-3 overflow-x-auto max-h-64 overflow-y-auto">
                <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                  {JSON.stringify(txData, null, 2)}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
