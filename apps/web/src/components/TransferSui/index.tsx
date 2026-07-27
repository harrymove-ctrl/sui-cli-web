import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Repeat,
  Send,
  Sparkles,
  Star,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { getApiBaseUrl } from '@/api/client';
import { Button } from '@/components/ui/button';
import { CopyForAiMenu } from '@/components/ui/copy-for-ai';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClarityEvents, trackEvent } from '@/lib/clarity';
import { showErrorToast, showInfoToast, showSuccessToast } from '@/lib/toast';
import { buildAiContext } from '@/lib/ai-context';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';

interface TransferableCoin {
  coinObjectId: string;
  balance: string;
  balanceSui: string;
}

interface SavedAddress {
  address: string;
  alias: string;
  lastUsed?: number;
}

interface BatchRecipient {
  id: string;
  address: string;
  amount: string;
}

type TransferMode = 'external' | 'internal' | 'batch';

export function TransferSui() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addresses, fetchAddresses } = useAppStore();
  const activeAddress = addresses.find((a) => a.isActive);
  const internalAddresses = addresses.filter((a) => !a.isActive);

  // URL params for pre-selecting coin and mode
  const coinIdParam = searchParams.get('coinId');
  const modeParam = searchParams.get('mode') as TransferMode | null;
  const validModes: TransferMode[] = ['external', 'internal', 'batch'];

  const [transferMode, setTransferMode] = useState<TransferMode>(() =>
    modeParam && validModes.includes(modeParam) ? modeParam : 'external'
  );

  // Sync mode state when URL changes (e.g., from FileTree navigation)
  useEffect(() => {
    const newMode = modeParam && validModes.includes(modeParam) ? modeParam : 'external';
    if (newMode !== transferMode) {
      setTransferMode(newMode);
    }
  }, [modeParam]);

  // Sync URL when mode changes
  const handleModeChange = (mode: TransferMode) => {
    setTransferMode(mode);
    if (mode === 'external') {
      searchParams.delete('mode');
    } else {
      searchParams.set('mode', mode);
    }
    setSearchParams(searchParams, { replace: true });
  };
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCoin, setSelectedCoin] = useState<string>(coinIdParam || '');
  const [selectedInternalAddress, setSelectedInternalAddress] = useState('');
  const [batchRecipients, setBatchRecipients] = useState<BatchRecipient[]>([
    { id: '1', address: '', amount: '' },
  ]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [recentAddresses, setRecentAddresses] = useState<SavedAddress[]>([]);
  const [addressToSave, setAddressToSave] = useState('');
  const [saveAlias, setSaveAlias] = useState('');
  const [coins, setCoins] = useState<TransferableCoin[]>([]);

  // Ticket needs the spendable balance of the *selected* coin object, not the
  // address total - a transfer draws from one coin, so the address balance
  // would let Max overshoot.
  const spendableSui = (() => {
    const coin = coins.find((c) => c.coinObjectId === selectedCoin);
    return coin ? parseFloat(coin.balanceSui) || 0 : 0;
  })();
  const overBalance = (parseFloat(amount) || 0) > spendableSui && spendableSui > 0;
  const [isLoadingCoins, setIsLoadingCoins] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [estimatedGas, setEstimatedGas] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [transferResult, setTransferResult] = useState<{
    success: boolean;
    digest?: string;
    error?: string;
    balanceBefore?: string;
    balanceAfter?: string;
    amountSent?: number;
  } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('sui-saved-addresses');
    const recent = localStorage.getItem('sui-recent-addresses');
    if (saved) {
      try {
        setSavedAddresses(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    if (recent) {
      try {
        setRecentAddresses(JSON.parse(recent));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    if (activeAddress) loadCoins();
  }, [activeAddress?.address]);

  // Pre-select coin from URL params
  useEffect(() => {
    if (coinIdParam && coins.length > 0) {
      const coinExists = coins.some((c) => c.coinObjectId === coinIdParam);
      if (coinExists) {
        setSelectedCoin(coinIdParam);
      }
    }
  }, [coinIdParam, coins]);

  const loadCoins = async () => {
    if (!activeAddress) return;
    setIsLoadingCoins(true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/transfers/sui/coins/${activeAddress.address}`
      );
      const data = await response.json();
      if (data.success && data.data) setCoins(data.data);
    } catch (error) {
      console.error('Failed to load coins:', error);
    } finally {
      setIsLoadingCoins(false);
    }
  };

  const saveAddress = () => {
    if (!addressToSave || !saveAlias) {
      showErrorToast({ message: 'Please enter both address and alias' });
      return;
    }
    const newAddress: SavedAddress = {
      address: addressToSave,
      alias: saveAlias,
      lastUsed: Date.now(),
    };
    const updated = [newAddress, ...savedAddresses.filter((a) => a.address !== addressToSave)];
    setSavedAddresses(updated);
    localStorage.setItem('sui-saved-addresses', JSON.stringify(updated));
    setAddressToSave('');
    setSaveAlias('');
    showSuccessToast({ message: `Saved ${saveAlias}` });
  };

  const addToRecent = (address: string) => {
    const updated = [
      { address, alias: 'Recent', lastUsed: Date.now() },
      ...recentAddresses.filter((a) => a.address !== address).slice(0, 4),
    ];
    setRecentAddresses(updated);
    localStorage.setItem('sui-recent-addresses', JSON.stringify(updated));
  };

  const removeSavedAddress = (address: string) => {
    const updated = savedAddresses.filter((a) => a.address !== address);
    setSavedAddresses(updated);
    localStorage.setItem('sui-saved-addresses', JSON.stringify(updated));
    showInfoToast({ message: 'Address removed' });
  };

  const addBatchRecipient = () => {
    setBatchRecipients([
      ...batchRecipients,
      { id: Date.now().toString(), address: '', amount: '' },
    ]);
  };

  const removeBatchRecipient = (id: string) => {
    if (batchRecipients.length === 1) {
      showErrorToast({ message: 'At least one recipient required' });
      return;
    }
    setBatchRecipients(batchRecipients.filter((r) => r.id !== id));
  };

  const updateBatchRecipient = (id: string, field: 'address' | 'amount', value: string) => {
    setBatchRecipients(batchRecipients.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const estimateGas = async () => {
    setIsEstimating(true);
    setEstimatedGas('');
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (transferMode === 'batch') {
        const gasPerTx = 0.001;
        setEstimatedGas((gasPerTx * batchRecipients.length).toFixed(6));
      } else {
        setEstimatedGas('0.001');
      }
      setShowPreview(true);
    } catch (error) {
      showErrorToast({ message: 'Failed to estimate gas' });
    } finally {
      setIsEstimating(false);
    }
  };

  const handleTransfer = async () => {
    if (!activeAddress) {
      showErrorToast({ message: 'No active address' });
      return;
    }
    const finalToAddress = transferMode === 'internal' ? selectedInternalAddress : toAddress;
    if (!finalToAddress || !amount || !selectedCoin) {
      showErrorToast({ message: 'Please fill all fields' });
      return;
    }
    const balanceBefore = activeAddress.balance;
    setIsTransferring(true);
    setTransferResult(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/transfers/sui`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: finalToAddress, amount, coinId: selectedCoin }),
      });
      const data = await response.json();
      if (data.success) {
        await fetchAddresses();
        const updatedAddress = addresses.find((a) => a.address === activeAddress.address);
        setTransferResult({
          success: true,
          digest: data.data.digest,
          balanceBefore,
          balanceAfter: updatedAddress?.balance || balanceBefore,
          amountSent: parseFloat(amount),
        });
        showSuccessToast({ message: 'Transfer successful!' });
        trackEvent(ClarityEvents.TRANSFER_COMPLETED);
        if (transferMode === 'external') addToRecent(finalToAddress);
        setToAddress('');
        setSelectedInternalAddress('');
        setAmount('');
        setSelectedCoin('');
        setShowPreview(false);
        await loadCoins();
      } else {
        setTransferResult({ success: false, error: data.error || 'Transfer failed' });
        showErrorToast({ message: data.error || 'Transfer failed' });
        trackEvent(ClarityEvents.TRANSFER_FAILED);
      }
    } catch (error: any) {
      const msg = error.message || String(error);
      setTransferResult({ success: false, error: msg });
      showErrorToast({ message: 'Connection error: ' + msg });
      trackEvent(ClarityEvents.TRANSFER_FAILED);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleBatchTransfer = async () => {
    showInfoToast({ message: 'Batch transfer coming soon!' });
  };

  const getTotalAmount = () => {
    if (transferMode === 'batch') {
      return batchRecipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    }
    return parseFloat(amount) || 0;
  };

  const getTotalWithGas = () => getTotalAmount() + (parseFloat(estimatedGas) || 0);

  const isAnyLoading = isLoadingCoins || isEstimating || isTransferring;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const destination = transferMode === 'internal' ? selectedInternalAddress : toAddress;
  const totalAmount = getTotalAmount();

  const aiJson = JSON.stringify(
    {
      transferMode,
      from: activeAddress?.address ?? null,
      toAddress: transferMode === 'batch' ? undefined : destination || null,
      amount: transferMode === 'batch' ? undefined : amount || null,
      selectedCoin: selectedCoin || null,
      batchRecipients:
        transferMode === 'batch'
          ? batchRecipients.map((r) => ({ address: r.address, amount: r.amount }))
          : undefined,
      totalAmount,
      estimatedGas: estimatedGas || null,
      transferResult,
    },
    null,
    2
  );

  const aiMarkdown = [
    '# Sui transfer',
    '',
    `- **Mode:** ${transferMode}`,
    `- **From:** ${activeAddress?.address ?? 'no active wallet'}`,
    transferMode === 'batch'
      ? `- **Recipients:** ${batchRecipients.length}`
      : `- **To:** ${destination || '(not set)'}`,
    transferMode === 'batch'
      ? `- **Total amount:** ${totalAmount} SUI`
      : `- **Amount:** ${amount || '0'} SUI`,
    `- **Selected coin:** ${selectedCoin || '(none)'}`,
    estimatedGas ? `- **Estimated gas:** ${estimatedGas} SUI` : null,
    transferMode === 'batch'
      ? [
          '',
          '## Recipients',
          '| # | Address | Amount (SUI) |',
          '|---|---|---|',
          ...batchRecipients.map(
            (r, i) => `| ${i + 1} | ${r.address || '(empty)'} | ${r.amount || '0'} |`
          ),
        ].join('\n')
      : null,
    transferResult
      ? `\n## Result\n${transferResult.success ? `Success — digest \`${transferResult.digest}\`` : `Failed — ${transferResult.error}`}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const aiPrompt = buildAiContext({
    title: 'Sui transfer',
    intro: [
      'A transfer being composed in sui-cli-web. Nothing has been signed or',
      'submitted.',
    ],
    stateJson: aiJson,
    endpoints: [
      {
        method: 'GET',
        path: '/transfers/sui/coins/:address',
        effect: "the address's spendable coin objects",
      },
      {
        method: 'POST',
        path: '/transfers/sui/dry-run',
        body: '{ to, amount, coinId?, gasBudget? }',
        effect: 'simulate; returns estimatedGas',
      },
      {
        method: 'POST',
        path: '/transfers/sui',
        body: '{ to, amount, coinId?, gasBudget? }',
        effect: 'signs and submits the transfer',
        mutating: true,
      },
      {
        method: 'POST',
        path: '/pay/sui',
        body: '{ recipients: [], amounts: [], inputCoins?, gasBudget?, dryRun? }',
        effect: 'signs and submits a multi-recipient pay',
        mutating: true,
      },
    ],
    rules: [
      "A transfer draws from a SINGLE coin object; `amount` must be <= that object's balance, not the address total",
      'Gas is paid separately in SUI and needs its own coin with enough balance',
      'Addresses are 0x-prefixed and 66 characters; they are NOT checksummed, so a typo is a valid-looking address and the funds are unrecoverable',
      'Amounts in this UI are SUI; the RPC takes MIST (1 SUI = 1e9 MIST)',
      'Use `splitCoin` / `mergeCoins` first if no single coin covers the amount',
    ],
    examples: [
      'review this before I sign',
      'work out the coin splits',
      'run the dry-run and report the gas',
      'turn it into a CLI command',
    ],
  });

  return (
    <div className="p-4 sm:p-6">
      <div
        className={cn(
          'mx-auto space-y-4',
          transferMode === 'batch' ? 'max-w-[1600px]' : 'max-w-xl'
        )}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-[#4da2ff]" />
            <h1 className="text-lg font-semibold text-foreground">Transfer SUI</h1>
          </div>
          <CopyForAiMenu
            prompt={aiPrompt}
            json={aiJson}
            markdown={aiMarkdown}
            onCopy={copyToClipboard}
          />
        </motion.div>

        {/* Mode Selector */}
        <div className="space-y-1.5">
          <Tabs
            value={transferMode}
            onValueChange={(v) => handleModeChange(v as TransferMode)}
            variant="pill"
          >
            <TabsList fullWidth indicatorClassName="bg-[#4da2ff]">
              <TabsTrigger value="external" icon={<Send />} className="flex-1">
                External
              </TabsTrigger>
              <TabsTrigger value="internal" icon={<Repeat />} className="flex-1">
                Internal
              </TabsTrigger>
              <TabsTrigger value="batch" icon={<Users />} className="flex-1">
                Batch
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="px-1 text-xs text-muted-foreground">
            {transferMode === 'external' && 'Send to any Sui address'}
            {transferMode === 'internal' && 'Move funds between your own wallets'}
            {transferMode === 'batch' && 'Send to multiple recipients at once'}
          </p>
        </div>

        <div
          className={cn(
            'gap-4',
            transferMode === 'batch'
              ? 'grid grid-cols-1 lg:grid-cols-3'
              : 'flex flex-col'
          )}
        >
          {/* Address Book */}
          <div className={cn('space-y-3', transferMode === 'batch' ? 'lg:col-span-1' : 'order-2')}>
            {/* Saved Addresses */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Star className="w-4 h-4 text-yellow-500" />
                Saved
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {savedAddresses.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No saved addresses
                  </p>
                ) : (
                  savedAddresses.map((addr) => (
                    <div
                      key={addr.address}
                      className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 hover:bg-accent border border-transparent hover:border-border cursor-pointer group transition-all"
                      onClick={() => {
                        if (transferMode === 'external') {
                          setToAddress(addr.address);
                          showInfoToast({ message: `Using ${addr.alias}` });
                        }
                      }}
                    >
                      <Wallet className="w-3.5 h-3.5 text-[#4da2ff] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground">{addr.alias}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {addr.address.slice(0, 8)}...{addr.address.slice(-6)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSavedAddress(addr.address);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded-md transition-all"
                      >
                        <X className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="pt-3 border-t border-border space-y-2">
                <input
                  type="text"
                  value={addressToSave}
                  onChange={(e) => setAddressToSave(e.target.value)}
                  placeholder="0x... address"
                  className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-md text-foreground placeholder:text-tertiary focus:outline-none focus:border-[#4da2ff]/50 font-mono text-xs"
                />
                <input
                  type="text"
                  value={saveAlias}
                  onChange={(e) => setSaveAlias(e.target.value)}
                  placeholder="Alias (e.g., Alice)"
                  className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-md text-foreground placeholder:text-tertiary focus:outline-none focus:border-[#4da2ff]/50 text-xs"
                />
                <Button variant="secondary" size="sm" onClick={saveAddress} className="w-full">
                  Save address
                </Button>
              </div>
            </div>

            {/* Recent */}
            {recentAddresses.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Clock className="w-4 h-4" />
                  Recent
                </div>
                <div className="space-y-1">
                  {recentAddresses.map((addr, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 hover:bg-accent border border-transparent hover:border-border cursor-pointer transition-all"
                      onClick={() => {
                        if (transferMode === 'external') {
                          setToAddress(addr.address);
                          showInfoToast({ message: 'Address loaded' });
                        }
                      }}
                    >
                      <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <div className="text-xs text-foreground font-mono truncate">
                        {addr.address.slice(0, 8)}...{addr.address.slice(-6)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Transfer Form */}
          <div className={cn('space-y-3', transferMode === 'batch' ? 'lg:col-span-2' : 'order-1')}>
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card border border-border rounded-lg p-5 space-y-4"
            >
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#4da2ff]/10">
                  {transferMode === 'external' && <Send className="w-5 h-5 text-[#4da2ff]" />}
                  {transferMode === 'internal' && <Repeat className="w-5 h-5 text-[#4da2ff]" />}
                  {transferMode === 'batch' && <Users className="w-5 h-5 text-[#4da2ff]" />}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {transferMode === 'external' && 'External Transfer'}
                    {transferMode === 'internal' && 'Internal Transfer'}
                    {transferMode === 'batch' && 'Batch Transfer'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {transferMode === 'external' && 'Send to any Sui address'}
                    {transferMode === 'internal' && 'Between your wallets'}
                    {transferMode === 'batch' && 'Multiple recipients'}
                  </p>
                </div>
              </div>

              {/* From */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">From</label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
                  <Wallet className="w-4 h-4 text-[#4da2ff]" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                      {activeAddress?.alias || 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {activeAddress?.address.slice(0, 10)}...{activeAddress?.address.slice(-6)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold tabular-nums text-foreground">
                      {activeAddress?.balance || '0'} <span className="text-xs font-normal text-muted-foreground">SUI</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* To - External */}
              {transferMode === 'external' && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    To address <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={toAddress}
                    onChange={(e) => setToAddress(e.target.value)}
                    placeholder="0x... recipient address"
                    className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:border-[#4da2ff]/50 font-mono text-sm"
                  />
                </div>
              )}

              {/* To - Internal */}
              {transferMode === 'internal' && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    To wallet <span className="text-destructive">*</span>
                  </label>
                  {internalAddresses.length === 0 ? (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-yellow-400">No other wallets</p>
                          <p className="text-xs text-yellow-500/70">Create more addresses first</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={selectedInternalAddress}
                      onChange={(e) => setSelectedInternalAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-[#4da2ff]/50 text-xs"
                    >
                      <option value="">Select wallet...</option>
                      {internalAddresses.map((addr) => (
                        <option key={addr.address} value={addr.address}>
                          {addr.alias} - {addr.address.slice(0, 8)}... ({addr.balance} SUI)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Batch Recipients */}
              {transferMode === 'batch' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">Recipients</label>
                    <button
                      onClick={addBatchRecipient}
                      className="px-2 py-1 text-xs bg-[#4da2ff]/10 text-[#4da2ff] rounded-md hover:bg-[#4da2ff]/20 transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {batchRecipients.map((recipient, idx) => (
                      <div
                        key={recipient.id}
                        className="flex gap-2 p-2 rounded-lg bg-secondary/50 border border-border"
                      >
                        <div className="flex-shrink-0 w-6 h-6 rounded-md bg-[#4da2ff]/10 flex items-center justify-center text-xs text-[#4da2ff]">
                          {idx + 1}
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <input
                            type="text"
                            value={recipient.address}
                            onChange={(e) =>
                              updateBatchRecipient(recipient.id, 'address', e.target.value)
                            }
                            placeholder="0x... address"
                            className="w-full px-2 py-1 bg-card border border-border rounded-md text-foreground placeholder:text-tertiary font-mono text-xs"
                          />
                          <input
                            type="text"
                            value={recipient.amount}
                            onChange={(e) =>
                              updateBatchRecipient(recipient.id, 'amount', e.target.value)
                            }
                            placeholder="Amount (SUI)"
                            className="w-full px-2 py-1 bg-card border border-border rounded-md text-foreground placeholder:text-tertiary text-xs"
                          />
                        </div>
                        <button
                          onClick={() => removeBatchRecipient(recipient.id)}
                          className="flex-shrink-0 w-6 h-6 rounded-md hover:bg-destructive/20 flex items-center justify-center transition-colors"
                          disabled={batchRecipients.length === 1}
                        >
                          <X className="w-3 h-3 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount - trade-ticket style: the number is the subject of this
                  screen, so it leads at display size with the spendable balance
                  and quick-add chips attached to it. */}
              {transferMode !== 'batch' && (
                <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="transfer-amount" className="text-xs text-muted-foreground">
                      Amount <span className="text-destructive">*</span>
                    </label>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">
                        Balance{' '}
                        <span className="font-mono text-foreground">
                          {spendableSui.toFixed(4)}
                        </span>{' '}
                        SUI
                      </span>
                      <button
                        type="button"
                        onClick={() => setAmount(String(spendableSui))}
                        disabled={spendableSui <= 0}
                        className="rounded-md px-1.5 py-0.5 font-medium text-[#4da2ff] transition-colors hover:bg-[#4da2ff]/10 disabled:opacity-40"
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <input
                      id="transfer-amount"
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="min-w-0 flex-1 bg-transparent text-4xl font-semibold tabular-nums text-foreground placeholder:text-tertiary focus:outline-none"
                    />
                    <span className="text-sm font-medium text-muted-foreground">SUI</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[0.1, 0.5, 1, 5].map((val) => (
                      <button
                        key={val}
                        type="button"
                        // Additive, not "set to": topping up a ticket is the
                        // common gesture, and a plain set discards what's typed.
                        onClick={() =>
                          setAmount(String(Number(((parseFloat(amount) || 0) + val).toFixed(9))))
                        }
                        className="rounded-md bg-[#4da2ff]/10 px-2 py-1 text-xs text-[#4da2ff] transition-colors hover:bg-[#4da2ff]/20"
                      >
                        +{val}
                      </button>
                    ))}
                    {amount && (
                      <button
                        type="button"
                        onClick={() => setAmount('')}
                        className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {overBalance && (
                    <p className="text-xs text-destructive">
                      Exceeds the selected coin's balance.
                    </p>
                  )}
                </div>
              )}

              {/* Coin Selection */}
              {transferMode !== 'batch' && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Select coin</label>
                  {isLoadingCoins ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="w-4 h-4 text-[#4da2ff] animate-spin" />
                    </div>
                  ) : (
                    <select
                      value={selectedCoin}
                      onChange={(e) => setSelectedCoin(e.target.value)}
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:border-[#4da2ff]/50 text-xs"
                    >
                      <option value="">Choose coin...</option>
                      {coins.map((coin) => (
                        <option key={coin.coinObjectId} value={coin.coinObjectId}>
                          {coin.balanceSui} SUI - {coin.coinObjectId.slice(0, 8)}...
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={estimateGas}
                  disabled={isAnyLoading}
                  className="flex-1"
                >
                  {isEstimating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Estimating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Preview
                    </>
                  )}
                </Button>
                {showPreview && (
                  <Button
                    onClick={transferMode === 'batch' ? handleBatchTransfer : handleTransfer}
                    disabled={isTransferring}
                    className="flex-1"
                  >
                    {isTransferring ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        Send
                      </>
                    )}
                  </Button>
                )}
              </div>
            </motion.div>

            {/* Preview */}
            {showPreview && estimatedGas && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-[#4da2ff]/30 rounded-lg p-4 space-y-3"
              >
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#4da2ff]" />
                  Transaction preview
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount</span>
                    <span className="text-foreground">{getTotalAmount().toFixed(6)} SUI</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Gas</span>
                    <span className="text-foreground">{estimatedGas} SUI</span>
                  </div>
                  {transferMode === 'batch' && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Recipients</span>
                      <span className="text-foreground">{batchRecipients.length}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-foreground font-semibold">Total</span>
                    <span className="text-foreground font-semibold">
                      {getTotalWithGas().toFixed(6)} SUI
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Result */}
            <AnimatePresence>
              {transferResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bg-card border rounded-lg overflow-hidden ${
                    transferResult.success ? 'border-green-500/40' : 'border-red-500/40'
                  }`}
                >
                  <div
                    className={`px-4 py-3 ${transferResult.success ? 'bg-green-500/10 border-b border-green-500/30' : 'bg-red-500/10 border-b border-red-500/30'}`}
                  >
                    <div className="flex items-center gap-2">
                      {transferResult.success ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                          <span className="text-sm font-semibold text-green-400">Success</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-red-400" />
                          <span className="text-sm font-semibold text-red-400">Failed</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    {transferResult.success && transferResult.digest && (
                      <>
                        {/* Balance Change */}
                        {transferResult.balanceBefore && transferResult.balanceAfter && (
                          <div className="bg-secondary/50 border border-border rounded-lg p-3">
                            <div className="text-xs text-muted-foreground mb-2">Balance change</div>
                            <div className="grid grid-cols-3 gap-2 items-center text-center">
                              <div>
                                <div className="text-lg font-semibold text-foreground">
                                  {transferResult.balanceBefore}
                                </div>
                                <div className="text-xs text-muted-foreground">Before</div>
                              </div>
                              <div className="flex flex-col items-center">
                                <ArrowRight className="w-4 h-4 text-[#4da2ff]" />
                                {transferResult.amountSent && (
                                  <span className="text-xs text-muted-foreground mt-1">
                                    -{transferResult.amountSent}
                                  </span>
                                )}
                              </div>
                              <div>
                                <div className="text-lg font-semibold text-green-400">
                                  {transferResult.balanceAfter}
                                </div>
                                <div className="text-xs text-muted-foreground">After</div>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Digest */}
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Transaction digest</div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-2 py-1.5 bg-secondary border border-border rounded-md text-xs font-mono text-foreground truncate">
                              {transferResult.digest}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(transferResult.digest || '');
                                showSuccessToast({ message: 'Copied!' });
                              }}
                              className="p-1.5 hover:bg-accent rounded-md transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                        {/* Explorer Link */}
                        <a
                          href={`https://testnet.suivision.xyz/txblock/${transferResult.digest}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#4da2ff]/10 border border-[#4da2ff]/30 text-[#4da2ff] rounded-full hover:bg-[#4da2ff]/20 transition-all text-xs font-medium"
                        >
                          View on Explorer
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                    {!transferResult.success && transferResult.error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-xs text-red-400">{transferResult.error}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
