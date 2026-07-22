/**
 * GasAnalysis - Comprehensive gas analysis with transaction insights
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Fuel,
  Zap,
  Database,
  ArrowDownRight,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Loader2,
  Copy,
  ChevronDown,
  ChevronRight,
  Activity,
  TrendingUp,
  Clock,
  Package,
  Coins,
  ArrowRightLeft,
  FileCode,
  Sparkles,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';

interface GasBreakdown {
  computationCost: string;
  storageCost: string;
  storageRebate: string;
  nonRefundableStorageFee: string;
  totalGasUsed: string;
  totalGasBudget: string;
  efficiency: number;
}

interface GasOptimization {
  type: 'warning' | 'suggestion' | 'info';
  category: string;
  message: string;
  potentialSavings?: string;
  details?: string;
}

interface GasAnalysisResult {
  success: boolean;
  breakdown?: GasBreakdown;
  optimizations: GasOptimization[];
  error?: string;
}

// Convert MIST to SUI
function formatSui(mist: string): string {
  const num = Number(mist) / 1_000_000_000;
  if (num === 0) return '0';
  if (num < 0.0001) return '<0.0001';
  if (num < 0.01) return num.toFixed(6);
  if (num < 1) return num.toFixed(4);
  return num.toFixed(4);
}

// Format large numbers
function formatNumber(mist: string): string {
  const num = Number(mist);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

// Analyze gas distribution
function analyzeGasDistribution(breakdown: GasBreakdown) {
  const computation = Number(breakdown.computationCost);
  const storage = Number(breakdown.storageCost);
  const total = computation + storage;

  if (total === 0) return { computationPercent: 0, storagePercent: 0, dominant: 'balanced' };

  const computationPercent = Math.round((computation / total) * 100);
  const storagePercent = Math.round((storage / total) * 100);

  let dominant: 'computation' | 'storage' | 'balanced' = 'balanced';
  if (computationPercent > 70) dominant = 'computation';
  else if (storagePercent > 70) dominant = 'storage';

  return { computationPercent, storagePercent, dominant };
}

// Estimate transaction type from gas pattern
function estimateTransactionType(breakdown: GasBreakdown): { type: string; icon: React.ReactNode; description: string } {
  const computation = Number(breakdown.computationCost);
  const storage = Number(breakdown.storageCost);
  const rebate = Number(breakdown.storageRebate);
  const total = computation + storage;

  // High rebate suggests deletion/cleanup
  if (rebate > storage * 0.8 && rebate > 1_000_000) {
    return {
      type: 'Cleanup/Delete',
      icon: <Package className="w-4 h-4" />,
      description: 'Objects were deleted, freeing storage'
    };
  }

  // Very high storage suggests NFT mint or large object creation
  if (storage > computation * 5 && storage > 10_000_000) {
    return {
      type: 'Object Creation',
      icon: <Sparkles className="w-4 h-4" />,
      description: 'New objects created (NFT mint, deploy, etc.)'
    };
  }

  // High computation with low storage suggests swap or calculation
  if (computation > storage * 2) {
    return {
      type: 'DeFi/Swap',
      icon: <ArrowRightLeft className="w-4 h-4" />,
      description: 'Complex computation (swap, stake, etc.)'
    };
  }

  // Balanced low gas suggests simple transfer
  if (total < 5_000_000) {
    return {
      type: 'Simple Transfer',
      icon: <Coins className="w-4 h-4" />,
      description: 'Basic SUI or token transfer'
    };
  }

  // High both suggests contract deployment
  if (computation > 5_000_000 && storage > 20_000_000) {
    return {
      type: 'Contract Deploy',
      icon: <FileCode className="w-4 h-4" />,
      description: 'Smart contract deployment'
    };
  }

  return {
    type: 'General Transaction',
    icon: <Activity className="w-4 h-4" />,
    description: 'Standard blockchain operation'
  };
}

// Gas benchmarks for comparison
const GAS_BENCHMARKS = {
  simpleTransfer: { min: 1_000_000, avg: 2_000_000, max: 5_000_000 },
  tokenSwap: { min: 3_000_000, avg: 8_000_000, max: 20_000_000 },
  nftMint: { min: 5_000_000, avg: 15_000_000, max: 50_000_000 },
  contractDeploy: { min: 20_000_000, avg: 100_000_000, max: 500_000_000 },
};

// Tooltip component
function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex">
      <div onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} className="cursor-help">
        {children}
      </div>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-card border border-border rounded-lg text-xs text-foreground/80 whitespace-nowrap max-w-[280px] text-wrap"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-card" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function GasAnalysis() {
  const [digest, setDigest] = useState('');
  const [result, setResult] = useState<GasAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const analyzeTransaction = useCallback(async () => {
    if (!digest.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.get(`/inspector/gas/analyze/${digest.trim()}`);
      if (response.success && response.breakdown) {
        setResult(response as GasAnalysisResult);
      } else {
        setError(response.error || 'Failed to analyze transaction');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze transaction');
    } finally {
      setIsLoading(false);
    }
  }, [digest]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') analyzeTransaction();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  const getEfficiencyInfo = (eff: number) => {
    if (eff >= 70) return { color: 'text-green-400', bg: 'bg-green-500', label: 'Excellent', emoji: '🎯' };
    if (eff >= 40) return { color: 'text-blue-400', bg: 'bg-blue-500', label: 'Good', emoji: '👍' };
    if (eff >= 20) return { color: 'text-yellow-400', bg: 'bg-yellow-500', label: 'Room to optimize', emoji: '💡' };
    return { color: 'text-orange-400', bg: 'bg-orange-500', label: 'Over-budgeted', emoji: '⚠️' };
  };

  const breakdown = result?.breakdown;
  const txType = breakdown ? estimateTransactionType(breakdown) : null;
  const gasDistribution = breakdown ? analyzeGasDistribution(breakdown) : null;
  const efficiencyInfo = breakdown ? getEfficiencyInfo(breakdown.efficiency) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <Fuel className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-semibold text-foreground">Gas Analysis</h2>
          <Tooltip content="Analyze transaction gas usage, understand costs, and get optimization tips">
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </Tooltip>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={digest}
              onChange={(e) => setDigest(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste transaction digest..."
              className="w-full pl-9 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-orange-500/50 font-mono"
            />
          </div>
          <Button onClick={analyzeTransaction} disabled={isLoading || !digest.trim()} className="px-5">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {breakdown && txType && gasDistribution && efficiencyInfo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

            {/* Transaction Summary Card */}
            <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/5 border border-orange-500/20 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
                    {txType.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{txType.type}</div>
                    <div className="text-xs text-muted-foreground">{txType.description}</div>
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(digest)}
                  className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground"
                  title="Copy digest"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Main Cost Display */}
              <div className="flex items-end gap-4 mb-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total Gas Cost</div>
                  <div className="text-3xl font-bold text-foreground font-mono">
                    {formatSui(breakdown.totalGasUsed)}
                    <span className="text-base text-muted-foreground ml-1">SUI</span>
                  </div>
                </div>
                <div className="flex-1 text-right">
                  <div className="text-xs text-muted-foreground">~${(Number(breakdown.totalGasUsed) / 1_000_000_000 * 3.5).toFixed(4)} USD</div>
                  <div className="text-xs text-tertiary font-mono">{formatNumber(breakdown.totalGasUsed)} MIST</div>
                </div>
              </div>

              {/* Efficiency Badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${efficiencyInfo.bg}/20 ${efficiencyInfo.color} border border-current/30`}>
                <span>{efficiencyInfo.emoji}</span>
                <span className="font-medium">{breakdown.efficiency}% budget used</span>
                <span className="text-xs opacity-70">• {efficiencyInfo.label}</span>
              </div>
            </div>

            {/* Visual Gas Breakdown */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-sm font-medium text-foreground/80 mb-4">Gas Distribution</div>

              {/* Visual Bar */}
              <div className="mb-4">
                <div className="h-8 rounded-lg overflow-hidden flex">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${gasDistribution.computationPercent}%` }}
                    transition={{ duration: 0.5 }}
                    className="bg-blue-500 flex items-center justify-center"
                  >
                    {gasDistribution.computationPercent > 15 && (
                      <span className="text-xs font-medium text-white">{gasDistribution.computationPercent}%</span>
                    )}
                  </motion.div>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${gasDistribution.storagePercent}%` }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="bg-purple-500 flex items-center justify-center"
                  >
                    {gasDistribution.storagePercent > 15 && (
                      <span className="text-xs font-medium text-white">{gasDistribution.storagePercent}%</span>
                    )}
                  </motion.div>
                </div>
                <div className="flex justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-blue-500" />
                    <span className="text-xs text-muted-foreground">Computation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-purple-500" />
                    <span className="text-xs text-muted-foreground">Storage</span>
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <div>
                      <div className="text-sm text-foreground">Computation</div>
                      <div className="text-xs text-tertiary">CPU cycles for executing logic</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-foreground">{formatSui(breakdown.computationCost)} SUI</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400" />
                    <div>
                      <div className="text-sm text-foreground">Storage</div>
                      <div className="text-xs text-tertiary">On-chain data storage</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-foreground">{formatSui(breakdown.storageCost)} SUI</div>
                  </div>
                </div>

                {Number(breakdown.storageRebate) > 0 && (
                  <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="flex items-center gap-2">
                      <ArrowDownRight className="w-4 h-4 text-green-400" />
                      <div>
                        <div className="text-sm text-foreground">Rebate Received</div>
                        <div className="text-xs text-green-400/70">Refund from deleted storage</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-green-400">-{formatSui(breakdown.storageRebate)} SUI</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Budget Analysis */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-sm font-medium text-foreground/80 mb-3">Budget Analysis</div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gas Budget Set</span>
                  <span className="font-mono text-foreground">{formatSui(breakdown.totalGasBudget)} SUI</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Actually Used</span>
                  <span className="font-mono text-foreground">{formatSui(breakdown.totalGasUsed)} SUI</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Unused (Returned)</span>
                  <span className="font-mono text-green-400">
                    {formatSui((Number(breakdown.totalGasBudget) - Number(breakdown.totalGasUsed)).toString())} SUI
                  </span>
                </div>

                {/* Progress bar */}
                <div className="pt-2">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, breakdown.efficiency)}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full rounded-full ${efficiencyInfo.bg}`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tips & Insights */}
            {result.optimizations.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-foreground/80">Insights & Tips</span>
                </div>
                <div className="p-3 space-y-2">
                  {result.optimizations.map((opt, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        opt.type === 'warning' ? 'bg-yellow-500/10' :
                        opt.type === 'suggestion' ? 'bg-blue-500/10' : 'bg-green-500/10'
                      }`}
                    >
                      {opt.type === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      ) : opt.type === 'suggestion' ? (
                        <Lightbulb className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className={`text-sm ${
                          opt.type === 'warning' ? 'text-yellow-300' :
                          opt.type === 'suggestion' ? 'text-blue-300' : 'text-green-300'
                        }`}>
                          {opt.message}
                        </div>
                        {opt.details && <div className="text-xs text-muted-foreground mt-1">{opt.details}</div>}
                        {opt.potentialSavings && <div className="text-xs text-green-400 mt-1">{opt.potentialSavings}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Reference */}
            <div className="bg-secondary/50 rounded-xl p-4 border border-dashed border-border">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Understanding Gas</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>
                  <span className="text-blue-400 font-medium">Computation</span>
                  <p className="mt-0.5">Processing power for executing code (loops, calculations, function calls)</p>
                </div>
                <div>
                  <span className="text-purple-400 font-medium">Storage</span>
                  <p className="mt-0.5">Cost to store data on-chain (creating objects, modifying state)</p>
                </div>
                <div>
                  <span className="text-green-400 font-medium">Rebate</span>
                  <p className="mt-0.5">Refund when you delete objects or free up storage space</p>
                </div>
                <div>
                  <span className="text-orange-400 font-medium">Budget</span>
                  <p className="mt-0.5">Max gas you're willing to pay. Unused gas is returned to you.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!result && !error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-orange-500/10 rounded-2xl mb-4">
              <Fuel className="w-10 h-10 text-orange-400/60" />
            </div>
            <h3 className="text-foreground/80 font-medium mb-2">Analyze Transaction Gas</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Understand how much gas was used, where it went, and how to optimize future transactions
            </p>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Try these examples:</div>
              {[
                { digest: '7SZsZ8RzL7JcteKbcJh4D5xXjz6vGkuxNzj6wJtB73Dv', label: 'Oracle Update (11 events)' },
                { digest: '95iEUzhvYWZoceBtgq7LkMsZxhrtfK3iJQk7AFV6Xgnk', label: 'DeFi Transaction (29 events)' },
              ].map((example) => (
                <button
                  key={example.digest}
                  onClick={() => setDigest(example.digest)}
                  className="block w-full p-2 bg-secondary hover:bg-accent rounded-lg text-left transition-colors"
                >
                  <div className="text-xs text-orange-400 font-mono truncate">{example.digest}</div>
                  <div className="text-xs text-tertiary">{example.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GasAnalysis;
