import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2, Copy, Droplet, ExternalLink, MessageCircle, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/useAppStore';
import { Spinner } from '../shared/Spinner';

type Network = 'devnet' | 'testnet' | 'localnet';

interface FaucetSource {
  id: string;
  name: string;
  description: string;
  networks: ('devnet' | 'testnet')[];
  type: 'api' | 'web' | 'discord';
  url?: string;
  dailyLimit?: string;
  perRequestAmount?: string;
}

const FAUCET_SOURCES: FaucetSource[] = [
  {
    id: 'fm-faucet',
    name: 'FM Faucet',
    description: 'Contact @rongmauhong (Telegram) or @222tee (X) - no captcha',
    networks: ['testnet'],
    type: 'web',
    url: 'https://fmfaucet.xyz',
    dailyLimit: '2 requests/day',
    perRequestAmount: '1 SUI',
  },
  {
    id: 'sui-web-faucet',
    name: 'Sui Web Faucet',
    description: 'Official web faucet by Mysten Labs',
    networks: ['devnet', 'testnet'],
    type: 'web',
    url: 'https://faucet.sui.io/',
    dailyLimit: 'Rate limited',
    perRequestAmount: '1 SUI',
  },
  {
    id: 'blockbolt-faucet',
    name: 'Blockbolt Faucet',
    description: 'Community faucet - no captcha',
    networks: ['devnet', 'testnet'],
    type: 'web',
    url: 'https://faucet.blockbolt.io/',
    dailyLimit: 'Limited',
    perRequestAmount: '1 SUI',
  },
  {
    id: 'n1stake-faucet',
    name: 'n1stake Faucet',
    description: 'Fast faucet - no registration',
    networks: ['testnet'],
    type: 'web',
    url: 'https://faucet.n1stake.com/',
    dailyLimit: '1 request/day',
    perRequestAmount: '0.5 SUI',
  },
  {
    id: 'suilearn-faucet',
    name: 'SuiLearn Faucet',
    description: 'Community faucet from India - simple & fast',
    networks: ['testnet'],
    type: 'web',
    url: 'https://faucet.suilearn.io/',
    dailyLimit: 'Limited',
    perRequestAmount: '1 SUI',
  },
  {
    id: 'stakely-faucet',
    name: 'Stakely Faucet',
    description: 'Requires captcha verification',
    networks: ['testnet'],
    type: 'web',
    url: 'https://stakely.io/faucet/sui-testnet-sui',
    dailyLimit: '1 request/day',
    perRequestAmount: '0.5 SUI',
  },
  {
    id: 'sui-discord',
    name: 'Sui Discord Faucet',
    description: 'Use #devnet-faucet or #testnet-faucet channel',
    networks: ['devnet', 'testnet'],
    type: 'discord',
    url: 'https://discord.gg/sui',
    dailyLimit: 'Varies',
    perRequestAmount: 'Varies',
  },
];

const networks: { id: Network; name: string; icon: string; description: string }[] = [
  {
    id: 'devnet',
    name: 'Devnet',
    icon: '🔵',
    description: 'Development network',
  },
  {
    id: 'testnet',
    name: 'Testnet',
    icon: '🟡',
    description: 'Public test network',
  },
  {
    id: 'localnet',
    name: 'Localnet',
    icon: '⚪',
    description: 'Local node',
  },
];

export function FaucetForm() {
  const { addresses, isLoading, requestFaucet, environments } = useAppStore();
  const [searchParams] = useSearchParams();
  const [selectedNetwork, setSelectedNetwork] = useState<Network>('testnet');
  const [isRequesting, setIsRequesting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    txDigest?: string;
  } | null>(null);
  const [customAddress, setCustomAddress] = useState('');

  const activeAddress = addresses.find((a) => a.isActive);
  const activeEnv = environments.find((e) => e.isActive);

  // Support requesting for external addresses via query param (e.g., multi-sig addresses)
  const queryAddress = searchParams.get('address');

  // Initialize custom address from query param
  useEffect(() => {
    if (queryAddress && queryAddress !== activeAddress?.address) {
      setCustomAddress(queryAddress);
    }
  }, [queryAddress, activeAddress?.address]);

  // Target address: custom address (for multi-sig) or active address
  const targetAddress = customAddress || activeAddress?.address;
  const isExternalAddress = !!customAddress && customAddress !== activeAddress?.address;

  // Auto-detect network from active environment
  const detectNetwork = (): Network | null => {
    if (!activeEnv) return null;
    const alias = activeEnv.alias.toLowerCase();
    if (alias.includes('devnet')) return 'devnet';
    if (alias.includes('testnet')) return 'testnet';
    if (alias.includes('local')) return 'localnet';
    return null;
  };

  const detectedNetwork = detectNetwork();

  // Filter faucet sources for selected network
  const availableSources = FAUCET_SOURCES.filter(
    (source) =>
      selectedNetwork !== 'localnet' &&
      source.networks.includes(selectedNetwork as 'devnet' | 'testnet')
  );

  const handleRequest = async () => {
    if (!targetAddress) {
      toast.error('No address specified');
      return;
    }

    setIsRequesting(true);
    setLastResult(null);
    try {
      // Pass target address for external/multi-sig addresses
      await requestFaucet(selectedNetwork, isExternalAddress ? targetAddress : undefined);
      const result = {
        success: true,
        message: `Tokens requested from ${selectedNetwork} faucet!`,
      };
      setLastResult(result);
      toast.success(result.message);
    } catch (error) {
      // Clean up error message - remove "Error:" prefix if present
      let errorMessage = error instanceof Error ? error.message : String(error);
      errorMessage = errorMessage.replace(/^Error:\s*/i, '');

      const result = {
        success: false,
        message: errorMessage,
      };
      setLastResult(result);
      toast.error(errorMessage);
    } finally {
      setIsRequesting(false);
    }
  };

  const openExternalFaucet = (url: string) => {
    // Use noopener,noreferrer to prevent tabnapping attacks
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyAddress = () => {
    if (targetAddress) {
      navigator.clipboard.writeText(targetAddress);
      toast.success('Address copied to clipboard');
    }
  };

  // Clear custom address to switch back to active address
  const clearCustomAddress = () => {
    setCustomAddress('');
  };

  if (!targetAddress && !activeAddress) {
    return <div className="px-3 py-8 text-center text-muted-foreground">No address selected</div>;
  }

  return (
    <div className="px-3 py-3 space-y-4">
      {/* Address summary */}
      <div className="p-4 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Droplet className="w-3.5 h-3.5 text-[#4da2ff]" />
            <span>Request faucet tokens</span>
            {isExternalAddress && (
              <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded-full border border-purple-500/30">
                External
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isExternalAddress && (
              <button
                onClick={clearCustomAddress}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                title="Clear"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={copyAddress}
              className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
              title="Copy address"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-2 text-foreground truncate font-mono text-sm">
          {isExternalAddress ? targetAddress : activeAddress?.alias || activeAddress?.address}
        </div>
        {!isExternalAddress && activeAddress && (
          <div className="text-xs text-muted-foreground mt-1">
            Balance: <span className="text-[#4da2ff]">{activeAddress.balance || '0'} SUI</span>
          </div>
        )}
      </div>

      {/* Network mismatch warning */}
      {detectedNetwork && detectedNetwork !== selectedNetwork && (
        <div className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-yellow-400/90">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                Environment mismatch: {activeEnv?.alias} → {detectedNetwork}
              </span>
            </div>
            <button
              onClick={() => setSelectedNetwork(detectedNetwork)}
              className="text-xs text-yellow-400 hover:text-yellow-300 font-medium"
            >
              Switch
            </button>
          </div>
        </div>
      )}

      {/* Network selection */}
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1">
          Network
        </div>
        <div className="flex gap-2">
          {networks.map((network) => (
            <button
              key={network.id}
              onClick={() => setSelectedNetwork(network.id)}
              className={clsx(
                'flex-1 px-3 py-2 text-xs rounded-lg transition-all border',
                selectedNetwork === network.id
                  ? 'bg-[#4da2ff]/20 text-[#4da2ff] border-[#4da2ff]/30'
                  : 'bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-border'
              )}
            >
              <div className="text-lg mb-1">{network.icon}</div>
              <div>{network.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Request button */}
      {selectedNetwork !== 'localnet' && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Droplet className="w-3.5 h-3.5" />
            <span>Sui official faucet</span>
            <span className="text-tertiary">·</span>
            <span>1 SUI per request</span>
          </div>
          <Button
            onClick={handleRequest}
            disabled={isRequesting || isLoading}
            className="w-full"
          >
            {isRequesting ? (
              <>
                <Spinner size="sm" />
                Requesting...
              </>
            ) : (
              <>
                <Droplet className="w-4 h-4" />
                Request tokens
              </>
            )}
          </Button>
        </div>
      )}

      {/* Localnet */}
      {selectedNetwork === 'localnet' && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>💻</span>
            <span>Local faucet</span>
            <span className="text-tertiary">·</span>
            <span>Requires local node</span>
          </div>
          <Button
            variant="secondary"
            onClick={handleRequest}
            disabled={isRequesting || isLoading}
            className="w-full"
          >
            {isRequesting ? (
              <>
                <Spinner size="sm" />
                Requesting...
              </>
            ) : (
              <>
                <Droplet className="w-4 h-4" />
                Request local tokens
              </>
            )}
          </Button>
        </div>
      )}

      {/* Result */}
      {lastResult && (
        <div
          className={clsx(
            'px-3 py-2 border rounded-lg text-xs',
            lastResult.success
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          )}
        >
          <div
            className={clsx(
              'flex items-center gap-2',
              lastResult.success ? 'text-green-400' : 'text-red-400'
            )}
          >
            {lastResult.success ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            <span>{lastResult.message}</span>
          </div>
          {lastResult.txDigest && (
            <div className="text-muted-foreground mt-1 truncate font-mono">
              tx: {lastResult.txDigest}
            </div>
          )}
        </div>
      )}

      {/* Alternative faucets */}
      {availableSources.length > 0 && selectedNetwork !== 'localnet' && (
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Alternatives
          </div>
          <div className="space-y-1">
            {availableSources.map((source) => (
              <div
                key={source.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group border border-transparent hover:border-border"
                onClick={() => source.url && openExternalFaucet(source.url)}
              >
                <span className="text-sm flex-shrink-0">
                  {source.type === 'web' ? (
                    '🌐'
                  ) : source.type === 'discord' ? (
                    <MessageCircle className="w-4 h-4" />
                  ) : (
                    '🔗'
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {source.name}
                  </span>
                </div>
                <span className="text-[10px] text-[#4da2ff]">{source.perRequestAmount}</span>
                <span className="text-[10px] text-tertiary">{source.dailyLimit}</span>
                <ExternalLink className="w-3 h-3 text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="px-3 py-3 border-t border-border text-xs text-muted-foreground">
        <div className="mb-1 font-medium">Tips</div>
        <div className="space-y-0.5 pl-2 text-tertiary">
          <div>Rate limit: ~10 requests/day (official)</div>
          <div>Discord: #devnet-faucet or #testnet-faucet</div>
          <div>Mainnet: no faucets available</div>
        </div>
      </div>
    </div>
  );
}
