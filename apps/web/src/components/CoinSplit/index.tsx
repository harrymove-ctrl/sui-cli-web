import type { CoinInfo, CoinMetadata, CoinOperationResult } from '@sui-cli-web/shared';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  Copy,
  ExternalLink,
  Plus,
  Scissors,
  Split,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '@/api/client';
import { Button } from '@/components/ui/button';
import { CopyForAiMenu } from '@/components/ui/copy-for-ai';
import { showErrorToast, showSuccessToast } from '@/lib/toast';
import { useAppStore } from '@/stores/useAppStore';

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

// Convert human-readable amount to raw amount (MIST equivalent)
function toRawAmount(amount: string, decimals: number): string {
  const [intPart, fracPart = ''] = amount.split('.');
  const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals);
  const rawStr = intPart + paddedFrac;
  return BigInt(rawStr).toString();
}

// Parse raw amount to human-readable
function fromRawAmount(raw: string, decimals: number): string {
  return formatBalance(raw, decimals);
}

interface SplitAmount {
  id: string;
  value: string;
  rawValue: string;
}

export function CoinSplit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addresses } = useAppStore();
  const activeAddress = addresses.find((a) => a.isActive);

  // URL params
  const coinIdParam = searchParams.get('coinId');
  const coinTypeParam = searchParams.get('type');

  // State
  const [coin, setCoin] = useState<CoinInfo | null>(null);
  const [metadata, setMetadata] = useState<CoinMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [splitAmounts, setSplitAmounts] = useState<SplitAmount[]>([
    { id: '1', value: '', rawValue: '' },
  ]);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<CoinOperationResult | null>(null);
  const [splitResult, setSplitResult] = useState<CoinOperationResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const decimals = metadata?.decimals ?? 9;
  const symbol = metadata?.symbol ?? 'COIN';

  // Load coin and metadata
  useEffect(() => {
    async function loadData() {
      if (!coinIdParam || !coinTypeParam || !activeAddress) return;

      setIsLoading(true);
      try {
        // Load coins of this type - getCoinsByType returns CoinInfo[] directly
        const coins = await api.getCoinsByType(activeAddress.address, coinTypeParam);
        if (coins && coins.length > 0) {
          const foundCoin = coins.find((c) => c.coinObjectId === coinIdParam);
          if (foundCoin) {
            setCoin(foundCoin);
          } else {
            showErrorToast({ message: 'Coin not found in this type' });
          }
        } else {
          showErrorToast({ message: 'No coins found of this type' });
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
  }, [coinIdParam, coinTypeParam, activeAddress?.address]);

  // Calculate totals
  const totalSplitAmount = useMemo(() => {
    return splitAmounts.reduce((sum, a) => {
      const val = a.rawValue ? BigInt(a.rawValue) : BigInt(0);
      return sum + val;
    }, BigInt(0));
  }, [splitAmounts]);

  const remainingBalance = useMemo(() => {
    if (!coin) return BigInt(0);
    const coinBalance = BigInt(coin.balance);
    return coinBalance - totalSplitAmount;
  }, [coin, totalSplitAmount]);

  const isValidSplit = useMemo(() => {
    if (!coin) return false;
    if (splitAmounts.length === 0) return false;
    if (splitAmounts.some((a) => !a.rawValue || BigInt(a.rawValue) <= 0)) return false;
    if (totalSplitAmount >= BigInt(coin.balance)) return false;
    return true;
  }, [coin, splitAmounts, totalSplitAmount]);

  // Handlers
  const addSplitAmount = () => {
    setSplitAmounts([...splitAmounts, { id: Date.now().toString(), value: '', rawValue: '' }]);
  };

  const removeSplitAmount = (id: string) => {
    if (splitAmounts.length === 1) {
      showErrorToast({ message: 'At least one amount required' });
      return;
    }
    setSplitAmounts(splitAmounts.filter((a) => a.id !== id));
  };

  const updateSplitAmount = (id: string, value: string) => {
    // Validate input - allow only numbers and one decimal point
    if (value && !/^\d*\.?\d*$/.test(value)) return;

    const rawValue = value ? toRawAmount(value, decimals) : '';
    setSplitAmounts(splitAmounts.map((a) => (a.id === id ? { ...a, value, rawValue } : a)));
    setShowPreview(false);
    setDryRunResult(null);
  };

  // Quick split presets
  const applyPreset = (preset: 'half' | '3equal' | '5equal' | '10equal') => {
    if (!coin) return;
    const balance = BigInt(coin.balance);

    let amounts: bigint[] = [];
    switch (preset) {
      case 'half':
        amounts = [balance / BigInt(2)];
        break;
      case '3equal':
        amounts = [balance / BigInt(3), balance / BigInt(3)];
        break;
      case '5equal':
        amounts = Array(4).fill(balance / BigInt(5));
        break;
      case '10equal':
        amounts = Array(9).fill(balance / BigInt(10));
        break;
    }

    setSplitAmounts(
      amounts.map((raw, idx) => ({
        id: `preset-${idx}`,
        value: fromRawAmount(raw.toString(), decimals),
        rawValue: raw.toString(),
      }))
    );
    setShowPreview(false);
    setDryRunResult(null);
  };

  const handleDryRun = async () => {
    if (!coin || !coinTypeParam || !isValidSplit) return;

    setIsEstimating(true);
    setDryRunResult(null);

    try {
      const amounts = splitAmounts.map((a) => a.rawValue);
      // fetchApi returns data.data directly, which is CoinOperationResult
      const result = await api.dryRunSplitCoin({
        coinId: coin.coinObjectId,
        coinType: coinTypeParam,
        amounts,
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
      showErrorToast({ message: 'Failed to estimate split' });
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSplit = async () => {
    if (!coin || !coinTypeParam || !isValidSplit) return;

    setIsSplitting(true);
    setSplitResult(null);

    try {
      const amounts = splitAmounts.map((a) => a.rawValue);
      // fetchApi returns data.data directly, which is CoinOperationResult
      const result = await api.splitGenericCoin({
        coinId: coin.coinObjectId,
        coinType: coinTypeParam,
        amounts,
      });

      // result IS the CoinOperationResult directly (success, digest, error)
      setSplitResult(result);
      if (result.success) {
        showSuccessToast({ message: 'Coin split successfully!' });
      } else {
        showErrorToast({ message: result.error || 'Split failed' });
      }
    } catch (error) {
      console.error('Split error:', error);
      showErrorToast({ message: 'Failed to split coin' });
    } finally {
      setIsSplitting(false);
    }
  };

  const isAnyLoading = isLoading || isEstimating || isSplitting;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showSuccessToast({ message: `${label} copied` });
  };

  const aiJson = JSON.stringify(
    {
      operation: 'split',
      coinType: coinTypeParam,
      symbol,
      decimals,
      sourceCoin: coin
        ? {
            coinObjectId: coin.coinObjectId,
            version: coin.version,
            balance: formatBalance(coin.balance, decimals),
          }
        : null,
      splitAmounts: splitAmounts
        .filter((a) => a.rawValue)
        .map((a) => ({ value: a.value, raw: a.rawValue })),
      splitTotal: formatBalance(totalSplitAmount.toString(), decimals),
      remaining: formatBalance(remainingBalance.toString(), decimals),
    },
    null,
    2
  );

  const aiMarkdown = [
    '# Sui coin split',
    '',
    `- **Coin type:** ${coinTypeParam}`,
    `- **Symbol:** ${symbol}`,
    coin ? `- **Source coin:** ${coin.coinObjectId}` : '',
    coin ? `- **Source balance:** ${formatBalance(coin.balance, decimals)} ${symbol}` : '',
    `- **Split total:** ${formatBalance(totalSplitAmount.toString(), decimals)} ${symbol}`,
    `- **Remaining:** ${formatBalance(remainingBalance.toString(), decimals)} ${symbol}`,
    '',
    '## Split into',
    ...splitAmounts.filter((a) => a.value).map((a, i) => `${i + 1}. ${a.value} ${symbol}`),
  ]
    .filter(Boolean)
    .join('\n');

  const aiPrompt = `I'm splitting a ${symbol} coin on Sui.\n\n${aiMarkdown}\n\nCheck that these split amounts make sense, don't exceed the source balance, and leave enough behind for gas.`;

  if (!coinIdParam || !coinTypeParam) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">Invalid parameters. Please select a coin first.</p>
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
            <Scissors className="w-5 h-5 text-foreground" />
            <h1 className="text-lg font-semibold text-foreground">Split Coin</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground text-sm hidden sm:block">{symbol}</span>
            {coin && (
              <CopyForAiMenu
                prompt={aiPrompt}
                json={aiJson}
                markdown={aiMarkdown}
                onCopy={copyToClipboard}
              />
            )}
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !coin ? (
          <div className="text-center py-8 text-muted-foreground">Coin not found</div>
        ) : (
          <>
            {/* Source Coin Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="text-xs text-muted-foreground mb-2">Source coin</div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-lg text-foreground">
                  {symbol[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                      {symbol}
                    </span>
                    <span className="text-xs text-muted-foreground">v{coin.version}</span>
                  </div>
                  <div className="text-lg font-semibold text-foreground mt-1">
                    {formatBalance(coin.balance, decimals)} {symbol}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-xs font-mono text-muted-foreground truncate">
                  {coin.coinObjectId}
                </div>
              </div>
            </motion.div>

            {/* Split Amounts */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-xl p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-foreground flex items-center gap-2 font-medium">
                  <Split className="w-4 h-4 text-muted-foreground" />
                  Split amounts
                </div>
                <Button size="sm" variant="outline" onClick={addSplitAmount}>
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'half', label: 'Half' },
                  { key: '3equal', label: '3 Equal' },
                  { key: '5equal', label: '5 Equal' },
                  { key: '10equal', label: '10 Equal' },
                ].map(({ key, label }) => (
                  <Button
                    key={key}
                    size="sm"
                    variant="secondary"
                    onClick={() => applyPreset(key as any)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {/* Amount Inputs */}
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {splitAmounts.map((amount, idx) => (
                  <div
                    key={amount.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 border border-border"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs text-foreground">
                      {idx + 1}
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={amount.value}
                        onChange={(e) => updateSplitAmount(amount.id, e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 pr-16 bg-background border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {symbol}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeSplitAmount(amount.id)}
                      disabled={splitAmounts.length === 1}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Split Total</span>
                  <span className="text-foreground">
                    {formatBalance(totalSplitAmount.toString(), decimals)} {symbol}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className={remainingBalance < 0 ? 'text-destructive' : 'text-foreground'}>
                    {formatBalance(remainingBalance.toString(), decimals)} {symbol}
                  </span>
                </div>
                {remainingBalance < 0 && (
                  <div className="flex items-center gap-2 text-xs text-destructive">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Split amounts exceed balance</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDryRun}
                disabled={!isValidSplit || isAnyLoading}
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
                <Button className="flex-1" onClick={handleSplit} disabled={isSplitting}>
                  {isSplitting ? (
                    <>
                      <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />
                      Splitting...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Execute Split
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
                      <span className="text-muted-foreground">New Coins</span>
                      <span className="text-foreground">{splitAmounts.length} coins</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="text-xs text-destructive">{dryRunResult.error}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Split Result */}
            <AnimatePresence>
              {splitResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      {splitResult.success ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-foreground" />
                          <span className="text-sm font-medium text-foreground">
                            Split successful
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-destructive" />
                          <span className="text-sm font-medium text-destructive">Split failed</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    {splitResult.success && splitResult.digest && (
                      <>
                        {/* Digest */}
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Transaction digest</div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-2 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs font-mono text-foreground truncate">
                              {splitResult.digest}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(splitResult.digest || '');
                                showSuccessToast({ message: 'Copied!' });
                              }}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* New Coin IDs */}
                        {splitResult.newCoinIds && splitResult.newCoinIds.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">
                              New coins ({splitResult.newCoinIds.length})
                            </div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {splitResult.newCoinIds.map((id, idx) => (
                                <div
                                  key={id}
                                  className="flex items-center gap-2 px-2 py-1 bg-secondary/40 rounded-lg"
                                >
                                  <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                                  <code className="flex-1 text-xs font-mono text-foreground truncate">
                                    {id}
                                  </code>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                      navigator.clipboard.writeText(id);
                                      showSuccessToast({ message: 'Copied!' });
                                    }}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Explorer Link */}
                        <Button asChild className="w-full">
                          <a
                            href={`https://testnet.suivision.xyz/txblock/${splitResult.digest}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View on Explorer
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>

                        {/* Back to Coins */}
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => navigate('/app/coins')}
                        >
                          Back to Coins
                        </Button>
                      </>
                    )}
                    {!splitResult.success && splitResult.error && (
                      <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                        <p className="text-xs text-destructive">{splitResult.error}</p>
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
