/**
 * Core Types for Move Development Studio
 */

// ============================================================================
// Operation Types
// ============================================================================

export type OperationType = 'build' | 'test' | 'publish' | 'upgrade';
export type OperationStatus = 'idle' | 'loading' | 'success' | 'error';
export type Network = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

// ============================================================================
// Package Types
// ============================================================================

export interface PackageMetadata {
  name: string;
  version: string;
  path: string;
  dependencies: Record<string, string>;
  lastModified: number;
}

export interface RecentProject {
  path: string;
  name: string;
  lastAccessed: number;
  network: Network;
  lastOperation?: OperationType;
}

// ============================================================================
// Operation Results
// ============================================================================

export interface BuildResult {
  success: boolean;
  output: string;
  bytecode?: string;
  modules?: string[];
  duration: number;
  timestamp: number;
}

export interface TestResult {
  success: boolean;
  output: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  timestamp: number;
  failures?: TestFailure[];
}

export interface TestFailure {
  name: string;
  message: string;
  location?: string;
}

export interface PublishResult {
  success: boolean;
  output: string;
  packageId?: string;
  transactionDigest?: string;
  explorerUrl?: string;
  gasUsed?: number;
  duration: number;
  timestamp: number;
}

export interface UpgradeResult {
  success: boolean;
  output: string;
  upgradeCapId?: string;
  newPackageId?: string;
  transactionDigest?: string;
  explorerUrl?: string;
  gasUsed?: number;
  duration: number;
  timestamp: number;
}

// ============================================================================
// Operation State
// ============================================================================

export interface OperationState<T = unknown> {
  status: OperationStatus;
  data?: T;
  error?: OperationError;
  startTime?: number;
  endTime?: number;
}

export interface OperationHistory {
  id: string;
  type: OperationType;
  timestamp: number;
  status: OperationStatus;
  packagePath: string;
  duration: number;
  result?: BuildResult | TestResult | PublishResult | UpgradeResult;
  error?: OperationError;
}

// ============================================================================
// Error Types
// ============================================================================

export interface OperationError {
  type: 'validation' | 'network' | 'compilation' | 'runtime' | 'unknown';
  message: string;
  details?: string;
  code?: string;
  recoverable: boolean;
  suggestions?: string[];
}

// ============================================================================
// Workflow Types
// ============================================================================

export type WorkflowStep = 'build' | 'test' | 'publish';

export interface WorkflowConfig {
  steps: WorkflowStep[];
  skipTests?: boolean;
  autoUpgrade?: boolean;
  network: Network;
}

export interface WorkflowProgress {
  currentStep: WorkflowStep | null;
  completedSteps: WorkflowStep[];
  failedStep?: WorkflowStep;
  results: {
    build?: BuildResult;
    test?: TestResult;
    publish?: PublishResult;
  };
}

// ============================================================================
// Component Props
// ============================================================================

export interface BaseOperationProps {
  packagePath: string;
  network: Network;
  onSuccess?: (result: unknown) => void;
  onError?: (error: OperationError) => void;
  disabled?: boolean;
}

export interface OperationCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  status: OperationStatus;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export interface OutputDisplayProps {
  output: string;
  type?: 'success' | 'error' | 'info';
  maxHeight?: number;
  showLineNumbers?: boolean;
  copyable?: boolean;
}

export interface ErrorDisplayProps {
  error: OperationError;
  onRetry?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

// ============================================================================
// API Types
// ============================================================================

export interface BuildRequest {
  packagePath: string;
  network?: Network;
  skipFetchLatest?: boolean;
  withUnpublished?: boolean;
}

export interface TestRequest {
  packagePath: string;
  network?: Network;
  filter?: string;
}

export interface PublishRequest {
  packagePath: string;
  network: Network;
  gas?: number;
  gasPrice?: number;
}

export interface UpgradeRequest {
  packagePath: string;
  upgradeCapId: string;
  network: Network;
  gas?: number;
}

// ============================================================================
// State Management
// ============================================================================

export interface MoveDevState {
  // Current package
  currentPackage: {
    path: string;
    metadata?: PackageMetadata;
  } | null;

  // Operation states
  build: OperationState<BuildResult>;
  test: OperationState<TestResult>;
  publish: OperationState<PublishResult>;
  upgrade: OperationState<UpgradeResult>;

  // Workflow
  workflow: {
    active: boolean;
    config?: WorkflowConfig;
    progress?: WorkflowProgress;
  };

  // History & cache
  history: OperationHistory[];
  recentProjects: RecentProject[];

  // UI state
  ui: {
    expandedSections: Set<OperationType>;
    selectedNetwork: Network;
    showAdvancedOptions: boolean;
  };
}

export interface MoveDevActions {
  // Package actions
  setPackage: (path: string) => Promise<void>;
  clearPackage: () => void;

  // Operation actions
  executeBuild: (request: BuildRequest) => Promise<BuildResult>;
  executeTest: (request: TestRequest) => Promise<TestResult>;
  executePublish: (request: PublishRequest) => Promise<PublishResult>;
  executeUpgrade: (request: UpgradeRequest) => Promise<UpgradeResult>;

  // Workflow actions
  startWorkflow: (config: WorkflowConfig) => Promise<void>;
  stopWorkflow: () => void;

  // History actions
  addToHistory: (entry: OperationHistory) => void;
  clearHistory: () => void;

  // UI actions
  toggleSection: (type: OperationType) => void;
  setNetwork: (network: Network) => void;
  toggleAdvancedOptions: () => void;
}
