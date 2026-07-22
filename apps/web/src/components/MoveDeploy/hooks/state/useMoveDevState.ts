/**
 * Main state management hook for Move Development Studio
 * Uses Zustand for state management with persistence
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  MoveDevState,
  MoveDevActions,
  OperationHistory,
  RecentProject,
  Network,
  OperationType,
  BuildResult,
  TestResult,
  PublishResult,
  UpgradeResult,
  BuildRequest,
  TestRequest,
  PublishRequest,
  UpgradeRequest,
  WorkflowConfig,
  WorkflowProgress,
} from '../../types';
import { apiClient } from '@/api/client';
import { trackEvent, ClarityEvents } from '@/lib/clarity';

// ============================================================================
// Initial State
// ============================================================================

const initialOperationState = {
  status: 'idle' as const,
  data: undefined,
  error: undefined,
  startTime: undefined,
  endTime: undefined,
};

const initialState: MoveDevState = {
  currentPackage: null,
  build: initialOperationState,
  test: initialOperationState,
  publish: initialOperationState,
  upgrade: initialOperationState,
  workflow: {
    active: false,
  },
  history: [],
  recentProjects: [],
  ui: {
    expandedSections: new Set(['build']),
    selectedNetwork: 'testnet',
    showAdvancedOptions: false,
  },
};

// ============================================================================
// Store Definition
// ============================================================================

export const useMoveDevStore = create<MoveDevState & MoveDevActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // ========================================================================
      // Package Actions
      // ========================================================================

      setPackage: async (path: string) => {
        set((state) => {
          state.currentPackage = { path };
        });

        // Add to recent projects
        const existing = get().recentProjects.find((p) => p.path === path);
        if (!existing) {
          set((state) => {
            state.recentProjects.unshift({
              path,
              name: path.split('/').pop() || path,
              lastAccessed: Date.now(),
              network: state.ui.selectedNetwork,
            });
            // Keep only 10 most recent
            if (state.recentProjects.length > 10) {
              state.recentProjects.pop();
            }
          });
        } else {
          set((state) => {
            const index = state.recentProjects.findIndex((p: RecentProject) => p.path === path);
            if (index > 0) {
              state.recentProjects[index].lastAccessed = Date.now();
              // Move to front
              const [project] = state.recentProjects.splice(index, 1);
              state.recentProjects.unshift(project);
            }
          });
        }

        // TODO: Fetch package metadata
        // This would call an API endpoint to get package info
      },

      clearPackage: () => {
        set((state) => {
          state.currentPackage = null;
          state.build = initialOperationState;
          state.test = initialOperationState;
          state.publish = initialOperationState;
          state.upgrade = initialOperationState;
        });
      },

      // ========================================================================
      // Operation Actions
      // ========================================================================

      executeBuild: async (request: BuildRequest) => {
        const startTime = Date.now();

        set((state) => {
          state.build = {
            status: 'loading',
            startTime,
          };
        });

        try {
          const response = await apiClient.buildPackage(request);
          const endTime = Date.now();

          const result: BuildResult = {
            success: true,
            output: response.output,
            modules: response.modules,
            duration: endTime - startTime,
            timestamp: endTime,
          };

          set((state) => {
            state.build = {
              status: 'success',
              data: result,
              startTime,
              endTime,
            };
          });

          // Add to history
          get().addToHistory({
            id: `build-${Date.now()}`,
            type: 'build',
            timestamp: endTime,
            status: 'success',
            packagePath: request.packagePath,
            duration: endTime - startTime,
            result,
          });

          trackEvent(ClarityEvents.PACKAGE_BUILT);
          return result;
        } catch (error) {
          const endTime = Date.now();
          const operationError = {
            type: 'compilation' as const,
            message: error instanceof Error ? error.message : 'Build failed',
            recoverable: true,
            suggestions: ['Check Move.toml syntax', 'Verify dependencies'],
          };

          set((state) => {
            state.build = {
              status: 'error',
              error: operationError,
              startTime,
              endTime,
            };
          });

          get().addToHistory({
            id: `build-${Date.now()}`,
            type: 'build',
            timestamp: endTime,
            status: 'error',
            packagePath: request.packagePath,
            duration: endTime - startTime,
            error: operationError,
          });

          throw operationError;
        }
      },

      executeTest: async (request: TestRequest) => {
        const startTime = Date.now();

        set((state) => {
          state.test = {
            status: 'loading',
            startTime,
          };
        });

        try {
          const response = await apiClient.testPackage(request);
          const endTime = Date.now();

          const result: TestResult = {
            success: response.success,
            output: response.output,
            passed: response.passed || 0,
            failed: response.failed || 0,
            skipped: response.skipped || 0,
            duration: endTime - startTime,
            timestamp: endTime,
            failures: response.failures,
          };

          set((state) => {
            state.test = {
              status: result.success ? 'success' : 'error',
              data: result,
              startTime,
              endTime,
            };
          });

          get().addToHistory({
            id: `test-${Date.now()}`,
            type: 'test',
            timestamp: endTime,
            status: result.success ? 'success' : 'error',
            packagePath: request.packagePath,
            duration: endTime - startTime,
            result,
          });

          return result;
        } catch (error) {
          const endTime = Date.now();
          const operationError = {
            type: 'runtime' as const,
            message: error instanceof Error ? error.message : 'Tests failed',
            recoverable: true,
            suggestions: ['Review test output', 'Check test assertions'],
          };

          set((state) => {
            state.test = {
              status: 'error',
              error: operationError,
              startTime,
              endTime,
            };
          });

          get().addToHistory({
            id: `test-${Date.now()}`,
            type: 'test',
            timestamp: endTime,
            status: 'error',
            packagePath: request.packagePath,
            duration: endTime - startTime,
            error: operationError,
          });

          throw operationError;
        }
      },

      executePublish: async (request: PublishRequest) => {
        const startTime = Date.now();

        set((state) => {
          state.publish = {
            status: 'loading',
            startTime,
          };
        });

        try {
          const response = await apiClient.publishPackage(request);
          const endTime = Date.now();

          const result: PublishResult = {
            success: true,
            output: response.output,
            packageId: response.packageId,
            transactionDigest: response.transactionDigest,
            explorerUrl: response.explorerUrl,
            gasUsed: response.gasUsed,
            duration: endTime - startTime,
            timestamp: endTime,
          };

          set((state) => {
            state.publish = {
              status: 'success',
              data: result,
              startTime,
              endTime,
            };
          });

          get().addToHistory({
            id: `publish-${Date.now()}`,
            type: 'publish',
            timestamp: endTime,
            status: 'success',
            packagePath: request.packagePath,
            duration: endTime - startTime,
            result,
          });

          trackEvent(ClarityEvents.PACKAGE_PUBLISHED);
          return result;
        } catch (error) {
          const endTime = Date.now();
          const operationError = {
            type: 'network' as const,
            message: error instanceof Error ? error.message : 'Publish failed',
            recoverable: true,
            suggestions: ['Check network connection', 'Verify gas budget'],
          };

          set((state) => {
            state.publish = {
              status: 'error',
              error: operationError,
              startTime,
              endTime,
            };
          });

          get().addToHistory({
            id: `publish-${Date.now()}`,
            type: 'publish',
            timestamp: endTime,
            status: 'error',
            packagePath: request.packagePath,
            duration: endTime - startTime,
            error: operationError,
          });

          throw operationError;
        }
      },

      executeUpgrade: async (request: UpgradeRequest) => {
        const startTime = Date.now();

        set((state) => {
          state.upgrade = {
            status: 'loading',
            startTime,
          };
        });

        try {
          const response = await apiClient.upgradePackage(request);
          const endTime = Date.now();

          const result: UpgradeResult = {
            success: true,
            output: response.output,
            upgradeCapId: request.upgradeCapId,
            newPackageId: response.packageId,
            transactionDigest: response.transactionDigest,
            explorerUrl: response.explorerUrl,
            gasUsed: response.gasUsed,
            duration: endTime - startTime,
            timestamp: endTime,
          };

          set((state) => {
            state.upgrade = {
              status: 'success',
              data: result,
              startTime,
              endTime,
            };
          });

          get().addToHistory({
            id: `upgrade-${Date.now()}`,
            type: 'upgrade',
            timestamp: endTime,
            status: 'success',
            packagePath: request.packagePath,
            duration: endTime - startTime,
            result,
          });

          return result;
        } catch (error) {
          const endTime = Date.now();
          const operationError = {
            type: 'network' as const,
            message: error instanceof Error ? error.message : 'Upgrade failed',
            recoverable: true,
            suggestions: ['Verify upgrade cap ID', 'Check package compatibility'],
          };

          set((state) => {
            state.upgrade = {
              status: 'error',
              error: operationError,
              startTime,
              endTime,
            };
          });

          get().addToHistory({
            id: `upgrade-${Date.now()}`,
            type: 'upgrade',
            timestamp: endTime,
            status: 'error',
            packagePath: request.packagePath,
            duration: endTime - startTime,
            error: operationError,
          });

          throw operationError;
        }
      },

      // ========================================================================
      // Workflow Actions
      // ========================================================================

      startWorkflow: async (config: WorkflowConfig) => {
        const { currentPackage } = get();
        if (!currentPackage) {
          throw new Error('No package selected');
        }

        set((state) => {
          state.workflow = {
            active: true,
            config,
            progress: {
              currentStep: null,
              completedSteps: [],
              results: {},
            },
          };
        });

        const { executeBuild, executeTest, executePublish } = get();

        try {
          // Step 1: Build
          if (config.steps.includes('build')) {
            set((state) => {
              if (state.workflow.progress) {
                state.workflow.progress.currentStep = 'build';
              }
            });

            const buildResult = await executeBuild({
              packagePath: currentPackage.path,
              network: config.network,
            });

            set((state) => {
              if (state.workflow.progress) {
                state.workflow.progress.completedSteps.push('build');
                state.workflow.progress.results.build = buildResult;
                state.workflow.progress.currentStep = null;
              }
            });
          }

          // Step 2: Test
          if (config.steps.includes('test') && !config.skipTests) {
            set((state) => {
              if (state.workflow.progress) {
                state.workflow.progress.currentStep = 'test';
              }
            });

            const testResult = await executeTest({
              packagePath: currentPackage.path,
              network: config.network,
            });

            if (!testResult.success) {
              throw new Error('Tests failed');
            }

            set((state) => {
              if (state.workflow.progress) {
                state.workflow.progress.completedSteps.push('test');
                state.workflow.progress.results.test = testResult;
                state.workflow.progress.currentStep = null;
              }
            });
          }

          // Step 3: Publish
          if (config.steps.includes('publish')) {
            set((state) => {
              if (state.workflow.progress) {
                state.workflow.progress.currentStep = 'publish';
              }
            });

            const publishResult = await executePublish({
              packagePath: currentPackage.path,
              network: config.network,
            });

            set((state) => {
              if (state.workflow.progress) {
                state.workflow.progress.completedSteps.push('publish');
                state.workflow.progress.results.publish = publishResult;
                state.workflow.progress.currentStep = null;
              }
            });
          }

          // Workflow completed successfully
          set((state) => {
            state.workflow.active = false;
          });
        } catch (error) {
          // Workflow failed
          set((state) => {
            if (state.workflow.progress?.currentStep) {
              state.workflow.progress.failedStep = state.workflow.progress.currentStep;
            }
            state.workflow.active = false;
          });
          throw error;
        }
      },

      stopWorkflow: () => {
        set((state) => {
          state.workflow.active = false;
        });
      },

      // ========================================================================
      // History Actions
      // ========================================================================

      addToHistory: (entry: OperationHistory) => {
        set((state) => {
          state.history.unshift(entry);
          // Keep only last 50 entries
          if (state.history.length > 50) {
            state.history.pop();
          }
        });
      },

      clearHistory: () => {
        set((state) => {
          state.history = [];
        });
      },

      // ========================================================================
      // UI Actions
      // ========================================================================

      toggleSection: (type: OperationType) => {
        set((state) => {
          if (state.ui.expandedSections.has(type)) {
            state.ui.expandedSections.delete(type);
          } else {
            state.ui.expandedSections.add(type);
          }
        });
      },

      setNetwork: (network: Network) => {
        set((state) => {
          state.ui.selectedNetwork = network;
        });
      },

      toggleAdvancedOptions: () => {
        set((state) => {
          state.ui.showAdvancedOptions = !state.ui.showAdvancedOptions;
        });
      },
    })),
    {
      name: 'move-dev-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        recentProjects: state.recentProjects,
        history: state.history.slice(0, 20), // Persist only last 20
        ui: {
          selectedNetwork: state.ui.selectedNetwork,
          showAdvancedOptions: state.ui.showAdvancedOptions,
        },
      }),
    }
  )
);

// ============================================================================
// Selectors (for optimized re-renders)
// ============================================================================

export const selectCurrentPackage = (state: MoveDevState) => state.currentPackage;
export const selectBuildState = (state: MoveDevState) => state.build;
export const selectTestState = (state: MoveDevState) => state.test;
export const selectPublishState = (state: MoveDevState) => state.publish;
export const selectUpgradeState = (state: MoveDevState) => state.upgrade;
export const selectWorkflow = (state: MoveDevState) => state.workflow;
export const selectHistory = (state: MoveDevState) => state.history;
export const selectRecentProjects = (state: MoveDevState) => state.recentProjects;
export const selectUI = (state: MoveDevState) => state.ui;
