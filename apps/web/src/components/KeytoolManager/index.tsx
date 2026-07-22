import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Spinner } from '../shared/Spinner';
import {
  listKeys,
  generateKey,
  signMessage,
  createMultiSigAddress,
  decodeTransactionKeytool,
  generateSampleTx,
  getBalance,
  combineMultiSigSignatures,
  buildTransferTransaction,
  executeSignedTransaction,
  SampleTxType,
} from '@/api/client';

type Tab = 'keys' | 'generate' | 'sign' | 'multisig' | 'execute' | 'decode';

// Matches the API response from `sui keytool list --json`
interface KeyInfo {
  alias?: string;
  suiAddress: string;
  publicBase64Key: string;
  keyScheme: string;
  flag?: number;
  peerId?: string;
}

interface GeneratedKey {
  address: string;
  publicKey: string;
  keyScheme: string;
  mnemonic?: string;
}

interface MultiSigField {
  publicKey: string;
  weight: number;
  selectedKeyIndex: number | null;
}

interface MultiSigHistoryItem {
  address: string;
  threshold: number;
  totalSigners: number;
  createdAt: string;
  label?: string;
  publicKeys?: string[];
  weights?: number[];
}

const MULTISIG_HISTORY_KEY = 'sui-cli-web:multisig-history';

// Threshold presets for multi-sig
const MULTISIG_PRESETS = [
  { label: '1-of-2', required: 1, total: 2 },
  { label: '2-of-2', required: 2, total: 2 },
  { label: '2-of-3', required: 2, total: 3 },
  { label: '3-of-5', required: 3, total: 5 },
];

// Multi-sig signing flow - simplified for clean UI
const MULTISIG_FLOW_STEPS = [
  { step: 1, title: 'Create', hint: 'Create multi-sig address from public keys' },
  { step: 2, title: 'Fund', hint: 'Send SUI to the multi-sig address' },
  { step: 3, title: 'Build TX', hint: 'Create unsigned transaction bytes' },
  { step: 4, title: 'Sign', hint: 'Each signer signs the same TX bytes' },
  { step: 5, title: 'Combine', hint: 'Merge partial signatures' },
  { step: 6, title: 'Execute', hint: 'Submit transaction to blockchain' },
];

// Multi-sig use case templates
const MULTISIG_USE_CASES = [
  {
    id: 'personal',
    label: '🔐 Personal Backup',
    description: '2-of-3: Main key + 2 backup keys',
    threshold: 2,
    signers: 3,
    tip: 'Store backup keys in separate secure locations',
  },
  {
    id: 'team',
    label: '👥 Team Treasury',
    description: '2-of-3: Requires 2 team members',
    threshold: 2,
    signers: 3,
    tip: 'Common for DAOs and project treasuries',
  },
  {
    id: 'enterprise',
    label: '🏢 Enterprise',
    description: '3-of-5: High security with redundancy',
    threshold: 3,
    signers: 5,
    tip: 'Recommended for large value holdings',
  },
];

// Sample transaction types for Sign tab
const SAMPLE_TX_TYPES: { type: SampleTxType; label: string; icon: string; description: string }[] = [
  {
    type: 'self-transfer',
    label: 'Self Transfer',
    icon: '🔄',
    description: 'Transfer 1 MIST to yourself (safest test)',
  },
  {
    type: 'split-coin',
    label: 'Split Coin',
    icon: '✂️',
    description: 'Split a coin into smaller amounts',
  },
  {
    type: 'merge-coins',
    label: 'Merge Coins',
    icon: '🔗',
    description: 'Combine multiple coins (requires 2+ coins)',
  },
];

export function KeytoolManager() {
  // URL params for tab switching
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const validTabs: Tab[] = ['keys', 'generate', 'sign', 'multisig', 'execute', 'decode'];
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    tabParam && validTabs.includes(tabParam) ? tabParam : 'keys'
  );

  // Sync tab state when URL changes (e.g., from FileTree navigation)
  useEffect(() => {
    const newTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'keys';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [tabParam]);

  // Sync URL when tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'keys') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    setSearchParams(searchParams, { replace: true });
  };

  // Keys state - shared across tabs
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysLoaded, setKeysLoaded] = useState(false);

  // Generate tab state
  const [keyScheme, setKeyScheme] = useState<'ed25519' | 'secp256k1' | 'secp256r1'>('ed25519');
  const [wordLength, setWordLength] = useState<number>(12);
  const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null);
  const [mnemonicAcknowledged, setMnemonicAcknowledged] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Sign tab state
  const [signAddress, setSignAddress] = useState('');
  const [selectedSignKeyIndex, setSelectedSignKeyIndex] = useState<number | null>(null);
  const [signData, setSignData] = useState('');
  const [signature, setSignature] = useState('');
  const [signing, setSigning] = useState(false);
  const [useManualSignAddress, setUseManualSignAddress] = useState(false);
  const [generatingSample, setGeneratingSample] = useState(false);
  const [sampleDescription, setSampleDescription] = useState('');
  const [selectedSampleType, setSelectedSampleType] = useState<SampleTxType>('self-transfer');

  // MultiSig tab state
  const [multiSigFields, setMultiSigFields] = useState<MultiSigField[]>([
    { publicKey: '', weight: 1, selectedKeyIndex: null },
    { publicKey: '', weight: 1, selectedKeyIndex: null },
  ]);
  const [threshold, setThreshold] = useState(1);
  const [multiSigAddress, setMultiSigAddress] = useState('');
  const [creatingMultiSig, setCreatingMultiSig] = useState(false);
  const [multiSigHistory, setMultiSigHistory] = useState<MultiSigHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyBalances, setHistoryBalances] = useState<Record<string, string>>({});
  const [loadingBalances, setLoadingBalances] = useState<Record<string, boolean>>({});

  // Decode tab state
  const [txBytes, setTxBytes] = useState('');
  const [decodeSignature, setDecodeSignature] = useState('');
  const [decodedResult, setDecodedResult] = useState<any>(null);
  const [decoding, setDecoding] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // Execute tab state - Transaction Builder & Executor
  const [executeStep, setExecuteStep] = useState<'build' | 'collect' | 'execute'>('build');
  // Build step
  const [buildFromAddress, setBuildFromAddress] = useState('');
  const [buildToAddress, setBuildToAddress] = useState('');
  const [buildAmount, setBuildAmount] = useState('');
  const [buildGasBudget, setBuildGasBudget] = useState('10000000');
  const [builtTxBytes, setBuiltTxBytes] = useState('');
  const [buildDescription, setBuildDescription] = useState('');
  const [building, setBuilding] = useState(false);
  // Collect step - Signature collector
  const [collectedSignatures, setCollectedSignatures] = useState<Array<{ signature: string; publicKey: string; label?: string }>>([]);
  const [newSignatureInput, setNewSignatureInput] = useState('');
  const [newSignaturePubKey, setNewSignaturePubKey] = useState('');
  const [newSignatureLabel, setNewSignatureLabel] = useState('');
  // Execute step
  const [combinePublicKeys, setCombinePublicKeys] = useState<string[]>([]);
  const [combineWeights, setCombineWeights] = useState<number[]>([]);
  const [combineThreshold, setCombineThreshold] = useState(2);
  const [combinedSignature, setCombinedSignature] = useState('');
  const [combining, setCombining] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{ digest: string; status: string; gasUsed: string } | null>(null);

  // Pending transactions storage
  const PENDING_TX_KEY = 'sui-cli-web:pending-multisig-tx';
  interface PendingTransaction {
    id: string;
    txBytes: string;
    description: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    createdAt: string;
    signatures: Array<{ signature: string; publicKey: string; label?: string }>;
    publicKeys: string[];
    weights: number[];
    threshold: number;
  }
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [selectedPendingTx, setSelectedPendingTx] = useState<string | null>(null);

  // Load keys once and share across tabs
  // Use refs to track state and prevent infinite loops/concurrent requests
  const loadingRef = useRef(false);
  const loadedRef = useRef(false);

  const loadKeys = useCallback(async (force = false) => {
    // Prevent concurrent requests using ref (more reliable than state)
    if (loadingRef.current) return;
    // Skip if already loaded and not forced (use ref to avoid dependency)
    if (loadedRef.current && !force) return;

    loadingRef.current = true;
    setKeysLoading(true);
    try {
      const result = await listKeys();
      const loadedKeys = Array.isArray(result) ? result : [];
      setKeys(loadedKeys);
      setKeysLoaded(true);
      loadedRef.current = true;
    } catch (error) {
      toast.error(String(error));
      setKeys([]);
    } finally {
      setKeysLoading(false);
      loadingRef.current = false;
    }
  }, []); // Empty deps - stable function reference

  // Load keys once on mount only
  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  // Load multi-sig history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MULTISIG_HISTORY_KEY);
      if (saved) {
        setMultiSigHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load multi-sig history:', e);
    }
  }, []);

  // Fetch balance for a specific address
  const fetchBalanceForAddress = useCallback(async (address: string) => {
    if (loadingBalances[address]) return;

    setLoadingBalances(prev => ({ ...prev, [address]: true }));
    try {
      const result = await getBalance(address);
      // API already returns balance in SUI (not MIST), just use it directly
      setHistoryBalances(prev => ({ ...prev, [address]: result.balance }));
    } catch {
      setHistoryBalances(prev => ({ ...prev, [address]: '0' }));
    } finally {
      setLoadingBalances(prev => ({ ...prev, [address]: false }));
    }
  }, [loadingBalances]);

  // Fetch balances when history is expanded
  useEffect(() => {
    if (showHistory && multiSigHistory.length > 0) {
      // Fetch balance for each address that we haven't loaded yet
      multiSigHistory.forEach(item => {
        if (historyBalances[item.address] === undefined && !loadingBalances[item.address]) {
          fetchBalanceForAddress(item.address);
        }
      });
    }
  }, [showHistory, multiSigHistory, historyBalances, loadingBalances, fetchBalanceForAddress]);

  // Save multi-sig to history
  const saveToMultiSigHistory = useCallback((
    address: string,
    threshold: number,
    totalSigners: number,
    publicKeys?: string[],
    weights?: number[]
  ) => {
    const newItem: MultiSigHistoryItem = {
      address,
      threshold,
      totalSigners,
      createdAt: new Date().toISOString(),
      publicKeys,
      weights,
    };
    setMultiSigHistory(prev => {
      // Don't add duplicates
      if (prev.some(item => item.address === address)) {
        return prev;
      }
      const updated = [newItem, ...prev].slice(0, 10); // Keep last 10
      try {
        localStorage.setItem(MULTISIG_HISTORY_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save multi-sig history:', e);
      }
      return updated;
    });
  }, []);

  // Remove from history
  const removeFromHistory = useCallback((address: string) => {
    setMultiSigHistory(prev => {
      const updated = prev.filter(item => item.address !== address);
      try {
        localStorage.setItem(MULTISIG_HISTORY_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save multi-sig history:', e);
      }
      return updated;
    });
    toast.success('Removed from history');
  }, []);

  // Handle key selection for Sign tab
  const handleSignKeySelect = (index: number) => {
    setSelectedSignKeyIndex(index);
    setSignAddress(keys[index].suiAddress);
    setUseManualSignAddress(false);
  };

  // Handle key selection for Multi-Sig tab
  const handleMultiSigKeySelect = (fieldIndex: number, keyIndex: number) => {
    const updated = [...multiSigFields];
    updated[fieldIndex] = {
      ...updated[fieldIndex],
      selectedKeyIndex: keyIndex,
      publicKey: keys[keyIndex].publicBase64Key,
    };
    setMultiSigFields(updated);
  };

  // Quick-fill multi-sig with first N keys
  const quickFillMultiSig = (count: number) => {
    const availableKeys = keys.slice(0, count);
    const fields: MultiSigField[] = availableKeys.map((key, index) => ({
      publicKey: key.publicBase64Key,
      weight: 1,
      selectedKeyIndex: index,
    }));
    while (fields.length < 2) {
      fields.push({ publicKey: '', weight: 1, selectedKeyIndex: null });
    }
    setMultiSigFields(fields);
    setThreshold(Math.min(count, availableKeys.length));
  };

  // Apply threshold preset
  const applyThresholdPreset = (preset: typeof MULTISIG_PRESETS[0]) => {
    const newFields = [...multiSigFields];
    while (newFields.length < preset.total) {
      newFields.push({ publicKey: '', weight: 1, selectedKeyIndex: null });
    }
    while (newFields.length > preset.total && newFields.length > 2) {
      newFields.pop();
    }
    setMultiSigFields(newFields.slice(0, Math.max(preset.total, 2)));
    setThreshold(preset.required);
  };

  // Truncate address for display
  const truncateAddress = (addr: string, chars = 6) => {
    if (!addr) return '';
    return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
  };

  const handleGenerateKey = async () => {
    setGenerating(true);
    try {
      const result = await generateKey(keyScheme, wordLength);
      setGeneratedKey(result);
      setMnemonicAcknowledged(false);
      toast.success('Key generated successfully');
      setKeysLoaded(false);
    } catch (error) {
      toast.error(String(error));
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyMnemonic = () => {
    if (generatedKey?.mnemonic) {
      navigator.clipboard.writeText(generatedKey.mnemonic);
      toast.success('Mnemonic copied to clipboard');
    }
  };

  const handleAcknowledgeMnemonic = () => {
    setMnemonicAcknowledged(true);
    toast.success('Mnemonic hidden for security');
  };

  const handleSignMessage = async () => {
    if (!signAddress.trim() || !signData.trim()) {
      toast.error('Address and data are required');
      return;
    }

    setSigning(true);
    try {
      const result = await signMessage(signAddress, signData);
      setSignature(result.signature);
      toast.success('Transaction signed successfully');
    } catch (error) {
      toast.error(String(error));
    } finally {
      setSigning(false);
    }
  };

  const handleGenerateSampleTx = async (txType: SampleTxType = selectedSampleType) => {
    if (!signAddress.trim()) {
      toast.error('Please select a signer first');
      return;
    }

    setGeneratingSample(true);
    setSampleDescription('');
    try {
      const result = await generateSampleTx(signAddress, txType);
      setSignData(result.txBytes);
      setSampleDescription(result.description);
      toast.success('Sample transaction generated');
    } catch (error) {
      toast.error(String(error));
    } finally {
      setGeneratingSample(false);
    }
  };

  const handleCreateMultiSig = async () => {
    const validFields = multiSigFields.filter(f => f.publicKey.trim());
    if (validFields.length < 2) {
      toast.error('At least 2 public keys are required');
      return;
    }

    if (threshold < 1 || threshold > validFields.length) {
      toast.error(`Threshold must be between 1 and ${validFields.length}`);
      return;
    }

    setCreatingMultiSig(true);
    try {
      const result = await createMultiSigAddress(
        validFields.map(f => f.publicKey),
        validFields.map(f => f.weight),
        threshold
      );
      setMultiSigAddress(result.address);
      // Save to history with publicKeys and weights
      saveToMultiSigHistory(
        result.address,
        threshold,
        validFields.length,
        validFields.map(f => f.publicKey),
        validFields.map(f => f.weight)
      );
      toast.success('Multi-sig address created');
    } catch (error) {
      toast.error(String(error));
    } finally {
      setCreatingMultiSig(false);
    }
  };

  const handleDecodeTransaction = async () => {
    if (!txBytes.trim()) {
      toast.error('Transaction bytes are required');
      return;
    }

    setDecoding(true);
    try {
      const result = await decodeTransactionKeytool(txBytes, decodeSignature || undefined);
      setDecodedResult(result);
      toast.success('Transaction decoded successfully');
    } catch (error) {
      toast.error(String(error));
    } finally {
      setDecoding(false);
    }
  };

  // Load pending transactions from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PENDING_TX_KEY);
      if (saved) {
        setPendingTransactions(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load pending transactions:', e);
    }
  }, []);

  // Save pending transaction
  const savePendingTransaction = useCallback((tx: PendingTransaction) => {
    setPendingTransactions(prev => {
      const updated = [tx, ...prev.filter(t => t.id !== tx.id)].slice(0, 20);
      try {
        localStorage.setItem(PENDING_TX_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save pending transaction:', e);
      }
      return updated;
    });
  }, []);

  // Remove pending transaction
  const removePendingTransaction = useCallback((id: string) => {
    setPendingTransactions(prev => {
      const updated = prev.filter(t => t.id !== id);
      try {
        localStorage.setItem(PENDING_TX_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save pending transactions:', e);
      }
      return updated;
    });
    if (selectedPendingTx === id) {
      setSelectedPendingTx(null);
    }
    toast.success('Transaction removed');
  }, [selectedPendingTx]);

  // Build transfer transaction
  const handleBuildTransfer = async () => {
    if (!buildFromAddress.trim() || !buildToAddress.trim() || !buildAmount.trim()) {
      toast.error('From address, to address, and amount are required');
      return;
    }

    setBuilding(true);
    try {
      const result = await buildTransferTransaction(
        buildFromAddress,
        buildToAddress,
        buildAmount,
        undefined,
        buildGasBudget
      );
      setBuiltTxBytes(result.txBytes);
      setBuildDescription(result.description);

      // Check if from address is from multi-sig history
      const historyItem = multiSigHistory.find(h => h.address === buildFromAddress);

      // Get publicKeys, weights, threshold from history or current form
      let txPublicKeys: string[] = [];
      let txWeights: number[] = [];
      let txThreshold = threshold;

      if (historyItem && historyItem.publicKeys && historyItem.weights) {
        // Use data from history
        txPublicKeys = historyItem.publicKeys;
        txWeights = historyItem.weights;
        txThreshold = historyItem.threshold;
      } else {
        // Fallback to current form
        txPublicKeys = multiSigFields.filter(f => f.publicKey.trim()).map(f => f.publicKey);
        txWeights = multiSigFields.filter(f => f.publicKey.trim()).map(f => f.weight);
      }

      // Auto-create pending transaction
      const newTx: PendingTransaction = {
        id: `tx-${Date.now()}`,
        txBytes: result.txBytes,
        description: result.description,
        fromAddress: buildFromAddress,
        toAddress: buildToAddress,
        amount: buildAmount,
        createdAt: new Date().toISOString(),
        signatures: [],
        publicKeys: txPublicKeys,
        weights: txWeights,
        threshold: txThreshold,
      };
      savePendingTransaction(newTx);
      setSelectedPendingTx(newTx.id);
      setCombinePublicKeys(newTx.publicKeys);
      setCombineWeights(newTx.weights);
      setCombineThreshold(newTx.threshold);

      toast.success('Transaction built! Share the TX bytes with signers.');
      setExecuteStep('collect');
    } catch (error) {
      toast.error(String(error));
    } finally {
      setBuilding(false);
    }
  };

  // Add signature to collection
  const handleAddSignature = () => {
    if (!newSignatureInput.trim() || !newSignaturePubKey.trim()) {
      toast.error('Signature and public key are required');
      return;
    }

    // Check for duplicate
    if (collectedSignatures.some(s => s.signature === newSignatureInput)) {
      toast.error('This signature is already added');
      return;
    }

    const newSig = {
      signature: newSignatureInput.trim(),
      publicKey: newSignaturePubKey.trim(),
      label: newSignatureLabel.trim() || undefined,
    };

    setCollectedSignatures(prev => [...prev, newSig]);
    setNewSignatureInput('');
    setNewSignaturePubKey('');
    setNewSignatureLabel('');

    // Update pending transaction
    if (selectedPendingTx) {
      const pendingTx = pendingTransactions.find(t => t.id === selectedPendingTx);
      if (pendingTx) {
        savePendingTransaction({
          ...pendingTx,
          signatures: [...pendingTx.signatures, newSig],
        });
      }
    }

    toast.success('Signature added');
  };

  // Remove signature from collection
  const handleRemoveSignature = (index: number) => {
    setCollectedSignatures(prev => prev.filter((_, i) => i !== index));

    // Update pending transaction
    if (selectedPendingTx) {
      const pendingTx = pendingTransactions.find(t => t.id === selectedPendingTx);
      if (pendingTx) {
        savePendingTransaction({
          ...pendingTx,
          signatures: pendingTx.signatures.filter((_, i) => i !== index),
        });
      }
    }
  };

  // Combine signatures
  const handleCombineSignatures = async () => {
    if (collectedSignatures.length < combineThreshold) {
      toast.error(`Need at least ${combineThreshold} signatures (have ${collectedSignatures.length})`);
      return;
    }

    if (combinePublicKeys.length < 2) {
      toast.error('At least 2 public keys are required');
      return;
    }

    setCombining(true);
    try {
      const result = await combineMultiSigSignatures(
        combinePublicKeys,
        combineWeights,
        combineThreshold,
        collectedSignatures.map(s => s.signature)
      );
      setCombinedSignature(result.combinedSignature);
      toast.success('Signatures combined successfully!');
    } catch (error) {
      toast.error(String(error));
    } finally {
      setCombining(false);
    }
  };

  // Execute signed transaction
  const handleExecuteTransaction = async () => {
    if (!builtTxBytes.trim() || !combinedSignature.trim()) {
      toast.error('Transaction bytes and combined signature are required');
      return;
    }

    setExecuting(true);
    try {
      const result = await executeSignedTransaction(builtTxBytes, combinedSignature);
      setExecutionResult(result);

      // Remove from pending after successful execution
      if (selectedPendingTx) {
        removePendingTransaction(selectedPendingTx);
      }

      toast.success('Transaction executed successfully!');
    } catch (error) {
      toast.error(String(error));
    } finally {
      setExecuting(false);
    }
  };

  // Load pending transaction into editor
  const loadPendingTransaction = (tx: PendingTransaction) => {
    setSelectedPendingTx(tx.id);
    setBuiltTxBytes(tx.txBytes);
    setBuildDescription(tx.description);
    setBuildFromAddress(tx.fromAddress);
    setBuildToAddress(tx.toAddress);
    setBuildAmount(tx.amount);
    setCollectedSignatures(tx.signatures);
    setCombinePublicKeys(tx.publicKeys);
    setCombineWeights(tx.weights);
    setCombineThreshold(tx.threshold);
    setCombinedSignature('');
    setExecutionResult(null);

    if (tx.signatures.length >= tx.threshold) {
      setExecuteStep('execute');
    } else if (tx.signatures.length > 0) {
      setExecuteStep('collect');
    } else {
      setExecuteStep('collect');
    }
  };

  // Export pending transaction as JSON
  const exportPendingTransaction = (tx: PendingTransaction) => {
    const exportData = {
      txBytes: tx.txBytes,
      description: tx.description,
      from: tx.fromAddress,
      to: tx.toAddress,
      amount: tx.amount,
      publicKeys: tx.publicKeys,
      weights: tx.weights,
      threshold: tx.threshold,
      signatures: tx.signatures,
      createdAt: tx.createdAt,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multisig-tx-${tx.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transaction exported');
  };

  // Import pending transaction from JSON
  const importPendingTransaction = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const newTx: PendingTransaction = {
          id: `tx-${Date.now()}`,
          txBytes: data.txBytes,
          description: data.description || 'Imported transaction',
          fromAddress: data.from || '',
          toAddress: data.to || '',
          amount: data.amount || '',
          createdAt: data.createdAt || new Date().toISOString(),
          signatures: data.signatures || [],
          publicKeys: data.publicKeys || [],
          weights: data.weights || [],
          threshold: data.threshold || 2,
        };
        savePendingTransaction(newTx);
        loadPendingTransaction(newTx);
        toast.success('Transaction imported');
      } catch (err) {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const addMultiSigField = () => {
    setMultiSigFields([...multiSigFields, { publicKey: '', weight: 1, selectedKeyIndex: null }]);
  };

  const removeMultiSigField = (index: number) => {
    if (multiSigFields.length > 2) {
      setMultiSigFields(multiSigFields.filter((_, i) => i !== index));
    }
  };

  const updateMultiSigField = (index: number, field: 'publicKey' | 'weight', value: string | number) => {
    const updated = [...multiSigFields];
    updated[index] = {
      ...updated[index],
      [field]: value,
      selectedKeyIndex: field === 'publicKey' ? null : updated[index].selectedKeyIndex,
    };
    setMultiSigFields(updated);
  };

  const validKeyCount = useMemo(() =>
    multiSigFields.filter(f => f.publicKey.trim()).length,
    [multiSigFields]
  );

  const tabs = [
    { id: 'keys' as Tab, label: 'Keys', icon: '🔑' },
    { id: 'generate' as Tab, label: 'Generate', icon: '✨' },
    { id: 'sign' as Tab, label: 'Sign', icon: '✍️' },
    { id: 'multisig' as Tab, label: 'Multi-Sig', icon: '👥' },
    { id: 'execute' as Tab, label: 'Execute', icon: '🚀', badge: pendingTransactions.length > 0 ? pendingTransactions.length : undefined },
    { id: 'decode' as Tab, label: 'Decode', icon: '🔍' },
  ];

  return (
    <div className="px-2 py-2">
      {/* Header */}
      <div className="mb-4 px-3">
        <h2 className="text-xl font-bold text-foreground mb-1">Key Management</h2>
        <p className="text-sm text-muted-foreground">
          Generate keys, sign messages, create multi-sig addresses
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 px-3 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap relative',
              activeTab === tab.id
                ? 'bg-accent text-accent-foreground shadow-lg'
                : 'bg-card/30 text-muted-foreground hover:bg-card/50 hover:text-foreground'
            )}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {'badge' in tab && tab.badge && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-3">
        {/* Keys Tab */}
        {activeTab === 'keys' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                {keys.length} key{keys.length !== 1 ? 's' : ''} found
              </p>
              <button
                onClick={() => loadKeys(true)}
                disabled={keysLoading}
                className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                {keysLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {keysLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : keys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No keys found. Go to Generate tab to create one.
              </div>
            ) : (
              <div className="space-y-2">
                {keys.map((key, index) => (
                  <div
                    key={key.suiAddress || index}
                    className="p-4 bg-card/50 border border-border/30 rounded-lg"
                  >
                    {key.alias && (
                      <div className="mb-2 flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded font-medium">
                          {key.alias}
                        </span>
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-tertiary">Address</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(key.suiAddress);
                              toast.success('Address copied');
                            }}
                            className="p-1 hover:bg-background-active rounded transition-colors"
                            title="Copy address"
                          >
                            <svg className="w-3 h-3 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                        <div className="font-mono text-sm text-foreground break-all">
                          {key.suiAddress}
                        </div>
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-tertiary">Public Key</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(key.publicBase64Key);
                            toast.success('Public key copied');
                          }}
                          className="p-1 hover:bg-background-active rounded transition-colors"
                          title="Copy public key"
                        >
                          <svg className="w-3 h-3 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                      <div className="font-mono text-xs text-muted-foreground break-all">
                        {key.publicBase64Key}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-tertiary">Scheme:</span>
                      <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded font-medium">
                        {key.keyScheme}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <div className="space-y-4">
            {!generatedKey || mnemonicAcknowledged ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Key Scheme</label>
                  <select
                    value={keyScheme}
                    onChange={(e) => setKeyScheme(e.target.value as 'ed25519' | 'secp256k1' | 'secp256r1')}
                    className="w-full px-3 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-accent/50 transition-colors"
                  >
                    <option value="ed25519">Ed25519 (Recommended)</option>
                    <option value="secp256k1">Secp256k1</option>
                    <option value="secp256r1">Secp256r1</option>
                  </select>
                  <p className="mt-1 text-xs text-tertiary">Ed25519 is recommended for most use cases</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Mnemonic Word Length</label>
                  <select
                    value={wordLength}
                    onChange={(e) => setWordLength(Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-accent/50 transition-colors"
                  >
                    <option value={12}>12 words</option>
                    <option value={15}>15 words</option>
                    <option value={18}>18 words</option>
                    <option value={21}>21 words</option>
                    <option value={24}>24 words</option>
                  </select>
                </div>

                <button
                  onClick={handleGenerateKey}
                  disabled={generating}
                  className="w-full px-4 py-2.5 bg-accent hover:bg-accent-hover text-accent-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? 'Generating...' : 'Generate New Key'}
                </button>

                {generatedKey && mnemonicAcknowledged && (
                  <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-green-400 text-lg">✓</span>
                      <div>
                        <h4 className="text-sm font-medium text-green-400 mb-1">Key Generated Successfully</h4>
                        <p className="text-xs text-muted-foreground">Your key has been added to the keystore</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-tertiary">Address</span>
                          <button onClick={() => { navigator.clipboard.writeText(generatedKey.address); toast.success('Address copied'); }} className="p-1 hover:bg-background-active rounded transition-colors">
                            <svg className="w-3 h-3 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          </button>
                        </div>
                        <div className="font-mono text-xs text-foreground break-all">{generatedKey.address}</div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-tertiary">Public Key</span>
                          <button onClick={() => { navigator.clipboard.writeText(generatedKey.publicKey); toast.success('Public key copied'); }} className="p-1 hover:bg-background-active rounded transition-colors">
                            <svg className="w-3 h-3 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          </button>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground break-all">{generatedKey.publicKey}</div>
                      </div>

                      <button onClick={() => setGeneratedKey(null)} className="w-full px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-sm font-medium transition-colors">
                        Generate Another Key
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg">
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-yellow-400 text-xl">⚠️</span>
                  <div>
                    <h4 className="text-sm font-medium text-yellow-400 mb-1">IMPORTANT: Save Your Recovery Phrase</h4>
                    <p className="text-xs text-muted-foreground">This recovery phrase will only be shown ONCE. Store it in a secure location. Anyone with this phrase can access your account.</p>
                  </div>
                </div>

                {generatedKey.mnemonic && (
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Recovery Phrase</span>
                      <button onClick={handleCopyMnemonic} className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded text-xs font-medium transition-colors flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Copy
                      </button>
                    </div>
                    <div className="p-3 bg-card border border-yellow-500/50 rounded font-mono text-sm text-foreground break-all select-all">
                      {generatedKey.mnemonic}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-medium text-tertiary">Address</span>
                    <div className="font-mono text-xs text-foreground mt-1 break-all">{generatedKey.address}</div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-tertiary">Public Key</span>
                    <div className="font-mono text-xs text-muted-foreground mt-1 break-all">{generatedKey.publicKey}</div>
                  </div>
                  <button onClick={handleAcknowledgeMnemonic} className="w-full px-4 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg text-sm font-medium transition-colors">
                    I have saved my recovery phrase
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sign Tab - IMPROVED */}
        {activeTab === 'sign' && (
          <div className="space-y-4">
            {/* Info Box */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-blue-400">ℹ️</span>
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-blue-400 mb-1">Sign Transaction Data</p>
                  <p>Sign BCS-serialized transaction bytes with your private key. Get transaction bytes from <code className="px-1 bg-secondary rounded">sui client tx-block --serialize</code> or build them programmatically.</p>
                </div>
              </div>
            </div>

            {/* Key Selector */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Select Signer</label>

              {keys.length > 0 && !useManualSignAddress ? (
                <>
                  <select
                    value={selectedSignKeyIndex ?? ''}
                    onChange={(e) => {
                      const idx = e.target.value === '' ? null : Number(e.target.value);
                      if (idx !== null) handleSignKeySelect(idx);
                    }}
                    className="w-full px-3 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-accent/50 transition-colors"
                  >
                    <option value="">Select a key from your keystore...</option>
                    {keys.map((key, index) => (
                      <option key={key.suiAddress} value={index}>
                        🔑 {key.alias || truncateAddress(key.suiAddress)} ({key.keyScheme})
                      </option>
                    ))}
                  </select>
                  <button onClick={() => { setUseManualSignAddress(true); setSelectedSignKeyIndex(null); }} className="mt-2 text-xs text-accent hover:underline">
                    Or enter address manually →
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={signAddress}
                    onChange={(e) => setSignAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 transition-colors font-mono"
                  />
                  {keys.length > 0 && (
                    <button onClick={() => setUseManualSignAddress(false)} className="mt-2 text-xs text-accent hover:underline">
                      ← Select from keystore
                    </button>
                  )}
                </>
              )}

              {selectedSignKeyIndex !== null && keys[selectedSignKeyIndex] && (
                <div className="mt-2 p-2 bg-card/50 rounded border border-border/30">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-tertiary">Selected:</span>
                    <span className="font-mono text-xs text-foreground">{keys[selectedSignKeyIndex].suiAddress}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Sample Transaction Generator */}
            <div className="p-3 bg-card/30 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-foreground">⚡ Generate Sample Transaction</span>
                <span className="text-xs text-tertiary">(for testing)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                {SAMPLE_TX_TYPES.map((sample) => (
                  <button
                    key={sample.type}
                    onClick={() => {
                      setSelectedSampleType(sample.type);
                      if (signAddress.trim()) {
                        handleGenerateSampleTx(sample.type);
                      }
                    }}
                    disabled={generatingSample || !signAddress.trim()}
                    className={clsx(
                      'p-2.5 rounded-lg text-left transition-all border',
                      selectedSampleType === sample.type && signAddress.trim()
                        ? 'bg-accent/20 border-accent/50'
                        : 'bg-card/50 border-border/30 hover:border-accent/30',
                      (!signAddress.trim() || generatingSample) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span>{sample.icon}</span>
                      <span className="text-sm font-medium text-foreground">{sample.label}</span>
                      {generatingSample && selectedSampleType === sample.type && (
                        <Spinner className="w-3 h-3 ml-auto" />
                      )}
                    </div>
                    <div className="text-xs text-tertiary">{sample.description}</div>
                  </button>
                ))}
              </div>

              {!signAddress.trim() && (
                <div className="text-xs text-yellow-400/80 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>Select a signer above to enable sample generation</span>
                </div>
              )}
            </div>

            {/* Transaction Bytes */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Transaction Bytes (Base64)</label>
              <textarea
                value={signData}
                onChange={(e) => { setSignData(e.target.value); setSampleDescription(''); }}
                placeholder="Enter Base64 encoded transaction bytes, or click a sample type above to generate one..."
                rows={4}
                className="w-full px-3 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 transition-colors font-mono"
              />

              {/* Sample Description */}
              {sampleDescription && (
                <div className="mt-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400 flex items-center gap-2">
                  <span>✓</span>
                  <span>{sampleDescription}</span>
                </div>
              )}

              {/* Tip */}
              <div className="mt-2 text-xs text-tertiary">
                <span className="font-medium">Manual:</span> Get TX bytes using{' '}
                <code className="px-1 py-0.5 bg-secondary rounded text-muted-foreground">sui client transfer-sui --serialize-unsigned-transaction</code>
              </div>
            </div>

            <button
              onClick={handleSignMessage}
              disabled={signing || !signAddress.trim() || !signData.trim()}
              className="w-full px-4 py-2.5 bg-accent hover:bg-accent-hover text-accent-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signing ? 'Signing...' : 'Sign Transaction'}
            </button>

            {signature && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-400">✓ Signature Created</span>
                  <button onClick={() => { navigator.clipboard.writeText(signature); toast.success('Signature copied'); }} className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded text-xs font-medium transition-colors flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Copy
                  </button>
                </div>
                <div className="font-mono text-xs text-foreground break-all p-2 bg-card border border-green-500/20 rounded">
                  {signature}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Multi-Sig Tab - Clean UI */}
        {activeTab === 'multisig' && (
          <div className="space-y-4">
            {/* Compact Flow Indicator */}
            <div className="flex items-center gap-1 px-1 py-2 overflow-x-auto">
              {MULTISIG_FLOW_STEPS.map((step, idx) => (
                <div key={step.step} className="flex items-center">
                  <div
                    className="group relative"
                    title={step.hint}
                  >
                    <div className={clsx(
                      'flex items-center gap-1 px-2 py-1 rounded text-xs transition-all cursor-default',
                      step.step === 1 ? 'bg-accent/20 text-accent' : 'text-tertiary hover:text-muted-foreground'
                    )}>
                      <span className="font-mono">{step.step}</span>
                      <span className="hidden sm:inline">{step.title}</span>
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-card border border-border/50 rounded text-xs text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                      {step.hint}
                    </div>
                  </div>
                  {idx < MULTISIG_FLOW_STEPS.length - 1 && (
                    <span className="text-tertiary/30 mx-0.5">→</span>
                  )}
                </div>
              ))}
            </div>

            {/* Use Case Templates */}
            <div className="p-3 bg-card/30 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">📋 Use Case Templates</span>
                  <span className="text-xs text-tertiary">(click to apply)</span>
                </div>
                <span className="text-xs text-tertiary">
                  {keys.length} key{keys.length !== 1 ? 's' : ''} available
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {MULTISIG_USE_CASES.map((useCase) => {
                  const hasEnoughKeys = keys.length >= useCase.signers;
                  const keysToFill = Math.min(keys.length, useCase.signers);
                  return (
                    <button
                      key={useCase.id}
                      onClick={() => {
                        if (!hasEnoughKeys && keys.length === 0) {
                          toast.error('No keys in keystore. Generate keys first in the "Generate" tab.');
                          return;
                        }
                        // Create fields for this use case, fill with available keys
                        const newFields: MultiSigField[] = [];
                        for (let i = 0; i < useCase.signers; i++) {
                          newFields.push({
                            publicKey: keys[i]?.publicBase64Key || '',
                            weight: 1,
                            selectedKeyIndex: keys[i] ? i : null,
                          });
                        }
                        setMultiSigFields(newFields);
                        setThreshold(useCase.threshold);
                        if (hasEnoughKeys) {
                          toast.success(`Applied ${useCase.label} template with ${keysToFill} keys`);
                        } else {
                          toast.success(`Applied ${useCase.label} template (${keysToFill}/${useCase.signers} keys filled)`);
                        }
                      }}
                      className={clsx(
                        'p-3 border rounded-lg text-left transition-all group',
                        hasEnoughKeys
                          ? 'bg-card/50 hover:bg-card/70 border-border/30 hover:border-accent/30'
                          : 'bg-card/30 border-border/20 opacity-70'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground group-hover:text-accent">{useCase.label}</span>
                        {!hasEnoughKeys && (
                          <span className="text-xs text-yellow-400/80">need {useCase.signers} keys</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">{useCase.description}</div>
                      <div className="text-xs text-tertiary italic">{useCase.tip}</div>
                    </button>
                  );
                })}
              </div>
              {keys.length === 0 && (
                <div className="mt-3 text-xs text-yellow-400/80 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>No keys found. Go to "Generate" tab to create keys first.</span>
                </div>
              )}
            </div>

            {/* Quick Fill from Keystore */}
            {keys.length >= 2 && (
              <div className="p-3 bg-card/30 rounded-lg">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs text-tertiary font-medium">⚡ Quick Fill from Keystore:</span>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => quickFillMultiSig(2)} className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded text-xs font-medium transition-colors" disabled={keys.length < 2}>
                      First 2 keys
                    </button>
                    {keys.length >= 3 && (
                      <button onClick={() => quickFillMultiSig(3)} className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded text-xs font-medium transition-colors">
                        First 3 keys
                      </button>
                    )}
                    {keys.length >= 5 && (
                      <button onClick={() => quickFillMultiSig(5)} className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded text-xs font-medium transition-colors">
                        First 5 keys
                      </button>
                    )}
                    <button onClick={() => quickFillMultiSig(keys.length)} className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded text-xs font-medium transition-colors">
                      All {keys.length} keys
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Signers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">Signers ({validKeyCount} configured)</label>
                <button onClick={addMultiSigField} className="px-3 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded text-xs font-medium transition-colors flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Signer
                </button>
              </div>

              <div className="space-y-3">
                {multiSigFields.map((field, index) => (
                  <div key={index} className="p-3 bg-card/30 border border-border/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Signer {index + 1}</span>
                      {multiSigFields.length > 2 && (
                        <button onClick={() => removeMultiSigField(index)} className="p-1 hover:bg-red-500/10 text-red-400 rounded transition-colors" title="Remove signer">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>

                    {keys.length > 0 && (
                      <select
                        value={field.selectedKeyIndex ?? ''}
                        onChange={(e) => {
                          const idx = e.target.value === '' ? null : Number(e.target.value);
                          if (idx !== null) handleMultiSigKeySelect(index, idx);
                          else updateMultiSigField(index, 'publicKey', '');
                        }}
                        className="w-full px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-accent/50 transition-colors mb-2"
                      >
                        <option value="">Select key or enter manually...</option>
                        {keys.map((key, keyIdx) => (
                          <option key={key.suiAddress} value={keyIdx}>
                            🔑 {key.alias || truncateAddress(key.suiAddress)} ({key.keyScheme})
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={field.publicKey}
                        onChange={(e) => updateMultiSigField(index, 'publicKey', e.target.value)}
                        placeholder="Public key (Base64)..."
                        className="flex-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 transition-colors font-mono"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-tertiary">Weight:</span>
                        <input
                          type="number"
                          min="1"
                          value={field.weight}
                          onChange={(e) => updateMultiSigField(index, 'weight', Number(e.target.value))}
                          className="w-16 px-2 py-2 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-accent/50 transition-colors text-center"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Threshold */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Threshold Configuration</label>
              <div className="p-3 bg-card/30 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-muted-foreground">Require</span>
                  <input
                    type="number"
                    min="1"
                    max={validKeyCount || 1}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 bg-secondary/50 border border-border/50 rounded text-sm text-foreground focus:outline-none focus:border-accent/50 transition-colors text-center"
                  />
                  <span className="text-sm text-muted-foreground">of {validKeyCount} signatures</span>
                  <span className="text-xs text-tertiary">(total weight: {multiSigFields.reduce((sum, f) => sum + (f.publicKey.trim() ? f.weight : 0), 0)})</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-tertiary">Presets:</span>
                  {MULTISIG_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => applyThresholdPreset(preset)}
                      className={clsx(
                        'px-2 py-1 text-xs rounded transition-colors',
                        threshold === preset.required && validKeyCount === preset.total
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-card/50 hover:bg-card/70 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateMultiSig}
              disabled={creatingMultiSig || validKeyCount < 2}
              className="w-full px-4 py-2.5 bg-accent hover:bg-accent-hover text-accent-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingMultiSig ? 'Creating...' : 'Create Multi-Sig Address'}
            </button>

            {multiSigAddress && (
              <div className="space-y-3">
                {/* Created Address */}
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-400">✓ Multi-Sig Address Created</span>
                    <button onClick={() => { navigator.clipboard.writeText(multiSigAddress); toast.success('Address copied'); }} className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs font-medium transition-colors flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      Copy
                    </button>
                  </div>
                  <div className="font-mono text-xs text-foreground break-all p-2 bg-secondary rounded">
                    {multiSigAddress}
                  </div>
                  <p className="mt-2 text-xs text-tertiary">
                    Requires <span className="text-accent font-medium">{threshold} of {validKeyCount}</span> signatures
                  </p>
                </div>

                {/* What's Next - Simplified guide */}
                <div className="p-3 bg-card/50 border border-border/30 rounded-lg">
                  <p className="text-sm font-medium text-foreground mb-2">How to Use Multi-Sig</p>
                  <p className="text-xs text-tertiary mb-3">
                    Multi-sig requires <span className="text-accent font-medium">{threshold}</span> out of <span className="text-accent font-medium">{validKeyCount}</span> signers to approve any transaction.
                  </p>

                  <div className="space-y-3">
                    {/* Step 1: Fund - Most Important */}
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">1</span>
                        <span className="text-sm font-medium text-blue-400">Fund the Address</span>
                      </div>
                      <p className="text-xs text-tertiary mb-2">
                        Before you can use this multi-sig, you need SUI for gas fees. Get testnet tokens:
                      </p>
                      <a
                        href={`/app/faucet?address=${multiSigAddress}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-xs font-medium transition-colors"
                      >
                        💧 Request from Faucet →
                      </a>
                    </div>

                    {/* Step 2: Build TX */}
                    <div className="p-3 bg-card/30 border border-border/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 rounded-full bg-yellow-500/80 text-black flex items-center justify-center text-xs font-bold">2</span>
                        <span className="text-sm font-medium text-yellow-400">Create Transaction</span>
                      </div>
                      <p className="text-xs text-tertiary mb-2">
                        Build an unsigned transaction. The key is to add <code className="px-1 bg-secondary rounded text-yellow-300">--serialize-unsigned-transaction</code>
                      </p>
                      <div className="p-2 bg-secondary rounded font-mono text-xs text-muted-foreground overflow-x-auto">
                        sui client transfer-sui --to 0x... --sui-coin-object-id 0x... --amount 1000000000 --gas-budget 10000000 --serialize-unsigned-transaction
                      </div>
                      <p className="text-xs text-tertiary mt-1.5 flex items-center gap-1">
                        <span>💡</span> This outputs base64-encoded TX bytes that all signers will sign.
                      </p>
                    </div>

                    {/* Step 3: Sign */}
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">3</span>
                        <span className="text-sm font-medium text-purple-400">Collect {threshold} Signatures</span>
                      </div>
                      <p className="text-xs text-tertiary mb-2">
                        Each signer uses the <strong>Sign tab</strong> to sign the <span className="text-yellow-400">SAME TX bytes</span>.
                        You need at least {threshold} signatures.
                      </p>
                      <button
                        onClick={() => setActiveTab('sign')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded text-xs font-medium transition-colors"
                      >
                        ✍️ Go to Sign Tab →
                      </button>
                    </div>

                    {/* Step 4: Combine & Execute */}
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">4</span>
                        <span className="text-sm font-medium text-green-400">Combine & Execute</span>
                      </div>
                      <p className="text-xs text-tertiary mb-2">
                        Combine all partial signatures and execute the transaction:
                      </p>
                      <div className="space-y-1.5">
                        <div className="p-2 bg-secondary rounded font-mono text-xs text-muted-foreground overflow-x-auto">
                          sui keytool multi-sig-combine-partial-sig --pks PK1 PK2 --weights 1 1 --threshold {threshold} --sigs SIG1 SIG2
                        </div>
                        <div className="p-2 bg-secondary rounded font-mono text-xs text-muted-foreground overflow-x-auto">
                          sui client execute-signed-tx --tx-bytes TX_BYTES --signatures COMBINED_SIG
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Important Note */}
                  <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-300/80 flex items-start gap-2">
                    <span>⚠️</span>
                    <span>All signers must sign the <strong>exact same TX bytes</strong>. Share the base64 string carefully!</span>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/app/objects?address=${multiSigAddress}`}
                    className="px-2 py-1 bg-card/50 hover:bg-card/70 text-muted-foreground rounded text-xs transition-colors"
                  >
                    📦 Objects
                  </a>
                  <a
                    href={`https://suiscan.xyz/testnet/account/${multiSigAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 bg-card/50 hover:bg-card/70 text-muted-foreground rounded text-xs transition-colors flex items-center gap-1"
                  >
                    Explorer ↗
                  </a>
                </div>
              </div>
            )}

            {/* History Section - Previously Created Multi-Sig Addresses */}
            {multiSigHistory.length > 0 && (
              <div className="p-3 bg-card/30 rounded-lg border border-border/20">
                {/* Header with explanation */}
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors"
                  >
                    <span>📜 Previously Created ({multiSigHistory.length})</span>
                    <svg className={clsx('w-4 h-4 transition-transform', showHistory && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Explanation when collapsed */}
                {!showHistory && (
                  <p className="text-xs text-tertiary">
                    Click to view your previously created multi-sig addresses
                  </p>
                )}

                {showHistory && (
                  <div className="space-y-2 mt-3">
                    {/* Info box explaining what this is */}
                    <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300/80 mb-3">
                      <p className="flex items-center gap-1.5">
                        <span>ℹ️</span>
                        <span>These are multi-sig addresses you created in this browser. Click to copy or view on explorer.</span>
                      </p>
                    </div>

                    {multiSigHistory.map((item) => {
                      const balance = historyBalances[item.address];
                      const isLoadingBalance = loadingBalances[item.address];
                      const hasBalance = balance && parseFloat(balance) > 0;

                      return (
                      <div key={item.address} className="p-3 bg-card/50 border border-border/30 rounded-lg hover:border-accent/30 transition-colors group">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded font-medium">
                                {item.threshold}-of-{item.totalSigners}
                              </span>
                              {/* Balance display */}
                              {isLoadingBalance ? (
                                <span className="text-xs text-tertiary animate-pulse">Loading...</span>
                              ) : balance !== undefined ? (
                                <span className={clsx(
                                  'px-2 py-0.5 text-xs rounded font-medium',
                                  hasBalance
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-red-500/20 text-red-400'
                                )}>
                                  {hasBalance ? `${balance} SUI` : '0 SUI'}
                                </span>
                              ) : null}
                              <span className="text-xs text-tertiary ml-auto">
                                {new Date(item.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div
                              className="font-mono text-xs text-foreground break-all cursor-pointer hover:text-accent transition-colors"
                              onClick={() => { navigator.clipboard.writeText(item.address); toast.success('Address copied!'); }}
                              title="Click to copy address"
                            >
                              {item.address}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => fetchBalanceForAddress(item.address)}
                              className="p-1.5 hover:bg-accent/10 text-tertiary hover:text-accent rounded transition-colors"
                              title="Refresh balance"
                              disabled={isLoadingBalance}
                            >
                              <svg className={clsx('w-4 h-4', isLoadingBalance && 'animate-spin')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                            <button
                              onClick={() => { navigator.clipboard.writeText(item.address); toast.success('Address copied!'); }}
                              className="p-1.5 hover:bg-accent/10 text-tertiary hover:text-accent rounded transition-colors"
                              title="Copy address"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => removeFromHistory(item.address)}
                              className="p-1.5 hover:bg-red-500/10 text-tertiary hover:text-red-400 rounded transition-colors"
                              title="Remove from history"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Hint when no balance */}
                        {!isLoadingBalance && balance !== undefined && !hasBalance && (
                          <div className="mb-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400/80 flex items-center gap-1.5">
                            <span>⚠️</span>
                            <span>No SUI yet - request from faucet to start using this address</span>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border/20">
                          {/* Quick Send - go to Execute tab */}
                          <button
                            onClick={() => {
                              setActiveTab('execute');
                              setExecuteStep('build');
                              setBuildFromAddress(item.address);
                              // Pre-fill combine fields if we have publicKeys
                              if (item.publicKeys && item.weights) {
                                setCombinePublicKeys(item.publicKeys);
                                setCombineWeights(item.weights);
                                setCombineThreshold(item.threshold);
                              }
                              toast.success('Ready to build transaction');
                            }}
                            className="px-2.5 py-1 bg-accent/20 hover:bg-accent/30 text-accent rounded text-xs font-medium transition-colors"
                          >
                            💸 Send TX
                          </button>
                          <a
                            href={`/app/faucet?address=${item.address}`}
                            className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded text-xs transition-colors"
                          >
                            💧 Get Test SUI
                          </a>
                          <a
                            href={`/app/objects?address=${item.address}`}
                            className="px-2.5 py-1 bg-card/50 hover:bg-card/70 text-muted-foreground rounded text-xs transition-colors"
                          >
                            📦 View Objects
                          </a>
                          <a
                            href={`https://suiscan.xyz/testnet/account/${item.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-card/50 hover:bg-card/70 text-muted-foreground rounded text-xs transition-colors flex items-center gap-1"
                          >
                            Explorer ↗
                          </a>
                        </div>
                      </div>
                      );
                    })}

                    {/* Clear all button */}
                    {multiSigHistory.length > 1 && (
                      <button
                        onClick={() => {
                          if (confirm('Clear all multi-sig history? This cannot be undone.')) {
                            localStorage.removeItem(MULTISIG_HISTORY_KEY);
                            setMultiSigHistory([]);
                            toast.success('History cleared');
                          }
                        }}
                        className="w-full mt-2 px-3 py-1.5 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      >
                        Clear All History
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Execute Tab - Multi-Sig Transaction Flow */}
        {activeTab === 'execute' && (
          <div className="space-y-4">
            {/* Step Indicator */}
            <div className="flex items-center gap-2 p-3 bg-card/30 rounded-lg">
              {(['build', 'collect', 'execute'] as const).map((step, idx) => (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => setExecuteStep(step)}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      executeStep === step
                        ? 'bg-accent text-accent-foreground'
                        : 'text-tertiary hover:text-muted-foreground'
                    )}
                  >
                    <span className={clsx(
                      'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                      executeStep === step ? 'bg-accent-foreground/20' : 'bg-card/50'
                    )}>
                      {idx + 1}
                    </span>
                    <span className="capitalize">{step}</span>
                    {step === 'collect' && collectedSignatures.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                        {collectedSignatures.length}
                      </span>
                    )}
                  </button>
                  {idx < 2 && <span className="text-tertiary/30 mx-1">→</span>}
                </div>
              ))}
            </div>

            {/* Pending Transactions */}
            {pendingTransactions.length > 0 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-yellow-400">📋 Pending Transactions ({pendingTransactions.length})</span>
                  <label className="px-2 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1">
                    <input
                      type="file"
                      accept=".json"
                      onChange={importPendingTransaction}
                      className="hidden"
                    />
                    📥 Import
                  </label>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pendingTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={clsx(
                        'p-2 rounded border transition-all cursor-pointer',
                        selectedPendingTx === tx.id
                          ? 'bg-accent/20 border-accent/50'
                          : 'bg-card/30 border-border/30 hover:border-accent/30'
                      )}
                      onClick={() => loadPendingTransaction(tx)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-foreground truncate">{tx.description}</span>
                            <span className={clsx(
                              'px-1.5 py-0.5 text-xs rounded font-medium',
                              tx.signatures.length >= tx.threshold
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            )}>
                              {tx.signatures.length}/{tx.threshold} sigs
                            </span>
                          </div>
                          <div className="text-xs text-tertiary">
                            {tx.amount} MIST → {truncateAddress(tx.toAddress, 4)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); exportPendingTransaction(tx); }}
                            className="p-1 hover:bg-accent/10 text-tertiary hover:text-accent rounded transition-colors"
                            title="Export"
                          >
                            📤
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removePendingTransaction(tx.id); }}
                            className="p-1 hover:bg-red-500/10 text-tertiary hover:text-red-400 rounded transition-colors"
                            title="Remove"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Build Step */}
            {executeStep === 'build' && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-400">🔧</span>
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-blue-400 mb-1">Build Transfer Transaction</p>
                      <p>Create unsigned transaction bytes for multi-sig signing. The transaction will be serialized without signatures.</p>
                    </div>
                  </div>
                </div>

                {/* From Address - with keystore + multi-sig history selector */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">From Address</label>
                  {(keys.length > 0 || multiSigHistory.length > 0) && (
                    <select
                      value={buildFromAddress}
                      onChange={(e) => setBuildFromAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-accent/50 transition-colors mb-2"
                    >
                      <option value="">Select address...</option>
                      {keys.length > 0 && (
                        <optgroup label="🔑 Keystore Addresses">
                          {keys.map((key) => (
                            <option key={key.suiAddress} value={key.suiAddress}>
                              {key.alias || truncateAddress(key.suiAddress, 8)} ({key.keyScheme})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {multiSigHistory.length > 0 && (
                        <optgroup label="👥 Multi-Sig Addresses">
                          {multiSigHistory.map((item) => (
                            <option key={item.address} value={item.address}>
                              {item.threshold}-of-{item.totalSigners}: {truncateAddress(item.address, 8)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  )}
                  <input
                    type="text"
                    value={buildFromAddress}
                    onChange={(e) => setBuildFromAddress(e.target.value)}
                    placeholder="Or enter address manually: 0x..."
                    className="w-full px-3 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 transition-colors font-mono"
                  />
                </div>

                {/* To Address - with keystore selector */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">To Address</label>
                  {(keys.length > 0 || multiSigHistory.length > 0) && (
                    <select
                      value={buildToAddress}
                      onChange={(e) => setBuildToAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground focus:outline-none focus:border-accent/50 transition-colors mb-2"
                    >
                      <option value="">Select recipient...</option>
                      {keys.length > 0 && (
                        <optgroup label="🔑 Keystore Addresses">
                          {keys.map((key) => (
                            <option key={key.suiAddress} value={key.suiAddress}>
                              {key.alias || truncateAddress(key.suiAddress, 8)} ({key.keyScheme})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {multiSigHistory.length > 0 && (
                        <optgroup label="👥 Multi-Sig Addresses">
                          {multiSigHistory.map((item) => (
                            <option key={item.address} value={item.address}>
                              {item.threshold}-of-{item.totalSigners}: {truncateAddress(item.address, 8)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  )}
                  <input
                    type="text"
                    value={buildToAddress}
                    onChange={(e) => setBuildToAddress(e.target.value)}
                    placeholder="Or enter address manually: 0x..."
                    className="w-full px-3 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 transition-colors font-mono"
                  />
                </div>

                {/* Amount with SUI presets */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Amount</label>
                  {/* Quick amount buttons */}
                  <div className="flex gap-2 mb-2">
                    {[
                      { label: '0.1 SUI', mist: '100000000' },
                      { label: '0.5 SUI', mist: '500000000' },
                      { label: '1 SUI', mist: '1000000000' },
                      { label: '5 SUI', mist: '5000000000' },
                    ].map((preset) => (
                      <button
                        key={preset.mist}
                        onClick={() => setBuildAmount(preset.mist)}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                          buildAmount === preset.mist
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-card/50 border border-border/30 text-muted-foreground hover:border-accent/50 hover:text-foreground'
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={buildAmount}
                    onChange={(e) => setBuildAmount(e.target.value)}
                    placeholder="1000000000 (1 SUI = 1,000,000,000 MIST)"
                    className="w-full px-3 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 transition-colors font-mono"
                  />
                  <p className="mt-1 text-xs text-tertiary">
                    {buildAmount && !isNaN(Number(buildAmount)) && Number(buildAmount) > 0
                      ? `= ${(Number(buildAmount) / 1_000_000_000).toFixed(4)} SUI`
                      : '1 SUI = 1,000,000,000 MIST'}
                  </p>
                </div>

                {/* Gas Budget - hidden by default, uses 10M MIST */}
                <details className="group">
                  <summary className="text-xs text-tertiary cursor-pointer hover:text-muted-foreground transition-colors">
                    ⚙️ Advanced Options
                  </summary>
                  <div className="mt-2 p-3 bg-card/30 rounded-lg">
                    <label className="block text-xs font-medium text-tertiary mb-1">Gas Budget (MIST)</label>
                    <input
                      type="text"
                      value={buildGasBudget}
                      onChange={(e) => setBuildGasBudget(e.target.value)}
                      placeholder="10000000 (default)"
                      className="w-full px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 transition-colors font-mono"
                    />
                    <p className="mt-1 text-xs text-tertiary">Leave empty for default (0.01 SUI)</p>
                  </div>
                </details>

                <button
                  onClick={handleBuildTransfer}
                  disabled={building || !buildFromAddress.trim() || !buildToAddress.trim() || !buildAmount.trim()}
                  className="w-full px-4 py-2.5 bg-accent hover:bg-accent-hover text-accent-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {building ? (
                    <>
                      <Spinner className="w-4 h-4" />
                      Building...
                    </>
                  ) : (
                    <>🔧 Build Transaction</>
                  )}
                </button>

                {builtTxBytes && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-400">✓ Transaction Built</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(builtTxBytes); toast.success('TX bytes copied'); }}
                        className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs font-medium transition-colors"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <div className="font-mono text-xs text-foreground break-all p-2 bg-secondary rounded max-h-24 overflow-y-auto">
                      {builtTxBytes}
                    </div>
                    {buildDescription && (
                      <p className="mt-2 text-xs text-tertiary">{buildDescription}</p>
                    )}
                    <button
                      onClick={() => setExecuteStep('collect')}
                      className="mt-3 w-full px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg text-sm font-medium transition-colors"
                    >
                      Next: Collect Signatures →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Collect Step */}
            {executeStep === 'collect' && (
              <div className="space-y-4">
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-purple-400">✍️</span>
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-purple-400 mb-1">Collect Signatures</p>
                      <p>Each signer uses the <strong>Sign tab</strong> to sign the TX bytes below. Then add their signatures here.</p>
                    </div>
                  </div>
                </div>

                {/* TX Bytes to Share */}
                {builtTxBytes && (
                  <div className="p-3 bg-card/50 border border-border/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-tertiary">TX Bytes to Sign (share with signers)</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(builtTxBytes); toast.success('TX bytes copied'); }}
                        className="px-2 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded text-xs font-medium transition-colors"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground break-all p-2 bg-secondary rounded max-h-20 overflow-y-auto">
                      {builtTxBytes}
                    </div>
                  </div>
                )}

                {/* Signature Progress */}
                <div className="p-3 bg-card/30 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">
                      Signatures: {collectedSignatures.length} / {combineThreshold} required
                    </span>
                    {collectedSignatures.length >= combineThreshold && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded font-medium">
                        ✓ Ready to combine
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 bg-card/50 rounded-full overflow-hidden mb-3">
                    <div
                      className={clsx(
                        'h-full transition-all',
                        collectedSignatures.length >= combineThreshold ? 'bg-green-500' : 'bg-accent'
                      )}
                      style={{ width: `${Math.min(100, (collectedSignatures.length / combineThreshold) * 100)}%` }}
                    />
                  </div>

                  {/* Collected Signatures */}
                  {collectedSignatures.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {collectedSignatures.map((sig, index) => (
                        <div key={index} className="p-2 bg-card/50 border border-border/30 rounded flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-foreground">
                                {sig.label || `Signer ${index + 1}`}
                              </span>
                              <span className="text-xs text-tertiary">
                                PK: {truncateAddress(sig.publicKey, 6)}
                              </span>
                            </div>
                            <div className="font-mono text-xs text-muted-foreground truncate">
                              {sig.signature}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveSignature(index)}
                            className="p-1 hover:bg-red-500/10 text-tertiary hover:text-red-400 rounded transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Multi-Sig Signers Status in Collect Step */}
                {combinePublicKeys.length > 0 && (
                  <div className="p-3 bg-card/30 border border-border/30 rounded-lg">
                    <span className="text-sm font-medium text-foreground mb-3 block">
                      👥 Required Signers ({collectedSignatures.length}/{combineThreshold} of {combinePublicKeys.length})
                    </span>
                    <div className="space-y-2">
                      {combinePublicKeys.map((pubKey, index) => {
                        const hasSigned = collectedSignatures.some(s => s.publicKey === pubKey);
                        const keystoreKey = keys.find(k => k.publicBase64Key === pubKey);
                        const weight = combineWeights[index] || 1;

                        return (
                          <div
                            key={pubKey}
                            className={clsx(
                              'flex items-center justify-between px-3 py-2 rounded-lg text-xs',
                              hasSigned
                                ? 'bg-green-500/10 border border-green-500/30'
                                : 'bg-card/50 border border-border/30'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-base shrink-0">
                                {hasSigned ? '✅' : '⏳'}
                              </span>
                              <div className="min-w-0 flex-1">
                                {keystoreKey ? (
                                  <div className="font-medium text-foreground flex items-center gap-1">
                                    <span className="text-blue-400">🔑</span>
                                    {keystoreKey.alias || truncateAddress(keystoreKey.suiAddress, 6)}
                                  </div>
                                ) : (
                                  <div className="font-medium text-tertiary">
                                    External: {pubKey.slice(0, 12)}...
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className={clsx(
                              'text-xs font-medium px-1.5 py-0.5 rounded shrink-0',
                              hasSigned ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                            )}>
                              {hasSigned ? 'Signed' : `Pending (w:${weight})`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Sign - Sign directly with your keys */}
                {builtTxBytes && keys.length > 0 && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <span className="text-sm font-medium text-blue-400 mb-3 block">⚡ Quick Sign (with your keys)</span>
                    <p className="text-xs text-tertiary mb-3">
                      Click a key to sign the transaction directly. No need to switch tabs!
                    </p>
                    <div className="grid gap-2">
                      {keys.map((key) => {
                        const alreadySigned = collectedSignatures.some(s => s.publicKey === key.publicBase64Key);
                        return (
                          <button
                            key={key.publicBase64Key}
                            onClick={async () => {
                              if (alreadySigned) return;
                              try {
                                const result = await signMessage(builtTxBytes, key.suiAddress);
                                const newSig = {
                                  signature: result.signature,
                                  publicKey: key.publicBase64Key,
                                  label: key.alias || truncateAddress(key.suiAddress, 6),
                                };
                                setCollectedSignatures(prev => [...prev, newSig]);
                                // Update pending transaction
                                if (selectedPendingTx) {
                                  const pendingTx = pendingTransactions.find(t => t.id === selectedPendingTx);
                                  if (pendingTx) {
                                    savePendingTransaction({
                                      ...pendingTx,
                                      signatures: [...pendingTx.signatures, newSig],
                                    });
                                  }
                                }
                                toast.success(`Signed with ${key.alias || truncateAddress(key.suiAddress, 6)}`);
                              } catch (error) {
                                toast.error(`Sign failed: ${error}`);
                              }
                            }}
                            disabled={alreadySigned}
                            className={clsx(
                              'flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all',
                              alreadySigned
                                ? 'bg-green-500/10 border border-green-500/30 text-green-400 cursor-default'
                                : 'bg-card/50 border border-border/30 hover:border-blue-500/50 hover:bg-blue-500/10 text-foreground'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{alreadySigned ? '✓' : '🔑'}</span>
                              <div className="text-left">
                                <div className="font-medium">{key.alias || 'Unnamed Key'}</div>
                                <div className="text-xs text-tertiary font-mono">
                                  {truncateAddress(key.suiAddress, 8)} • {key.keyScheme}
                                </div>
                              </div>
                            </div>
                            {alreadySigned ? (
                              <span className="text-green-400 text-xs">Signed</span>
                            ) : (
                              <span className="text-blue-400">Sign →</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Manual Add Signature Form */}
                <div className="p-3 bg-card/30 border border-border/30 rounded-lg">
                  <span className="text-sm font-medium text-foreground mb-3 block">📝 Add External Signature</span>
                  <p className="text-xs text-tertiary mb-3">
                    For signatures from other signers (not in your keystore)
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-tertiary mb-1">Signature</label>
                      <input
                        type="text"
                        value={newSignatureInput}
                        onChange={(e) => setNewSignatureInput(e.target.value)}
                        placeholder="Paste signature here..."
                        className="w-full px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 transition-colors font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-tertiary mb-1">Public Key</label>
                      {keys.length > 0 && (
                        <select
                          value={newSignaturePubKey}
                          onChange={(e) => setNewSignaturePubKey(e.target.value)}
                          className="w-full px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/50 transition-colors mb-2"
                        >
                          <option value="">Select from keystore...</option>
                          {keys.map((key) => (
                            <option key={key.publicBase64Key} value={key.publicBase64Key}>
                              {key.alias || truncateAddress(key.suiAddress, 6)} ({key.keyScheme})
                            </option>
                          ))}
                        </select>
                      )}
                      <input
                        type="text"
                        value={newSignaturePubKey}
                        onChange={(e) => setNewSignaturePubKey(e.target.value)}
                        placeholder="Or enter public key (Base64)..."
                        className="w-full px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 transition-colors font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-tertiary mb-1">Label (optional)</label>
                      <input
                        type="text"
                        value={newSignatureLabel}
                        onChange={(e) => setNewSignatureLabel(e.target.value)}
                        placeholder="e.g., Alice, Bob..."
                        className="w-full px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 transition-colors"
                      />
                    </div>

                    <button
                      onClick={handleAddSignature}
                      disabled={!newSignatureInput.trim() || !newSignaturePubKey.trim()}
                      className="w-full px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add External Signature
                    </button>
                  </div>
                </div>

                {/* Proceed to Execute */}
                {collectedSignatures.length >= combineThreshold && (
                  <button
                    onClick={() => setExecuteStep('execute')}
                    className="w-full px-4 py-2.5 bg-accent hover:bg-accent-hover text-accent-foreground rounded-lg text-sm font-medium transition-colors"
                  >
                    Next: Combine & Execute →
                  </button>
                )}
              </div>
            )}

            {/* Execute Step */}
            {executeStep === 'execute' && (
              <div className="space-y-4">
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-green-400">🚀</span>
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-green-400 mb-1">Combine & Execute</p>
                      <p>Combine all signatures into a multi-sig signature and execute the transaction on-chain.</p>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="p-3 bg-card/30 rounded-lg">
                  <span className="text-sm font-medium text-foreground mb-2 block">Transaction Summary</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-tertiary">Signatures:</span>
                      <span className="ml-2 text-foreground">{collectedSignatures.length} / {combineThreshold}</span>
                    </div>
                    <div>
                      <span className="text-tertiary">Public Keys:</span>
                      <span className="ml-2 text-foreground">{combinePublicKeys.length}</span>
                    </div>
                    <div>
                      <span className="text-tertiary">Threshold:</span>
                      <span className="ml-2 text-foreground">{combineThreshold}</span>
                    </div>
                    <div>
                      <span className="text-tertiary">Status:</span>
                      <span className={clsx(
                        'ml-2',
                        collectedSignatures.length >= combineThreshold ? 'text-green-400' : 'text-yellow-400'
                      )}>
                        {collectedSignatures.length >= combineThreshold ? 'Ready' : 'Need more sigs'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Multi-Sig Signers Status */}
                {combinePublicKeys.length > 0 && (
                  <div className="p-3 bg-card/30 border border-border/30 rounded-lg">
                    <span className="text-sm font-medium text-foreground mb-3 block">
                      👥 Multi-Sig Signers ({collectedSignatures.length}/{combinePublicKeys.length} signed)
                    </span>
                    <div className="space-y-2">
                      {combinePublicKeys.map((pubKey, index) => {
                        // Check if this public key has signed
                        const hasSigned = collectedSignatures.some(s => s.publicKey === pubKey);
                        // Find if this key exists in user's keystore
                        const keystoreKey = keys.find(k => k.publicBase64Key === pubKey);
                        // Get weight for this key
                        const weight = combineWeights[index] || 1;

                        return (
                          <div
                            key={pubKey}
                            className={clsx(
                              'flex items-center justify-between px-3 py-2 rounded-lg text-xs',
                              hasSigned
                                ? 'bg-green-500/10 border border-green-500/30'
                                : 'bg-yellow-500/5 border border-yellow-500/20'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-lg shrink-0">
                                {hasSigned ? '✅' : '⏳'}
                              </span>
                              <div className="min-w-0 flex-1">
                                {keystoreKey ? (
                                  <>
                                    <div className="font-medium text-foreground flex items-center gap-1.5">
                                      <span className="text-blue-400">🔑</span>
                                      {keystoreKey.alias || 'Unnamed Key'}
                                      <span className="text-xs text-tertiary">({keystoreKey.keyScheme})</span>
                                    </div>
                                    <div className="text-xs text-tertiary font-mono truncate">
                                      {truncateAddress(keystoreKey.suiAddress, 10)}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="font-medium text-foreground">External Signer</div>
                                    <div className="text-xs text-tertiary font-mono truncate">
                                      {pubKey.slice(0, 20)}...{pubKey.slice(-8)}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-xs text-tertiary">
                                weight: {weight}
                              </span>
                              <span className={clsx(
                                'text-xs font-medium px-1.5 py-0.5 rounded',
                                hasSigned
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-yellow-500/20 text-yellow-400'
                              )}>
                                {hasSigned ? 'Signed' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {collectedSignatures.length < combineThreshold && (
                      <p className="mt-3 text-xs text-tertiary text-center">
                        Need {combineThreshold - collectedSignatures.length} more signature(s) to meet threshold of {combineThreshold}
                      </p>
                    )}
                  </div>
                )}

                {/* Combine Button */}
                {!combinedSignature && (
                  <button
                    onClick={handleCombineSignatures}
                    disabled={combining || collectedSignatures.length < combineThreshold}
                    className="w-full px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {combining ? (
                      <>
                        <Spinner className="w-4 h-4" />
                        Combining Signatures...
                      </>
                    ) : (
                      <>🔗 Combine Signatures</>
                    )}
                  </button>
                )}

                {/* Combined Signature Result */}
                {combinedSignature && (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-purple-400">✓ Combined Multi-Sig Signature</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(combinedSignature); toast.success('Signature copied'); }}
                        className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded text-xs font-medium transition-colors"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground break-all p-2 bg-secondary rounded max-h-20 overflow-y-auto">
                      {combinedSignature}
                    </div>
                  </div>
                )}

                {/* Execute Button */}
                {combinedSignature && !executionResult && (
                  <button
                    onClick={handleExecuteTransaction}
                    disabled={executing}
                    className="w-full px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {executing ? (
                      <>
                        <Spinner className="w-4 h-4" />
                        Executing Transaction...
                      </>
                    ) : (
                      <>🚀 Execute Transaction</>
                    )}
                  </button>
                )}

                {/* Execution Result */}
                {executionResult && (
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">🎉</span>
                      <span className="text-lg font-medium text-green-400">Transaction Executed!</span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between p-2 bg-secondary rounded">
                        <span className="text-tertiary">Digest:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-foreground">{truncateAddress(executionResult.digest, 8)}</span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(executionResult.digest); toast.success('Digest copied'); }}
                            className="p-1 hover:bg-accent/10 text-tertiary hover:text-accent rounded transition-colors"
                          >
                            📋
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-secondary rounded">
                        <span className="text-tertiary">Status:</span>
                        <span className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          executionResult.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        )}>
                          {executionResult.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-secondary rounded">
                        <span className="text-tertiary">Gas Used:</span>
                        <span className="text-foreground">{executionResult.gasUsed} MIST</span>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <a
                        href={`https://suiscan.xyz/testnet/tx/${executionResult.digest}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-2 bg-card/50 hover:bg-card/70 text-foreground rounded-lg text-sm font-medium transition-colors text-center"
                      >
                        View on Explorer ↗
                      </a>
                      <button
                        onClick={() => {
                          setExecuteStep('build');
                          setBuiltTxBytes('');
                          setBuildDescription('');
                          setCollectedSignatures([]);
                          setCombinedSignature('');
                          setExecutionResult(null);
                          setSelectedPendingTx(null);
                        }}
                        className="flex-1 px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-sm font-medium transition-colors"
                      >
                        New Transaction
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Decode Tab - IMPROVED */}
        {activeTab === 'decode' && (
          <div className="space-y-4">
            {/* Info Box */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-blue-400">ℹ️</span>
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-blue-400 mb-1">Decode & Verify Transactions</p>
                  <p>Inspect transaction bytes before signing. Optionally verify that a signature matches the transaction.</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Transaction Bytes (Base64)</label>
              <textarea
                value={txBytes}
                onChange={(e) => setTxBytes(e.target.value)}
                placeholder="Enter base64 encoded transaction bytes..."
                rows={4}
                className="w-full px-3 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 transition-colors font-mono"
              />
              <p className="mt-1 text-xs text-tertiary">
                Paste transaction bytes from{' '}
                <code className="px-1 py-0.5 bg-secondary rounded">sui client tx-block</code> or the Sign tab
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Signature (Optional - for verification)</label>
              <input
                type="text"
                value={decodeSignature}
                onChange={(e) => setDecodeSignature(e.target.value)}
                placeholder="Enter signature to verify against transaction..."
                className="w-full px-3 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 transition-colors font-mono"
              />
              <p className="mt-1 text-xs text-tertiary">If provided, verifies the signature was created for this transaction</p>
            </div>

            <button
              onClick={handleDecodeTransaction}
              disabled={decoding || !txBytes.trim()}
              className="w-full px-4 py-2.5 bg-accent hover:bg-accent-hover text-accent-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {decoding ? 'Decoding...' : 'Decode Transaction'}
            </button>

            {decodedResult && (
              <div className="p-4 bg-card/50 border border-border/30 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">📋 Decoded Result</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowRawJson(!showRawJson)}
                      className={clsx(
                        'px-2 py-1 text-xs rounded transition-colors',
                        showRawJson ? 'bg-accent text-accent-foreground' : 'bg-card/50 hover:bg-card/70 text-muted-foreground'
                      )}
                    >
                      {showRawJson ? 'Formatted' : 'Raw JSON'}
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(JSON.stringify(decodedResult.decoded, null, 2)); toast.success('Result copied'); }}
                      className="px-2 py-1 bg-card/50 hover:bg-card/70 text-muted-foreground text-xs rounded transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      Copy
                    </button>
                  </div>
                </div>

                {decodedResult.signatureValid !== undefined && (
                  <div className={clsx(
                    'mb-3 px-3 py-2 rounded text-xs font-medium flex items-center gap-2',
                    decodedResult.signatureValid ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  )}>
                    {decodedResult.signatureValid ? '✓ Signature Valid' : '✗ Signature Invalid'}
                  </div>
                )}

                {showRawJson ? (
                  <pre className="font-mono text-xs text-muted-foreground p-3 bg-card border border-border/30 rounded overflow-x-auto max-h-96">
                    {JSON.stringify(decodedResult.decoded, null, 2)}
                  </pre>
                ) : (
                  <div className="space-y-2 text-xs">
                    {typeof decodedResult.decoded === 'object' && decodedResult.decoded !== null ? (
                      Object.entries(decodedResult.decoded).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2 p-2 bg-card/50 rounded">
                          <span className="text-tertiary font-medium min-w-[100px]">{key}:</span>
                          <span className="text-foreground font-mono break-all">
                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <pre className="font-mono text-muted-foreground p-3 bg-card border border-border/30 rounded">
                        {String(decodedResult.decoded)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
