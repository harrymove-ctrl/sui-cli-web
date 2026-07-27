import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Code,
  Copy,
  Eye,
  FileText,
  Fuel,
  Layers,
  Lightbulb,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  executePreSignedTransaction,
  executePtb,
  getApiBaseUrl,
  PtbCommand,
  PtbOptions,
} from '@/api/client';
import { EventExplorer } from '@/components/EventExplorer';
import { GasAnalysis } from '@/components/GasAnalysis';
import { EnhancedReplaySummary } from '@/components/TransactionInspector/EnhancedReplaySummary';
import { GasBreakdown } from '@/components/TransactionInspector/GasBreakdown';
import { TransactionSummary } from '@/components/TransactionInspector/TransactionSummary';
import { Button } from '@/components/ui/button';
import { CopyForAiMenu } from '@/components/ui/copy-for-ai';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { analyzeTransaction } from '@/utils/transactionAnalyzer';

interface InspectResult {
  success: boolean;
  results?: any;
  events?: any[];
  effects?: any;
  error?: string;
}

interface ReplayResult {
  success: boolean;
  output: string;
  error?: string;
}

interface ExecuteSignedResult {
  success: boolean;
  digest?: string;
  effects?: any;
  events?: any[];
  error?: string;
}

interface PtbExecuteResult {
  success: boolean;
  digest?: string;
  output?: string;
  preview?: string;
  effects?: any;
  events?: any[];
  error?: string;
}

type ActiveOperation = 'inspect' | 'replay' | 'execute' | 'ptb' | 'idle';

export function TransactionBuilder() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const validTabs = ['inspect', 'replay', 'execute', 'ptb', 'gas', 'events'];
  const [activeTab, setActiveTab] = useState(() =>
    tabParam && validTabs.includes(tabParam) ? tabParam : 'inspect'
  );

  // Sync tab state when URL changes (e.g., from FileTree navigation)
  useEffect(() => {
    const newTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'inspect';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [tabParam]);

  // Handle tab change - update both state and URL
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'inspect') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', value);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const [inspectDigest, setInspectDigest] = useState('');
  const [replayDigest, setReplayDigest] = useState('');

  // Execute Signed TX state
  const [txBytes, setTxBytes] = useState('');
  const [signatures, setSignatures] = useState<string[]>(['']);

  // PTB state
  const [ptbCommands, setPtbCommands] = useState<PtbCommand[]>([
    { type: 'split-coins', args: ['gas', '[1000000]'] },
  ]);
  const [ptbGasBudget, setPtbGasBudget] = useState('');
  const [ptbDryRun, setPtbDryRun] = useState(false);
  const [ptbPreview, setPtbPreview] = useState(false);

  const [activeOperation, setActiveOperation] = useState<ActiveOperation>('idle');
  const [operationProgress, setOperationProgress] = useState(0);

  const [inspecting, setInspecting] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executingPtb, setExecutingPtb] = useState(false);

  const [inspectResult, setInspectResult] = useState<InspectResult | null>(null);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecuteSignedResult | null>(null);
  const [ptbResult, setPtbResult] = useState<PtbExecuteResult | null>(null);

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // Inspect transaction
  const handleInspect = async () => {
    if (!inspectDigest.trim()) {
      toast.error('Please enter transaction digest');
      return;
    }

    setInspecting(true);
    setInspectResult(null);
    setActiveOperation('inspect');
    setOperationProgress(33);

    try {
      const response = await fetch(`${getApiBaseUrl()}/inspector/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txDigest: inspectDigest.trim() }),
      });

      const data: {
        success: boolean;
        data?: any;
        error?: string;
        message?: string;
        details?: any;
      } = await response.json();
      setOperationProgress(66);

      if (data.success && data.data) {
        setInspectResult({
          success: true,
          results: data.data.results,
          events: data.data.events,
          effects: data.data.effects,
        });
        toast.success('Transaction inspected successfully!');
        setOperationProgress(100);
      } else {
        const errorMsg = data.error || 'Inspection failed';
        setInspectResult({ success: false, error: errorMsg });
        toast.error(errorMsg);
        setOperationProgress(0);
      }
    } catch (error: any) {
      const msg = error.message || String(error);
      setInspectResult({ success: false, error: 'Connection error: ' + msg });
      toast.error('Inspection failed: ' + msg);
      setOperationProgress(0);
    } finally {
      setInspecting(false);
      setActiveOperation('idle');
    }
  };

  // Replay transaction
  const handleReplay = async () => {
    if (!replayDigest.trim()) {
      toast.error('Please enter transaction digest');
      return;
    }

    setReplaying(true);
    setReplayResult(null);
    setActiveOperation('replay');
    setOperationProgress(33);

    try {
      const response = await fetch(`${getApiBaseUrl()}/inspector/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txDigest: replayDigest.trim() }),
      });

      const data: {
        success: boolean;
        data?: { output: string };
        error?: string;
        message?: string;
        details?: any;
      } = await response.json();
      setOperationProgress(66);

      if (data.success && data.data) {
        setReplayResult({ success: true, output: data.data.output });
        toast.success('Transaction replayed successfully!');
        setOperationProgress(100);
      } else {
        const errorMsg = data.error || 'Replay failed';
        setReplayResult({
          success: false,
          output: '',
          error: errorMsg,
        });
        toast.error(errorMsg);
        setOperationProgress(0);
      }
    } catch (error: any) {
      const msg = error.message || String(error);
      setReplayResult({ success: false, output: '', error: 'Connection error: ' + msg });
      toast.error('Replay failed: ' + msg);
      setOperationProgress(0);
    } finally {
      setReplaying(false);
      setActiveOperation('idle');
    }
  };

  // Execute pre-signed transaction
  const handleExecuteSigned = async () => {
    if (!txBytes.trim()) {
      toast.error('Please enter transaction bytes');
      return;
    }

    const validSignatures = signatures.filter((s) => s.trim());
    if (validSignatures.length === 0) {
      toast.error('Please enter at least one signature');
      return;
    }

    setExecuting(true);
    setExecuteResult(null);
    setActiveOperation('execute');
    setOperationProgress(33);

    try {
      const result = await executePreSignedTransaction(txBytes.trim(), validSignatures);
      setOperationProgress(100);
      setExecuteResult({ success: true, ...result });
      toast.success('Transaction executed successfully!');
    } catch (error: any) {
      const msg = error.message || String(error);
      setExecuteResult({ success: false, error: msg });
      toast.error('Execution failed: ' + msg);
      setOperationProgress(0);
    } finally {
      setExecuting(false);
      setActiveOperation('idle');
    }
  };

  // Add signature input
  const addSignature = () => {
    setSignatures([...signatures, '']);
  };

  // Remove signature input
  const removeSignature = (index: number) => {
    if (signatures.length > 1) {
      setSignatures(signatures.filter((_, i) => i !== index));
    }
  };

  // Update signature at index
  const updateSignature = (index: number, value: string) => {
    const newSignatures = [...signatures];
    newSignatures[index] = value;
    setSignatures(newSignatures);
  };

  // Execute PTB
  const handleExecutePtb = async () => {
    if (ptbCommands.length === 0) {
      toast.error('Please add at least one command');
      return;
    }

    setExecutingPtb(true);
    setPtbResult(null);
    setActiveOperation('ptb');
    setOperationProgress(33);

    try {
      const options: PtbOptions = {};
      if (ptbGasBudget) options.gasBudget = parseInt(ptbGasBudget);
      if (ptbDryRun) options.dryRun = true;
      if (ptbPreview) options.preview = true;

      const result = await executePtb(ptbCommands, options);
      setOperationProgress(100);
      setPtbResult({ success: true, ...result });
      toast.success(
        ptbPreview
          ? 'PTB preview generated!'
          : ptbDryRun
            ? 'Dry run complete!'
            : 'PTB executed successfully!'
      );
    } catch (error: any) {
      const msg = error.message || String(error);
      setPtbResult({ success: false, error: msg });
      toast.error('PTB failed: ' + msg);
      setOperationProgress(0);
    } finally {
      setExecutingPtb(false);
      setActiveOperation('idle');
    }
  };

  // Add PTB command
  const addPtbCommand = () => {
    setPtbCommands([...ptbCommands, { type: 'move-call', args: [''] }]);
  };

  // Remove PTB command
  const removePtbCommand = (index: number) => {
    if (ptbCommands.length > 1) {
      setPtbCommands(ptbCommands.filter((_, i) => i !== index));
    }
  };

  // Update PTB command
  const updatePtbCommand = (index: number, field: 'type' | 'args', value: any) => {
    const newCommands = [...ptbCommands];
    if (field === 'type') {
      newCommands[index] = { ...newCommands[index], type: value };
    } else {
      newCommands[index] = { ...newCommands[index], args: value };
    }
    setPtbCommands(newCommands);
  };

  const isAnyLoading = inspecting || replaying || executing || executingPtb;

  // Per-tab "Copy for AI" export. The PTB tab is the highest-value case: a user
  // pasting "explain/debug this programmable transaction" wants the constructed
  // commands plus any dry-run/preview output. The gas and events tabs render
  // their own components (each with its own menu), so we hide this one there.
  const buildAiExport = (): { prompt: string; json?: string } | null => {
    if (activeTab === 'ptb') {
      const ptbJson = JSON.stringify(
        {
          commands: ptbCommands,
          options: {
            gasBudget: ptbGasBudget || 'auto',
            dryRun: ptbDryRun,
            preview: ptbPreview,
          },
          result: ptbResult ?? null,
        },
        null,
        2
      );
      const prompt = [
        `Explain and debug this Sui programmable transaction block (PTB).`,
        '',
        'Commands (executed atomically, in order):',
        ...ptbCommands.map((cmd, i) => `${i + 1}. ${cmd.type} ${cmd.args.join(' ')}`.trim()),
        '',
        `Gas budget: ${ptbGasBudget || 'auto'}${ptbDryRun ? ' | dry-run' : ''}${ptbPreview ? ' | preview-only' : ''}`,
        ptbResult
          ? `\nLatest ${ptbResult.preview ? 'preview' : ptbResult.output ? 'dry-run' : 'execution'} result:\n${
              ptbResult.error
                ? `ERROR: ${ptbResult.error}`
                : ptbResult.preview || ptbResult.output || `digest ${ptbResult.digest ?? ''}`
            }`
          : '',
        '',
        `Explain what each command does, how they compose, and flag anything that looks wrong or unsafe.`,
      ]
        .filter(Boolean)
        .join('\n');
      return { prompt, json: ptbJson };
    }

    if (activeTab === 'inspect' && inspectResult?.success) {
      return {
        prompt: [
          `Explain this Sui transaction I inspected (dry-run).`,
          '',
          `- Digest: ${inspectDigest.trim()}`,
          `- Events emitted: ${inspectResult.events?.length ?? 0}`,
          '',
          `Summarize what it does, its effects, and anything worth attention.`,
        ].join('\n'),
        json: JSON.stringify(
          {
            digest: inspectDigest.trim(),
            results: inspectResult.results,
            events: inspectResult.events,
            effects: inspectResult.effects,
          },
          null,
          2
        ),
      };
    }

    if (activeTab === 'replay' && replayResult?.success) {
      return {
        prompt: [
          `Explain this replayed Sui transaction and its execution trace.`,
          '',
          `- Digest: ${replayDigest.trim()}`,
          '',
          `Walk me through what happened during execution and highlight any issues.`,
        ].join('\n'),
        json: JSON.stringify({ digest: replayDigest.trim(), output: replayResult.output }, null, 2),
      };
    }

    if (activeTab === 'execute' && executeResult) {
      return {
        prompt: [
          `Explain the outcome of this pre-signed Sui transaction I executed.`,
          '',
          executeResult.digest ? `- Digest: ${executeResult.digest}` : '',
          `- Status: ${executeResult.success ? 'success' : 'failed'}`,
          executeResult.error ? `- Error: ${executeResult.error}` : '',
          '',
          `Explain what the transaction did or why it failed.`,
        ]
          .filter(Boolean)
          .join('\n'),
        json: JSON.stringify(executeResult, null, 2),
      };
    }

    return null;
  };

  const aiExport = buildAiExport();

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-[#4da2ff]" />
          <h1 className="text-lg font-bold text-foreground">Transaction Inspector</h1>
        </div>
        {aiExport && (
          <CopyForAiMenu prompt={aiExport.prompt} json={aiExport.json} onCopy={copyToClipboard} />
        )}
      </motion.div>

      {/* Operation Progress */}
      <AnimatePresence mode="wait">
        {isAnyLoading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-border rounded-lg p-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">
                  {activeOperation === 'inspect' && 'Inspecting transaction...'}
                  {activeOperation === 'replay' && 'Replaying transaction...'}
                </span>
                <span className="text-muted-foreground">{operationProgress}%</span>
              </div>
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#4da2ff] to-[#4da2ff]/70"
                  initial={{ width: 0 }}
                  animate={{ width: `${operationProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          {/* Custom Tab List */}
          <TabsList fullWidth indicatorClassName="bg-[#4da2ff]">
            <TabsTrigger value="inspect" icon={<Eye />} className="flex-1">
              Inspect
            </TabsTrigger>
            <TabsTrigger value="replay" icon={<Play />} className="flex-1">
              Replay
            </TabsTrigger>
            <TabsTrigger value="execute" icon={<Send />} className="flex-1">
              Execute
            </TabsTrigger>
            <TabsTrigger value="ptb" icon={<Layers />} className="flex-1">
              PTB
            </TabsTrigger>
            <TabsTrigger value="gas" icon={<Fuel />} className="flex-1">
              Gas
            </TabsTrigger>
            <TabsTrigger value="events" icon={<Activity />} className="flex-1">
              Events
            </TabsTrigger>
          </TabsList>
          <p className="px-1 pt-1.5 text-xs text-muted-foreground">
            {activeTab === 'inspect' && 'Dry-run a transaction before sending it'}
            {activeTab === 'replay' && 'Re-execute a past transaction from its digest'}
            {activeTab === 'execute' && 'Build and submit a transaction'}
            {activeTab === 'ptb' && 'Compose a multi-step programmable transaction block'}
            {activeTab === 'gas' && 'Estimate and analyze gas costs'}
            {activeTab === 'events' && 'Query on-chain events by type or package'}
          </p>

          {/* Inspect Tab */}
          <TabsContent value="inspect" className="space-y-4 mt-0">
            {/* Input Card */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-foreground text-sm font-medium">
                <Code className="w-4 h-4" />
                <span>Inspect Transaction Block</span>
              </div>

              <p className="text-xs text-muted-foreground">
                View detailed information about an executed transaction
              </p>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  Transaction Digest <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={inspectDigest}
                  onChange={(e) => setInspectDigest(e.target.value)}
                  placeholder="e.g., Gma9Re9HDNKEaAK9JPXDFZ6YyoepKjH3pGC8ASWGytf3"
                  disabled={isAnyLoading}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:border-[#4da2ff] font-mono text-xs disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Enter transaction digest (base58 from Sui Explorer)
                </p>
              </div>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  onClick={handleInspect}
                  disabled={!inspectDigest.trim() || inspecting || isAnyLoading}
                  className="w-full"
                >
                  {inspecting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Inspecting...
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      Inspect Transaction
                    </>
                  )}
                </Button>
              </motion.div>

              {/* Loading Skeleton */}
              {inspecting && !inspectResult && (
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-20 w-full" />
                </div>
              )}
            </div>

            {/* Inspect Result */}
            <AnimatePresence mode="wait">
              {inspectResult && (
                <motion.div
                  key="inspect-result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {inspectResult.success ? (
                    <>
                      {/* Success Header */}
                      <div className="bg-card border border-success/30 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          <span className="text-success text-sm">Inspection Complete</span>
                        </div>
                      </div>

                      {/* Transaction Summary & Gas Breakdown */}
                      <div className="space-y-4">
                        <TransactionSummary txData={inspectResult.results} digest={inspectDigest} />
                        <GasBreakdown gasUsed={analyzeTransaction(inspectResult.results).gasUsed} />
                      </div>

                      {/* Raw Data Tabs */}
                      <div className="bg-card border border-border rounded-lg p-4">
                        <Tabs defaultValue="results" className="w-full">
                          <TabsList className="flex gap-1 p-1 bg-secondary rounded-md mb-3 h-auto">
                            <TabsTrigger
                              value="results"
                              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded transition-all data-[state=active]:bg-[#4da2ff]/20 data-[state=active]:text-[#4da2ff] data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent"
                            >
                              <FileText className="w-3 h-3" />
                              Raw Data
                            </TabsTrigger>
                            <TabsTrigger
                              value="events"
                              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded transition-all data-[state=active]:bg-[#4da2ff]/20 data-[state=active]:text-[#4da2ff] data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent"
                            >
                              <Zap className="w-3 h-3" />
                              Events ({inspectResult.events?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger
                              value="effects"
                              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded transition-all data-[state=active]:bg-[#4da2ff]/20 data-[state=active]:text-[#4da2ff] data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent"
                            >
                              <Layers className="w-3 h-3" />
                              Effects
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="results" className="mt-0">
                            {inspectResult.results ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">
                                    Execution Results
                                  </span>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(
                                        JSON.stringify(inspectResult.results, null, 2),
                                        'Results'
                                      )
                                    }
                                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                  >
                                    <Copy className="w-3 h-3" />
                                    Copy
                                  </button>
                                </div>
                                <div className="bg-secondary border border-border rounded p-3 overflow-x-auto max-h-64 overflow-y-auto">
                                  <pre className="text-xs text-foreground font-mono whitespace-pre-wrap">
                                    {JSON.stringify(inspectResult.results, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <AlertCircle className="w-3 h-3" />
                                No execution results available
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="events" className="mt-0">
                            {inspectResult.events && inspectResult.events.length > 0 ? (
                              <div className="space-y-2">
                                <span className="text-xs text-muted-foreground">
                                  Transaction Events ({inspectResult.events.length})
                                </span>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {inspectResult.events.map((event: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="bg-secondary border border-border rounded p-3"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-foreground">
                                          Event #{idx + 1}
                                        </span>
                                        <button
                                          onClick={() =>
                                            copyToClipboard(JSON.stringify(event, null, 2), 'Event')
                                          }
                                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap overflow-x-auto">
                                        {JSON.stringify(event, null, 2)}
                                      </pre>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <AlertCircle className="w-3 h-3" />
                                No events emitted by this transaction
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="effects" className="mt-0">
                            {inspectResult.effects ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">
                                    Transaction Effects
                                  </span>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(
                                        JSON.stringify(inspectResult.effects, null, 2),
                                        'Effects'
                                      )
                                    }
                                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                                  >
                                    <Copy className="w-3 h-3" />
                                    Copy
                                  </button>
                                </div>
                                <div className="bg-secondary border border-border rounded p-3 overflow-x-auto max-h-64 overflow-y-auto">
                                  <pre className="text-xs text-foreground font-mono whitespace-pre-wrap">
                                    {JSON.stringify(inspectResult.effects, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <AlertCircle className="w-3 h-3" />
                                No effects data available
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>
                      </div>
                    </>
                  ) : (
                    /* Error Result */
                    <div className="bg-card border border-destructive/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-destructive text-sm mb-1">Inspection Failed</p>
                          <p className="text-destructive/70 text-xs">{inspectResult.error}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inspect Tips */}
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-[#4da2ff] flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-xs">
                  <p className="text-foreground">
                    <span className="text-muted-foreground">Use Case:</span> View detailed
                    information about executed transactions.
                  </p>
                  <div className="pt-2 border-t border-border">
                    <p className="text-muted-foreground mb-1">Try This Sample:</p>
                    <button
                      onClick={() =>
                        setInspectDigest('Gma9Re9HDNKEaAK9JPXDFZ6YyoepKjH3pGC8ASWGytf3')
                      }
                      className="font-mono text-[#4da2ff] bg-[#4da2ff]/10 px-2 py-1 rounded-md hover:bg-[#4da2ff]/20 transition-colors"
                    >
                      Gma9Re9HDNKEaAK9JPXDFZ6YyoepKjH3pGC8ASWGytf3
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Replay Tab */}
          <TabsContent value="replay" className="space-y-4 mt-0">
            {/* Input Card */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-foreground text-sm font-medium">
                <Play className="w-4 h-4" />
                <span>Replay On-Chain Transaction</span>
              </div>

              <p className="text-xs text-muted-foreground">
                Replay an executed transaction to debug execution flow
              </p>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  Transaction Digest <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={replayDigest}
                  onChange={(e) => setReplayDigest(e.target.value)}
                  placeholder="e.g., Gma9Re9HDNKEaAK9JPXDFZ6YyoepKjH3pGC8ASWGytf3"
                  disabled={isAnyLoading}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:border-[#4da2ff] font-mono text-xs disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Enter transaction digest (base58 from Sui Explorer)
                </p>
              </div>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  onClick={handleReplay}
                  disabled={!replayDigest.trim() || replaying || isAnyLoading}
                  className="w-full"
                >
                  {replaying ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Replaying...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Replay Transaction
                    </>
                  )}
                </Button>
              </motion.div>

              {/* Loading Skeleton */}
              {replaying && !replayResult && (
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-20 w-full" />
                </div>
              )}
            </div>

            {/* Replay Result */}
            <AnimatePresence mode="wait">
              {replayResult && (
                <motion.div
                  key="replay-result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {replayResult.success ? (
                    <>
                      {/* Success Header */}
                      <div className="bg-card border border-success/30 rounded-lg p-3 mb-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          <span className="text-success text-sm">Replay Complete</span>
                        </div>
                      </div>

                      {/* Enhanced Replay Summary */}
                      <EnhancedReplaySummary output={replayResult.output} digest={replayDigest} />
                    </>
                  ) : (
                    /* Error Result */
                    <div className="bg-card border border-destructive/30 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-destructive text-sm mb-1">Replay Failed</p>
                          <p className="text-destructive/70 text-xs">{replayResult.error}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Replay Tips */}
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-xs">
                  <p className="text-foreground">
                    <span className="text-muted-foreground">Use Case:</span> Debug already-executed
                    transactions with detailed execution trace.
                  </p>
                  <div className="pt-2 border-t border-border">
                    <p className="text-muted-foreground mb-1">Try This Sample:</p>
                    <button
                      onClick={() =>
                        setReplayDigest('Gma9Re9HDNKEaAK9JPXDFZ6YyoepKjH3pGC8ASWGytf3')
                      }
                      className="font-mono text-warning bg-warning/10 px-2 py-1 rounded-md hover:bg-warning/20 transition-colors"
                    >
                      Gma9Re9HDNKEaAK9JPXDFZ6YyoepKjH3pGC8ASWGytf3
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Execute Signed TX Tab */}
          <TabsContent value="execute" className="space-y-4 mt-0">
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-foreground text-sm font-medium">
                <Send className="w-4 h-4" />
                <span>Execute Pre-Signed Transaction</span>
              </div>

              <p className="text-xs text-muted-foreground">
                Execute a transaction that was signed externally (e.g., hardware wallet, multi-sig)
              </p>

              {/* TX Bytes Input */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  Transaction Bytes (Base64) <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={txBytes}
                  onChange={(e) => setTxBytes(e.target.value)}
                  placeholder="Base64-encoded serialized transaction..."
                  disabled={isAnyLoading}
                  rows={3}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:border-[#4da2ff] font-mono text-xs disabled:opacity-50 resize-none"
                />
              </div>

              {/* Signatures */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  Signatures (Base64) <span className="text-destructive">*</span>
                </label>
                {signatures.map((sig, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={sig}
                      onChange={(e) => updateSignature(idx, e.target.value)}
                      placeholder={`Signature ${idx + 1}...`}
                      disabled={isAnyLoading}
                      className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:border-[#4da2ff] font-mono text-xs disabled:opacity-50"
                    />
                    {signatures.length > 1 && (
                      <button
                        onClick={() => removeSignature(idx)}
                        disabled={isAnyLoading}
                        className="p-2 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addSignature}
                  disabled={isAnyLoading}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" />
                  Add another signature (for multi-sig)
                </button>
              </div>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  onClick={handleExecuteSigned}
                  disabled={
                    !txBytes.trim() ||
                    signatures.every((s) => !s.trim()) ||
                    executing ||
                    isAnyLoading
                  }
                  className="w-full"
                >
                  {executing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Execute Transaction
                    </>
                  )}
                </Button>
              </motion.div>

              {/* Execute Result */}
              <AnimatePresence mode="wait">
                {executeResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-3 rounded-lg border ${executeResult.success ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {executeResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <span
                        className={`text-sm ${executeResult.success ? 'text-success' : 'text-destructive'}`}
                      >
                        {executeResult.success ? 'Transaction Executed!' : 'Execution Failed'}
                      </span>
                    </div>
                    {executeResult.digest && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Digest:</span>
                        <code className="text-xs text-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">
                          {executeResult.digest}
                        </code>
                        <button
                          onClick={() => copyToClipboard(executeResult.digest!, 'Digest')}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {executeResult.error && (
                      <p className="text-xs text-destructive/80 mt-2">{executeResult.error}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </TabsContent>

          {/* PTB Tab */}
          <TabsContent value="ptb" className="space-y-4 mt-0">
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-foreground text-sm font-medium">
                <Layers className="w-4 h-4" />
                <span>Programmable Transaction Block (PTB)</span>
              </div>

              <p className="text-xs text-muted-foreground">
                Build and execute multiple operations in a single atomic transaction
              </p>

              {/* Commands */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Commands</label>
                {ptbCommands.map((cmd, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <select
                      value={cmd.type}
                      onChange={(e) => updatePtbCommand(idx, 'type', e.target.value)}
                      disabled={isAnyLoading}
                      className="px-2 py-1.5 bg-secondary border border-border rounded-lg text-foreground text-xs disabled:opacity-50"
                    >
                      <option value="split-coins">split-coins</option>
                      <option value="merge-coins">merge-coins</option>
                      <option value="transfer-objects">transfer-objects</option>
                      <option value="move-call">move-call</option>
                      <option value="assign">assign</option>
                      <option value="make-move-vec">make-move-vec</option>
                    </select>
                    <input
                      type="text"
                      value={cmd.args.join(' ')}
                      onChange={(e) => updatePtbCommand(idx, 'args', e.target.value.split(' '))}
                      placeholder="Arguments (space separated)..."
                      disabled={isAnyLoading}
                      className="flex-1 px-3 py-1.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:border-[#4da2ff] font-mono text-xs disabled:opacity-50"
                    />
                    {ptbCommands.length > 1 && (
                      <button
                        onClick={() => removePtbCommand(idx)}
                        disabled={isAnyLoading}
                        className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addPtbCommand}
                  disabled={isAnyLoading}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" />
                  Add command
                </button>
              </div>

              {/* Options */}
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <label className="text-muted-foreground">Gas Budget:</label>
                  <input
                    type="text"
                    value={ptbGasBudget}
                    onChange={(e) => setPtbGasBudget(e.target.value)}
                    placeholder="auto"
                    disabled={isAnyLoading}
                    className="w-24 px-2 py-1 bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary text-xs disabled:opacity-50"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ptbDryRun}
                    onChange={(e) => {
                      setPtbDryRun(e.target.checked);
                      if (e.target.checked) setPtbPreview(false);
                    }}
                    disabled={isAnyLoading}
                    className="rounded border-border"
                  />
                  Dry Run
                </label>
                <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ptbPreview}
                    onChange={(e) => {
                      setPtbPreview(e.target.checked);
                      if (e.target.checked) setPtbDryRun(false);
                    }}
                    disabled={isAnyLoading}
                    className="rounded border-border"
                  />
                  Preview Only
                </label>
              </div>

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  onClick={handleExecutePtb}
                  disabled={ptbCommands.length === 0 || executingPtb || isAnyLoading}
                  className="w-full"
                >
                  {executingPtb ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      {ptbPreview
                        ? 'Generating Preview...'
                        : ptbDryRun
                          ? 'Running Dry Run...'
                          : 'Executing PTB...'}
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      {ptbPreview ? 'Preview PTB' : ptbDryRun ? 'Dry Run PTB' : 'Execute PTB'}
                    </>
                  )}
                </Button>
              </motion.div>

              {/* PTB Result */}
              <AnimatePresence mode="wait">
                {ptbResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-3 rounded-lg border ${ptbResult.success ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {ptbResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <span
                        className={`text-sm ${ptbResult.success ? 'text-success' : 'text-destructive'}`}
                      >
                        {ptbResult.success
                          ? ptbResult.preview
                            ? 'Preview Generated'
                            : ptbResult.output
                              ? 'Dry Run Complete'
                              : 'PTB Executed!'
                          : 'PTB Failed'}
                      </span>
                    </div>
                    {ptbResult.digest && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-muted-foreground">Digest:</span>
                        <code className="text-xs text-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">
                          {ptbResult.digest}
                        </code>
                        <button
                          onClick={() => copyToClipboard(ptbResult.digest!, 'Digest')}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {(ptbResult.preview || ptbResult.output) && (
                      <pre className="text-xs text-foreground font-mono bg-secondary p-2 rounded overflow-x-auto max-h-40 overflow-y-auto">
                        {ptbResult.preview || ptbResult.output}
                      </pre>
                    )}
                    {ptbResult.error && (
                      <p className="text-xs text-destructive/80 mt-2">{ptbResult.error}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Help */}
              <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                <p>
                  <span className="text-foreground">split-coins:</span> gas [1000, 5000] - Split gas
                  coin
                </p>
                <p>
                  <span className="text-foreground">transfer-objects:</span> [obj1, obj2] @address -
                  Transfer objects
                </p>
                <p>
                  <span className="text-foreground">move-call:</span> pkg::module::func &lt;T&gt;
                  arg1 arg2 - Call function
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Gas Analysis Tab */}
          <TabsContent value="gas" className="space-y-4 mt-0">
            <GasAnalysis />
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-4 mt-0">
            <EventExplorer />
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Overview Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-lg p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#4da2ff]" />
          <span className="text-foreground text-sm font-medium">Inspector Overview</span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="text-muted-foreground">
            <span className="text-foreground">Inspect vs Replay:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
            <div className="flex gap-2">
              <Eye className="w-3 h-3 text-[#4da2ff] flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground">
                <span className="text-foreground">Inspect:</span> View executed transaction data
              </span>
            </div>
            <div className="flex gap-2">
              <Play className="w-3 h-3 text-success flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground">
                <span className="text-foreground">Replay:</span> Debug with execution trace
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <span className="text-muted-foreground">
              Both operations are read-only and safe. No gas fees or state changes.
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
