/**
 * Enhanced Replay Summary - Clean Terminal Style
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  parseReplayOutput,
  formatMistToSui,
  shortenAddress,
  type ReplayParsedData,
} from '@/utils/replayParser';

interface EnhancedReplaySummaryProps {
  output: string;
  digest?: string;
}

export function EnhancedReplaySummary({ output, digest }: EnhancedReplaySummaryProps) {
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [showObjects, setShowObjects] = useState(false);
  const data: ReplayParsedData = parseReplayOutput(output);

  const totalGas = data.gasInfo.computationCost + data.gasInfo.storageCost - data.gasInfo.storageRebate;

  return (
    <div className="space-y-3">
      {/* Main Summary Card */}
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
              Replay Results
            </span>
            <span className="text-tertiary text-xs font-mono">
              Epoch #{data.executedEpoch}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Status */}
          <div className="flex items-center gap-3">
            {data.status === 'Success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm font-mono ${data.status === 'Success' ? 'text-green-400' : 'text-red-400'}`}>
              {data.status}
            </span>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center py-2 bg-secondary rounded">
              <div className="text-lg font-mono text-foreground">{data.createdObjects.length}</div>
              <div className="text-xs text-tertiary font-mono">Created</div>
            </div>
            <div className="text-center py-2 bg-secondary rounded">
              <div className="text-lg font-mono text-foreground">{data.mutatedObjects.length}</div>
              <div className="text-xs text-tertiary font-mono">Modified</div>
            </div>
            <div className="text-center py-2 bg-secondary rounded">
              <div className="text-lg font-mono text-foreground">{formatMistToSui(totalGas)}</div>
              <div className="text-xs text-tertiary font-mono">SUI</div>
            </div>
            <div className="text-center py-2 bg-secondary rounded">
              <div className="text-lg font-mono text-foreground">{data.dependencies.length}</div>
              <div className="text-xs text-tertiary font-mono">Deps</div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Gas Details */}
          <div className="space-y-2">
            <div className="text-tertiary text-xs uppercase tracking-wider font-medium">Gas</div>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Computation</span>
                <span className="text-foreground">{formatMistToSui(data.gasInfo.computationCost)} SUI</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Storage</span>
                <span className="text-foreground">{formatMistToSui(data.gasInfo.storageCost)} SUI</span>
              </div>
              {data.gasInfo.storageRebate > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rebate</span>
                  <span className="text-green-400">-{formatMistToSui(data.gasInfo.storageRebate)} SUI</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-border">
                <span className="text-foreground">Total</span>
                <span className="text-foreground font-medium">{formatMistToSui(totalGas)} SUI</span>
              </div>
              <div className="flex justify-between text-tertiary">
                <span>Budget</span>
                <span>{formatMistToSui(data.gasInfo.gasBudget)} SUI</span>
              </div>
            </div>
          </div>

          {/* Objects Toggle */}
          {(data.createdObjects.length > 0 || data.mutatedObjects.length > 0) && (
            <>
              <div className="border-t border-border" />
              <button
                onClick={() => setShowObjects(!showObjects)}
                className="flex items-center gap-2 text-xs text-tertiary hover:text-muted-foreground transition-colors w-full justify-center py-2 font-mono"
              >
                {showObjects ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showObjects ? 'Hide' : 'Show'} Objects ({data.createdObjects.length + data.mutatedObjects.length})
              </button>

              <AnimatePresence>
                {showObjects && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden space-y-3"
                  >
                    {/* Created Objects */}
                    {data.createdObjects.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-tertiary text-xs font-mono">Created</div>
                        <div className="space-y-1">
                          {data.createdObjects.map((obj, idx) => (
                            <div key={idx} className="bg-secondary rounded p-2 text-xs font-mono">
                              <div className="text-foreground">{shortenAddress(obj.id)}</div>
                              <div className="text-tertiary">Owner: {shortenAddress(obj.owner)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mutated Objects */}
                    {data.mutatedObjects.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-tertiary text-xs font-mono">Modified</div>
                        <div className="space-y-1">
                          {data.mutatedObjects.map((obj, idx) => (
                            <div key={idx} className="bg-secondary rounded p-2 text-xs font-mono">
                              <div className="text-foreground">{shortenAddress(obj.id)}</div>
                              <div className="text-tertiary">Version: {obj.version}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Raw Output Toggle */}
          <div className="border-t border-border" />
          <button
            onClick={() => setShowRawOutput(!showRawOutput)}
            className="flex items-center gap-2 text-xs text-tertiary hover:text-muted-foreground transition-colors w-full justify-center py-2 font-mono"
          >
            {showRawOutput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showRawOutput ? 'Hide' : 'Show'} Raw Output
          </button>

          <AnimatePresence>
            {showRawOutput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="bg-secondary border border-border rounded p-3 overflow-x-auto max-h-64 overflow-y-auto">
                  <pre className="text-xs text-muted-foreground font-mono whitespace-pre">
                    {data.rawOutput}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
