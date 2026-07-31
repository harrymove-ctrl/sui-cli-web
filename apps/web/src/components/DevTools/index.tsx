import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Code,
  FileCode,
  FileText,
  FolderOpen,
  Lightbulb,
  Loader2,
  PlayCircle,
  Settings,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  disassembleModule,
  generatePackageSummary,
  getPackageModules,
  getPublishedPackages,
  type PublishedPackageInfo,
  runCoverage,
} from '@/api/client';
import { FileBrowser } from '@/components/MoveDeploy/FileBrowser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyForAiMenu } from '@/components/ui/copy-for-ai';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCopyToClipboard } from '@/hooks';

// Helper to parse CLI output and separate warnings from actual content
interface ParsedOutput {
  hasError: boolean;
  hasWarnings: boolean;
  warnings: SimplifiedWarning[];
  content: string;
  status: 'success' | 'warning' | 'error';
}

// Simplified warning for user-friendly display
interface SimplifiedWarning {
  id: string; // e.g., "W99001"
  title: string; // User-friendly title
  description: string; // Simple explanation
  suggestion: string; // What to do about it
  location?: string; // File:line (simplified)
  rawOutput: string; // Original output for advanced users
}

// Map warning codes to user-friendly explanations
const WARNING_EXPLANATIONS: Record<
  string,
  { title: string; description: string; suggestion: string }
> = {
  W99001: {
    title: 'Better return pattern available',
    description:
      'Your function sends an object directly to the caller. This works, but returning the object instead makes your code more flexible.',
    suggestion:
      'Consider using "public fun" that returns the object, so callers can decide what to do with it.',
  },
  W09001: {
    title: 'Unused variable',
    description: 'You declared a variable but never used it.',
    suggestion: 'Remove the variable or prefix with underscore (_) if intentional.',
  },
  W09002: {
    title: 'Unused import',
    description: 'You imported something but never used it.',
    suggestion: 'Remove the unused import to keep code clean.',
  },
  W09003: {
    title: 'Unused function',
    description: "You defined a function but it's never called.",
    suggestion: 'Remove if not needed, or add "public" if it should be accessible.',
  },
};

// Parse raw warning into simplified format
function parseWarningToSimplified(rawWarning: string): SimplifiedWarning {
  // Extract warning code: warning[lint W99001], warning[Lint W99001], or warning[W99001]
  // Note: Sui CLI uses "Lint" (capital L) in output
  const codeMatch = rawWarning.match(/warning\[(?:[Ll]int\s+)?(W\d+)\]:/);
  const warningCode = codeMatch ? codeMatch[1] : 'unknown';

  // Extract location (file:line)
  const locationMatch = rawWarning.match(/┌─\s+([^:]+):(\d+):\d+/);
  const location = locationMatch
    ? `${locationMatch[1].split('/').pop()}:${locationMatch[2]}`
    : undefined;

  // Get explanation from our map, or create generic one
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

function parseCliOutput(output: string): ParsedOutput {
  // Pre-process: Remove "Error: " prefix if followed by warning (API wraps warnings in error response)
  let processedOutput = output;
  if (processedOutput.startsWith('Error: warning[')) {
    processedOutput = processedOutput.substring(7); // Remove "Error: "
  }

  const lines = processedOutput.split('\n');
  const rawWarnings: string[] = [];
  const contentLines: string[] = [];
  let hasError = false;

  let inWarningBlock = false;
  let currentWarning = '';

  // Helper to check if line is part of warning block (indented or box drawing chars)
  const isWarningContinuation = (line: string): boolean => {
    // Box drawing characters: ┌ ─ │ └ ├ ╭ ╮ ╯ ╰
    const boxChars = /^[\s┌─│└├╭╮╯╰]/;
    // Also match lines starting with spaces, =, or containing "This warning"
    return (
      boxChars.test(line) ||
      line.startsWith('   ') ||
      line.startsWith(' ') ||
      line.startsWith('=') ||
      line.includes('This warning can be suppressed') ||
      line.includes('Returning an object') ||
      line.includes('Transaction sender') ||
      line.includes('Transfer of an object') ||
      line.includes('^^^^') ||
      line.trim() === ''
    );
  };

  for (const line of lines) {
    // Detect warning start: "warning[lint W99xxx]:", "warning[Lint W99xxx]:", or "warning[W99xxx]:" pattern
    // Note: Sui CLI uses "Lint" (capital L) in output
    if (/^warning\[(?:[Ll]int\s+)?W\d+\]:/.test(line)) {
      // Save previous warning if exists
      if (currentWarning) {
        rawWarnings.push(currentWarning.trim());
      }
      inWarningBlock = true;
      currentWarning = line;
    }
    // Detect real error start: "error[Exxxx]:" (compile errors, not wrapped warnings)
    else if (/^error\[E\d+\]:/.test(line)) {
      hasError = true;
      inWarningBlock = false;
      if (currentWarning) {
        rawWarnings.push(currentWarning.trim());
        currentWarning = '';
      }
      contentLines.push(line);
    }
    // Continue warning block
    else if (inWarningBlock && isWarningContinuation(line)) {
      currentWarning += '\n' + line;
    }
    // Normal content - end warning block
    else {
      if (inWarningBlock && currentWarning) {
        rawWarnings.push(currentWarning.trim());
        currentWarning = '';
      }
      inWarningBlock = false;
      contentLines.push(line);
    }
  }

  // Push last warning if any
  if (currentWarning) {
    rawWarnings.push(currentWarning.trim());
  }

  // Convert raw warnings to simplified format
  const warnings = rawWarnings.map(parseWarningToSimplified);

  const content = contentLines.join('\n').trim();
  const hasWarnings = warnings.length > 0;

  // Determine overall status - only error if real compile errors, not lint warnings
  let status: 'success' | 'warning' | 'error' = 'success';
  if (hasError) {
    status = 'error';
  } else if (hasWarnings) {
    status = 'warning';
  }

  return {
    hasError,
    hasWarnings,
    warnings,
    content: content || '', // Empty content is OK if only warnings
    status,
  };
}

export function DevTools() {
  // URL params for tab switching
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const validTabs = ['coverage', 'disassemble', 'summary'];
  const [activeTab, setActiveTab] = useState(() =>
    tabParam && validTabs.includes(tabParam) ? tabParam : 'coverage'
  );

  // Sync tab state when URL changes (e.g., from FileTree navigation)
  useEffect(() => {
    const newTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'coverage';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [tabParam]);

  // Sync URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'coverage') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    setSearchParams(searchParams, { replace: true });
  };

  // Coverage State
  const [packagePath, setPackagePath] = useState('');
  const [coverageMode, setCoverageMode] = useState('summary');
  const [coverageModuleName, setCoverageModuleName] = useState('');
  const [coverageOutput, setCoverageOutput] = useState('');
  const [runningCoverage, setRunningCoverage] = useState(false);
  const [detectedModules, setDetectedModules] = useState<string[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);

  // Disassembly State
  const [modulePath, setModulePath] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [showBytecodeMap, setShowBytecodeMap] = useState(false);
  const [disassemblyOutput, setDisassemblyOutput] = useState('');
  const [disassembling, setDisassembling] = useState(false);

  // Summary State
  const [summaryPackagePath, setSummaryPackagePath] = useState('');
  const [summaryPackageId, setSummaryPackageId] = useState('');
  const [summaryFormat, setSummaryFormat] = useState('json');
  const [summaryOutput, setSummaryOutput] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [publishedPackages, setPublishedPackages] = useState<PublishedPackageInfo[]>([]);
  const [loadingPublishedPackages, setLoadingPublishedPackages] = useState(false);

  // File Browser State
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserTarget, setBrowserTarget] = useState<'coverage' | 'disassembly' | 'summary'>(
    'coverage'
  );

  // Check if module name is required for current coverage mode
  const moduleNameRequired = coverageMode === 'source' || coverageMode === 'bytecode';

  // Fetch published packages on mount (for Summary tab dropdown)
  useEffect(() => {
    const fetchPublishedPackages = async () => {
      setLoadingPublishedPackages(true);
      try {
        const result = await getPublishedPackages();
        setPublishedPackages(result.packages || []);
      } catch {
        // Silently fail - dropdown just won't have options
        setPublishedPackages([]);
      } finally {
        setLoadingPublishedPackages(false);
      }
    };
    fetchPublishedPackages();
  }, []);

  // Fetch modules when package path changes
  const fetchModules = async (path: string) => {
    if (!path.trim()) {
      setDetectedModules([]);
      return;
    }

    setLoadingModules(true);
    try {
      const data = await getPackageModules(path.trim());
      setDetectedModules(data.modules);
      // Auto-select first module if only one exists and module is required
      if (data.modules.length === 1 && moduleNameRequired && !coverageModuleName) {
        setCoverageModuleName(data.modules[0]);
      }
    } catch {
      setDetectedModules([]);
    } finally {
      setLoadingModules(false);
    }
  };

  // Handle package path change with module detection
  const handlePackagePathChange = (newPath: string) => {
    setPackagePath(newPath);
    // Debounce module fetch
    const timeoutId = setTimeout(() => fetchModules(newPath), 300);
    return () => clearTimeout(timeoutId);
  };

  // Handle Coverage
  const handleRunCoverage = async () => {
    if (!packagePath.trim()) {
      toast.error('Please enter a package path');
      return;
    }

    if (moduleNameRequired && !coverageModuleName.trim()) {
      toast.error(`Module name is required for '${coverageMode}' mode`);
      return;
    }

    setRunningCoverage(true);
    setCoverageOutput('');

    try {
      const data = await runCoverage(
        packagePath.trim(),
        coverageMode,
        coverageModuleName.trim() || undefined
      );
      setCoverageOutput(data.output);
      toast.success('Coverage analysis complete!');
    } catch (error: any) {
      const msg = error.message || String(error);
      setCoverageOutput(`Error: ${msg}`);
      toast.error('Coverage failed: ' + msg);
    } finally {
      setRunningCoverage(false);
    }
  };

  // Handle Disassemble
  const handleDisassemble = async () => {
    if (!modulePath.trim()) {
      toast.error('Please enter a module path');
      return;
    }

    setDisassembling(true);
    setDisassemblyOutput('');

    try {
      const data = await disassembleModule(modulePath.trim(), showDebug, showBytecodeMap);
      setDisassemblyOutput(data.output);
      toast.success('Disassembly complete!');
    } catch (error: any) {
      const msg = error.message || String(error);
      setDisassemblyOutput(`Error: ${msg}`);
      toast.error('Disassembly failed: ' + msg);
    } finally {
      setDisassembling(false);
    }
  };

  // Handle Summary
  const handleGenerateSummary = async () => {
    if (!summaryPackagePath.trim() && !summaryPackageId.trim()) {
      toast.error('Please enter a package path or package ID');
      return;
    }

    setGeneratingSummary(true);
    setSummaryOutput('');

    try {
      const data = await generatePackageSummary(
        summaryPackagePath.trim() || undefined,
        summaryPackageId.trim() || undefined,
        summaryFormat
      );
      setSummaryOutput(
        summaryFormat === 'json' ? JSON.stringify(data.summary, null, 2) : String(data.summary)
      );
      toast.success('Summary generated!');
    } catch (error: any) {
      const msg = error.message || String(error);
      setSummaryOutput(`Error: ${msg}`);
      toast.error('Summary generation failed: ' + msg);
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Copy-for-AI: assemble the active tool's inputs/outputs into shareable context
  const copyToClipboard = useCopyToClipboard();

  const tabLabels: Record<string, string> = {
    coverage: 'Test Coverage',
    disassemble: 'Bytecode Disassembly',
    summary: 'Package Summary',
  };

  const aiState: Record<string, unknown> =
    activeTab === 'coverage'
      ? {
          tool: 'coverage',
          packagePath: packagePath.trim() || null,
          coverageMode,
          moduleName: coverageModuleName.trim() || null,
          detectedModules,
          output: coverageOutput ? coverageOutput.slice(0, 6000) : null,
        }
      : activeTab === 'disassemble'
        ? {
            tool: 'disassemble',
            modulePath: modulePath.trim() || null,
            showDebug,
            showBytecodeMap,
            output: disassemblyOutput ? disassemblyOutput.slice(0, 6000) : null,
          }
        : {
            tool: 'summary',
            packagePath: summaryPackagePath.trim() || null,
            packageId: summaryPackageId.trim() || null,
            format: summaryFormat,
            output: summaryOutput ? summaryOutput.slice(0, 6000) : null,
          };

  const hasExportable =
    activeTab === 'coverage'
      ? !!(packagePath.trim() || coverageOutput)
      : activeTab === 'disassemble'
        ? !!(modulePath.trim() || disassemblyOutput)
        : !!(summaryPackagePath.trim() || summaryPackageId.trim() || summaryOutput);

  const aiActiveOutput =
    activeTab === 'coverage'
      ? coverageOutput
      : activeTab === 'disassemble'
        ? disassemblyOutput
        : summaryOutput;

  const aiJson = JSON.stringify(aiState, null, 2);

  const aiMarkdown = [
    `# Sui Move Dev Tools — ${tabLabels[activeTab]}`,
    '',
    ...(activeTab === 'coverage'
      ? [
          `- **Package path:** ${packagePath.trim() || 'not set'}`,
          `- **Mode:** ${coverageMode}`,
          coverageModuleName.trim() ? `- **Module:** ${coverageModuleName.trim()}` : null,
        ]
      : activeTab === 'disassemble'
        ? [
            `- **Module path:** ${modulePath.trim() || 'not set'}`,
            `- **Show debug:** ${showDebug ? 'yes' : 'no'}`,
            `- **Show bytecode map:** ${showBytecodeMap ? 'yes' : 'no'}`,
          ]
        : [
            `- **Package path:** ${summaryPackagePath.trim() || 'not set'}`,
            `- **Package ID:** ${summaryPackageId.trim() || 'not set'}`,
            `- **Format:** ${summaryFormat}`,
          ]),
    aiActiveOutput ? '' : null,
    aiActiveOutput ? '## Output' : null,
    aiActiveOutput ? '```\n' + aiActiveOutput.slice(0, 6000) + '\n```' : null,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const aiPrompt = `Here's the output from the Sui Move "${tabLabels[activeTab]}" dev tool:\n\n${aiMarkdown}\n\nHelp me interpret this and suggest concrete next steps (e.g. improving test coverage, understanding the bytecode, or reviewing the package structure).`;

  return (
    <>
      <div className="relative z-10 p-4 sm:p-6">
        <div className="relative max-w-[1600px] mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-medium text-foreground">Dev Tools</h1>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            </div>
            {hasExportable && (
              <CopyForAiMenu
                prompt={aiPrompt}
                json={aiJson}
                markdown={aiMarkdown}
                onCopy={copyToClipboard}
              />
            )}
          </div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
          >
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList fullWidth indicatorClassName="bg-[#4da2ff]">
                <TabsTrigger value="coverage" icon={<Activity />} className="flex-1">
                  <span className="hidden sm:inline">Coverage</span>
                </TabsTrigger>
                <TabsTrigger value="disassemble" icon={<Code />} className="flex-1">
                  <span className="hidden sm:inline">Disassemble</span>
                </TabsTrigger>
                <TabsTrigger value="summary" icon={<FileText />} className="flex-1">
                  <span className="hidden sm:inline">Summary</span>
                </TabsTrigger>
              </TabsList>
              <p className="px-1 pt-1.5 text-xs text-tertiary">
                {activeTab === 'coverage' && 'Move test coverage report for your package'}
                {activeTab === 'disassemble' && 'View compiled bytecode as Move disassembly'}
                {activeTab === 'summary' && 'Package structure and module summary'}
              </p>

              {/* Coverage Tab */}
              <TabsContent value="coverage" className="space-y-4 mt-4">
                {/* Helpful Tip */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs">
                  <p className="text-blue-400 flex items-center gap-1.5 mb-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Prerequisite: Run tests with coverage flag first
                  </p>
                  <code className="text-blue-300/80 font-mono block pl-5">
                    sui move test --coverage
                  </code>
                </div>

                <Card className="hover:border-green-500/40 transition-colors shadow-md">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-1.5 text-green-400">
                      <Activity className="w-3.5 h-3.5 text-green-500" />
                      Test Coverage Analysis
                      <span className="text-xs text-muted-foreground ml-auto font-normal">
                        Run coverage on Move packages
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* Package Path */}
                    <div className="space-y-1">
                      <Label
                        htmlFor="coverage-package-path"
                        className="text-xs font-medium flex items-center gap-1 text-green-400"
                      >
                        Package Path <span className="text-red-400">*</span>
                      </Label>
                      <div className="flex gap-1.5">
                        <input
                          id="coverage-package-path"
                          type="text"
                          value={packagePath}
                          onChange={(e) => handlePackagePathChange(e.target.value)}
                          placeholder="/path/to/your/move/package"
                          className="flex-1 px-2.5 py-1.5 bg-card border border-green-500/30 rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500 transition-all text-xs font-mono"
                          disabled={runningCoverage}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setBrowserTarget('coverage');
                            setShowBrowser(true);
                          }}
                          disabled={runningCoverage}
                          className="border-green-500/50 text-green-400 hover:bg-green-500/10 flex-shrink-0"
                          title="Browse"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Mode Selection with Explanation */}
                    <div className="space-y-1.5">
                      <Label htmlFor="coverage-mode" className="text-xs font-medium text-green-400">
                        Coverage Mode
                      </Label>
                      <select
                        id="coverage-mode"
                        value={coverageMode}
                        onChange={(e) => setCoverageMode(e.target.value)}
                        disabled={runningCoverage}
                        className="w-full px-2.5 py-1.5 bg-card border border-green-500/30 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-green-500/50 text-xs disabled:opacity-50"
                      >
                        <option value="summary">Summary - Overall coverage statistics</option>
                        <option value="source">
                          Source Code - Line-by-line coverage (requires module)
                        </option>
                        <option value="bytecode">
                          Bytecode - Disassembled coverage (requires module)
                        </option>
                        <option value="lcov">LCOV - Export for external tools</option>
                      </select>

                      {/* Mode explanation */}
                      <div className="p-2.5 bg-green-500/5 border border-green-500/20 rounded-lg text-[11px] text-muted-foreground">
                        {coverageMode === 'summary' && (
                          <div className="space-y-1">
                            <p className="font-medium text-green-400">📊 Summary Mode</p>
                            <p>
                              Shows overall test coverage percentage for your entire package. Quick
                              way to see how much of your code is tested.
                            </p>
                            <p className="text-green-500/60">
                              Best for: Quick overview of test coverage
                            </p>
                          </div>
                        )}
                        {coverageMode === 'source' && (
                          <div className="space-y-1">
                            <p className="font-medium text-green-400">📝 Source Code Mode</p>
                            <p>
                              Shows line-by-line coverage - which lines were executed during tests
                              (✓) and which were not (✗).
                            </p>
                            <p className="text-green-500/60">
                              Best for: Finding untested code paths
                            </p>
                            <p className="text-amber-400/80 text-xs">
                              ⚠️ Requires selecting a specific module
                            </p>
                          </div>
                        )}
                        {coverageMode === 'bytecode' && (
                          <div className="space-y-1">
                            <p className="font-medium text-green-400">🔧 Bytecode Mode</p>
                            <p>
                              Shows coverage at bytecode level - more detailed than source, useful
                              for understanding low-level execution.
                            </p>
                            <p className="text-green-500/60">
                              Best for: Advanced debugging & optimization
                            </p>
                            <p className="text-amber-400/80 text-xs">
                              ⚠️ Requires selecting a specific module
                            </p>
                          </div>
                        )}
                        {coverageMode === 'lcov' && (
                          <div className="space-y-1">
                            <p className="font-medium text-green-400">📤 LCOV Export Mode</p>
                            <p>
                              Exports coverage data in LCOV format - standard format used by
                              coverage visualization tools.
                            </p>
                            <p className="text-green-500/60">
                              Best for: Integration with VS Code, Codecov, Coveralls
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Module Name - Required for source/bytecode modes */}
                    <div className="space-y-1">
                      <Label
                        htmlFor="coverage-module"
                        className="text-xs font-medium text-green-400 flex items-center gap-2"
                      >
                        <span>
                          Module Name{' '}
                          {moduleNameRequired ? (
                            <span className="text-red-400">*</span>
                          ) : (
                            <span className="text-green-400/80">(optional for summary)</span>
                          )}
                        </span>
                        {loadingModules && (
                          <Loader2 className="w-3 h-3 animate-spin text-green-400/80" />
                        )}
                        {!loadingModules && detectedModules.length > 0 && (
                          <span className="text-xs text-green-400/80">
                            {detectedModules.length} module{detectedModules.length > 1 ? 's' : ''}{' '}
                            found
                          </span>
                        )}
                      </Label>
                      {detectedModules.length > 0 ? (
                        <select
                          id="coverage-module"
                          value={coverageModuleName}
                          onChange={(e) => setCoverageModuleName(e.target.value)}
                          disabled={runningCoverage}
                          className={`w-full px-2.5 py-1.5 bg-card border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-green-500/50 text-xs disabled:opacity-50 ${
                            moduleNameRequired && !coverageModuleName.trim()
                              ? 'border-amber-500/50'
                              : 'border-green-500/30'
                          }`}
                        >
                          <option value="">Select a module...</option>
                          {detectedModules.map((mod) => (
                            <option key={mod} value={mod}>
                              {mod}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id="coverage-module"
                          type="text"
                          value={coverageModuleName}
                          onChange={(e) => setCoverageModuleName(e.target.value)}
                          placeholder={
                            moduleNameRequired ? 'module_name (required)' : 'module_name'
                          }
                          disabled={runningCoverage}
                          className={`w-full px-2.5 py-1.5 bg-card border rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-green-500/50 text-xs font-mono disabled:opacity-50 ${
                            moduleNameRequired && !coverageModuleName.trim()
                              ? 'border-amber-500/50'
                              : 'border-green-500/30'
                          }`}
                        />
                      )}
                      {moduleNameRequired && !coverageModuleName.trim() && (
                        <p className="text-xs text-amber-400/80 flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Required for {coverageMode} mode - specify which module to analyze
                        </p>
                      )}
                    </div>

                    {/* Run Button */}
                    <Button
                      onClick={handleRunCoverage}
                      disabled={
                        !packagePath.trim() ||
                        runningCoverage ||
                        (moduleNameRequired && !coverageModuleName.trim())
                      }
                      className="w-full bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/50"
                    >
                      {runningCoverage ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Running Coverage...
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-4 h-4" />
                          Run Coverage
                        </>
                      )}
                    </Button>

                    {/* Output with separate warnings and content */}
                    <AnimatePresence mode="wait">
                      {coverageOutput &&
                        (() => {
                          const parsed = parseCliOutput(coverageOutput);
                          return (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="space-y-2"
                            >
                              {/* Warnings Section - User-friendly display */}
                              {parsed.hasWarnings && (
                                <div className="space-y-2">
                                  {/* Simple header */}
                                  <div className="flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4 text-amber-400" />
                                    <span className="text-sm font-medium text-amber-400">
                                      {parsed.warnings.length} code suggestion
                                      {parsed.warnings.length > 1 ? 's' : ''} found
                                    </span>
                                    <span className="text-xs text-green-500/60 ml-auto">
                                      Your code works fine!
                                    </span>
                                  </div>

                                  {/* Simple warning cards */}
                                  <div className="space-y-2">
                                    {parsed.warnings.map((warning, idx) => (
                                      <div
                                        key={idx}
                                        className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg"
                                      >
                                        {/* Simple title and location */}
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                          <span className="text-sm font-medium text-amber-300">
                                            {warning.title}
                                          </span>
                                          {warning.location && (
                                            <span className="text-xs text-amber-500/50 font-mono whitespace-nowrap">
                                              {warning.location}
                                            </span>
                                          )}
                                        </div>

                                        {/* Simple description */}
                                        <p className="text-xs text-muted-foreground mb-2">
                                          {warning.description}
                                        </p>

                                        {/* Simple suggestion */}
                                        <p className="text-xs text-green-400/80 flex items-start gap-1.5">
                                          <span className="text-green-500 mt-0.5">→</span>
                                          {warning.suggestion}
                                        </p>

                                        {/* Expandable technical details for advanced users */}
                                        <details className="mt-2">
                                          <summary className="text-xs text-amber-500/40 cursor-pointer hover:text-amber-500/60 transition-colors flex items-center gap-1">
                                            <ChevronDown className="w-3 h-3" />
                                            Show compiler output
                                          </summary>
                                          <pre className="mt-2 p-2 bg-secondary rounded-lg text-xs text-amber-400/60 font-mono overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                                            {warning.rawOutput}
                                          </pre>
                                        </details>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Helpful note */}
                                  <p className="text-xs text-tertiary text-center">
                                    These are optional improvements. Your code compiles and runs
                                    correctly.
                                  </p>
                                </div>
                              )}

                              {/* Main Output/Results Section - only show if has content or error */}
                              {(parsed.content || parsed.status === 'error') && (
                                <div className="space-y-1">
                                  <Label className="text-xs font-medium flex items-center gap-1">
                                    {parsed.status === 'error' ? (
                                      <>
                                        <AlertCircle className="w-3 h-3 text-red-400" />
                                        <span className="text-red-400">Error</span>
                                      </>
                                    ) : parsed.hasWarnings ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                                        <span className="text-green-400">Coverage Results</span>
                                        <span className="text-xs text-amber-400 ml-1">
                                          (compiled with warnings)
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                                        <span className="text-green-400">Coverage Results</span>
                                      </>
                                    )}
                                  </Label>
                                  <pre
                                    className={`p-3 bg-secondary border rounded-lg text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto ${
                                      parsed.status === 'error'
                                        ? 'border-red-500/30 text-red-400'
                                        : 'border-green-500/30 text-green-400'
                                    }`}
                                  >
                                    {parsed.content || 'No output'}
                                  </pre>
                                </div>
                              )}

                              {/* If only warnings and no content, show info message */}
                              {parsed.hasWarnings &&
                                !parsed.content &&
                                parsed.status !== 'error' && (
                                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs">
                                    <p className="text-blue-400 flex items-center gap-1.5">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      Coverage completed with lint warnings. Your code compiled
                                      successfully.
                                    </p>
                                    <p className="text-blue-400/70 mt-1 pl-5">
                                      The warnings above are suggestions for better code practices,
                                      not errors.
                                    </p>
                                  </div>
                                )}
                            </motion.div>
                          );
                        })()}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Disassemble Tab */}
              <TabsContent value="disassemble" className="space-y-4 mt-4">
                {/* What is Disassemble */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs">
                  <p className="text-blue-400 flex items-center gap-1.5 mb-1">
                    <Code className="w-3.5 h-3.5" />
                    What is Disassembly?
                  </p>
                  <p className="text-blue-300/70 pl-5 mb-1">
                    Converts compiled bytecode (.mv files) back to readable assembly. Useful for:
                  </p>
                  <ul className="text-blue-300/60 pl-7 space-y-0.5 list-disc">
                    <li>Understanding how your code compiles</li>
                    <li>Debugging bytecode verification issues</li>
                    <li>Analyzing third-party packages</li>
                  </ul>
                </div>

                <Card className="hover:border-green-500/40 transition-colors shadow-md">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-1.5 text-green-400">
                      <Code className="w-3.5 h-3.5 text-green-500" />
                      Disassemble Module
                      <span className="text-xs text-muted-foreground ml-auto font-normal">
                        View bytecode from .mv files
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* Module Path */}
                    <div className="space-y-1">
                      <Label
                        htmlFor="module-path"
                        className="text-xs font-medium flex items-center gap-1 text-green-400"
                      >
                        Module Path (.mv file) <span className="text-red-400">*</span>
                      </Label>
                      <div className="flex gap-1.5">
                        <input
                          id="module-path"
                          type="text"
                          value={modulePath}
                          onChange={(e) => setModulePath(e.target.value)}
                          placeholder="/path/to/module.mv"
                          className="flex-1 px-2.5 py-1.5 bg-card border border-green-500/30 rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500 transition-all text-xs font-mono"
                          disabled={disassembling}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setBrowserTarget('disassembly');
                            setShowBrowser(true);
                          }}
                          disabled={disassembling}
                          className="border-green-500/50 text-green-400 hover:bg-green-500/10 flex-shrink-0"
                          title="Browse"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-green-400/80 flex items-center gap-1">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Typically found in build/package/bytecode_modules/*.mv
                      </p>
                    </div>

                    {/* Options */}
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-green-400">Options</Label>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showDebug}
                            onChange={(e) => setShowDebug(e.target.checked)}
                            disabled={disassembling}
                            className="w-3 h-3 text-green-500 bg-card border-green-500/50 rounded focus:ring-1 focus:ring-green-500/50"
                          />
                          <span className="text-[11px] text-green-400">Show debug information</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showBytecodeMap}
                            onChange={(e) => setShowBytecodeMap(e.target.checked)}
                            disabled={disassembling}
                            className="w-3 h-3 text-green-500 bg-card border-green-500/50 rounded focus:ring-1 focus:ring-green-500/50"
                          />
                          <span className="text-[11px] text-green-400">Show bytecode map</span>
                        </label>
                      </div>
                    </div>

                    {/* Disassemble Button */}
                    <Button
                      onClick={handleDisassemble}
                      disabled={!modulePath.trim() || disassembling}
                      className="w-full bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/50"
                    >
                      {disassembling ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Disassembling...
                        </>
                      ) : (
                        <>
                          <Code className="w-4 h-4" />
                          Disassemble
                        </>
                      )}
                    </Button>

                    {/* Output */}
                    <AnimatePresence mode="wait">
                      {disassemblyOutput && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-1"
                        >
                          <Label className="text-xs font-medium text-green-400 flex items-center gap-1">
                            {disassemblyOutput.includes('Error:') ? (
                              <AlertCircle className="w-3 h-3 text-red-400" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-green-400" />
                            )}
                            Disassembled Bytecode
                          </Label>
                          <pre
                            className={`p-3 bg-secondary border rounded-lg text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto ${
                              disassemblyOutput.includes('Error:')
                                ? 'border-red-500/30 text-red-400'
                                : 'border-green-500/30 text-green-400'
                            }`}
                          >
                            {disassemblyOutput}
                          </pre>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Summary Tab */}
              <TabsContent value="summary" className="space-y-4 mt-4">
                {/* What is Summary */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs">
                  <p className="text-blue-400 flex items-center gap-1.5 mb-1">
                    <FileText className="w-3.5 h-3.5" />
                    What is Package Summary?
                  </p>
                  <p className="text-blue-300/70 pl-5 mb-1">
                    Generates structured documentation of your Move package including:
                  </p>
                  <ul className="text-blue-300/60 pl-7 space-y-0.5 list-disc">
                    <li>All public functions and their signatures</li>
                    <li>Struct definitions and fields</li>
                    <li>Entry points and their parameters</li>
                    <li>Dependencies and module structure</li>
                  </ul>
                  <p className="text-blue-300/50 pl-5 mt-1 text-xs">
                    Can generate from local source OR published package ID
                  </p>
                </div>

                <Card className="hover:border-green-500/40 transition-colors shadow-md">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-1.5 text-green-400">
                      <FileText className="w-3.5 h-3.5 text-green-500" />
                      Package Summary
                      <span className="text-xs text-muted-foreground ml-auto font-normal">
                        Generate package documentation
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* Package Path */}
                    <div className="space-y-1">
                      <Label
                        htmlFor="summary-package-path"
                        className="text-xs font-medium text-green-400"
                      >
                        Package Path <span className="text-green-400/80">(local)</span>
                      </Label>
                      <div className="flex gap-1.5">
                        <input
                          id="summary-package-path"
                          type="text"
                          value={summaryPackagePath}
                          onChange={(e) => setSummaryPackagePath(e.target.value)}
                          placeholder="/path/to/your/move/package"
                          className="flex-1 px-2.5 py-1.5 bg-card border border-green-500/30 rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500 transition-all text-xs font-mono"
                          disabled={generatingSummary}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setBrowserTarget('summary');
                            setShowBrowser(true);
                          }}
                          disabled={generatingSummary}
                          className="border-green-500/50 text-green-400 hover:bg-green-500/10 flex-shrink-0"
                          title="Browse"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Or Divider */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-green-500/20"></div>
                      <span className="text-xs text-green-400/80">OR</span>
                      <div className="flex-1 h-px bg-green-500/20"></div>
                    </div>

                    {/* Package ID */}
                    <div className="space-y-1">
                      <Label
                        htmlFor="summary-package-id"
                        className="text-xs font-medium text-green-400"
                      >
                        Package ID <span className="text-green-400/80">(on-chain)</span>
                      </Label>

                      {/* Dropdown for published packages */}
                      {publishedPackages.length > 0 && (
                        <div className="mb-1.5">
                          <select
                            value={summaryPackageId}
                            onChange={(e) => setSummaryPackageId(e.target.value)}
                            disabled={generatingSummary || loadingPublishedPackages}
                            className="w-full px-2.5 py-1.5 bg-card border border-green-500/30 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-green-500/50 text-xs disabled:opacity-50"
                          >
                            <option value="">Select from your packages...</option>
                            {publishedPackages.map((pkg) => (
                              <option key={pkg.packageId} value={pkg.packageId}>
                                {pkg.packageId.slice(0, 10)}...{pkg.packageId.slice(-6)} (v
                                {pkg.version})
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-green-400/80 mt-0.5">
                            {publishedPackages.length} package
                            {publishedPackages.length !== 1 ? 's' : ''} found via UpgradeCap
                          </p>
                        </div>
                      )}

                      {/* Manual input */}
                      <input
                        id="summary-package-id"
                        type="text"
                        value={summaryPackageId}
                        onChange={(e) => setSummaryPackageId(e.target.value)}
                        placeholder={
                          publishedPackages.length > 0 ? 'Or enter package ID manually...' : '0x...'
                        }
                        className="w-full px-2.5 py-1.5 bg-card border border-green-500/30 rounded-lg text-foreground placeholder:text-tertiary focus:outline-none focus:ring-1 focus:ring-green-500/50 text-xs font-mono"
                        disabled={generatingSummary}
                      />
                    </div>

                    {/* Format Selection */}
                    <div className="space-y-1">
                      <Label
                        htmlFor="summary-format"
                        className="text-xs font-medium text-green-400"
                      >
                        Output Format
                      </Label>
                      <select
                        id="summary-format"
                        value={summaryFormat}
                        onChange={(e) => setSummaryFormat(e.target.value)}
                        disabled={generatingSummary}
                        className="w-full px-2.5 py-1.5 bg-card border border-green-500/30 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-green-500/50 text-xs disabled:opacity-50"
                      >
                        <option value="json">JSON</option>
                        <option value="yaml">YAML</option>
                      </select>
                    </div>

                    {/* Generate Button */}
                    <Button
                      onClick={handleGenerateSummary}
                      disabled={
                        (!summaryPackagePath.trim() && !summaryPackageId.trim()) ||
                        generatingSummary
                      }
                      className="w-full bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/50"
                    >
                      {generatingSummary ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4" />
                          Generate Summary
                        </>
                      )}
                    </Button>

                    {/* Output */}
                    <AnimatePresence mode="wait">
                      {summaryOutput && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="space-y-1"
                        >
                          <Label className="text-xs font-medium text-green-400 flex items-center gap-1">
                            {summaryOutput.includes('Error:') ? (
                              <AlertCircle className="w-3 h-3 text-red-400" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-green-400" />
                            )}
                            Summary
                          </Label>
                          <pre
                            className={`p-3 bg-secondary border rounded-lg text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto ${
                              summaryOutput.includes('Error:')
                                ? 'border-red-500/30 text-red-400'
                                : 'border-green-500/30 text-green-400'
                            }`}
                          >
                            {summaryOutput}
                          </pre>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>

      {/* File Browser Modal */}
      <AnimatePresence>
        {showBrowser && (
          <FileBrowser
            onSelect={(path) => {
              if (browserTarget === 'coverage') {
                setPackagePath(path);
                // Trigger module detection for coverage
                fetchModules(path);
              } else if (browserTarget === 'disassembly') {
                setModulePath(path);
              } else if (browserTarget === 'summary') {
                setSummaryPackagePath(path);
              }
              toast.success(`Selected: ${path.split('/').pop()}`);
            }}
            onClose={() => setShowBrowser(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
