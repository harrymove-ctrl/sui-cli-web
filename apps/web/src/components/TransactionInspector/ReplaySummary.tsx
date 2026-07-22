/**
 * Replay Summary Component
 * Displays parsed replay output in a user-friendly way
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  XCircle,
  Play,
  Package,
  Coins,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Hash,
} from 'lucide-react';
import {
  parseReplayOutput,
  formatMistToSui,
  shortenAddress,
  type ReplayParsedData,
} from '@/utils/replayParser';
import { GlossaryIcon } from '@/components/ui/tooltip';

interface ReplaySummaryProps {
  output: string;
  digest?: string;
}

export function ReplaySummary({ output, digest }: ReplaySummaryProps) {
  const [showRawOutput, setShowRawOutput] = useState(false);
  const data: ReplayParsedData = parseReplayOutput(output);

  const totalGas = data.gasInfo.computationCost + data.gasInfo.storageCost - data.gasInfo.storageRebate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-green-500/30 bg-gradient-to-br from-card via-card to-green-500/5 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Play className="w-5 h-5 text-green-500" />
              Replay Summary
            </span>
            <Badge
              variant="outline"
              className={`${
                data.status === 'Success'
                  ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900'
                  : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900'
              } font-medium px-3 py-1`}
            >
              {data.status === 'Success' ? '✅ Replayed Successfully' : '❌ Replay Failed'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="flex items-start gap-3">
            {data.status === 'Success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground">
                Transaction replayed successfully at epoch #{data.executedEpoch}
              </p>
              <p className="text-sm text-muted-foreground">
                All operations executed as originally performed on-chain
              </p>
            </div>
          </div>

          <Separator />

          {/* Gas Costs */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                💰 Gas Costs (Replay)
                <GlossaryIcon term="GAS_USED" />
              </h3>
            </div>

            <div className="space-y-2 pl-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Computation:</span>
                <span className="font-mono text-foreground">
                  {formatMistToSui(data.gasInfo.computationCost)} SUI
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Storage:</span>
                <span className="font-mono text-foreground">
                  {formatMistToSui(data.gasInfo.storageCost)} SUI
                </span>
              </div>

              {data.gasInfo.storageRebate > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rebate:</span>
                  <span className="font-mono text-green-600 dark:text-green-400">
                    -{formatMistToSui(data.gasInfo.storageRebate)} SUI
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                <span className="font-medium text-foreground">Total Cost:</span>
                <span className="font-mono font-semibold text-lg text-primary">
                  {formatMistToSui(totalGas)} SUI
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Object Changes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">📦 Object Changes</h3>
            </div>

            <div className="space-y-3 pl-6">
              {/* Created Objects */}
              {data.createdObjects.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <span className="text-green-600 dark:text-green-400">•</span>
                    Created {data.createdObjects.length} new object{data.createdObjects.length > 1 ? 's' : ''}
                  </p>
                  {data.createdObjects.map((obj, idx) => (
                    <div
                      key={idx}
                      className="ml-4 p-3 bg-green-500/5 border border-green-500/20 rounded-lg"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <Hash className="w-3 h-3 text-muted-foreground" />
                          <span className="font-mono text-foreground">{shortenAddress(obj.id)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <ArrowRight className="w-3 h-3" />
                          Owner: <span className="font-mono">{shortenAddress(obj.owner)}</span>
                        </div>
                        <div className="text-muted-foreground">Version: {obj.version}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Mutated Objects */}
              {data.mutatedObjects.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <span className="text-blue-600 dark:text-blue-400">•</span>
                    Modified {data.mutatedObjects.length} existing object{data.mutatedObjects.length > 1 ? 's' : ''}
                  </p>
                  {data.mutatedObjects.map((obj, idx) => (
                    <div
                      key={idx}
                      className="ml-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <Hash className="w-3 h-3 text-muted-foreground" />
                          <span className="font-mono text-foreground">{shortenAddress(obj.id)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <ArrowRight className="w-3 h-3" />
                          Owner: <span className="font-mono">{shortenAddress(obj.owner)}</span>
                        </div>
                        <div className="text-muted-foreground">Version: {obj.version}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Gas Object */}
              {data.gasObject && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <span className="text-purple-600 dark:text-purple-400">•</span>
                    Gas Object Updated
                  </p>
                  <div className="ml-4 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <Hash className="w-3 h-3 text-muted-foreground" />
                        <span className="font-mono text-foreground">
                          {shortenAddress(data.gasObject.id)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <ArrowRight className="w-3 h-3" />
                        Owner: <span className="font-mono">{shortenAddress(data.gasObject.owner)}</span>
                      </div>
                      <div className="text-muted-foreground">Version: {data.gasObject.version}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dependencies */}
          {data.dependencies.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">🔗 Transaction Dependencies</h3>
                <div className="pl-6">
                  <p className="text-sm text-muted-foreground">
                    Depends on {data.dependencies.length} other transaction{data.dependencies.length > 1 ? 's' : ''}
                  </p>
                  {data.dependencies.map((dep, idx) => (
                    <div key={idx} className="mt-1 text-xs font-mono text-muted-foreground">
                      • {dep}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Expandable Raw Output */}
          <div className="pt-2">
            <button
              onClick={() => setShowRawOutput(!showRawOutput)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2 rounded-lg hover:bg-muted/50"
            >
              {showRawOutput ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Hide Terminal Output
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show Terminal Output (Advanced)
                </>
              )}
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
                  <div className="mt-3 p-4 bg-muted/50 border border-border rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
                    <pre className="text-xs text-foreground font-mono whitespace-pre">
                      {data.rawOutput}
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
