import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Code,
  FileCode,
  FolderOpen,
  Lightbulb,
  Package,
  PlayCircle,
  RefreshCw,
  Rocket,
  Search,
  TestTube2,
  Trash2,
  Upload,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  type AnalyzedParameter,
  analyzeParameters,
  buildMovePackage,
  callPackageFunction,
  publishPackage,
  testMovePackage,
  upgradePackage,
} from '@/api/client';
import { explorePackage, type MoveFunction } from '@/api/services/packages';
import { ParameterInputField } from '@/components/ParameterInputField';
import { AnimatedToastStack, useAnimatedToastStack } from '@/components/ui/animated-toast-stack';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type CommandItem, CommandPalette } from '@/components/ui/command-palette';
import { CopyForAiMenu } from '@/components/ui/copy-for-ai';
import { Label } from '@/components/ui/label';
import { Loader } from '@/components/ui/loader';
import { Checkbox } from '@/components/ui/motion-checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/motion-select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowPipelineIndicator } from '@/components/ui/workflow-pipeline';
import { useCopyToClipboard } from '@/hooks';
import { buildAiContext } from '@/lib/ai-context';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { FileBrowser } from './FileBrowser';
import { MoveStudioFlow, type StudioStage } from './MoveStudioFlow';
import { TerminalBuildOutput } from './TerminalBuildOutput';
import { splitCliOutput, TerminalErrorDisplay } from './TerminalErrorDisplay';
import { TerminalSuccessDisplay } from './TerminalSuccessDisplay';
import { TerminalTestOutput } from './TerminalTestOutput';

interface PublishResult {
  success: boolean;
  packageId?: string;
  digest?: string;
  createdObjects?: any[];
  error?: string;
}

interface RecentProject {
  path: string;
  name: string;
  lastUsed: number;
  upgradeCap?: string;
}

type WorkflowStep = 'build' | 'test' | 'publish' | 'idle';

/** Budgets people actually pick, in MIST. "custom" reveals the raw input. */
const GAS_PRESETS = [
  { value: '10000000', label: '0.01 SUI' },
  { value: '50000000', label: '0.05 SUI' },
  { value: '100000000', label: '0.1 SUI (default)' },
  { value: '500000000', label: '0.5 SUI' },
  { value: '1000000000', label: '1 SUI' },
];

interface ModuleFunction {
  name: string;
  visibility: string;
  parameters: Array<{ name: string; type: string }>;
  typeParameters: string[];
  returnTypes: string[];
  signature: string;
}

interface PackageModule {
  name: string;
  functions: ModuleFunction[];
}

/** The CLI supplies the transaction context itself, so the call form hides it -
 *  it keys off the literal parameter name `ctx`. */
const isTxContext = (type: string): boolean => type.includes('::tx_context::TxContext');

/**
 * Adapt an explorer `MoveFunction` (positional parameter types, no names) to the
 * shape the Interact form wants.
 */
function toModuleFunction(fn: MoveFunction): ModuleFunction {
  const parameters = fn.parameters.map((type, i) => ({
    name: isTxContext(type) ? 'ctx' : `arg${i}`,
    type,
  }));
  const generics = fn.typeParameters.length ? `<${fn.typeParameters.join(', ')}>` : '';
  const returns = fn.returns.length ? `: ${fn.returns.join(', ')}` : '';
  return {
    name: fn.name,
    // `entry` outranks the raw visibility here: on a screen for calling
    // functions, "can I call this in a transaction" is the useful signal, and
    // the picker already styles entry/public differently from the rest.
    visibility: fn.isEntry ? 'entry' : fn.visibility,
    parameters,
    typeParameters: fn.typeParameters,
    returnTypes: fn.returns,
    signature: `${fn.name}${generics}(${fn.parameters.join(', ')})${returns}`,
  };
}

export function MoveDeploy() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [packagePath, setPackagePath] = useState('');
  const [gasBudget, setGasBudget] = useState('100000000');
  const [upgradeCapId, setUpgradeCapId] = useState('');
  const [testFilter, setTestFilter] = useState('');
  // Which preset the dropdown shows; 'custom' hands control back to the input.
  const [gasPreset, setGasPreset] = useState('100000000');

  // Long-running CLI ops get their own stack so one toast can morph
  // loading -> success/error in place and hold a failure open with Retry.
  // Quick confirmations ("Copied") stay on react-hot-toast.
  const {
    toasts: opToasts,
    showToast: showOpToast,
    updateToast: updateOpToast,
    dismissToast: dismissOpToast,
  } = useAnimatedToastStack({ defaultDuration: 4000, limit: 4 });

  /** Start a toast for a long op; returns handles to settle it. */
  const startOp = (title: string) => {
    const id = showOpToast({ status: 'loading', title, duration: 0 });
    return {
      succeed: (doneTitle: string, description?: string) =>
        updateOpToast(id, { status: 'success', title: doneTitle, description, duration: 4000 }),
      fail: (failTitle: string, raw: string, retry?: () => void) => {
        // Only the first real problem line goes in the toast - the full CLI
        // stream (warnings + build log) belongs in the inline panel.
        const { problem, warnings } = splitCliOutput(raw);
        // Don't pass a warning off as the cause. The CLI prints its
        // protocol-version warning on every command; if that's all we have,
        // say so rather than implying it's why the op failed.
        const summary = problem[0]
          ? problem[0]
          : warnings[0]
            ? `No error detail returned. Warning: ${warnings[0]}`
            : 'See the output below for details.';
        updateOpToast(id, {
          status: 'error',
          title: failTitle,
          description: summary,
          duration: 0,
          ...(retry ? { action: { label: 'Retry', onClick: () => retry() } } : {}),
        });
      },
    };
  };
  // Only an explicit ?packageId= deep link skips the flow - that's a deliberate
  // jump (the Call button in My Packages). A *stored* last-package-id must not:
  // it made the flow a one-time thing that anyone who'd ever used the studio
  // could never see again.
  const [flowDone, setFlowDone] = useState(() => Boolean(searchParams.get('packageId')));
  const [skipDeps, setSkipDeps] = useState(false);

  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [showBrowser, setShowBrowser] = useState(false);
  const [saveUpgradeCap, setSaveUpgradeCap] = useState(true);

  const [currentStep, setCurrentStep] = useState<WorkflowStep>('idle');
  const [workflowProgress, setWorkflowProgress] = useState(0);
  const [isOneClickRunning, setIsOneClickRunning] = useState(false);

  const [building, setBuilding] = useState(false);
  const [testing, setTesting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const [buildOutput, setBuildOutput] = useState<string>('');
  const [testOutput, setTestOutput] = useState<string>('');
  const [testPassed, setTestPassed] = useState(0);
  const [testFailed, setTestFailed] = useState(0);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);

  // Contract Interaction State
  const [targetPackageId, setTargetPackageId] = useState('');
  const [packageModules, setPackageModules] = useState<PackageModule[]>([]);
  const [loadingFunctions, setLoadingFunctions] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [functionFilter, setFunctionFilter] = useState('');
  const [selectedFunction, setSelectedFunction] = useState<ModuleFunction | null>(null);
  const [selectedModuleName, setSelectedModuleName] = useState('');
  const [functionArgs, setFunctionArgs] = useState<string[]>([]);
  const [functionTypeArgs, setFunctionTypeArgs] = useState<string[]>([]);
  const [callResult, setCallResult] = useState<any>(null);
  const [calling, setCalling] = useState(false);
  const [analyzedParams, setAnalyzedParams] = useState<AnalyzedParameter[]>([]);
  const [analyzingParams, setAnalyzingParams] = useState(false);

  // Tab state (controlled for URL params support)
  const tabParam = searchParams.get('tab');
  const validTabs = ['develop', 'deploy', 'upgrade', 'interact'];
  const [activeTab, setActiveTab] = useState(() =>
    tabParam && validTabs.includes(tabParam) ? tabParam : 'develop'
  );

  // Sync tab state when URL changes (e.g., from FileTree navigation)
  useEffect(() => {
    const newTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'develop';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [tabParam]);

  // Sync URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'develop') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tab);
    }
    // Preserve packageId if present
    setSearchParams(searchParams, { replace: true });
  };

  // Get active address from store for parameter analysis
  const addresses = useAppStore((state) => state.addresses);
  const activeAddress = addresses.find((a) => a.isActive)?.address || null;

  // Active network for AI export context
  const environments = useAppStore((state) => state.environments);
  const activeEnv = environments.find((e) => e.isActive);

  // Handle URL params for direct package interaction
  const urlPackageId = searchParams.get('packageId');
  useEffect(() => {
    if (urlPackageId) {
      setTargetPackageId(urlPackageId);
      handleTabChange('interact');
    }
  }, [urlPackageId]);

  // Load recent projects from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sui-recent-projects');
    if (saved) {
      try {
        setRecentProjects(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load recent projects:', e);
      }
    }
  }, []);

  // Save to recent projects
  const addToRecent = (path: string, upgradeCap?: string) => {
    const projectName = path.split('/').pop() || path;
    const newProject: RecentProject = {
      path,
      name: projectName,
      lastUsed: Date.now(),
      upgradeCap,
    };

    const updated = [newProject, ...recentProjects.filter((p) => p.path !== path).slice(0, 4)];

    setRecentProjects(updated);
    localStorage.setItem('sui-recent-projects', JSON.stringify(updated));
  };

  // Remove from recent projects
  const removeFromRecent = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentProjects.filter((p) => p.path !== path);
    setRecentProjects(updated);
    localStorage.setItem('sui-recent-projects', JSON.stringify(updated));
    toast.success('Removed from recent projects');
  };

  // Use recent project
  const useRecentProject = (project: RecentProject) => {
    setPackagePath(project.path);
    if (project.upgradeCap) {
      setUpgradeCapId(project.upgradeCap);
    }
    toast.success(`Loaded: ${project.name}`);
  };

  // Validate package path
  const isValidPath = packagePath.trim().length > 0;

  // Build package
  const handleBuild = async () => {
    if (!packagePath.trim()) {
      toast.error('Please select a package path');
      return;
    }

    setBuilding(true);
    const op = startOp('Building package');
    setBuildOutput('');
    setCurrentStep('build');
    setWorkflowProgress(33);

    try {
      const data = await buildMovePackage(packagePath.trim());
      setBuildOutput(data.output);
      op.succeed('Build complete');
      setWorkflowProgress(100);
      addToRecent(packagePath.trim());
      return true;
    } catch (error: any) {
      const msg = error.message || String(error);
      setBuildOutput(msg);
      op.fail('Build failed', msg, handleBuild);
      setWorkflowProgress(0);
      return false;
    } finally {
      setBuilding(false);
      setCurrentStep('idle');
    }
  };

  // Run tests
  const handleTest = async () => {
    if (!packagePath.trim()) {
      toast.error('Please select a package path');
      return;
    }

    setTesting(true);
    setTestOutput('');
    setCurrentStep('test');
    setWorkflowProgress(33);

    try {
      const data = await testMovePackage(packagePath.trim(), testFilter.trim() || undefined);
      setTestOutput(data.output);
      setTestPassed(data.passed);
      setTestFailed(data.failed);

      if (data.failed === 0) {
        toast.success(`All ${data.passed} test(s) passed!`);
        setWorkflowProgress(100);
        return true;
      } else {
        toast.error(`${data.failed} test(s) failed`);
        setWorkflowProgress(66);
        return false;
      }
    } catch (error: any) {
      const msg = error.message || String(error);
      setTestOutput(msg);
      setTestPassed(0);
      setTestFailed(1);
      toast.error('Test failed: ' + msg);
      setWorkflowProgress(0);
      return false;
    } finally {
      setTesting(false);
      setCurrentStep('idle');
    }
  };

  // Publish package
  const handlePublish = async () => {
    if (!packagePath.trim()) {
      toast.error('Please select a package path');
      return;
    }

    setPublishing(true);
    const op = startOp('Publishing package');
    setPublishResult(null);
    setCurrentStep('publish');
    setWorkflowProgress(33);

    try {
      const data = await publishPackage(packagePath.trim(), gasBudget, skipDeps);
      setPublishResult({
        success: true,
        packageId: data.packageId,
        digest: data.digest,
        createdObjects: data.createdObjects,
      });
      op.succeed('Package published');
      setWorkflowProgress(100);

      // Auto-save UpgradeCap if enabled
      if (saveUpgradeCap && data.createdObjects) {
        const upgradeCap = data.createdObjects.find(
          (obj: any) => obj.type === 'created' && obj.objectType?.includes('UpgradeCap')
        );
        if (upgradeCap?.objectId) {
          setUpgradeCapId(upgradeCap.objectId);
          addToRecent(packagePath.trim(), upgradeCap.objectId);
          toast.success('UpgradeCap saved for future upgrades');
        }
      }
      return true;
    } catch (error: any) {
      const msg = error.message || String(error);
      setPublishResult({ success: false, error: msg });
      op.fail('Publish failed', msg, handlePublish);
      setWorkflowProgress(0);
      return false;
    } finally {
      setPublishing(false);
      setCurrentStep('idle');
    }
  };

  // Upgrade package
  const handleUpgrade = async () => {
    if (!packagePath.trim()) {
      toast.error('Please select a package path');
      return;
    }
    if (!upgradeCapId.trim()) {
      toast.error('Please enter an upgrade capability ID');
      return;
    }

    setUpgrading(true);
    const op = startOp('Upgrading package');
    setPublishResult(null);
    setCurrentStep('publish');
    setWorkflowProgress(33);

    try {
      const data = await upgradePackage(packagePath.trim(), upgradeCapId.trim(), gasBudget);
      setPublishResult({
        success: true,
        packageId: data.packageId,
        digest: data.digest,
      });
      op.succeed('Package upgraded');
      setWorkflowProgress(100);
      addToRecent(packagePath.trim(), upgradeCapId.trim());
      return true;
    } catch (error: any) {
      const msg = error.message || String(error);
      setPublishResult({ success: false, error: msg });
      op.fail('Upgrade failed', msg, handleUpgrade);
      setWorkflowProgress(0);
      return false;
    } finally {
      setUpgrading(false);
      setCurrentStep('idle');
    }
  };

  // One-click workflow: Build → Test → Publish
  const handleOneClickWorkflow = async () => {
    if (!packagePath.trim()) {
      toast.error('Please select a package path');
      return;
    }

    setIsOneClickRunning(true);

    // Step 1: Build
    toast('Step 1/3: Building...', { icon: '🔨' });
    const buildSuccess = await handleBuild();
    if (!buildSuccess) {
      setIsOneClickRunning(false);
      return;
    }

    // Small delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 2: Test
    toast('Step 2/3: Testing...', { icon: '🧪' });
    const testSuccess = await handleTest();
    if (!testSuccess) {
      setIsOneClickRunning(false);
      toast.error('Tests failed. Fix errors before publishing.');
      return;
    }

    // Small delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 3: Publish
    toast('Step 3/3: Publishing...', { icon: '🚀' });
    const publishSuccess = await handlePublish();

    setIsOneClickRunning(false);

    if (publishSuccess) {
      toast.success('Complete workflow finished successfully!');
    }
  };

  // Load package functions for interaction
  const handleLoadPackage = async () => {
    if (!targetPackageId.trim()) {
      toast.error('Please enter a package ID');
      return;
    }

    setLoadingFunctions(true);
    setPackageModules([]);
    setSelectedFunction(null);
    setCallResult(null);

    try {
      // `explorePackage` (the endpoint behind the Package Explorer), not the
      // inspector: InspectorService parses an older `sui client object` shape and
      // now rejects every package - including 0x2 - with "Object is not a
      // package". This one returns normalized modules straight from the RPC.
      const data = await explorePackage(targetPackageId.trim());
      const modules = data.modules.map((m) => ({
        name: m.name,
        functions: m.functions.map((fn) => toModuleFunction(fn)),
      }));
      setPackageModules(modules);
      toast.success(`Loaded ${modules.length} module(s)`);
      // Remember last package ID
      localStorage.setItem('sui-last-package-id', targetPackageId.trim());
    } catch (error: any) {
      toast.error(error.message || String(error));
    } finally {
      setLoadingFunctions(false);
    }
  };

  // Narrow the picker by function name, signature, or module name. A package can
  // expose dozens of functions across ten-plus modules, so scanning the tree by
  // hand is the slow part of making a call.
  const filteredModules = useMemo(() => {
    const q = functionFilter.trim().toLowerCase();
    if (!q) return packageModules;
    return packageModules
      .map((m) => {
        // A module-name hit keeps the whole module; otherwise keep the matching
        // functions only, so the count badge reflects what you can actually click.
        if (m.name.toLowerCase().includes(q)) return m;
        const functions = m.functions.filter(
          (f) => f.name.toLowerCase().includes(q) || (f.signature ?? '').toLowerCase().includes(q)
        );
        return functions.length ? { ...m, functions } : null;
      })
      .filter((m): m is PackageModule => m !== null);
  }, [packageModules, functionFilter]);

  // While filtering, every surviving module is forced open - collapsed matches
  // read as "no results".
  const isFiltering = functionFilter.trim().length > 0;

  // Toggle module expansion
  const toggleModule = (moduleName: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleName)) {
      newExpanded.delete(moduleName);
    } else {
      newExpanded.add(moduleName);
    }
    setExpandedModules(newExpanded);
  };

  // Select function to call and analyze parameters
  const handleSelectFunction = async (func: ModuleFunction, moduleName: string) => {
    setSelectedFunction(func);
    setSelectedModuleName(moduleName);
    setCallResult(null);
    setAnalyzedParams([]);

    // Initialize args array based on parameter count
    const filteredParams = func.parameters.filter((p) => p.name !== 'ctx' && p.name !== '_ctx');
    const argsCount = filteredParams.length;
    setFunctionArgs(new Array(argsCount).fill(''));
    setFunctionTypeArgs(new Array(func.typeParameters.length).fill(''));

    // Analyze parameters if we have an active address
    if (activeAddress && argsCount > 0) {
      setAnalyzingParams(true);
      try {
        const result = await analyzeParameters(
          targetPackageId.trim(),
          moduleName,
          func.name,
          activeAddress
        );
        setAnalyzedParams(result.parameters);

        // Auto-fill values from analyzed parameters
        const newArgs = [...new Array(argsCount).fill('')];
        result.parameters.forEach((param, idx) => {
          if (param.autoFilled) {
            newArgs[idx] = param.autoFilled.value;
          }
        });
        setFunctionArgs(newArgs);
      } catch (error) {
        console.error('Failed to analyze parameters:', error);
        // Continue without analysis - user can still enter manually
      } finally {
        setAnalyzingParams(false);
      }
    }
  };

  // Refresh parameter suggestions
  const handleRefreshSuggestions = async () => {
    if (!selectedFunction || !selectedModuleName || !activeAddress) return;

    setAnalyzingParams(true);
    try {
      const result = await analyzeParameters(
        targetPackageId.trim(),
        selectedModuleName,
        selectedFunction.name,
        activeAddress
      );
      setAnalyzedParams(result.parameters);
    } catch (error) {
      console.error('Failed to refresh suggestions:', error);
      toast.error('Failed to refresh suggestions');
    } finally {
      setAnalyzingParams(false);
    }
  };

  // Call contract function
  const handleCallFunction = async () => {
    if (!selectedFunction || !selectedModuleName) {
      toast.error('Please select a function to call');
      return;
    }

    setCalling(true);
    setCallResult(null);

    try {
      const data = await callPackageFunction(
        targetPackageId.trim(),
        selectedModuleName,
        selectedFunction.name,
        functionArgs.filter((arg) => arg.trim()),
        functionTypeArgs.filter((t) => t.trim()),
        gasBudget
      );
      setCallResult(data);
      toast.success('Function called successfully!');
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      setCallResult({ error: errorMsg });
      toast.error(errorMsg);
    } finally {
      setCalling(false);
    }
  };

  // Auto-fill package ID from publish result
  useEffect(() => {
    if (publishResult?.success && publishResult.packageId) {
      setTargetPackageId(publishResult.packageId);
    }
  }, [publishResult]);

  // Load last used package ID on mount
  useEffect(() => {
    const lastPackageId = localStorage.getItem('sui-last-package-id');
    if (lastPackageId && !targetPackageId) {
      setTargetPackageId(lastPackageId);
    }
  }, []);

  const isAnyLoading = building || testing || publishing || upgrading || isOneClickRunning;

  // Copy-for-AI: assemble the current deployment state into shareable context
  const copyToClipboard = useCopyToClipboard();

  const packageName = packagePath.trim()
    ? packagePath.trim().split('/').pop() || packagePath.trim()
    : null;
  const deployedObjects = (publishResult?.createdObjects || [])
    .filter((o: any) => o.objectId)
    .slice(0, 200)
    .map((o: any) => ({ objectId: o.objectId, objectType: o.objectType, type: o.type }));

  const hasExportable = !!(
    packagePath.trim() ||
    buildOutput ||
    testOutput ||
    publishResult ||
    packageModules.length
  );

  const aiJson = JSON.stringify(
    {
      network: activeEnv?.alias ?? null,
      activeTab,
      packagePath: packagePath.trim() || null,
      packageName,
      gasBudget,
      build: buildOutput ? { output: buildOutput.slice(0, 4000) } : null,
      tests: testOutput
        ? { passed: testPassed, failed: testFailed, output: testOutput.slice(0, 4000) }
        : null,
      publish: publishResult
        ? {
            success: publishResult.success,
            packageId: publishResult.packageId ?? null,
            digest: publishResult.digest ?? null,
            error: publishResult.error ?? null,
            createdObjects: deployedObjects,
          }
        : null,
      upgradeCapId: upgradeCapId.trim() || null,
      targetPackageId: targetPackageId.trim() || null,
      loadedModules: packageModules.map((m) => ({ name: m.name, functions: m.functions.length })),
    },
    null,
    2
  );

  const aiMarkdown = [
    '# Sui Move deployment',
    '',
    `- **Network:** ${activeEnv?.alias ?? 'not connected'}`,
    `- **Package path:** ${packagePath.trim() || 'not set'}`,
    packageName ? `- **Package name:** ${packageName}` : null,
    `- **Gas budget:** ${gasBudget} MIST`,
    testOutput ? `- **Tests:** ${testPassed} passed, ${testFailed} failed` : null,
    publishResult?.success && publishResult.packageId
      ? `- **Deployed package ID:** ${publishResult.packageId}`
      : null,
    publishResult?.digest ? `- **Tx digest:** ${publishResult.digest}` : null,
    publishResult && !publishResult.success && publishResult.error
      ? `- **Publish error:** ${publishResult.error}`
      : null,
    deployedObjects.length > 0 ? '' : null,
    deployedObjects.length > 0 ? '## Created objects' : null,
    ...(deployedObjects.length > 0
      ? deployedObjects.map((o) => `- \`${o.objectId}\` — ${o.objectType || o.type}`)
      : []),
    buildOutput ? '' : null,
    buildOutput ? '## Build output' : null,
    buildOutput ? '```\n' + buildOutput.slice(0, 4000) + '\n```' : null,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const aiPrompt = buildAiContext({
    title: 'Sui Move package workflow',
    intro: [
      'Move Studio drives the local `sui move` CLI against a package directory on',
      'this machine. Below is the current build/test/publish state.',
    ],
    stateJson: aiJson,
    extra: aiMarkdown,
    endpoints: [
      { method: 'GET', path: '/health', effect: 'confirm the server is up' },
      {
        method: 'POST',
        path: '/move/build',
        body: '{ packagePath }',
        effect: 'compile; returns CLI stdout/stderr',
      },
      {
        method: 'POST',
        path: '/move/test',
        body: '{ packagePath, filter? }',
        effect: 'run Move unit tests',
      },
      {
        method: 'POST',
        path: '/move/publish',
        body: '{ packagePath, gasBudget?, skipDependencyVerification? }',
        effect: 'signs and publishes the package on-chain',
        mutating: true,
      },
      {
        method: 'POST',
        path: '/packages/upgrade',
        body: '{ packagePath, upgradeCapId, gasBudget? }',
        effect: 'signs and publishes a new version',
        mutating: true,
      },
      {
        method: 'GET',
        path: '/packages/:id/explore',
        effect: "a published package's callable interface",
      },
    ],
    rules: [
      'Build, test, publish and upgrade all need a local directory containing `Move.toml` - a package ID alone is not enough',
      'Publishing returns an UpgradeCap; upgrading is impossible without it',
      'The CLI prints `[warning]` lines (e.g. protocol version drift) and `INCLUDING DEPENDENCY` / `BUILDING` progress on the same stream as errors - warnings are not failures',
      'A CLI protocol version behind the network usually surfaces as a dependency-verification failure, not a clear error',
      'Gas budgets are MIST (1 SUI = 1e9 MIST)',
    ],
    examples: [
      'read this build failure',
      'explain the test output',
      'work out why publish failed',
      'build the sui client call for a function',
    ],
  });

  // Studio actions, reachable without hunting for the button that runs them.
  // ⌘K is already taken app-wide by the QuickSwitcher (MainLayout), so this one
  // answers to ⌘J.
  const paletteItems: CommandItem[] = [
    {
      id: 'build',
      label: 'Build package',
      group: 'Workflow',
      icon: Package,
      keywords: ['compile'],
      disabled: !isValidPath || isAnyLoading,
      onSelect: () => {
        handleTabChange('develop');
        handleBuild();
      },
    },
    {
      id: 'test',
      label: 'Run tests',
      group: 'Workflow',
      icon: TestTube2,
      disabled: !isValidPath || isAnyLoading,
      onSelect: () => {
        handleTabChange('develop');
        handleTest();
      },
    },
    {
      id: 'publish',
      label: 'Publish package',
      group: 'Workflow',
      icon: Rocket,
      keywords: ['deploy'],
      disabled: !isValidPath || isAnyLoading,
      onSelect: () => {
        handleTabChange('deploy');
        handlePublish();
      },
    },
    {
      id: 'upgrade',
      label: 'Upgrade package',
      group: 'Workflow',
      icon: RefreshCw,
      disabled: !isValidPath || isAnyLoading,
      onSelect: () => {
        handleTabChange('upgrade');
        handleUpgrade();
      },
    },
    {
      id: 'one-click',
      label: 'Build → Test → Publish',
      group: 'Workflow',
      icon: PlayCircle,
      keywords: ['one click', 'workflow', 'all'],
      disabled: !isValidPath || isAnyLoading,
      onSelect: () => {
        handleTabChange('develop');
        handleOneClickWorkflow();
      },
    },
    {
      id: 'load',
      label: 'Load package functions',
      group: 'Interact',
      icon: Zap,
      keywords: ['call', 'interact', 'functions'],
      disabled: !targetPackageId.trim() || isAnyLoading,
      onSelect: () => {
        handleTabChange('interact');
        handleLoadPackage();
      },
    },
    ...(['develop', 'deploy', 'upgrade', 'interact'] as const).map((tab) => ({
      id: `goto-${tab}`,
      label: `Go to ${tab[0].toUpperCase()}${tab.slice(1)}`,
      group: 'Navigate',
      icon: Code,
      keywords: ['tab', 'switch'],
      onSelect: () => handleTabChange(tab),
    })),
  ];

  return (
    <>
      <CommandPalette items={paletteItems} shortcut="j" placeholder="Search Move Studio actions…" />
      <AnimatedToastStack
        toasts={opToasts}
        onDismiss={dismissOpToast}
        position="bottom-right"
        placement="fixed"
        maxVisible={3}
      />
      {/* Content */}
      <div className="relative z-10 p-3 sm:p-4 overflow-x-hidden">
        <div className="relative max-w-7xl mx-auto space-y-3">
          {/* Compact Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative z-10 flex flex-wrap items-center justify-between gap-y-2"
          >
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-foreground" />
              <h1 className="text-lg font-bold text-foreground">Move Development Studio</h1>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {flowDone && (
                <button
                  type="button"
                  onClick={() => setFlowDone(false)}
                  className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Change package
                </button>
              )}
              <p className="text-muted-foreground text-xs hidden xl:block">Build • Test • Deploy</p>
              {hasExportable && (
                <CopyForAiMenu
                  prompt={aiPrompt}
                  json={aiJson}
                  markdown={aiMarkdown}
                  onCopy={copyToClipboard}
                />
              )}
            </div>
          </motion.div>

          {/* Workflow Pipeline Indicator */}
          {(isAnyLoading || buildOutput || testOutput || publishResult) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <WorkflowPipelineIndicator
                currentStep={currentStep}
                completedSteps={
                  new Set(
                    [
                      buildOutput && !buildOutput.includes('error') ? 'build' : '',
                      testOutput && testOutput.includes('Passed') ? 'test' : '',
                      publishResult?.success ? 'publish' : '',
                    ].filter(Boolean)
                  )
                }
                failedSteps={
                  new Set(
                    [
                      buildOutput && buildOutput.includes('error') ? 'build' : '',
                      testOutput &&
                      testOutput.includes('failed') &&
                      !testOutput.includes('failed: 0')
                        ? 'test'
                        : '',
                      publishResult && !publishResult.success ? 'publish' : '',
                    ].filter(Boolean)
                  )
                }
                progress={workflowProgress}
              />
            </motion.div>
          )}

          {!flowDone && (
            <MoveStudioFlow
              packagePath={packagePath}
              onPackagePathChange={setPackagePath}
              onBrowse={() => setShowBrowser(true)}
              targetPackageId={targetPackageId}
              onTargetPackageIdChange={setTargetPackageId}
              activeAddress={activeAddress ?? undefined}
              onComplete={(stage: StudioStage) => {
                handleTabChange(stage);
                setFlowDone(true);
              }}
            />
          )}

          <div
            className={cn(
              'grid grid-cols-1 lg:grid-cols-4 gap-3 w-full min-w-0',
              !flowDone && 'hidden'
            )}
          >
            {/* Left Column: Package Selection - Compact */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
              className="lg:col-span-1 space-y-2 min-w-0"
            >
              {/* Recent Projects - Compact */}
              <Card className="bg-card backdrop-blur-md border-border transition-colors shadow-md">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    Recent
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2 space-y-1">
                  {recentProjects.length === 0 ? (
                    <div className="text-center py-4">
                      <FolderOpen className="w-5 h-5 text-muted-foreground/60 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground">No recent projects</p>
                    </div>
                  ) : (
                    recentProjects.map((project) => (
                      <motion.div
                        key={project.path}
                        onClick={() => useRecentProject(project)}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-2 p-2 rounded bg-card hover:bg-muted/50 border border-border hover:border-border cursor-pointer group transition-all"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">
                            {project.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(project.lastUsed).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={(e) => removeFromRecent(project.path, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-error/20 rounded transition-all"
                        >
                          <Trash2 className="w-2.5 h-2.5 text-error" />
                        </button>
                      </motion.div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Right Column: Main Content */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.15 }}
              className="lg:col-span-3 space-y-2 min-w-0 overflow-hidden"
            >
              {/* Main Workflow Tabs - underline variant reads as build stages and
                  keeps a light footprint next to the blue One-Click bar above. */}
              <Tabs
                value={activeTab}
                onValueChange={handleTabChange}
                variant="underline"
                className="w-full"
              >
                <TabsList indicatorClassName="bg-[#4da2ff]">
                  <TabsTrigger value="develop" icon={<Code />}>
                    Develop
                  </TabsTrigger>
                  <TabsTrigger value="deploy" icon={<Rocket />}>
                    Deploy
                  </TabsTrigger>
                  <TabsTrigger value="upgrade" icon={<RefreshCw />}>
                    Upgrade
                  </TabsTrigger>
                  <TabsTrigger value="interact" icon={<Zap />}>
                    Interact
                  </TabsTrigger>
                </TabsList>
                <p className="px-1 pt-2 text-xs text-muted-foreground">
                  {activeTab === 'develop' && 'Write, build, and test your Move package locally'}
                  {activeTab === 'deploy' && 'Publish a new package to the network'}
                  {activeTab === 'upgrade' && 'Upgrade an already-published package'}
                  {activeTab === 'interact' && 'Call functions on a deployed package'}
                </p>

                {/* Package path, gas and options drive build/test/publish/upgrade,
                    so they stay pinned under the stage picker - but Interact works
                    off a deployed package ID, not a local directory, so the whole
                    block drops away there. */}
                {activeTab !== 'interact' && (
                  <div className="space-y-2 mt-2">
                    {/* Package Configuration - Compact */}
                    <Card className="bg-card backdrop-blur-md border-border transition-colors shadow-md relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-border" />
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                          <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
                          Package Configuration
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-2">
                        {/* Package Path - Compact */}
                        <div className="space-y-1">
                          <Label
                            htmlFor="package-path"
                            className="text-xs font-medium flex items-center gap-1 text-foreground"
                          >
                            Package Path <span className="text-error">*</span>
                          </Label>
                          <div className="flex gap-1.5">
                            <input
                              id="package-path"
                              type="text"
                              value={packagePath}
                              onChange={(e) => setPackagePath(e.target.value)}
                              placeholder="/path/to/your/move/package"
                              className="flex-1 px-2.5 py-1.5 bg-card border border-border rounded text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary transition-all text-xs font-mono"
                              disabled={isAnyLoading}
                            />
                            <button
                              onClick={() => setShowBrowser(true)}
                              disabled={isAnyLoading}
                              className="px-2.5 py-1.5 bg-secondary border border-border text-foreground rounded hover:bg-accent transition-colors disabled:opacity-50"
                              title="Browse"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Absolute path to your Move package directory (containing Move.toml)
                          </p>
                        </div>

                        <Separator className="bg-muted my-1" />

                        {/* Gas & Options. Single column until `sm`: side by side in a
                          narrow card the two checkbox labels collide. */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label
                              htmlFor="gas-budget"
                              className="text-xs font-medium text-foreground"
                            >
                              Gas Budget
                            </Label>
                            <Select
                              value={gasPreset}
                              onValueChange={(v) => {
                                setGasPreset(v);
                                if (v !== 'custom') setGasBudget(v);
                              }}
                              disabled={isAnyLoading}
                            >
                              <SelectTrigger className="py-1.5 text-xs">
                                <SelectValue placeholder="Choose a budget" />
                              </SelectTrigger>
                              <SelectContent>
                                {GAS_PRESETS.map((preset) => (
                                  <SelectItem key={preset.value} value={preset.value}>
                                    {preset.label}
                                  </SelectItem>
                                ))}
                                <SelectItem value="custom">Custom…</SelectItem>
                              </SelectContent>
                            </Select>
                            {gasPreset === 'custom' && (
                              <input
                                id="gas-budget"
                                type="text"
                                value={gasBudget}
                                onChange={(e) => setGasBudget(e.target.value)}
                                placeholder="100000000"
                                className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring transition-all text-xs font-mono"
                                disabled={isAnyLoading}
                              />
                            )}
                            <p className="text-xs text-muted-foreground/60">
                              {gasBudget} MIST (0.1 SUI = 100000000 MIST)
                            </p>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-foreground">Options</Label>
                            <div className="flex flex-col gap-2 pt-1">
                              <Checkbox
                                checked={saveUpgradeCap}
                                onCheckedChange={setSaveUpgradeCap}
                                disabled={isAnyLoading}
                                label="Auto-save UpgradeCap"
                              />
                              <Checkbox
                                checked={skipDeps}
                                onCheckedChange={setSkipDeps}
                                disabled={isAnyLoading}
                                label="Skip dependency verification"
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* One-Click Workflow - Compact */}
                    <Card className="bg-card backdrop-blur-md border-primary/40 shadow-md relative overflow-hidden">
                      <CardHeader className="py-2 px-3 relative z-10">
                        <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                          <PlayCircle className="w-3.5 h-3.5 text-muted-foreground" />
                          One-Click Workflow
                          <span className="text-xs text-muted-foreground ml-auto font-normal">
                            Automatically build, test, and publish
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 relative z-10">
                        <Button
                          onClick={handleOneClickWorkflow}
                          disabled={!isValidPath || isAnyLoading}
                          className="w-full bg-primary border border-primary text-primary-foreground hover:bg-primary/90"
                        >
                          {isOneClickRunning ? (
                            <>
                              <Loader variant="dither" size={16} label="Working" />
                              Running...
                            </>
                          ) : (
                            <>
                              <Rocket className="w-4 h-4" />
                              Build → Test → Publish
                              <ChevronRight className="w-3 h-3" />
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground text-center mt-1.5 flex items-center justify-center gap-1">
                          <Zap className="w-2.5 h-2.5 text-muted-foreground" />
                          Recommended for production deployment
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Develop Tab - Redesigned: Actions on top, Output below full-width */}
                <TabsContent value="develop" className="space-y-3 mt-2">
                  {/* Action Buttons - Compact 2 columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Build Action */}
                    <Card className="bg-card backdrop-blur-md border-border transition-colors relative shadow-md rounded-xl">
                      <div
                        className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl transition-all z-10 ${
                          building
                            ? 'bg-success animate-pulse'
                            : buildOutput && !buildOutput.includes('error')
                              ? 'bg-success'
                              : buildOutput && buildOutput.includes('error')
                                ? 'bg-error'
                                : 'bg-border'
                        }`}
                      />
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          Build Package
                          {buildOutput && !building && (
                            <Badge
                              className={`text-xs ml-auto ${
                                buildOutput.includes('error')
                                  ? 'bg-error/15 text-error border-error/30'
                                  : 'bg-success/15 text-success border-success/30'
                              }`}
                            >
                              {buildOutput.includes('error') ? 'Failed' : 'Success'}
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <Button
                          onClick={handleBuild}
                          disabled={!isValidPath || building || isAnyLoading}
                          size="sm"
                          className="w-full bg-secondary border border-border text-foreground hover:bg-accent"
                        >
                          {building ? (
                            <>
                              <Loader variant="dither" size={12} label="Working" />
                              Building...
                            </>
                          ) : (
                            <>
                              <Building2 className="w-3 h-3" />
                              Build Package
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Test Action */}
                    <Card className="bg-card backdrop-blur-md border-border transition-colors relative shadow-md rounded-xl">
                      <div
                        className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl transition-all z-10 ${
                          testing
                            ? 'bg-success animate-pulse'
                            : testOutput && testOutput.includes('failed: 0')
                              ? 'bg-success'
                              : testOutput && testOutput.includes('failed')
                                ? 'bg-error'
                                : 'bg-border'
                        }`}
                      />
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                          <TestTube2 className="w-3.5 h-3.5 text-muted-foreground" />
                          Run Tests
                          {testOutput && !testing && (
                            <Badge
                              className={`text-xs ml-auto ${
                                testOutput.includes('failed: 0')
                                  ? 'bg-success/15 text-success border-success/30'
                                  : 'bg-error/15 text-error border-error/30'
                              }`}
                            >
                              {testOutput.includes('failed: 0') ? 'Passed' : 'Failed'}
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-2">
                        <input
                          type="text"
                          value={testFilter}
                          onChange={(e) => setTestFilter(e.target.value)}
                          placeholder="Filter tests by name..."
                          disabled={isAnyLoading}
                          className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring transition-all text-xs font-mono"
                        />
                        <Button
                          onClick={handleTest}
                          disabled={!isValidPath || testing || isAnyLoading}
                          size="sm"
                          className="w-full bg-secondary border border-border text-foreground hover:bg-accent"
                        >
                          {testing ? (
                            <>
                              <Loader variant="dither" size={12} label="Working" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <TestTube2 className="w-3 h-3" />
                              Run Tests
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Output Section - FULL WIDTH below buttons */}
                  {(building || testing || buildOutput || testOutput) && (
                    <div className="grid grid-cols-1 gap-3">
                      {/* Build Output - Full Width */}
                      {(building || buildOutput) && (
                        <Card className="bg-card backdrop-blur-md border-border shadow-md rounded-xl">
                          <CardHeader className="py-2 px-3 border-b border-border">
                            <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                              Build Output
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-3">
                            <AnimatePresence mode="wait">
                              {building && !buildOutput && (
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="space-y-1.5 p-2 bg-muted/50 border border-border rounded"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <Loader
                                      variant="dither"
                                      size={12}
                                      label="Working"
                                      className="text-foreground"
                                    />
                                    <span className="text-xs text-foreground">Compiling...</span>
                                  </div>
                                  <Skeleton className="h-2 w-full bg-muted" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                            {buildOutput && (
                              <TerminalBuildOutput
                                output={buildOutput}
                                isError={
                                  buildOutput.includes('error') || buildOutput.includes('Error')
                                }
                              />
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Test Output - Full Width */}
                      {(testing || testOutput) && (
                        <Card className="bg-card backdrop-blur-md border-border shadow-md rounded-xl">
                          <CardHeader className="py-2 px-3 border-b border-border">
                            <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                              <TestTube2 className="w-3.5 h-3.5 text-muted-foreground" />
                              Test Results
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-3">
                            <AnimatePresence mode="wait">
                              {testing && !testOutput && (
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="space-y-1.5 p-2 bg-muted/50 border border-border rounded"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <Loader
                                      variant="dither"
                                      size={12}
                                      label="Working"
                                      className="text-foreground"
                                    />
                                    <span className="text-xs text-foreground">
                                      Running tests...
                                    </span>
                                  </div>
                                  <Skeleton className="h-2 w-full bg-muted" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                            {testOutput && (
                              <TerminalTestOutput
                                output={testOutput}
                                passed={testPassed}
                                failed={testFailed}
                              />
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* Pro Tip - Very Compact */}
                  <div className="flex items-center gap-2 px-3 py-2 border border-border bg-muted/50 backdrop-blur-md rounded-lg">
                    <Lightbulb className="h-3.5 w-3.5 text-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Pro Tip:</strong> Always build before
                      testing. Use the One-Click Workflow for the complete process.
                    </span>
                  </div>
                </TabsContent>

                {/* Deploy Tab - Compact */}
                <TabsContent value="deploy" className="space-y-2 mt-2">
                  <Card className="bg-card backdrop-blur-md border-border transition-colors shadow-md">
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                        <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                        Publish Package
                        <span className="text-xs text-muted-foreground ml-auto font-normal">
                          Deploy to blockchain
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-2">
                      <Button
                        onClick={handlePublish}
                        disabled={!isValidPath || publishing || isAnyLoading}
                        className="w-full bg-secondary border border-border text-foreground hover:bg-accent"
                      >
                        {publishing ? (
                          <>
                            <Loader variant="dither" size={16} label="Working" />
                            Publishing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Publish Package
                          </>
                        )}
                      </Button>
                      <AnimatePresence mode="wait">
                        {publishing && !publishResult && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-2 bg-muted/50 border border-border rounded space-y-1"
                          >
                            <div className="flex items-center gap-1.5">
                              <Loader
                                variant="dither"
                                size={12}
                                label="Working"
                                className="text-foreground"
                              />
                              <span className="text-xs text-foreground">Publishing...</span>
                            </div>
                            <div className="space-y-1 pl-4">
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5 text-foreground" />
                                <span className="text-xs text-muted-foreground">Compiling...</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Loader
                                  variant="dither"
                                  size={10}
                                  label="Working"
                                  className="text-foreground"
                                />
                                <span className="text-xs text-foreground">Generating tx...</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Circle className="w-2.5 h-2.5 text-muted-foreground/40" />
                                <span className="text-xs text-muted-foreground">Confirming...</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                  <AnimatePresence mode="wait">
                    {publishResult && (
                      <>
                        {publishResult.success ? (
                          <TerminalSuccessDisplay
                            title="PACKAGE PUBLISHED"
                            command="sui client publish --gas-budget 100000000"
                            rawOutput={(publishResult as any).output}
                            fields={[
                              ...(publishResult.packageId
                                ? [
                                    {
                                      label: 'PACKAGE_ID',
                                      value: publishResult.packageId,
                                      copyable: true,
                                    },
                                  ]
                                : []),
                              ...(publishResult.digest
                                ? [
                                    {
                                      label: 'TX_DIGEST',
                                      value: publishResult.digest,
                                      copyable: true,
                                    },
                                  ]
                                : []),
                              ...(publishResult.createdObjects || [])
                                .filter((obj: any) => {
                                  // Only include objects that have a valid objectId
                                  // Skip 'published' type (package info) and objects without objectId
                                  return (
                                    obj.type === 'created' &&
                                    obj.objectId &&
                                    typeof obj.objectId === 'string' &&
                                    obj.objectId.startsWith('0x')
                                  );
                                })
                                .map((obj: any) => ({
                                  label: obj.objectType?.includes('UpgradeCap')
                                    ? 'UPGRADE_CAP'
                                    : 'CREATED_OBJECT',
                                  value: obj.objectId,
                                  copyable: true,
                                })),
                            ]}
                          />
                        ) : (
                          <TerminalErrorDisplay
                            title="PUBLISH FAILED"
                            error={publishResult.error || 'Unknown error'}
                            onRetry={handlePublish}
                            suggestions={[
                              'Check gas budget',
                              'Verify SUI balance',
                              'Ensure package builds first',
                              'Check network connection',
                            ]}
                          />
                        )}
                      </>
                    )}
                  </AnimatePresence>
                  <div className="flex items-center gap-2 px-3 py-2 border border-border bg-muted/50 backdrop-blur-md rounded-lg">
                    <AlertCircle className="h-3.5 w-3.5 text-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Before Publishing:</strong> Ensure your
                      package builds and all tests pass.
                    </span>
                  </div>
                </TabsContent>

                {/* Upgrade Tab - Compact */}
                <TabsContent value="upgrade" className="space-y-2 mt-2">
                  <Card className="bg-card backdrop-blur-md border-border transition-colors shadow-md">
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                        <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                        Upgrade Package
                        <span className="text-xs text-muted-foreground ml-auto font-normal">
                          Using UpgradeCap
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-2">
                      <div className="space-y-1">
                        <Label
                          htmlFor="upgrade-cap"
                          className="text-xs font-medium flex items-center gap-1 text-foreground"
                        >
                          UpgradeCap Object ID <span className="text-error">*</span>
                        </Label>
                        <input
                          id="upgrade-cap"
                          type="text"
                          value={upgradeCapId}
                          onChange={(e) => setUpgradeCapId(e.target.value)}
                          placeholder="0x... (auto-filled from recent)"
                          disabled={isAnyLoading}
                          className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring transition-all text-xs font-mono"
                        />
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" />
                          UpgradeCap from initial publish
                        </p>
                      </div>
                      <Button
                        onClick={handleUpgrade}
                        disabled={!isValidPath || !upgradeCapId.trim() || upgrading || isAnyLoading}
                        className="w-full bg-secondary border border-border text-foreground hover:bg-accent"
                      >
                        {upgrading ? (
                          <>
                            <Loader variant="dither" size={16} label="Working" />
                            Upgrading...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            Upgrade Package
                          </>
                        )}
                      </Button>
                      <AnimatePresence mode="wait">
                        {upgrading && !publishResult && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-2 bg-muted/50 border border-border rounded space-y-1"
                          >
                            <div className="flex items-center gap-1.5">
                              <Loader
                                variant="dither"
                                size={12}
                                label="Working"
                                className="text-foreground"
                              />
                              <span className="text-xs text-foreground">Upgrading...</span>
                            </div>
                            <Skeleton className="h-2 w-full bg-muted" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                  <div className="flex items-center gap-2 px-3 py-2 border border-border bg-muted/50 backdrop-blur-md rounded-lg">
                    <AlertCircle className="h-3.5 w-3.5 text-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Requirements:</strong> Own the UpgradeCap,
                      build updated package first.
                    </span>
                  </div>
                </TabsContent>

                {/* Interact Tab - Compact */}
                <TabsContent value="interact" className="space-y-2 mt-2">
                  {/* Package Loader - Compact */}
                  <Card className="bg-card backdrop-blur-md border-border transition-colors shadow-md">
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                        <Package className="w-3.5 h-3.5 text-muted-foreground" />
                        Load Package
                        <span className="text-xs text-muted-foreground ml-auto font-normal">
                          Enter package ID to inspect
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-2">
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={targetPackageId}
                          onChange={(e) => setTargetPackageId(e.target.value)}
                          placeholder="0x... (auto-filled from publish)"
                          className="flex-1 px-2.5 py-1.5 bg-card border border-border rounded text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring transition-all text-xs font-mono"
                          disabled={loadingFunctions}
                        />
                        <Button
                          onClick={handleLoadPackage}
                          disabled={!targetPackageId.trim() || loadingFunctions}
                          size="sm"
                          className="bg-muted border border-border text-foreground hover:bg-accent whitespace-nowrap"
                        >
                          {loadingFunctions ? (
                            <>
                              <Loader variant="dither" size={12} label="Working" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <Package className="w-3 h-3" />
                              Load
                            </>
                          )}
                        </Button>
                      </div>
                      <AnimatePresence mode="wait">
                        {loadingFunctions && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-1"
                          >
                            <Skeleton className="h-2 w-full bg-muted" />
                            <Skeleton className="h-2 w-3/4 bg-muted/50" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {packageModules.length > 0 && (
                        <div className="flex items-center gap-1.5 p-1.5 bg-muted/50 border border-border rounded">
                          <CheckCircle2 className="h-3 w-3 text-foreground" />
                          <span className="text-xs text-muted-foreground">
                            <strong className="text-foreground">Loaded!</strong>{' '}
                            {packageModules.length} module(s)
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Function List - Compact */}
                  {packageModules.length > 0 && (
                    <Card className="bg-card backdrop-blur-md border-border transition-colors shadow-md">
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-sm flex items-center gap-1.5 text-foreground">
                          <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
                          Functions
                          <span className="text-xs text-muted-foreground ml-auto font-normal">
                            {isFiltering
                              ? `${filteredModules.reduce((n, m) => n + m.functions.length, 0)} match${
                                  filteredModules.reduce((n, m) => n + m.functions.length, 0) === 1
                                    ? ''
                                    : 'es'
                                }`
                              : 'Click to select'}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <div className="px-3 pb-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                          <input
                            type="text"
                            value={functionFilter}
                            onChange={(e) => setFunctionFilter(e.target.value)}
                            placeholder="Filter functions by name or signature..."
                            className="w-full pl-7 pr-3 py-1.5 bg-secondary border border-border rounded text-xs font-mono text-foreground placeholder:text-tertiary focus:outline-none focus:border-primary/50 transition-colors"
                          />
                        </div>
                      </div>
                      <CardContent className="px-3 pb-2 space-y-1 max-h-48 overflow-y-auto">
                        {isFiltering && filteredModules.length === 0 && (
                          <div className="py-4 text-center text-xs text-muted-foreground">
                            No function matches “{functionFilter.trim()}”
                          </div>
                        )}
                        {filteredModules.map((module) => (
                          <div
                            key={module.name}
                            className="border border-border rounded overflow-hidden"
                          >
                            <button
                              onClick={() => toggleModule(module.name)}
                              className="w-full px-2 py-1.5 bg-secondary hover:bg-muted/50 transition-colors flex items-center justify-between text-xs"
                            >
                              <span className="flex items-center gap-1.5">
                                <Code className="w-3 h-3 text-foreground" />
                                <span className="text-foreground font-mono">{module.name}</span>
                                <Badge className="bg-muted text-foreground text-xs border-border px-1">
                                  {module.functions.length}
                                </Badge>
                              </span>
                              <ChevronDown
                                className={`w-3 h-3 text-foreground transition-transform ${isFiltering || expandedModules.has(module.name) ? 'rotate-180' : ''}`}
                              />
                            </button>
                            <AnimatePresence>
                              {(isFiltering || expandedModules.has(module.name)) && (
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: 'auto' }}
                                  exit={{ height: 0 }}
                                  className="divide-y divide-border overflow-hidden"
                                >
                                  {module.functions.map((func) => {
                                    const isEntry =
                                      func.visibility === 'public' || func.visibility === 'entry';
                                    const isSelected =
                                      selectedFunction?.name === func.name &&
                                      selectedModuleName === module.name;
                                    return (
                                      <button
                                        key={func.name}
                                        onClick={() => handleSelectFunction(func, module.name)}
                                        className={`w-full px-2 py-1.5 text-left hover:bg-accent transition-all ${isSelected ? 'bg-accent border-l-2 border-primary' : ''}`}
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <Zap
                                            className={`w-2.5 h-2.5 flex-shrink-0 ${isEntry ? 'text-primary' : 'text-muted-foreground'}`}
                                          />
                                          <span className="text-xs text-foreground font-mono truncate">
                                            {func.name}
                                          </span>
                                          <Badge
                                            className={`text-xs px-1 font-mono ${isEntry ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}
                                          >
                                            {func.visibility}
                                          </Badge>
                                        </div>
                                        <code className="text-xs text-muted-foreground truncate block mt-0.5 font-mono">
                                          {func.signature}
                                        </code>
                                      </button>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Function Call Form - Compact */}
                  {selectedFunction && (
                    <Card className="bg-card backdrop-blur-md border-border shadow-md relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-border" />
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-sm flex items-center gap-1.5 text-foreground font-mono">
                          <PlayCircle className="w-3.5 h-3.5 text-muted-foreground" />
                          {selectedFunction.name}
                          <span className="text-xs text-muted-foreground ml-auto font-normal">
                            {selectedModuleName}::{selectedFunction.name}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-2">
                        {/* Type Arguments - Compact */}
                        {selectedFunction.typeParameters.length > 0 && (
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-foreground">
                              Type Args ({selectedFunction.typeParameters.length})
                            </Label>
                            <div className="space-y-1">
                              {selectedFunction.typeParameters.map((typeParam, idx) => (
                                <input
                                  key={idx}
                                  type="text"
                                  value={functionTypeArgs[idx] || ''}
                                  onChange={(e) => {
                                    const n = [...functionTypeArgs];
                                    n[idx] = e.target.value;
                                    setFunctionTypeArgs(n);
                                  }}
                                  placeholder={`${typeParam} (e.g., 0x2::sui::SUI)`}
                                  className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring transition-all text-xs font-mono"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Parameters - Compact */}
                        {selectedFunction.parameters.filter(
                          (p) => p.name !== 'ctx' && p.name !== '_ctx'
                        ).length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium text-foreground">
                                Parameters
                              </Label>
                              {analyzingParams && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Loader variant="dither" size={10} label="Working" />
                                  Analyzing...
                                </span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {selectedFunction.parameters
                                .filter((p) => p.name !== 'ctx' && p.name !== '_ctx')
                                .map((param, idx) => {
                                  const analyzedParam = analyzedParams[idx];
                                  if (analyzedParam) {
                                    return (
                                      <div
                                        key={idx}
                                        className="p-2 bg-secondary border border-border rounded"
                                      >
                                        <ParameterInputField
                                          parameter={analyzedParam}
                                          value={functionArgs[idx] || ''}
                                          onChange={(v) => {
                                            const n = [...functionArgs];
                                            n[idx] = v;
                                            setFunctionArgs(n);
                                          }}
                                          onRefreshSuggestions={handleRefreshSuggestions}
                                          isLoading={analyzingParams}
                                          disabled={calling}
                                        />
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={idx} className="space-y-0.5">
                                      <Label className="text-xs text-foreground font-mono">
                                        {param.name}: {param.type}
                                      </Label>
                                      <input
                                        type="text"
                                        value={functionArgs[idx] || ''}
                                        onChange={(e) => {
                                          const n = [...functionArgs];
                                          n[idx] = e.target.value;
                                          setFunctionArgs(n);
                                        }}
                                        placeholder={`Enter ${param.type}`}
                                        disabled={calling}
                                        className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring text-xs font-mono disabled:opacity-50"
                                      />
                                    </div>
                                  );
                                })}
                            </div>
                            {!activeAddress && (
                              <p className="text-xs text-yellow-500/70">
                                Connect wallet for suggestions
                              </p>
                            )}
                          </div>
                        )}
                        {/* Call Button - Compact */}
                        <Button
                          onClick={handleCallFunction}
                          disabled={calling}
                          className="w-full bg-secondary border border-border text-foreground hover:bg-accent"
                        >
                          {calling ? (
                            <>
                              <Loader variant="dither" size={16} label="Working" />
                              Calling...
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4" />
                              Call Function
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Transaction Result */}
                  <AnimatePresence mode="wait">
                    {callResult && (
                      <>
                        {callResult.error ? (
                          <TerminalErrorDisplay
                            title="CALL FAILED"
                            error={callResult.error}
                            onRetry={handleCallFunction}
                            suggestions={[
                              'Check parameters',
                              'Verify type args',
                              'Check gas',
                              'Ensure entry/public',
                            ]}
                          />
                        ) : (
                          <TerminalSuccessDisplay
                            title="EXECUTED"
                            command={`sui client call --package ${targetPackageId} --module ${selectedModuleName} --function ${selectedFunction?.name}${functionTypeArgs.filter((t) => t.trim()).length > 0 ? ` --type-args ${functionTypeArgs.filter((t) => t.trim()).join(' ')}` : ''}${functionArgs.filter((a) => a.trim()).length > 0 ? ` --args ${functionArgs.filter((a) => a.trim()).join(' ')}` : ''} --gas-budget ${gasBudget}`}
                            fields={[
                              ...(callResult.digest
                                ? [{ label: 'TX_DIGEST', value: callResult.digest, copyable: true }]
                                : []),
                              ...(callResult.gasUsed
                                ? [
                                    {
                                      label: 'GAS_USED',
                                      value: `${callResult.gasUsed} MIST`,
                                      copyable: false,
                                    },
                                  ]
                                : []),
                              ...(callResult.objectChanges
                                ?.filter((c: any) => c.type === 'created')
                                .map((obj: any) => ({
                                  label: `CREATED (${obj.objectType?.split('::').pop() || 'Object'})`,
                                  value: obj.objectId,
                                  copyable: true,
                                })) || []),
                              ...(callResult.objectChanges
                                ?.filter((c: any) => c.type === 'mutated')
                                .map((obj: any) => ({
                                  label: `MUTATED (${obj.objectType?.split('::').pop() || 'Object'})`,
                                  value: obj.objectId,
                                  copyable: true,
                                })) || []),
                            ]}
                            message="Function executed successfully"
                          />
                        )}
                      </>
                    )}
                  </AnimatePresence>
                  {/* Tips - Compact */}
                  <div className="flex items-center gap-2 px-3 py-2 border border-border bg-muted/50 backdrop-blur-md rounded-lg">
                    <Lightbulb className="h-3.5 w-3.5 text-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Tips:</strong> Package ID auto-filled from
                      publish. Type args use full paths:{' '}
                      <code className="bg-card px-0.5 rounded text-foreground">0x2::sui::SUI</code>
                    </span>
                  </div>
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>
        </div>
      </div>

      {/* File Browser Modal */}
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
    </>
  );
}
