import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Building2,
  TestTube2,
  Upload,
  Package,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lightbulb,
  Code,
  FileCode,
  Rocket,
  FolderOpen,
  Clock,
  Sparkles,
  PlayCircle,
  ChevronRight,
  Trash2,
  Zap,
  ChevronDown,
  Loader2,
  Circle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { WorkflowPipelineIndicator } from '@/components/ui/workflow-pipeline';
import { Badge } from '@/components/ui/badge';
import { FileBrowser } from './FileBrowser';
import { TerminalErrorDisplay } from './TerminalErrorDisplay';
import { TerminalSuccessDisplay } from './TerminalSuccessDisplay';
import { TerminalBuildOutput } from './TerminalBuildOutput';
import { TerminalTestOutput } from './TerminalTestOutput';
import {
  buildMovePackage,
  testMovePackage,
  publishPackage,
  upgradePackage,
  inspectPackage,
  callPackageFunction,
  analyzeParameters,
  type AnalyzedParameter,
} from '@/api/client';
import { ParameterInputField } from '@/components/ParameterInputField';
import { useAppStore } from '@/stores/useAppStore';

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

export function MoveDeploy() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [packagePath, setPackagePath] = useState('');
  const [gasBudget, setGasBudget] = useState('100000000');
  const [upgradeCapId, setUpgradeCapId] = useState('');
  const [testFilter, setTestFilter] = useState('');
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

    const updated = [
      newProject,
      ...recentProjects.filter((p) => p.path !== path).slice(0, 4),
    ];

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
    setBuildOutput('');
    setCurrentStep('build');
    setWorkflowProgress(33);

    try {
      const data = await buildMovePackage(packagePath.trim());
      setBuildOutput(data.output);
      toast.success('Build successful!');
      setWorkflowProgress(100);
      addToRecent(packagePath.trim());
      return true;
    } catch (error: any) {
      const msg = error.message || String(error);
      setBuildOutput(msg);
      toast.error('Build failed: ' + msg);
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
      toast.success('Package published successfully!');
      setWorkflowProgress(100);

      // Auto-save UpgradeCap if enabled
      if (saveUpgradeCap && data.createdObjects) {
        const upgradeCap = data.createdObjects.find((obj: any) =>
          obj.type === 'created' && obj.objectType?.includes('UpgradeCap')
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
      toast.error('Publish failed: ' + msg);
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
      toast.success('Package upgraded successfully!');
      setWorkflowProgress(100);
      addToRecent(packagePath.trim(), upgradeCapId.trim());
      return true;
    } catch (error: any) {
      const msg = error.message || String(error);
      setPublishResult({ success: false, error: msg });
      toast.error('Upgrade failed: ' + msg);
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
      const data = await inspectPackage(targetPackageId.trim());
      setPackageModules(data.modules);
      toast.success(`Loaded ${data.modules.length} module(s)`);
      // Remember last package ID
      localStorage.setItem('sui-last-package-id', targetPackageId.trim());
    } catch (error: any) {
      toast.error(error.message || String(error));
    } finally {
      setLoadingFunctions(false);
    }
  };

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

  return (
    <>
      {/* Content */}
      <div className="relative z-10 p-3 sm:p-4 overflow-x-hidden">
        <div className="relative max-w-7xl mx-auto space-y-3">
          {/* Compact Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative z-10 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-green-400" style={{ filter: 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.5))' }} />
              <h1 className="text-lg font-bold text-green-400 font-mono">Move Development Studio</h1>
            </div>
            <p className="text-green-500/60 font-mono text-xs hidden sm:block">
              Build • Test • Deploy
            </p>
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
                  new Set([
                    buildOutput && !buildOutput.includes('error') ? 'build' : '',
                    testOutput && testOutput.includes('Passed') ? 'test' : '',
                    publishResult?.success ? 'publish' : '',
                  ].filter(Boolean))
                }
                failedSteps={
                  new Set([
                    buildOutput && buildOutput.includes('error') ? 'build' : '',
                    testOutput && testOutput.includes('failed') && !testOutput.includes('failed: 0') ? 'test' : '',
                    publishResult && !publishResult.success ? 'publish' : '',
                  ].filter(Boolean))
                }
                progress={workflowProgress}
              />
            </motion.div>
          )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 w-full min-w-0">
          {/* Left Column: Package Selection - Compact */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
            className="lg:col-span-1 space-y-2 min-w-0"
          >
            {/* Recent Projects - Compact */}
            <Card className="bg-black/40 backdrop-blur-md border-green-500/30 hover:border-green-500/50 transition-colors shadow-md">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-1.5 text-green-400 font-mono">
                  <Clock className="w-3.5 h-3.5 text-green-500" />
                  Recent
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2 space-y-1">
                {recentProjects.length === 0 ? (
                  <div className="text-center py-4">
                    <FolderOpen className="w-5 h-5 text-green-500/40 mx-auto mb-1" />
                    <p className="text-xs text-green-400/80 font-mono">No recent projects</p>
                  </div>
                ) : (
                  recentProjects.map((project) => (
                    <motion.div
                      key={project.path}
                      onClick={() => useRecentProject(project)}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 p-2 rounded bg-black/40 hover:bg-green-500/10 border border-green-500/20 hover:border-green-500/40 cursor-pointer group transition-all"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-green-400 truncate font-mono">{project.name}</div>
                        <div className="text-xs text-green-400/80 font-mono">{new Date(project.lastUsed).toLocaleDateString()}</div>
                      </div>
                      <button
                        onClick={(e) => removeFromRecent(project.path, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                      >
                        <Trash2 className="w-2.5 h-2.5 text-red-400" />
                      </button>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Templates - Very Compact */}
            <Card className="bg-black/40 backdrop-blur-md border-green-500/30 hover:border-green-500/50 transition-colors shadow-md">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-1.5 text-green-400 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-green-500" />
                  Templates
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <div className="text-center py-3">
                  <Sparkles className="w-5 h-5 text-green-500/40 mx-auto mb-1" />
                  <p className="text-xs text-green-400/80 font-mono">Coming soon</p>
                </div>
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
            {/* Package Configuration - Compact */}
            <Card className="bg-black/40 backdrop-blur-md border-green-500/30 hover:border-green-500/50 transition-colors shadow-md relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-500/50" />
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-1.5 text-green-400 font-mono">
                  <FileCode className="w-3.5 h-3.5 text-green-500" />
                  Package Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2">
                {/* Package Path - Compact */}
                <div className="space-y-1">
                  <Label htmlFor="package-path" className="text-xs font-medium flex items-center gap-1 text-green-400 font-mono">
                    Package Path <span className="text-red-400">*</span>
                  </Label>
                  <div className="flex gap-1.5">
                    <input
                      id="package-path"
                      type="text"
                      value={packagePath}
                      onChange={(e) => setPackagePath(e.target.value)}
                      placeholder="/path/to/your/move/package"
                      className="flex-1 px-2.5 py-1.5 bg-black/50 border border-green-500/30 rounded text-green-400 placeholder:text-green-500/40 focus:outline-none focus:ring-1 focus:ring-green-500/50 focus:border-green-500 transition-all text-xs font-mono"
                      disabled={isAnyLoading}
                    />
                    <button
                      onClick={() => setShowBrowser(true)}
                      disabled={isAnyLoading}
                      className="px-2.5 py-1.5 bg-green-500/20 border border-green-500/50 text-green-400 rounded hover:bg-green-500/30 transition-colors disabled:opacity-50"
                      title="Browse"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-green-400/80 flex items-center gap-1 font-mono">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Absolute path to your Move package directory (containing Move.toml)
                  </p>
                </div>

                <Separator className="bg-green-500/20 my-1" />

                {/* Gas & Options - Inline Compact */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="gas-budget" className="text-xs font-medium text-green-400 font-mono">Gas Budget</Label>
                    <input
                      id="gas-budget"
                      type="text"
                      value={gasBudget}
                      onChange={(e) => setGasBudget(e.target.value)}
                      placeholder="100000000"
                      className="w-full px-2.5 py-1.5 bg-black/50 border border-green-500/30 rounded text-green-400 placeholder:text-green-500/40 focus:outline-none focus:ring-1 focus:ring-green-500/50 text-xs font-mono"
                      disabled={isAnyLoading}
                    />
                    <p className="text-xs text-green-500/40 font-mono">In MIST (0.1 SUI = 100000000 MIST)</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-green-400 font-mono">Options</Label>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveUpgradeCap}
                          onChange={(e) => setSaveUpgradeCap(e.target.checked)}
                          disabled={isAnyLoading}
                          className="w-3 h-3 text-green-500 bg-black/50 border-green-500/50 rounded focus:ring-1 focus:ring-green-500/50"
                        />
                        <span className="text-[11px] text-green-400 font-mono">Auto-save UpgradeCap</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipDeps}
                          onChange={(e) => setSkipDeps(e.target.checked)}
                          disabled={isAnyLoading}
                          className="w-3 h-3 text-green-500 bg-black/50 border-green-500/50 rounded focus:ring-1 focus:ring-green-500/50"
                        />
                        <span className="text-[11px] text-green-400 font-mono">Skip dependency verification</span>
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* One-Click Workflow - Compact */}
            <Card className="bg-black/40 backdrop-blur-md border-green-500/50 hover:border-green-500 transition-colors shadow-md relative overflow-hidden">
              <CardHeader className="py-2 px-3 relative z-10">
                <CardTitle className="text-sm flex items-center gap-1.5 text-green-400 font-mono">
                  <PlayCircle className="w-3.5 h-3.5 text-green-500" />
                  One-Click Workflow
                  <span className="text-xs text-green-400/80 ml-auto font-normal">Automatically build, test, and publish</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 relative z-10">
                <button
                  onClick={handleOneClickWorkflow}
                  disabled={!isValidPath || isAnyLoading}
                  className="w-full px-4 py-2.5 bg-green-500/20 border border-green-500/50 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm font-mono"
                >
                  {isOneClickRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" />
                      Build → Test → Publish
                      <ChevronRight className="w-3 h-3" />
                    </>
                  )}
                </button>
                <p className="text-xs text-green-400/80 text-center mt-1.5 flex items-center justify-center gap-1 font-mono">
                  <Zap className="w-2.5 h-2.5 text-green-500" />
                  Recommended for production deployment
                </p>
              </CardContent>
            </Card>

            {/* Main Workflow Tabs - Compact */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-black/30 border border-green-500/30 h-9">
                <TabsTrigger value="develop" className="flex items-center justify-center gap-1.5 text-xs data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400 text-green-500/60 hover:text-green-400 font-mono h-8">
                  <Code className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">Develop</span>
                </TabsTrigger>
                <TabsTrigger value="deploy" className="flex items-center justify-center gap-1.5 text-xs data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400 text-green-500/60 hover:text-green-400 font-mono h-8">
                  <Rocket className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">Deploy</span>
                </TabsTrigger>
                <TabsTrigger value="upgrade" className="flex items-center justify-center gap-1.5 text-xs data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400 text-green-500/60 hover:text-green-400 font-mono h-8">
                  <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">Upgrade</span>
                </TabsTrigger>
                <TabsTrigger value="interact" className="flex items-center justify-center gap-1.5 text-xs data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400 text-green-500/60 hover:text-green-400 font-mono h-8">
                  <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden sm:inline">Interact</span>
                </TabsTrigger>
              </TabsList>

              {/* Develop Tab - Redesigned: Actions on top, Output below full-width */}
              <TabsContent value="develop" className="space-y-3 mt-2">
                {/* Action Buttons - Compact 2 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Build Action */}
                  <Card className="bg-black/40 backdrop-blur-md border-green-500/30 hover:border-green-500/50 transition-colors relative shadow-md rounded-xl">
                    <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl transition-all z-10 ${
                      building ? 'bg-green-500 animate-pulse' :
                      buildOutput && !buildOutput.includes('error') ? 'bg-green-500' :
                      buildOutput && buildOutput.includes('error') ? 'bg-red-500' :
                      'bg-green-500/30'
                    }`} />
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-sm flex items-center gap-1.5 text-green-400 font-mono">
                        <Building2 className="w-3.5 h-3.5 text-green-500" />
                        Build Package
                        {buildOutput && !building && (
                          <Badge className={`text-xs ml-auto ${buildOutput.includes('error') ?
                            'bg-red-500/20 text-red-400 border-red-500/30' :
                            'bg-green-500/20 text-green-400 border-green-500/30'
                          } font-mono`}>
                            {buildOutput.includes('error') ? 'Failed' : 'Success'}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <button
                        onClick={handleBuild}
                        disabled={!isValidPath || building || isAnyLoading}
                        className="w-full px-3 py-2 bg-green-500/20 border border-green-500/50 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-xs font-mono"
                      >
                        {building ? (
                          <><Loader2 className="w-3 h-3 animate-spin" />Building...</>
                        ) : (
                          <><Building2 className="w-3 h-3" />Build Package</>
                        )}
                      </button>
                    </CardContent>
                  </Card>

                  {/* Test Action */}
                  <Card className="bg-black/40 backdrop-blur-md border-green-500/30 hover:border-green-500/50 transition-colors relative shadow-md rounded-xl">
                    <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl transition-all z-10 ${
                      testing ? 'bg-green-500 animate-pulse' :
                      testOutput && testOutput.includes('failed: 0') ? 'bg-green-500' :
                      testOutput && testOutput.includes('failed') ? 'bg-red-500' :
                      'bg-green-500/30'
                    }`} />
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-sm flex items-center gap-1.5 text-green-400 font-mono">
                        <TestTube2 className="w-3.5 h-3.5 text-green-500" />
                        Run Tests
                        {testOutput && !testing && (
                          <Badge className={`text-xs ml-auto ${testOutput.includes('failed: 0') ?
                            'bg-green-500/20 text-green-400 border-green-500/30' :
                            'bg-red-500/20 text-red-400 border-red-500/30'
                          } font-mono`}>
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
                        className="w-full px-2.5 py-1.5 bg-black/50 border border-green-500/30 rounded text-xs text-green-400 placeholder:text-green-500/40 focus:outline-none focus:ring-1 focus:ring-green-500/50 font-mono"
                      />
                      <button
                        onClick={handleTest}
                        disabled={!isValidPath || testing || isAnyLoading}
                        className="w-full px-3 py-2 bg-green-500/20 border border-green-500/50 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-xs font-mono"
                      >
                        {testing ? (
                          <><Loader2 className="w-3 h-3 animate-spin" />Testing...</>
                        ) : (
                          <><TestTube2 className="w-3 h-3" />Run Tests</>
                        )}
                      </button>
                    </CardContent>
                  </Card>
                </div>

                {/* Output Section - FULL WIDTH below buttons */}
                {(building || testing || buildOutput || testOutput) && (
                  <div className="grid grid-cols-1 gap-3">
                    {/* Build Output - Full Width */}
                    {(building || buildOutput) && (
                      <Card className="bg-black/40 backdrop-blur-md border-green-500/30 shadow-md rounded-xl">
                        <CardHeader className="py-2 px-3 border-b border-green-500/20">
                          <CardTitle className="text-sm flex items-center gap-1.5 text-green-400 font-mono">
                            <Building2 className="w-3.5 h-3.5 text-green-500" />
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
                                className="space-y-1.5 p-2 bg-green-500/10 border border-green-500/30 rounded"
                              >
                                <div className="flex items-center gap-1.5">
                                  <Loader2 className="w-3 h-3 text-green-400 animate-spin" />
                                  <span className="text-xs text-green-400 font-mono">Compiling...</span>
                                </div>
                                <Skeleton className="h-2 w-full bg-green-500/20" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                          {buildOutput && (
                            <TerminalBuildOutput
                              output={buildOutput}
                              isError={buildOutput.includes('error') || buildOutput.includes('Error')}
                            />
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Test Output - Full Width */}
                    {(testing || testOutput) && (
                      <Card className="bg-black/40 backdrop-blur-md border-green-500/30 shadow-md rounded-xl">
                        <CardHeader className="py-2 px-3 border-b border-green-500/20">
                          <CardTitle className="text-sm flex items-center gap-1.5 text-green-400 font-mono">
                            <TestTube2 className="w-3.5 h-3.5 text-green-500" />
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
                                className="space-y-1.5 p-2 bg-green-500/10 border border-green-500/30 rounded"
                              >
                                <div className="flex items-center gap-1.5">
                                  <Loader2 className="w-3 h-3 text-green-400 animate-spin" />
                                  <span className="text-xs text-green-400 font-mono">Running tests...</span>
                                </div>
                                <Skeleton className="h-2 w-full bg-green-500/20" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                          {testOutput && (
                            <TerminalTestOutput output={testOutput} passed={testPassed} failed={testFailed} />
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Pro Tip - Very Compact */}
                <div className="flex items-center gap-2 px-3 py-2 border border-green-500/30 bg-green-500/10 backdrop-blur-md rounded-lg">
                  <Lightbulb className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs text-green-300/80 font-mono">
                    <strong className="text-green-400">Pro Tip:</strong> Always build before testing. Use the One-Click Workflow for the complete process.
                  </span>
                </div>
              </TabsContent>

              {/* Deploy Tab - Compact */}
              <TabsContent value="deploy" className="space-y-2 mt-2">
                <Card className="bg-black/40 backdrop-blur-md border-green-500/30 hover:border-green-500/50 transition-colors shadow-md">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm flex items-center gap-1.5 text-green-400 font-mono">
                      <Upload className="w-3.5 h-3.5 text-green-500" />
                      Publish Package
                      <span className="text-xs text-green-400/80 ml-auto font-normal">Deploy to blockchain</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-2">
                    <button
                      onClick={handlePublish}
                      disabled={!isValidPath || publishing || isAnyLoading}
                      className="w-full px-4 py-2.5 bg-green-500/20 border border-green-500/50 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm font-mono"
                    >
                      {publishing ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Publishing...</>
                      ) : (
                        <><Upload className="w-4 h-4" />Publish Package</>
                      )}
                    </button>
                    <AnimatePresence mode="wait">
                      {publishing && !publishResult && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="p-2 bg-green-500/10 border border-green-500/30 rounded space-y-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 text-green-400 animate-spin" />
                            <span className="text-xs text-green-400 font-mono">Publishing...</span>
                          </div>
                          <div className="space-y-1 pl-4">
                            <div className="flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5 text-green-400" /><span className="text-xs text-green-300/80 font-mono">Compiling...</span></div>
                            <div className="flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 text-green-400 animate-spin" /><span className="text-xs text-green-400 font-mono">Generating tx...</span></div>
                            <div className="flex items-center gap-1"><Circle className="w-2.5 h-2.5 text-green-500/30" /><span className="text-xs text-green-400/80 font-mono">Confirming...</span></div>
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
                            ...(publishResult.packageId ? [{ label: 'PACKAGE_ID', value: publishResult.packageId, copyable: true }] : []),
                            ...(publishResult.digest ? [{ label: 'TX_DIGEST', value: publishResult.digest, copyable: true }] : []),
                            ...(publishResult.createdObjects || [])
                              .filter((obj: any) => {
                                // Only include objects that have a valid objectId
                                // Skip 'published' type (package info) and objects without objectId
                                return obj.type === 'created' && obj.objectId && typeof obj.objectId === 'string' && obj.objectId.startsWith('0x');
                              })
                              .map((obj: any) => ({
                                label: obj.objectType?.includes('UpgradeCap') ? 'UPGRADE_CAP' : 'CREATED_OBJECT',
                                value: obj.objectId, copyable: true
                              }))
                          ]}
                        />
                      ) : (
                        <TerminalErrorDisplay title="PUBLISH FAILED" error={publishResult.error || 'Unknown error'} onRetry={handlePublish}
                          suggestions={['Check gas budget', 'Verify SUI balance', 'Ensure package builds first', 'Check network connection']} />
                      )}
                    </>
                  )}
                </AnimatePresence>
                <div className="flex items-center gap-2 px-3 py-2 border border-green-500/30 bg-green-500/10 backdrop-blur-md rounded-lg">
                  <AlertCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs text-green-300/80 font-mono">
                    <strong className="text-green-400">Before Publishing:</strong> Ensure your package builds and all tests pass.
                  </span>
                </div>
              </TabsContent>

              {/* Upgrade Tab - Compact */}
              <TabsContent value="upgrade" className="space-y-2 mt-2">
                <Card className="bg-black/40 backdrop-blur-md border-green-500/30 hover:border-green-500/50 transition-colors shadow-md">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm flex items-center gap-1.5 text-green-400 font-mono">
                      <RefreshCw className="w-3.5 h-3.5 text-green-500" />
                      Upgrade Package
                      <span className="text-xs text-green-400/80 ml-auto font-normal">Using UpgradeCap</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="upgrade-cap" className="text-xs font-medium flex items-center gap-1 text-green-400 font-mono">
                        UpgradeCap Object ID <span className="text-red-400">*</span>
                      </Label>
                      <input
                        id="upgrade-cap"
                        type="text"
                        value={upgradeCapId}
                        onChange={(e) => setUpgradeCapId(e.target.value)}
                        placeholder="0x... (auto-filled from recent)"
                        disabled={isAnyLoading}
                        className="w-full px-2.5 py-1.5 bg-black/50 border border-green-500/30 rounded text-green-400 placeholder:text-green-500/40 focus:outline-none focus:ring-1 focus:ring-green-500/50 font-mono text-xs"
                      />
                      <p className="text-xs text-green-400/80 flex items-center gap-1 font-mono">
                        <AlertCircle className="w-2.5 h-2.5" />
                        UpgradeCap from initial publish
                      </p>
                    </div>
                    <button
                      onClick={handleUpgrade}
                      disabled={!isValidPath || !upgradeCapId.trim() || upgrading || isAnyLoading}
                      className="w-full px-4 py-2.5 bg-green-500/20 border border-green-500/50 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm font-mono"
                    >
                      {upgrading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Upgrading...</>
                      ) : (
                        <><RefreshCw className="w-4 h-4" />Upgrade Package</>
                      )}
                    </button>
                    <AnimatePresence mode="wait">
                      {upgrading && !publishResult && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="p-2 bg-green-500/10 border border-green-500/30 rounded space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 text-green-400 animate-spin" />
                            <span className="text-xs text-green-400 font-mono">Upgrading...</span>
                          </div>
                          <Skeleton className="h-2 w-full bg-green-500/20" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
                <div className="flex items-center gap-2 px-3 py-2 border border-green-500/30 bg-green-500/10 backdrop-blur-md rounded-lg">
                  <AlertCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs text-green-300/80 font-mono">
                    <strong className="text-green-400">Requirements:</strong> Own the UpgradeCap, build updated package first.
                  </span>
                </div>
              </TabsContent>

              {/* Interact Tab - Compact */}
              <TabsContent value="interact" className="space-y-2 mt-2">
                {/* Package Loader - Compact */}
                <Card className="bg-black/40 backdrop-blur-md border-green-500/30 hover:border-green-500/50 transition-colors shadow-md">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm flex items-center gap-1.5 text-green-400 font-mono">
                      <Package className="w-3.5 h-3.5 text-green-500" />
                      Load Package
                      <span className="text-xs text-green-400/80 ml-auto font-normal">Enter package ID to inspect</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-2">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={targetPackageId}
                        onChange={(e) => setTargetPackageId(e.target.value)}
                        placeholder="0x... (auto-filled from publish)"
                        className="flex-1 px-2.5 py-1.5 bg-black/50 border border-green-500/30 rounded text-green-400 placeholder:text-green-500/40 focus:outline-none focus:ring-1 focus:ring-green-500/50 font-mono text-xs"
                        disabled={loadingFunctions}
                      />
                      <button
                        onClick={handleLoadPackage}
                        disabled={!targetPackageId.trim() || loadingFunctions}
                        className="px-3 py-1.5 bg-green-500/20 border border-green-500/50 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 text-xs whitespace-nowrap font-mono"
                      >
                        {loadingFunctions ? (
                          <><Loader2 className="w-3 h-3 animate-spin" />Loading...</>
                        ) : (
                          <><Package className="w-3 h-3" />Load</>
                        )}
                      </button>
                    </div>
                    <AnimatePresence mode="wait">
                      {loadingFunctions && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1">
                          <Skeleton className="h-2 w-full bg-green-500/20" />
                          <Skeleton className="h-2 w-3/4 bg-green-500/10" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {packageModules.length > 0 && (
                      <div className="flex items-center gap-1.5 p-1.5 bg-green-500/10 border border-green-500/30 rounded">
                        <CheckCircle2 className="h-3 w-3 text-green-400" />
                        <span className="text-xs text-green-300/80 font-mono">
                          <strong className="text-green-400">Loaded!</strong> {packageModules.length} module(s)
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Function List - Compact */}
                {packageModules.length > 0 && (
                  <Card className="bg-black/40 backdrop-blur-md border-green-500/30 hover:border-green-500/50 transition-colors shadow-md">
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-sm flex items-center gap-1.5 text-green-400 font-mono">
                        <FileCode className="w-3.5 h-3.5 text-green-500" />
                        Functions
                        <span className="text-xs text-green-400/80 ml-auto font-normal">Click to select</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-2 space-y-1 max-h-48 overflow-y-auto">
                      {packageModules.map((module) => (
                        <div key={module.name} className="border border-green-500/30 rounded overflow-hidden">
                          <button
                            onClick={() => toggleModule(module.name)}
                            className="w-full px-2 py-1.5 bg-black/30 hover:bg-green-500/10 transition-colors flex items-center justify-between text-xs"
                          >
                            <span className="flex items-center gap-1.5">
                              <Code className="w-3 h-3 text-green-400" />
                              <span className="text-green-400 font-mono">{module.name}</span>
                              <Badge className="bg-green-500/20 text-green-400 text-xs border-green-500/30 font-mono px-1">
                                {module.functions.length}
                              </Badge>
                            </span>
                            <ChevronDown className={`w-3 h-3 text-green-400 transition-transform ${expandedModules.has(module.name) ? 'rotate-180' : ''}`} />
                          </button>
                          <AnimatePresence>
                            {expandedModules.has(module.name) && (
                              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                                className="divide-y divide-green-500/20 overflow-hidden">
                                {module.functions.map((func) => {
                                  const isEntry = func.visibility === 'public' || func.visibility === 'entry';
                                  const isSelected = selectedFunction?.name === func.name && selectedModuleName === module.name;
                                  return (
                                    <button
                                      key={func.name}
                                      onClick={() => handleSelectFunction(func, module.name)}
                                      className={`w-full px-2 py-1.5 text-left hover:bg-green-500/10 transition-all ${isSelected ? 'bg-green-500/10 border-l-2 border-green-500' : ''}`}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <Zap className={`w-2.5 h-2.5 flex-shrink-0 ${isEntry ? 'text-green-400' : 'text-green-400/80'}`} />
                                        <span className="text-xs text-green-400 font-mono truncate">{func.name}</span>
                                        <Badge className={`text-xs px-1 font-mono ${isEntry ? 'bg-green-500/20 text-green-400' : 'bg-green-500/10 text-green-500/60'}`}>
                                          {func.visibility}
                                        </Badge>
                                      </div>
                                      <code className="text-xs text-green-400/80 truncate block mt-0.5 font-mono">{func.signature}</code>
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
                  <Card className="bg-black/40 backdrop-blur-md border-green-500/50 shadow-md relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-500/50" />
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-sm flex items-center gap-1.5 text-green-400 font-mono">
                        <PlayCircle className="w-3.5 h-3.5 text-green-500" />
                        {selectedFunction.name}
                        <span className="text-xs text-green-400/80 ml-auto font-normal">{selectedModuleName}::{selectedFunction.name}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-2">
                      {/* Type Arguments - Compact */}
                      {selectedFunction.typeParameters.length > 0 && (
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-green-400 font-mono">Type Args ({selectedFunction.typeParameters.length})</Label>
                          <div className="space-y-1">
                            {selectedFunction.typeParameters.map((typeParam, idx) => (
                              <input key={idx} type="text" value={functionTypeArgs[idx] || ''}
                                onChange={(e) => { const n = [...functionTypeArgs]; n[idx] = e.target.value; setFunctionTypeArgs(n); }}
                                placeholder={`${typeParam} (e.g., 0x2::sui::SUI)`}
                                className="w-full px-2.5 py-1.5 bg-black/50 border border-green-500/30 rounded text-green-400 placeholder:text-green-500/40 focus:outline-none focus:ring-1 focus:ring-green-500/50 font-mono text-xs"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Parameters - Compact */}
                      {selectedFunction.parameters.filter((p) => p.name !== 'ctx' && p.name !== '_ctx').length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-green-400 font-mono">Parameters</Label>
                            {analyzingParams && <span className="flex items-center gap-1 text-xs text-green-500/60"><Loader2 className="w-2.5 h-2.5 animate-spin" />Analyzing...</span>}
                          </div>
                          <div className="space-y-2">
                            {selectedFunction.parameters.filter((p) => p.name !== 'ctx' && p.name !== '_ctx').map((param, idx) => {
                              const analyzedParam = analyzedParams[idx];
                              if (analyzedParam) {
                                return (
                                  <div key={idx} className="p-2 bg-black/30 border border-green-500/20 rounded">
                                    <ParameterInputField parameter={analyzedParam} value={functionArgs[idx] || ''}
                                      onChange={(v) => { const n = [...functionArgs]; n[idx] = v; setFunctionArgs(n); }}
                                      onRefreshSuggestions={handleRefreshSuggestions} isLoading={analyzingParams} disabled={calling} />
                                  </div>
                                );
                              }
                              return (
                                <div key={idx} className="space-y-0.5">
                                  <Label className="text-xs text-green-400 font-mono">{param.name}: {param.type}</Label>
                                  <input type="text" value={functionArgs[idx] || ''}
                                    onChange={(e) => { const n = [...functionArgs]; n[idx] = e.target.value; setFunctionArgs(n); }}
                                    placeholder={`Enter ${param.type}`} disabled={calling}
                                    className="w-full px-2.5 py-1.5 bg-black/50 border border-green-500/30 rounded text-green-400 placeholder:text-green-500/40 focus:outline-none focus:ring-1 focus:ring-green-500/50 text-xs font-mono disabled:opacity-50"
                                  />
                                </div>
                              );
                            })}
                          </div>
                          {!activeAddress && <p className="text-xs text-yellow-500/70 font-mono">Connect wallet for suggestions</p>}
                        </div>
                      )}
                      {/* Call Button - Compact */}
                      <button onClick={handleCallFunction} disabled={calling}
                        className="w-full px-4 py-2.5 bg-green-500/20 border border-green-500/50 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm font-mono"
                      >
                        {calling ? <><Loader2 className="w-4 h-4 animate-spin" />Calling...</> : <><Zap className="w-4 h-4" />Call Function</>}
                      </button>
                    </CardContent>
                  </Card>
                )}

                {/* Transaction Result */}
                <AnimatePresence mode="wait">
                  {callResult && (
                    <>
                      {callResult.error ? (
                        <TerminalErrorDisplay title="CALL FAILED" error={callResult.error} onRetry={handleCallFunction}
                          suggestions={['Check parameters', 'Verify type args', 'Check gas', 'Ensure entry/public']} />
                      ) : (
                        <TerminalSuccessDisplay title="EXECUTED"
                          command={`sui client call --package ${targetPackageId} --module ${selectedModuleName} --function ${selectedFunction?.name}${functionTypeArgs.filter(t => t.trim()).length > 0 ? ` --type-args ${functionTypeArgs.filter(t => t.trim()).join(' ')}` : ''}${functionArgs.filter(a => a.trim()).length > 0 ? ` --args ${functionArgs.filter(a => a.trim()).join(' ')}` : ''} --gas-budget ${gasBudget}`}
                          fields={[
                            ...(callResult.digest ? [{ label: 'TX_DIGEST', value: callResult.digest, copyable: true }] : []),
                            ...(callResult.gasUsed ? [{ label: 'GAS_USED', value: `${callResult.gasUsed} MIST`, copyable: false }] : []),
                            ...(callResult.objectChanges?.filter((c: any) => c.type === 'created').map((obj: any) => ({
                              label: `CREATED (${obj.objectType?.split('::').pop() || 'Object'})`,
                              value: obj.objectId,
                              copyable: true
                            })) || []),
                            ...(callResult.objectChanges?.filter((c: any) => c.type === 'mutated').map((obj: any) => ({
                              label: `MUTATED (${obj.objectType?.split('::').pop() || 'Object'})`,
                              value: obj.objectId,
                              copyable: true
                            })) || [])
                          ]}
                          message="Function executed successfully"
                        />
                      )}
                    </>
                  )}
                </AnimatePresence>
                {/* Tips - Compact */}
                <div className="flex items-center gap-2 px-3 py-2 border border-green-500/30 bg-green-500/10 backdrop-blur-md rounded-lg">
                  <Lightbulb className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                  <span className="text-xs text-green-300/80 font-mono">
                    <strong className="text-green-400">Tips:</strong> Package ID auto-filled from publish. Type args use full paths: <code className="bg-black/50 px-0.5 rounded text-green-400">0x2::sui::SUI</code>
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
