import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  FileSearch,
  Binary,
  Unlock,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FolderOpen,
  Copy,
  Activity,
  Info,
  ChevronDown,
  Lightbulb,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { FileBrowser } from '@/components/MoveDeploy/FileBrowser';
import { verifySource, verifyBytecode, decodeTransaction } from '@/api/client';

// Simplified warning for user-friendly display
interface SimplifiedWarning {
  id: string;
  title: string;
  description: string;
  suggestion: string;
  location?: string;
  rawOutput: string;
}

// Map warning codes to user-friendly explanations
const WARNING_EXPLANATIONS: Record<string, { title: string; description: string; suggestion: string }> = {
  'W99001': {
    title: 'Better return pattern available',
    description: 'Your function sends an object directly to the caller. This works, but returning the object instead makes your code more flexible.',
    suggestion: 'Consider using "public fun" that returns the object, so callers can decide what to do with it.',
  },
  'W09001': {
    title: 'Unused variable',
    description: 'You declared a variable but never used it.',
    suggestion: 'Remove the variable or prefix with underscore (_) if intentional.',
  },
  'W09002': {
    title: 'Unused import',
    description: 'You imported something but never used it.',
    suggestion: 'Remove the unused import to keep code clean.',
  },
  'W09003': {
    title: 'Unused function',
    description: 'You defined a function but it\'s never called.',
    suggestion: 'Remove if not needed, or add "public" if it should be accessible.',
  },
};

// Parse raw warning into simplified format
function parseWarningToSimplified(rawWarning: string): SimplifiedWarning {
  // Note: Sui CLI uses "Lint" (capital L) in output
  const codeMatch = rawWarning.match(/warning\[(?:[Ll]int\s+)?(W\d+)\]:/);
  const warningCode = codeMatch ? codeMatch[1] : 'unknown';
  const locationMatch = rawWarning.match(/┌─\s+([^:]+):(\d+):\d+/);
  const location = locationMatch ? `${locationMatch[1].split('/').pop()}:${locationMatch[2]}` : undefined;

  const explanation = WARNING_EXPLANATIONS[warningCode] || {
    title: 'Code suggestion',
    description: 'The compiler found something that could be improved.',
    suggestion: 'Review the details below if you want to address this.',
  };

  return {
    id: warningCode,
    title: explanation.title,
    description: explanation.description,
    suggestion: explanation.suggestion,
    location,
    rawOutput: rawWarning,
  };
}

// Helper to parse CLI output and separate warnings from actual content
interface ParsedOutput {
  hasWarnings: boolean;
  warnings: SimplifiedWarning[];
  content: string;
}

function parseCliWarnings(output: string): ParsedOutput {
  // Pre-process: Remove "Error: " prefix if followed by warning (API wraps warnings in error response)
  let processedOutput = output;
  if (processedOutput.startsWith('Error: warning[')) {
    processedOutput = processedOutput.substring(7); // Remove "Error: "
  }

  const lines = processedOutput.split('\n');
  const rawWarnings: string[] = [];
  const contentLines: string[] = [];

  let inWarningBlock = false;
  let currentWarning = '';

  // Helper to check if line is part of warning block
  const isWarningContinuation = (line: string): boolean => {
    const boxChars = /^[\s┌─│└├╭╮╯╰]/;
    return boxChars.test(line) ||
           line.startsWith('   ') ||
           line.startsWith(' ') ||
           line.startsWith('=') ||
           line.includes('This warning can be suppressed') ||
           line.includes('Returning an object') ||
           line.includes('Transaction sender') ||
           line.includes('Transfer of an object') ||
           line.includes('^^^^') ||
           line.trim() === '';
  };

  for (const line of lines) {
    // Detect warning start - Note: Sui CLI uses "Lint" (capital L)
    if (/^warning\[(?:[Ll]int\s+)?W\d+\]:/.test(line)) {
      if (currentWarning) {
        rawWarnings.push(currentWarning.trim());
      }
      inWarningBlock = true;
      currentWarning = line;
    }
    // Continue warning block
    else if (inWarningBlock && isWarningContinuation(line)) {
      currentWarning += '\n' + line;
    }
    // Normal content
    else {
      if (inWarningBlock && currentWarning) {
        rawWarnings.push(currentWarning.trim());
        currentWarning = '';
      }
      inWarningBlock = false;
      contentLines.push(line);
    }
  }

  if (currentWarning) {
    rawWarnings.push(currentWarning.trim());
  }

  return {
    hasWarnings: rawWarnings.length > 0,
    warnings: rawWarnings.map(parseWarningToSimplified),
    content: contentLines.join('\n').trim(),
  };
}

interface VerifySourceResult {
  verified: boolean;
  output: string;
  packagePath: string;
}

interface VerifyBytecodeResult {
  output: string;
  withinLimits: boolean;
  meterUsage?: { current: number; limit: number };
}

interface DecodeTransactionResult {
  decoded: any;
  signatureValid?: boolean;
}

export function SecurityTools() {
  // URL params for tab switching
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const validTabs = ['source', 'bytecode', 'decode'];
  const [activeTab, setActiveTab] = useState(() =>
    tabParam && validTabs.includes(tabParam) ? tabParam : 'source'
  );

  // Sync tab state when URL changes (e.g., from FileTree navigation)
  useEffect(() => {
    const newTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'source';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [tabParam]);

  // Sync URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'source') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    setSearchParams(searchParams, { replace: true });
  };

  // Source Verification State
  const [packagePath, setPackagePath] = useState('');
  const [verifyDeps, setVerifyDeps] = useState(false);
  const [skipSource, setSkipSource] = useState(false);
  const [verifyingSource, setVerifyingSource] = useState(false);
  const [sourceResult, setSourceResult] = useState<VerifySourceResult | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);

  // Bytecode Verification State
  const [bytecodePackagePath, setBytecodePackagePath] = useState('');
  const [modulePaths, setModulePaths] = useState('');
  const [protocolVersion, setProtocolVersion] = useState('');
  const [verifyingBytecode, setVerifyingBytecode] = useState(false);
  const [bytecodeResult, setBytecodeResult] = useState<VerifyBytecodeResult | null>(null);
  const [showBytecodeBrowser, setShowBytecodeBrowser] = useState(false);

  // Transaction Decoding State
  const [txBytes, setTxBytes] = useState('');
  const [signature, setSignature] = useState('');
  const [decodingTx, setDecodingTx] = useState(false);
  const [txResult, setTxResult] = useState<DecodeTransactionResult | null>(null);

  // Handle Source Verification
  const handleVerifySource = async () => {
    if (!packagePath.trim()) {
      toast.error('Please select a package path');
      return;
    }

    setVerifyingSource(true);
    setSourceResult(null);

    try {
      const data = await verifySource(packagePath.trim(), verifyDeps, skipSource);
      setSourceResult(data);
      if (data.verified) {
        toast.success('Source verification successful!');
      } else {
        toast.error('Source verification failed');
      }
    } catch (error: any) {
      const msg = error.message || String(error);
      setSourceResult({ verified: false, output: msg, packagePath: packagePath.trim() });
      toast.error('Verification failed: ' + msg);
    } finally {
      setVerifyingSource(false);
    }
  };

  // Handle Bytecode Verification
  const handleVerifyBytecode = async () => {
    if (!bytecodePackagePath.trim() && !modulePaths.trim()) {
      toast.error('Please provide a package path or module paths');
      return;
    }

    setVerifyingBytecode(true);
    setBytecodeResult(null);

    try {
      const modulePathsArray = modulePaths.trim() ? modulePaths.trim().split(',').map(p => p.trim()) : undefined;
      const protocolVer = protocolVersion.trim() ? parseInt(protocolVersion.trim(), 10) : undefined;

      const data = await verifyBytecode(
        bytecodePackagePath.trim() || undefined,
        modulePathsArray,
        protocolVer
      );
      setBytecodeResult(data);
      if (data.withinLimits) {
        toast.success('Bytecode within meter limits!');
      } else {
        toast.error('Bytecode exceeds meter limits');
      }
    } catch (error: any) {
      const msg = error.message || String(error);
      setBytecodeResult({ output: msg, withinLimits: false });
      toast.error('Verification failed: ' + msg);
    } finally {
      setVerifyingBytecode(false);
    }
  };

  // Handle Transaction Decoding
  const handleDecodeTx = async () => {
    if (!txBytes.trim()) {
      toast.error('Please provide transaction bytes');
      return;
    }

    setDecodingTx(true);
    setTxResult(null);

    try {
      const data = await decodeTransaction(txBytes.trim(), signature.trim() || undefined);
      setTxResult(data);
      toast.success('Transaction decoded successfully!');
    } catch (error: any) {
      const msg = error.message || String(error);
      toast.error('Decoding failed: ' + msg);
    } finally {
      setDecodingTx(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <>
      <div className="relative z-10 p-3 sm:p-4">
        <div className="relative max-w-[1600px] mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative z-10 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              <h1 className="text-lg font-bold text-foreground">Security Tools</h1>
            </div>
            <p className="text-muted-foreground text-xs hidden sm:block">
              Verify • Audit • Decode
            </p>
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
          >
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-secondary border border-border h-9">
                <TabsTrigger value="source" className="flex items-center justify-center gap-1.5 text-xs data-[state=active]:bg-accent data-[state=active]:text-foreground text-muted-foreground hover:text-foreground h-8">
                  <FileSearch className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">Verify Source</span>
                </TabsTrigger>
                <TabsTrigger value="bytecode" className="flex items-center justify-center gap-1.5 text-xs data-[state=active]:bg-accent data-[state=active]:text-foreground text-muted-foreground hover:text-foreground h-8">
                  <Binary className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">Verify Bytecode</span>
                </TabsTrigger>
                <TabsTrigger value="decode" className="flex items-center justify-center gap-1.5 text-xs data-[state=active]:bg-accent data-[state=active]:text-foreground text-muted-foreground hover:text-foreground h-8">
                  <Unlock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">Decode TX</span>
                </TabsTrigger>
              </TabsList>

              {/* Verify Source Tab */}
              <TabsContent value="source" className="space-y-4 mt-4">
                {/* Prerequisite Info */}
                <div className="p-3 bg-accent/40 border border-border rounded-lg text-xs">
                  <p className="text-foreground flex items-center gap-1.5 mb-1">
                    <Info className="w-3.5 h-3.5" />
                    Prerequisite: Package must be published on-chain first
                  </p>
                  <p className="text-muted-foreground pl-5">
                    This verifies that your local source code matches the bytecode deployed on the current network.
                  </p>
                </div>

                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Source Verification
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Verify on-chain bytecode matches local source
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* Package Path */}
                    <div className="space-y-1">
                      <Label htmlFor="source-package-path" className="text-xs font-medium flex items-center gap-1 text-foreground">
                        Package Path <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex gap-1.5">
                        <input
                          id="source-package-path"
                          type="text"
                          value={packagePath}
                          onChange={(e) => setPackagePath(e.target.value)}
                          placeholder="/path/to/move/package"
                          className="flex-1 px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-all text-xs"
                          disabled={verifyingSource}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowBrowser(true)}
                          disabled={verifyingSource}
                          title="Browse"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-foreground">Options</Label>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={verifyDeps}
                            onChange={(e) => setVerifyDeps(e.target.checked)}
                            disabled={verifyingSource}
                            className="w-3.5 h-3.5 text-foreground bg-secondary border-border rounded focus:ring-1 focus:ring-ring"
                          />
                          <span className="text-[11px] text-muted-foreground">Verify dependencies</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={skipSource}
                            onChange={(e) => setSkipSource(e.target.checked)}
                            disabled={verifyingSource}
                            className="w-3.5 h-3.5 text-foreground bg-secondary border-border rounded focus:ring-1 focus:ring-ring"
                          />
                          <span className="text-[11px] text-muted-foreground">Skip source verification</span>
                        </label>
                      </div>
                    </div>

                    {/* Verify Button */}
                    <Button
                      onClick={handleVerifySource}
                      disabled={!packagePath.trim() || verifyingSource}
                      className="w-full"
                    >
                      {verifyingSource ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          Verify Source
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Source Result */}
                <AnimatePresence mode="wait">
                  {sourceResult && (() => {
                    const parsed = parseCliWarnings(sourceResult.output);
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-3"
                      >
                        {/* User-friendly Lint Warnings */}
                        {parsed.hasWarnings && (
                          <div className="space-y-2 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                            {/* Simple header */}
                            <div className="flex items-center gap-2">
                              <Lightbulb className="w-4 h-4 text-amber-500" />
                              <span className="text-sm font-medium text-amber-500">
                                {parsed.warnings.length} code suggestion{parsed.warnings.length > 1 ? 's' : ''} found
                              </span>
                              <span className="text-xs text-muted-foreground ml-auto">
                                Not verification errors
                              </span>
                            </div>

                            {/* Simple warning cards */}
                            <div className="space-y-2">
                              {parsed.warnings.map((warning, idx) => (
                                <div
                                  key={idx}
                                  className="p-2.5 bg-card border border-amber-500/10 rounded-lg"
                                >
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <span className="text-xs font-medium text-amber-500">
                                      {warning.title}
                                    </span>
                                    {warning.location && (
                                      <span className="text-xs text-amber-500/70 font-mono whitespace-nowrap">
                                        {warning.location}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mb-1.5">
                                    {warning.description}
                                  </p>
                                  <p className="text-[11px] text-emerald-500/90 flex items-start gap-1">
                                    <span className="text-emerald-500">→</span>
                                    {warning.suggestion}
                                  </p>
                                  <details className="mt-1.5">
                                    <summary className="text-xs text-amber-500/60 cursor-pointer hover:text-amber-500 flex items-center gap-1">
                                      <ChevronDown className="w-2.5 h-2.5" />
                                      Show compiler output
                                    </summary>
                                    <pre className="mt-1.5 p-1.5 bg-secondary rounded text-xs text-amber-500/70 font-mono overflow-x-auto whitespace-pre-wrap max-h-24 overflow-y-auto">
                                      {warning.rawOutput}
                                    </pre>
                                  </details>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Verification Result */}
                        <Card className={`bg-card border shadow-sm ${sourceResult.verified ? 'border-emerald-500/40' : 'border-destructive/40'}`}>
                          <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm flex items-center gap-1.5">
                              {sourceResult.verified ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  <span className="text-emerald-500">Verification Successful</span>
                                  {parsed.hasWarnings && (
                                    <span className="text-xs text-amber-500 ml-1">(with lint warnings)</span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4 text-destructive" />
                                  <span className="text-destructive">Verification Failed</span>
                                </>
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="px-4 pb-4 space-y-3">
                            {/* Helpful message for failed verification */}
                            {!sourceResult.verified && (
                              <div className="p-3 bg-destructive/5 border border-destructive/30 rounded-lg text-xs">
                                <p className="text-destructive flex items-center gap-1.5 mb-1">
                                  <AlertCircle className="w-3 h-3" />
                                  Common reasons for verification failure:
                                </p>
                                <ul className="text-destructive/80 pl-5 space-y-0.5 list-disc text-xs">
                                  <li>Package not yet published on current network</li>
                                  <li>Local source differs from deployed bytecode</li>
                                  <li>Wrong network (check active environment)</li>
                                  <li>Package ID mismatch in Move.toml</li>
                                </ul>
                              </div>
                            )}

                            {/* Output */}
                            <div className="bg-secondary border border-border rounded-lg p-2 max-h-64 overflow-y-auto">
                              <pre className={`text-xs font-mono whitespace-pre-wrap break-all ${sourceResult.verified ? 'text-emerald-500' : 'text-destructive'}`}>
                                {parsed.content || sourceResult.output}
                              </pre>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </TabsContent>

              {/* Verify Bytecode Tab */}
              <TabsContent value="bytecode" className="space-y-4 mt-4">
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                      <Binary className="w-3.5 h-3.5 text-emerald-500" />
                      Bytecode Verification
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Check bytecode meter limits and validity
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* Package Path */}
                    <div className="space-y-1">
                      <Label htmlFor="bytecode-package-path" className="text-xs font-medium text-foreground">
                        Package Path
                      </Label>
                      <div className="flex gap-1.5">
                        <input
                          id="bytecode-package-path"
                          type="text"
                          value={bytecodePackagePath}
                          onChange={(e) => setBytecodePackagePath(e.target.value)}
                          placeholder="/path/to/move/package"
                          className="flex-1 px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-ring text-xs"
                          disabled={verifyingBytecode}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowBytecodeBrowser(true)}
                          disabled={verifyingBytecode}
                          title="Browse"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Module Paths */}
                    <div className="space-y-1">
                      <Label htmlFor="module-paths" className="text-xs font-medium text-foreground">
                        Module Paths (comma-separated)
                      </Label>
                      <input
                        id="module-paths"
                        type="text"
                        value={modulePaths}
                        onChange={(e) => setModulePaths(e.target.value)}
                        placeholder="/path/to/module1.mv,/path/to/module2.mv"
                        className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-ring text-xs"
                        disabled={verifyingBytecode}
                      />
                    </div>

                    {/* Protocol Version */}
                    <div className="space-y-1">
                      <Label htmlFor="protocol-version" className="text-xs font-medium text-foreground">
                        Protocol Version (optional)
                      </Label>
                      <input
                        id="protocol-version"
                        type="text"
                        value={protocolVersion}
                        onChange={(e) => setProtocolVersion(e.target.value)}
                        placeholder="e.g., 1"
                        className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-ring text-xs"
                        disabled={verifyingBytecode}
                      />
                    </div>

                    {/* Verify Button */}
                    <Button
                      onClick={handleVerifyBytecode}
                      disabled={(!bytecodePackagePath.trim() && !modulePaths.trim()) || verifyingBytecode}
                      className="w-full"
                    >
                      {verifyingBytecode ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <Binary className="w-4 h-4" />
                          Verify Bytecode
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Bytecode Result */}
                <AnimatePresence mode="wait">
                  {bytecodeResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Card className={`bg-card border shadow-sm ${bytecodeResult.withinLimits ? 'border-emerald-500/40' : 'border-destructive/40'}`}>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm flex items-center gap-1.5">
                            {bytecodeResult.withinLimits ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span className="text-emerald-500">Within Limits</span>
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="w-4 h-4 text-destructive" />
                                <span className="text-destructive">Exceeds Limits</span>
                              </>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-3">
                          {/* Meter Usage */}
                          {bytecodeResult.meterUsage && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-foreground">Meter Usage</span>
                                <Badge variant={bytecodeResult.withinLimits ? 'secondary' : 'destructive'} className="text-xs">
                                  {bytecodeResult.meterUsage.current} / {bytecodeResult.meterUsage.limit}
                                </Badge>
                              </div>
                              {/* Progress Bar */}
                              <div className="w-full bg-secondary border border-border rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full transition-all ${bytecodeResult.withinLimits ? 'bg-emerald-500' : 'bg-destructive'}`}
                                  style={{
                                    width: `${Math.min((bytecodeResult.meterUsage.current / bytecodeResult.meterUsage.limit) * 100, 100)}%`
                                  }}
                                />
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Activity className="w-2.5 h-2.5" />
                                {Math.round((bytecodeResult.meterUsage.current / bytecodeResult.meterUsage.limit) * 100)}% used
                              </div>
                            </div>
                          )}

                          {/* Output */}
                          <div className="bg-secondary border border-border rounded-lg p-2 max-h-64 overflow-y-auto">
                            <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-all">
                              {bytecodeResult.output}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </TabsContent>

              {/* Decode Transaction Tab */}
              <TabsContent value="decode" className="space-y-4 mt-4">
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                      <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                      Transaction Decoder
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Decode and verify transaction bytes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* Transaction Bytes */}
                    <div className="space-y-1">
                      <Label htmlFor="tx-bytes" className="text-xs font-medium flex items-center gap-1 text-foreground">
                        Transaction Bytes <span className="text-destructive">*</span>
                      </Label>
                      <textarea
                        id="tx-bytes"
                        value={txBytes}
                        onChange={(e) => setTxBytes(e.target.value)}
                        placeholder="Paste base64-encoded transaction bytes here..."
                        className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-ring text-xs font-mono min-h-[80px] resize-y"
                        disabled={decodingTx}
                      />
                    </div>

                    {/* Signature (Optional) */}
                    <div className="space-y-1">
                      <Label htmlFor="signature" className="text-xs font-medium text-foreground">
                        Signature (optional)
                      </Label>
                      <input
                        id="signature"
                        type="text"
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        placeholder="Optional signature for verification"
                        className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-ring text-xs font-mono"
                        disabled={decodingTx}
                      />
                    </div>

                    {/* Decode Button */}
                    <Button
                      onClick={handleDecodeTx}
                      disabled={!txBytes.trim() || decodingTx}
                      className="w-full"
                    >
                      {decodingTx ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Decoding...
                        </>
                      ) : (
                        <>
                          <Unlock className="w-4 h-4" />
                          Decode Transaction
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Decode Result */}
                <AnimatePresence mode="wait">
                  {txResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Card className="bg-card border-emerald-500/40 shadow-sm">
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Decoded Transaction
                            {txResult.signatureValid !== undefined && (
                              <Badge variant={txResult.signatureValid ? 'secondary' : 'destructive'} className="ml-auto text-xs">
                                {txResult.signatureValid ? 'Valid Signature' : 'Invalid Signature'}
                              </Badge>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                          <div className="bg-secondary border border-border rounded-lg p-2 max-h-96 overflow-y-auto relative">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => copyToClipboard(JSON.stringify(txResult.decoded, null, 2), 'Transaction data')}
                              className="absolute top-2 right-2 h-7 w-7"
                              title="Copy to clipboard"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-all pr-8">
                              {JSON.stringify(txResult.decoded, null, 2)}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.2 }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border border-border bg-secondary/50 rounded-lg">
              <AlertCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">
                <strong className="text-foreground">Security Tip:</strong> Always verify source code before deployment. Check bytecode limits to prevent runtime failures.
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* File Browser Modals */}
      <AnimatePresence>
        {showBrowser && (
          <FileBrowser
            onSelect={(path) => {
              setPackagePath(path);
              toast.success(`Selected: ${path.split('/').pop()}`);
            }}
            onClose={() => setShowBrowser(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBytecodeBrowser && (
          <FileBrowser
            onSelect={(path) => {
              setBytecodePackagePath(path);
              toast.success(`Selected: ${path.split('/').pop()}`);
            }}
            onClose={() => setShowBytecodeBrowser(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
