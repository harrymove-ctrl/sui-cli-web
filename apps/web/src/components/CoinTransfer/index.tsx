import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { getApiBaseUrl } from '@/api/client';
import { Spinner } from '../shared/Spinner';
import toast from 'react-hot-toast';
import { ArrowLeft, Send, AlertCircle, CheckCircle, ChevronDown, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface CoinMetadata {
  coinType: string;
  name: string;
  symbol: string;
  decimals: number;
  description?: string;
  iconUrl?: string;
}

export function CoinTransfer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addresses } = useAppStore();
  const activeAddress = addresses.find((a) => a.isActive);

  // URL params
  const coinIdParam = searchParams.get('coinId') || '';
  const coinTypeParam = searchParams.get('type') || '';

  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [metadata, setMetadata] = useState<CoinMetadata | null>(null);
  const [coinBalance, setCoinBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(true);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [estimatedGas, setEstimatedGas] = useState<string>('');
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<{
    success: boolean;
    digest?: string;
    error?: string;
  } | null>(null);

  // Filter out current active address from recipient options
  const otherAddresses = addresses.filter((a) => !a.isActive);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowWalletDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load coin metadata and balance
  useEffect(() => {
    async function loadCoinInfo() {
      if (!coinTypeParam || !coinIdParam || !activeAddress) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch metadata
        const metaRes = await fetch(
          `${getApiBaseUrl()}/coins/metadata?type=${encodeURIComponent(coinTypeParam)}`
        );
        const metaData = await metaRes.json();
        if (metaData.success && metaData.data) {
          setMetadata(metaData.data);
        } else {
          // Default metadata
          const parts = coinTypeParam.split('::');
          setMetadata({
            coinType: coinTypeParam,
            name: parts[parts.length - 1] || 'Unknown',
            symbol: parts[parts.length - 1] || '???',
            decimals: 9,
          });
        }

        // Fetch coin balance from grouped coins
        const coinsRes = await fetch(`${getApiBaseUrl()}/coins/${activeAddress.address}`);
        const coinsData = await coinsRes.json();
        if (coinsData.success && coinsData.data?.groups) {
          for (const group of coinsData.data.groups) {
            for (const coin of group.coins) {
              if (coin.coinObjectId === coinIdParam) {
                setCoinBalance(coin.balance);
                break;
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load coin info:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadCoinInfo();
  }, [coinIdParam, coinTypeParam, activeAddress]);

  const formatBalance = (balance: string, decimals: number): string => {
    const balanceBigInt = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const integerPart = balanceBigInt / divisor;
    const fractionalPart = balanceBigInt % divisor;

    let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    fractionalStr = fractionalStr.replace(/0+$/, '');
    if (fractionalStr.length < 4) {
      fractionalStr = fractionalStr.padEnd(4, '0');
    }

    return `${integerPart}.${fractionalStr}`;
  };

  const parseAmount = (amountStr: string, decimals: number): string => {
    // Convert human-readable amount to base units
    const parts = amountStr.split('.');
    const intPart = parts[0] || '0';
    let fracPart = parts[1] || '';

    // Pad or truncate fractional part
    if (fracPart.length > decimals) {
      fracPart = fracPart.slice(0, decimals);
    } else {
      fracPart = fracPart.padEnd(decimals, '0');
    }

    return BigInt(intPart + fracPart).toString();
  };

  const handleEstimate = async () => {
    if (!toAddress || !amount || !metadata) {
      toast.error('Please fill all fields');
      return;
    }

    setIsEstimating(true);
    setEstimatedGas('');

    try {
      const amountInBaseUnits = parseAmount(amount, metadata.decimals);

      const response = await fetch(`${getApiBaseUrl()}/coins/transfer/dry-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinId: coinIdParam,
          coinType: coinTypeParam,
          to: toAddress,
          amount: amountInBaseUnits,
        }),
      });

      const data = await response.json();
      if (data.success && data.data?.success) {
        const gasUsed = data.data.gasUsed || '0';
        setEstimatedGas(formatBalance(gasUsed, 9));
        toast.success('Gas estimated');
      } else {
        toast.error(data.data?.error || data.error || 'Estimation failed');
      }
    } catch (error) {
      toast.error('Failed to estimate gas');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleTransfer = async () => {
    if (!toAddress || !amount || !metadata) {
      toast.error('Please fill all fields');
      return;
    }

    setIsTransferring(true);
    setResult(null);

    try {
      const amountInBaseUnits = parseAmount(amount, metadata.decimals);

      const response = await fetch(`${getApiBaseUrl()}/coins/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinId: coinIdParam,
          coinType: coinTypeParam,
          to: toAddress,
          amount: amountInBaseUnits,
        }),
      });

      const data = await response.json();
      if (data.success && data.data?.success) {
        setResult({
          success: true,
          digest: data.data.digest,
        });
        toast.success('Transfer successful!');
      } else {
        setResult({
          success: false,
          error: data.data?.error || data.error || 'Transfer failed',
        });
        toast.error(data.data?.error || data.error || 'Transfer failed');
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Failed to execute transfer',
      });
      toast.error('Failed to execute transfer');
    } finally {
      setIsTransferring(false);
    }
  };

  const setMaxAmount = () => {
    if (metadata && coinBalance !== '0') {
      setAmount(formatBalance(coinBalance, metadata.decimals));
    }
  };

  if (!coinIdParam || !coinTypeParam) {
    return (
      <div className="px-3 py-8 text-center text-muted-foreground">
        <div className="text-4xl mb-2">Missing coin info</div>
        <Button className="mt-4" onClick={() => navigate('/app/objects')}>
          Go to Objects
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="px-2 py-2 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Transfer {metadata?.symbol || 'Coin'}</h1>
          <p className="text-xs text-muted-foreground">Send to any address</p>
        </div>
      </div>

      {/* Coin Info */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Coin</span>
            <Badge variant="secondary">{metadata?.symbol}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Balance</span>
            <span className="text-sm font-mono text-foreground">
              {formatBalance(coinBalance, metadata?.decimals || 9)} {metadata?.symbol}
            </span>
          </div>
          <div className="text-xs font-mono text-tertiary truncate">{coinIdParam}</div>
        </CardContent>
      </Card>

      {/* Transfer Form */}
      {!result ? (
        <div className="space-y-4">
          {/* To Address */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-muted-foreground">Recipient address</label>
              {otherAddresses.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                  >
                    <Wallet className="w-3 h-3" />
                    My Wallets
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${showWalletDropdown ? 'rotate-180' : ''}`}
                    />
                  </Button>
                  {showWalletDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                      <div className="px-3 py-2 bg-secondary border-b border-border text-xs text-muted-foreground">
                        Select from your wallets
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {otherAddresses.map((addr) => (
                          <button
                            key={addr.address}
                            type="button"
                            onClick={() => {
                              setToAddress(addr.address);
                              setShowWalletDropdown(false);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-accent transition-colors border-b border-border last:border-0"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">📋</span>
                              <div className="flex-1 min-w-0">
                                {addr.alias && (
                                  <div className="text-xs font-medium text-foreground truncate">
                                    {addr.alias}
                                  </div>
                                )}
                                <div className="text-xs font-mono text-muted-foreground truncate">
                                  {addr.address.slice(0, 10)}...{addr.address.slice(-8)}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm font-mono text-foreground placeholder:text-tertiary focus:outline-none focus:border-primary"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Amount</label>
            <div className="relative">
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full px-3 py-2 pr-20 bg-card border border-border rounded-lg text-sm font-mono text-foreground placeholder:text-tertiary focus:outline-none focus:border-primary"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={setMaxAmount}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                MAX
              </Button>
            </div>
          </div>

          {/* Estimated Gas */}
          {estimatedGas && (
            <div className="p-3 bg-secondary border border-border rounded-lg text-sm">
              <span className="text-muted-foreground">Estimated gas:</span>{' '}
              <span className="font-mono text-foreground">{estimatedGas} SUI</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleEstimate}
              disabled={isEstimating || !toAddress || !amount}
            >
              {isEstimating ? 'Estimating...' : 'Estimate Gas'}
            </Button>
            <Button
              className="flex-1"
              onClick={handleTransfer}
              disabled={isTransferring || !toAddress || !amount}
            >
              {isTransferring ? (
                <>
                  <Spinner className="w-4 h-4" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* Result */
        <div
          className={`p-4 rounded-lg ${result.success ? 'bg-success/10 border border-success/30' : 'bg-destructive/10 border border-destructive/30'}`}
        >
          <div className="flex items-center gap-2 mb-3">
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-success" />
            ) : (
              <AlertCircle className="w-5 h-5 text-destructive" />
            )}
            <span className={`font-medium ${result.success ? 'text-success' : 'text-destructive'}`}>
              {result.success ? 'Transfer Successful' : 'Transfer Failed'}
            </span>
          </div>

          {result.digest && (
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1">Transaction digest</div>
              <div
                className="text-sm font-mono bg-card border border-border p-2 rounded cursor-pointer hover:bg-accent text-foreground break-all"
                onClick={() => {
                  navigator.clipboard.writeText(result.digest!);
                  toast.success('Copied!');
                }}
              >
                {result.digest}
              </div>
            </div>
          )}

          {result.error && <div className="text-sm text-destructive">{result.error}</div>}

          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setResult(null)}>
              Transfer Again
            </Button>
            <Button className="flex-1" onClick={() => navigate('/app/objects')}>
              Back to Objects
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
