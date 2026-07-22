import { SuiCliExecutor } from '../../cli/SuiCliExecutor';
import { sanitizeErrorMessage } from '../../utils/errorHandler';
import path from 'path';
import fs from 'fs/promises';

export interface MoveBuildResult {
    success: boolean;
    output: string;
    error?: string;
}

export interface MoveTestResult {
    success: boolean;
    output: string;
    passed: number;
    failed: number;
    error?: string;
}

export interface MoveNewResult {
    success: boolean;
    path?: string;
    error?: string;
}

export interface MovePublishResult {
    success: boolean;
    output: string;
    packageId?: string;
    upgradeCapId?: string;
    error?: string;
}

export class MoveService {
    private executor: SuiCliExecutor;

    constructor() {
        this.executor = SuiCliExecutor.getInstance();
    }

    /**
     * Build a Move package
     * @param packagePath Path to the Move package (containing Move.toml)
     */
    public async buildPackage(packagePath: string): Promise<MoveBuildResult> {
        try {
            // Validate path exists
            try {
                await fs.access(path.join(packagePath, 'Move.toml'));
            } catch {
                return {
                    success: false,
                    output: '',
                    error: `Invalid package path: No Move.toml found in ${packagePath}`,
                };
            }

            const args = [
                'move',
                'build',
            ];

            // Execute build command
            // Note: We don't use --json because 'move build' doesn't support it well for compilation errors
            const output = await this.executor.execute(args, { cwd: packagePath });

            return {
                success: true,
                output,
            };
        } catch (error: any) {
            console.error('[MoveService] Build failed:', error);
            return {
                success: false,
                output: error.message || String(error),
                error: 'Build failed',
            };
        }
    }

    /**
     * Run Move tests
     * @param packagePath Path to the Move package
     * @param filter Optional filter string to run specific tests
     */
    public async runTests(packagePath: string, filter?: string): Promise<MoveTestResult> {
        try {
            const args = ['move', 'test'];
            if (filter) {
                args.push(filter);
            }

            const output = await this.executor.execute(args, { cwd: packagePath });

            // Parse output for stats - support multiple Sui CLI output formats
            // Format 1: "Test result: OK. Total tests: 9; passed: 9; failed: 0"
            // Format 2: "X / Y test(s) passed" / "X / Y test(s) failed"
            let passed = 0;
            let failed = 0;

            // Try new format first: "passed: X; failed: Y"
            const newPassedMatch = output.match(/passed:\s*(\d+)/i);
            const newFailedMatch = output.match(/failed:\s*(\d+)/i);

            if (newPassedMatch || newFailedMatch) {
                passed = newPassedMatch ? parseInt(newPassedMatch[1]) : 0;
                failed = newFailedMatch ? parseInt(newFailedMatch[1]) : 0;
            } else {
                // Fallback to old format: "X / Y test(s) passed/failed"
                const passedMatch = output.match(/(\d+) \/ \d+ test\(s\) passed/);
                const failedMatch = output.match(/(\d+) \/ \d+ test\(s\) failed/);
                passed = passedMatch ? parseInt(passedMatch[1]) : 0;
                failed = failedMatch ? parseInt(failedMatch[1]) : 0;
            }

            return {
                success: failed === 0,
                output,
                passed,
                failed,
            };
        } catch (error: any) {
            console.error('[MoveService] Tests failed:', error);
            return {
                success: false,
                output: error.message || String(error),
                passed: 0,
                failed: 1, // Assume failure if command fails
                error: 'Tests failed to execute',
            };
        }
    }

    /**
     * Create a new Move project
     * @param name Project name
     * @param parentDir Directory where the project should be created (optional, defaults to current directory)
     */
    public async createNewPackage(name: string, parentDir?: string): Promise<MoveNewResult> {
        return this.newProject(name, parentDir || process.cwd());
    }

    /**
     * Create a new Move project (internal implementation)
     * @param name Project name
     * @param parentDir Directory where the project should be created
     */
    private async newProject(name: string, parentDir: string): Promise<MoveNewResult> {
        try {
            // Validate parent dir
            await fs.access(parentDir);

            const args = ['move', 'new', name];

            await this.executor.execute(args, { cwd: parentDir });

            return {
                success: true,
                path: path.join(parentDir, name),
            };
        } catch (error: any) {
            console.error('[MoveService] New project creation failed:', error);
            return {
                success: false,
                error: sanitizeErrorMessage(error),
            };
        }
    }

    /**
     * Publish a Move package to the Sui blockchain
     * @param packagePath Path to the Move package
     * @param gasBudget Gas budget for the publish transaction (default: 100000000 MIST = 0.1 SUI)
     */
    public async publishPackage(packagePath: string, gasBudget: number = 100000000): Promise<MovePublishResult> {
        try {
            // Validate path exists and has Move.toml
            try {
                await fs.access(path.join(packagePath, 'Move.toml'));
            } catch {
                return {
                    success: false,
                    output: '',
                    error: `Invalid package path: No Move.toml found in ${packagePath}`,
                };
            }

            const args = [
                'client',
                'publish',
                '--gas-budget', gasBudget.toString(),
            ];

            // Execute publish command with JSON output
            const output = await this.executor.execute(args, {
                cwd: packagePath,
                json: true,
                timeout: 120000, // 2 minute timeout for publish
            });

            // Parse JSON output to extract package ID and upgrade cap
            try {
                const jsonData = JSON.parse(output);

                // Extract package ID from created objects
                let packageId: string | undefined;
                let upgradeCapId: string | undefined;

                if (jsonData.objectChanges) {
                    for (const change of jsonData.objectChanges) {
                        if (change.type === 'published') {
                            packageId = change.packageId;
                        } else if (change.objectType?.includes('UpgradeCap')) {
                            upgradeCapId = change.objectId;
                        }
                    }
                }

                return {
                    success: true,
                    output,
                    packageId,
                    upgradeCapId,
                };
            } catch (parseError) {
                // If JSON parsing fails, still return success with raw output
                console.warn('[MoveService] Could not parse publish JSON output:', parseError);
                return {
                    success: true,
                    output,
                };
            }
        } catch (error: any) {
            console.error('[MoveService] Publish failed:', error);
            return {
                success: false,
                output: error.message || String(error),
                error: 'Publish failed',
            };
        }
    }
}
