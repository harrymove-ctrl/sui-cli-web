import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Calculator,
  Check,
  CheckCircle2,
  ChevronLeft,
  Combine,
  Copy,
  ExternalLink,
  Layers,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import { Button } from '@/components/ui/button';
import { showErrorToast, showSuccessToast } from '@/lib/toast';
import { useAppStore } from '@/stores/useAppStore';
import type { CoinInfo, CoinMetadata, CoinOperationResult } from '@sui-cli-web/shared';

// Format balance with proper decimals
function formatBalance(balance: string, decimals: number): string {
  const balanceBigInt = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const integerPart = balanceBigInt / divisor;
  const fractionalPart = balanceBigInt % divisor;

  let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  fractionalStr = fractionalStr.replace(/0+$/, '');
  if (fractionalStr.length === 0) {
    fractionalStr = '0';
  }

  return `${integerPart}.${fractionalStr}`;
}

export function CoinMerge() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addresses } = useAppStore();
  const activeAddress = addresses.find((a) => a.isActive);

  // URL params
  const coinTypeParam = searchParams.get('type');
  const primaryCoinIdParam = searchParams.get('coinId');

  // State
  const [coins, setCoins] = useState<CoinInfo[]>([]);
  const [metadata, setMetadata] = useState<CoinMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [primaryCoinId, setPrimaryCoinId] = useState<string>(primaryCoinIdParam || '');
  const [selectedCoinIds, setSelectedCoinIds] = useState<Set<string>>(new Set());
  const [isEstimating, setIsEstimating] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<CoinOperationResult | null>(null);
  const [mergeResult, setMergeResult] = useState<CoinOperationResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const decimals = metadata?.decimals ?? 9;
  const symbol = metadata?.symbol ?? 'COIN';

  // Load coins and metadata
  useEffect(() => {
    async function loadData() {
      if (!coinTypeParam || !activeAddress) return;

      setIsLoading(true);
      try {
        // Load all coins of this type - getCoinsByType returns CoinInfo[] directly
        const coins = await api.getCoinsByType(activeAddress.address, coinTypeParam);
        if (coins && coins.length > 0) {
          setCoins(coins);
          // If we have a primary coin from URL, use it
          if (primaryCoinIdParam) {
            setPrimaryCoinId(primaryCoinIdParam);
          } else {
            // Otherwise select the first coin as primary
            setPrimaryCoinId(coins[0].coinObjectId);
          }
        }

        // Load metadata - getCoinMetadata returns CoinMetadata | null directly
        const metadata = await api.getCoinMetadata(coinTypeParam);
        if (metadata) {
          setMetadata(metadata);
        }
      } catch (error) {
        console.error('Failed to load coin data:', error);
        showErrorToast({ message: 'Failed to load coin data' });
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [coinTypeParam, activeAddress?.address, primaryCoinIdParam]);

  // Primary coin
  const primaryCoin = useMemo(() => {
    return coins.find((c) => c.coinObjectId === primaryCoinId);
  }, [coins, primaryCoinId]);

  // Available coins to merge (excluding primary)
  const availableCoins = useMemo(() => {
    return coins.filter((c) => c.coinObjectId !== primaryCoinId);
  }, [coins, primaryCoinId]);

  // Calculate totals
  const selectedCoins = useMemo(() => {
    return availableCoins.filter((c) => selectedCoinIds.has(c.coinObjectId));
  }, [availableCoins, selectedCoinIds]);

  const selectedBalance = useMemo(() => {
    return selectedCoins.reduce((sum, c) => sum + BigInt(c.balance), BigInt(0));
  }, [selectedCoins]);

  const totalAfterMerge = useMemo(() => {
    if (!primaryCoin) return BigInt(0);
    return BigInt(primaryCoin.balance) + selectedBalance;
  }, [primaryCoin, selectedBalance]);

  const isValidMerge = useMemo(() => {
    return primaryCoinId && selectedCoinIds.size > 0;
  }, [primaryCoinId, selectedCoinIds]);

  // Handlers
  const toggleCoinSelection = (coinId: string) => {
    setSelectedCoinIds((prev) => {
      const next = new Set(prev);
      if (next.has(coinId)) {
        next.delete(coinId);
      } else {
        next.add(coinId);
      }
      return next;
    });
    setShowPreview(false);
    setDryRunResult(null);
  };

  const selectAllCoins = () => {
    setSelectedCoinIds(new Set(availableCoins.map((c) => c.coinObjectId)));
    setShowPreview(false);
    setDryRunResult(null);
  };

  const clearSelection = () => {
    setSelectedCoinIds(new Set());
    setShowPreview(false);
    setDryRunResult(null);
  };

  const handleDryRun = async () => {
    if (!coinTypeParam || !isValidMerge) return;

    setIsEstimating(true);
    setDryRunResult(null);

    try {
      const coinIdsToMerge = Array.from(selectedCoinIds);
      // fetchApi returns data.data directly, which is CoinOperationResult
      const result = await api.dryRunMergeCoins({
        primaryCoinId,
        coinIdsToMerge,
        coinType: coinTypeParam,
      });

      // result IS the CoinOperationResult directly (success, gasUsed, error)
      if (result.success) {
        setDryRunResult(result);
        setShowPreview(true);
      } else {
        showErrorToast({ message: result.error || 'Dry run failed' });
      }
    } catch (error) {
      console.error('Dry run error:', error);
      showErrorToast({ message: 'Failed to estimate merge' });
    } finally {
      setIsEstimating(false);
    }
  };

  const handleMerge = async () => {
    if (!coinTypeParam || !isValidMerge) return;

    setIsMerging(true);
    setMergeResult(null);

    try {
      const coinIdsToMerge = Array.from(selectedCoinIds);
      // fetchApi returns data.data directly, which is CoinOperationResult
      const result = await api.mergeGenericCoins({
        primaryCoinId,
        coinIdsToMerge,
        coinType: coinTypeParam,
      });

      // result IS the CoinOperationResult directly (success, digest, error)
      setMergeResult(result);
      if (result.success) {
        showSuccessToast({ message: 'Coins merged successfully!' });
      } else {
        showErrorToast({ message: result.error || 'Merge failed' });
      }
    } catch (error) {
      console.error('Merge error:', error);
      showErrorToast({ message: 'Failed to merge coins' });
    } finally {
      setIsMerging(false);
    }
  };

  const isAnyLoading = isLoading || isEstimating || isMerging;

  if (!coinTypeParam) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Invalid parameters. Please select a coin type first.</p>
        <Button onClick={() => navigate('/app/coins')} className="mt-4">
          Go to Coins
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Combine className="w-5 h-5 text-foreground" />
            <h1 className="text-lg font-semibold text-foreground">Merge Coins</h1>
          </div>
          <span className="text-muted-foreground text-sm hidden sm:block ml-auto">{symbol}</span>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
          </div>
        ) : coins.length < 2 ? (
          <div className="text-center py-8">
            <Layers className="w-10 h-10 mx-auto mb-2 text-tertiary" />
            <p className="text-muted-foreground">
              Need at least 2 coins to merge. You have {coins.length} {symbol} coin(s).
            </p>
            <Button variant="secondary" className="mt-4" onClick={() => navigate('/app/coins')}>
              Back to Coins
            </Button>
          </div>
        ) : (
          <>
            {/* Primary Coin Selector */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="text-xs text-muted-foreground mb-2">Primary coin (receives merged balance)</div>
              <select
                value={primaryCoinId}
                onChange={(e) => {
                  setPrimaryCoinId(e.target.value);
                  // Remove from selection if it was selected
                  setSelectedCoinIds((prev) => {
                    const next = new Set(prev);
                    next.delete(e.target.value);
                    return next;
                  });
                  setShowPreview(false);
                  setDryRunResult(null);
                }}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              >
                {coins.map((coin) => (
                  <option key={coin.coinObjectId} value={coin.coinObjectId}>
                    {formatBalance(coin.balance, decimals)} {symbol} - {coin.coinObjectId.slice(0, 12)}...
                  </option>
                ))}
              </select>
              {primaryCoin && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-lg text-foreground">
                      {symbol[0]}
                    </div>
                    <div className="flex-1">
                      <div className="text-lg font-semibold text-foreground">
                        {formatBalance(primaryCoin.balance, decimals)} {symbol}
                      </div>
                      <div className="text-xs font-mono text-muted-foreground truncate">
                        {primaryCoin.coinObjectId}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Coins to Merge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-xl p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-foreground flex items-center gap-2 font-medium">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  Select coins to merge
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={selectAllCoins}>
                    Select All
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearSelection}>
                    Clear
                  </Button>
                </div>
              </div>

              {/* Coin List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {availableCoins.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No other coins available to merge
                  </div>
                ) : (
                  availableCoins.map((coin) => {
                    const isSelected = selectedCoinIds.has(coin.coinObjectId);
                    return (
                      <div
                        key={coin.coinObjectId}
                        onClick={() => toggleCoinSelection(coin.coinObjectId)}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-accent border-foreground/30'
                            : 'bg-secondary/30 border-border hover:border-foreground/20'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-foreground border-foreground' : 'border-border'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-background" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground">
                            {formatBalance(coin.balance, decimals)} {symbol}
                          </div>
                          <div className="text-xs font-mono text-muted-foreground truncate">
                            {coin.coinObjectId}
                          </div>
                        </div>
                        <div className="text-xs text-tertiary">v{coin.version}</div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Summary */}
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Selected</span>
                  <span className="text-foreground">
                    {selectedCoinIds.size} coin{selectedCoinIds.size !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Selected Balance</span>
                  <span className="text-foreground">
                    {formatBalance(selectedBalance.toString(), decimals)} {symbol}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span className="text-foreground font-medium">After Merge</span>
                  <span className="text-foreground font-medium">
                    {formatBalance(totalAfterMerge.toString(), decimals)} {symbol}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Coins Reduced</span>
                  <span className="text-foreground">
                    {coins.length} → {coins.length - selectedCoinIds.size}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDryRun}
                disabled={!isValidMerge || isAnyLoading}
              >
                {isEstimating ? (
                  <>
                    <div className="w-3 h-3 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                    Estimating...
                  </>
                ) : (
                  <>
                    <Calculator className="w-3.5 h-3.5" />
                    Preview
                  </>
                )}
              </Button>
              {showPreview && dryRunResult?.success && (
                <Button className="flex-1" onClick={handleMerge} disabled={isMerging}>
                  {isMerging ? (
                    <>
                      <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />
                      Merging...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Execute Merge
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Dry Run Preview */}
            {showPreview && dryRunResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-card border rounded-xl p-4 space-y-3 ${
                  dryRunResult.success ? 'border-border' : 'border-destructive/50'
                }`}
              >
                <h3 className="text-sm font-medium text-foreground">Dry run result</h3>
                {dryRunResult.success ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span className="text-foreground">Success</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gas Estimate</span>
                      <span className="text-foreground">{dryRunResult.gasUsed || '~0.01'} SUI</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Coins Merged</span>
                      <span className="text-foreground">{selectedCoinIds.size} → 1</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="text-xs text-destructive">{dryRunResult.error}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Merge Result */}
            <AnimatePresence>
              {mergeResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      {mergeResult.success ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-foreground" />
                          <span className="text-sm font-medium text-foreground">Merge successful</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-destructive" />
                          <span className="text-sm font-medium text-destructive">Merge failed</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    {mergeResult.success && mergeResult.digest && (
                      <>
                        {/* Summary */}
                        <div className="bg-secondary/30 border border-border rounded-lg p-3">
                          <div className="text-xs text-muted-foreground mb-2">Merge result</div>
                          <div className="grid grid-cols-3 gap-2 items-center text-center">
                            <div>
                              <div className="text-lg font-semibold text-foreground">
                                {selectedCoinIds.size + 1}
                              </div>
                              <div className="text-xs text-muted-foreground">Coins</div>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-lg text-muted-foreground">→</span>
                            </div>
                            <div>
                              <div className="text-lg font-semibold text-foreground">1</div>
                              <div className="text-xs text-muted-foreground">Coin</div>
                            </div>
                          </div>
                        </div>

                        {/* Digest */}
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Transaction digest</div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-2 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs font-mono text-foreground truncate">
                              {mergeResult.digest}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(mergeResult.digest || '');
                                showSuccessToast({ message: 'Copied!' });
                              }}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Explorer Link */}
                        <Button asChild className="w-full">
                          <a
                            href={`https://testnet.suivision.xyz/txblock/${mergeResult.digest}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View on Explorer
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>

                        {/* Back to Coins */}
                        <Button variant="outline" className="w-full" onClick={() => navigate('/app/coins')}>
                          Back to Coins
                        </Button>
                      </>
                    )}
                    {!mergeResult.success && mergeResult.error && (
                      <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                        <p className="text-xs text-destructive">{mergeResult.error}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
