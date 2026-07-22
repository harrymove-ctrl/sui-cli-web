import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Coins,
  Droplet,
  Eye,
  EyeOff,
  KeyRound,
  Package,
  Send,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/avatar';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { ExportPrivateKeyDialog } from '@/components/AddressList/ExportPrivateKeyDialog';

function formatBalance(balance: string | undefined): string {
  const num = parseFloat(balance || '0');
  if (isNaN(num)) return '0.00';
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Sui CLI env aliases are conventionally named after the network itself
// (testnet/mainnet/devnet/localnet) - color-coded so mainnet (real funds)
// reads as visually distinct from the sandboxed networks.
const NETWORK_COLORS: Record<string, string> = {
  mainnet: 'bg-destructive/15 text-destructive',
  testnet: 'bg-primary/15 text-primary',
  devnet: 'bg-violet-500/15 text-violet-500',
  localnet: 'bg-muted-foreground/15 text-muted-foreground',
};

function networkBadgeClass(alias: string | undefined): string {
  if (!alias) return NETWORK_COLORS.localnet;
  return NETWORK_COLORS[alias.toLowerCase()] ?? NETWORK_COLORS.localnet;
}

const ACTIONS = [
  { id: 'send', label: 'Send', icon: Send, to: '/app/transfer' },
  { id: 'faucet', label: 'Faucet', icon: Droplet, to: '/app/faucet' },
  { id: 'coins', label: 'Coins', icon: Coins, to: '/app/coins' },
  { id: 'objects', label: 'Objects', icon: Package, to: '/app/objects' },
] as const;

export function WalletCard() {
  const navigate = useNavigate();
  const { addresses, switchAddress, environments } = useAppStore();
  const activeAddress = addresses.find((a) => a.isActive);
  const activeEnv = environments.find((e) => e.isActive);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Transient balance-change indicator: compares against the last balance seen
  // this session, not a real historical delta.
  const prevBalanceRef = useRef<string | undefined>(activeAddress?.balance);
  const [delta, setDelta] = useState<number | null>(null);

  useEffect(() => {
    const current = activeAddress?.balance;
    const prev = prevBalanceRef.current;
    if (current !== undefined && prev !== undefined && current !== prev) {
      const diff = parseFloat(current) - parseFloat(prev);
      if (!isNaN(diff) && diff !== 0) {
        setDelta(diff);
        const timer = setTimeout(() => setDelta(null), 15000);
        return () => clearTimeout(timer);
      }
    }
    prevBalanceRef.current = current;
  }, [activeAddress?.balance]);

  useEffect(() => {
    if (!switcherOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [switcherOpen]);

  const otherAddresses = addresses.filter((a) => !a.isActive);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      {/* Account switcher + balance, one compact row */}
      <div className="relative" ref={switcherRef}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSwitcherOpen((o) => !o)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            <Avatar
              label={activeAddress?.alias || activeAddress?.address}
              className="w-6 h-6 text-[10px] flex-shrink-0"
            />
            <span className="text-xs font-medium text-foreground truncate">
              {activeAddress?.alias || 'No address'}
            </span>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform',
                switcherOpen && 'rotate-180'
              )}
            />
          </button>
          {activeEnv && (
            <Tooltip content={`Switch network (currently ${activeEnv.alias})`} side="top">
              <button
                onClick={() => navigate('/app/environments')}
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 transition-opacity hover:opacity-75',
                  networkBadgeClass(activeEnv.alias)
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {activeEnv.alias}
              </button>
            </Tooltip>
          )}
          <button
            onClick={() => setBalanceHidden((h) => !h)}
            aria-label={balanceHidden ? 'Show balance' : 'Hide balance'}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            {balanceHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>

        <AnimatePresence>
          {switcherOpen && otherAddresses.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-border bg-popover shadow-lg overflow-hidden z-10"
            >
              {otherAddresses.map((addr) => (
                <button
                  key={addr.address}
                  onClick={() => {
                    switchAddress(addr.address);
                    setSwitcherOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-accent transition-colors"
                >
                  <Avatar label={addr.alias || addr.address} className="w-6 h-6 text-[10px]" />
                  <span className="text-sm text-foreground truncate">
                    {addr.alias || `${addr.address.slice(0, 8)}...`}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-lg font-semibold text-foreground">
          {balanceHidden ? '••••••' : formatBalance(activeAddress?.balance)}
          {!balanceHidden && <span className="text-xs text-muted-foreground ml-1">SUI</span>}
        </span>

        {!balanceHidden && delta !== null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium',
              delta > 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
            )}
          >
            {delta > 0 ? (
              <TrendingUp className="w-2.5 h-2.5" />
            ) : (
              <TrendingDown className="w-2.5 h-2.5" />
            )}
            {delta > 0 ? '+' : ''}
            {delta.toFixed(2)}
          </span>
        )}
      </div>

      {/* Actions - tooltips anchor above the icons (side="top"): this card is
          pinned at the bottom of the sidebar, so a bottom-positioned tooltip
          has nowhere to render and gets clipped by the viewport edge. */}
      <div className="mt-3 grid grid-cols-5 gap-1">
        {ACTIONS.map((action) => (
          <Tooltip key={action.id} content={action.label} side="top">
            <button
              onClick={() => navigate(action.to)}
              className="flex items-center justify-center w-full h-7 rounded-md bg-secondary hover:bg-accent transition-colors"
            >
              <action.icon className="w-3.5 h-3.5 text-foreground" />
            </button>
          </Tooltip>
        ))}
        <Tooltip content="Export Private Key" side="top">
          <button
            onClick={() => setExportOpen(true)}
            disabled={!activeAddress}
            className="flex items-center justify-center w-full h-7 rounded-md bg-secondary hover:bg-destructive/15 transition-colors disabled:opacity-40"
          >
            <KeyRound className="w-3.5 h-3.5 text-destructive" />
          </button>
        </Tooltip>
      </div>

      <ExportPrivateKeyDialog
        isOpen={exportOpen}
        address={activeAddress?.address ?? ''}
        alias={activeAddress?.alias}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}
