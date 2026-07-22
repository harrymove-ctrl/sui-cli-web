import { SuiCliExecutor } from '../../cli/SuiCliExecutor.js';
import { sanitizeErrorMessage } from '../../utils/errorHandler.js';
import { validatePackagePath } from '../../utils/validation.js';
import path from 'path';
import fs from 'fs/promises';

export interface CoverageResult {
    success: boolean;
    output: string;
    mode: string;
    moduleName?: string;
    error?: string;
}

export interface DisassembleResult {
    success: boolean;
    output: string;
    modulePath: string;
    error?: string;
}

export interface SummaryResult {
    success: boolean;
    summary?: object | string;
    format: string;
    packageId?: string;
    modules?: string[];
    error?: string;
}

export class DevToolsService {
    private executor: SuiCliExecutor;

    constructor() {
        this.executor = SuiCliExecutor.getInstance();
    }

    /**
     * Run coverage analysis on a Move package
     * Requires: Tests must have been run with --coverage flag first
     * @param packagePath Path to the Move package
     * @param mode Coverage mode: 'summary' | 'source' | 'bytecode' | 'lcov'
     * @param moduleName Optional module name for source/bytecode modes
     */
    public async runCoverage(
        packagePath: string,
        mode: string = 'summary',
        moduleName?: string
    ): Promise<CoverageResult> {
        try {
            // Validate package path (prevents path traversal)
            const validatedPath = validatePackagePath(packagePath);

            // Validate path exists
            try {
                await fs.access(path.join(validatedPath, 'Move.toml'));
            } catch {
                return {
                    success: false,
                    output: '',
                    mode,
                    moduleName,
                    error: `Invalid package path: No Move.toml found in ${validatedPath}`,
                };
            }

            // Validate mode
            const validModes = ['summary', 'source', 'bytecode', 'lcov'];
            if (!validModes.includes(mode)) {
                return {
                    success: false,
                    output: '',
                    mode,
                    moduleName,
                    error: `Invalid coverage mode: ${mode}. Valid modes: ${validModes.join(', ')}`,
                };
            }

            // For source and bytecode modes, module name is REQUIRED
            if ((mode === 'source' || mode === 'bytecode') && !moduleName) {
                return {
                    success: false,
                    output: '',
                    mode,
                    moduleName,
                    error: `Module name is required for '${mode}' mode. Please specify the module name.`,
                };
            }

            // Check if coverage map exists before running
            const coverageMapPath = path.join(validatedPath, '.coverage_map.mvcov');
            let coverageMapExists = false;
            try {
                await fs.access(coverageMapPath);
                coverageMapExists = true;
            } catch {
                // Coverage map doesn't exist - will provide clear error
            }

            if (!coverageMapExists) {
                // Check for active (non-commented) test functions in the package
                const hasActiveTests = await this.checkForActiveTests(validatedPath);

                if (!hasActiveTests) {
                    return {
                        success: false,
                        output: '',
                        mode,
                        moduleName,
                        error: `No active tests found in this package. Coverage analysis requires tests.\n\nYour test code may be commented out. To use coverage:\n1. Uncomment or add tests (in tests/ folder or with #[test] attribute)\n2. Run: sui move test --coverage\n3. Then run coverage analysis`,
                    };
                }

                return {
                    success: false,
                    output: '',
                    mode,
                    moduleName,
                    error: `No coverage data found. Please run tests with coverage first:\n\nsui move test --coverage\n\nThen try running coverage analysis again.`,
                };
            }

            const args = [
                'move',
                'coverage',
                mode,
            ];

            // Add module name for source and bytecode modes
            if ((mode === 'source' || mode === 'bytecode') && moduleName) {
                args.push('--module', moduleName);
            }

            // Execute coverage command
            console.log(`[DevToolsService] Running coverage: sui ${args.join(' ')} in ${validatedPath}`);
            const output = await this.executor.execute(args, { cwd: validatedPath });

            // Add mode identifier to help user understand what they're seeing
            const modeDescriptions: Record<string, string> = {
                'summary': '📊 Coverage Summary',
                'source': '📝 Source Code Coverage',
                'bytecode': '🔧 Bytecode Coverage',
                'lcov': '📤 LCOV Export',
            };

            const modeHeader = `=== ${modeDescriptions[mode] || mode.toUpperCase()} ===\n\n`;

            return {
                success: true,
                output: modeHeader + output,
                mode,
                moduleName,
            };
        } catch (error: any) {
            console.error('[DevToolsService] Coverage failed:', error);
            const errorMessage = error.message || String(error);

            // Check if the "error" is actually just lint warnings (not real errors)
            // Sui CLI exits with non-zero code even for warnings
            // Note: Sui CLI uses "Lint" (capital L) in output
            const hasOnlyWarnings = /warning\[(?:[Ll]int\s+)?W\d+\]:/.test(errorMessage) &&
                                   !/error\[E\d+\]:/.test(errorMessage);

            if (hasOnlyWarnings) {
                // Check if there's actual coverage output after warnings
                // Look for coverage-specific patterns
                const hasCoverageOutput = errorMessage.includes('Coverage:') ||
                                         errorMessage.includes('covered:') ||
                                         errorMessage.includes('Module') ||
                                         errorMessage.includes('%');

                // Add mode header for clarity
                const modeDescriptions: Record<string, string> = {
                    'summary': '📊 Coverage Summary',
                    'source': '📝 Source Code Coverage',
                    'bytecode': '🔧 Bytecode Coverage',
                    'lcov': '📤 LCOV Export',
                };
                const modeHeader = `=== ${modeDescriptions[mode] || mode.toUpperCase()} ===\n\n`;

                return {
                    success: true,
                    output: modeHeader + errorMessage,
                    mode,
                    moduleName,
                };
            }

            // Parse common error messages to provide user-friendly feedback
            let userFriendlyError = errorMessage;
            if (errorMessage.includes('.coverage_map.mvcov') && errorMessage.includes("doesn't exist")) {
                userFriendlyError = 'No coverage data found. Run "sui move test --coverage" first to generate coverage data.';
            } else if (errorMessage.includes('No such file or directory')) {
                userFriendlyError = 'Coverage map not found. Please run tests with coverage flag first:\n\nsui move test --coverage';
            }

            return {
                success: false,
                output: userFriendlyError,
                mode,
                moduleName,
                error: userFriendlyError,
            };
        }
    }

    /**
     * Disassemble a compiled Move module (.mv file)
     * @param modulePath Path to the .mv file to disassemble
     * @param showDebug Show disassembly in raw Debug format
     * @param showBytecodeMap Print the bytecode map (source map for disassembled bytecode)
     */
    public async disassemble(
        modulePath: string,
        showDebug: boolean = false,
        showBytecodeMap: boolean = false
    ): Promise<DisassembleResult> {
        try {
            // Validate path (prevents path traversal)
            // Use directory of module path for validation
            const moduleDir = path.dirname(modulePath);
            const moduleFile = path.basename(modulePath);

            // Check for path traversal attempts
            if (modulePath.includes('..')) {
                return {
                    success: false,
                    output: '',
                    modulePath,
                    error: 'Invalid module path: Path traversal not allowed',
                };
            }

            // Validate it's a .mv file
            if (!moduleFile.endsWith('.mv')) {
                return {
                    success: false,
                    output: '',
                    modulePath,
                    error: 'Module path must point to a .mv file',
                };
            }

            // Validate .mv file exists
            try {
                await fs.access(modulePath);
            } catch {
                return {
                    success: false,
                    output: '',
                    modulePath,
                    error: `Module file not found: ${modulePath}`,
                };
            }

            const args = [
                'move',
                'disassemble',
                modulePath,
            ];

            if (showDebug) {
                args.push('--Xdebug');
            }

            if (showBytecodeMap) {
                args.push('--bytecode-map');
            }

            // Execute disassemble command
            const output = await this.executor.execute(args);

            return {
                success: true,
                output,
                modulePath,
            };
        } catch (error: any) {
            console.error('[DevToolsService] Disassemble failed:', error);
            return {
                success: false,
                output: error.message || String(error),
                modulePath,
                error: 'Disassembly failed',
            };
        }
    }

    /**
     * Generate a summary of a Move package (functions, structs, annotations, etc.)
     * Can summarize from source code or from a published package on-chain
     * @param packagePath Path to the Move package (optional if packageId is provided)
     * @param packageId Package object ID on-chain (optional if packagePath is provided)
     * @param format Output format: 'json' | 'yaml'
     */
    public async generateSummary(
        packagePath?: string,
        packageId?: string,
        format: string = 'json'
    ): Promise<SummaryResult> {
        try {
            // Either packagePath or packageId must be provided
            if (!packagePath && !packageId) {
                return {
                    success: false,
                    format,
                    error: 'Either packagePath or packageId must be provided',
                };
            }

            // Validate format
            const validFormats = ['json', 'yaml'];
            if (!validFormats.includes(format)) {
                return {
                    success: false,
                    format,
                    error: `Invalid format: ${format}. Valid formats: ${validFormats.join(', ')}`,
                };
            }

            // If packagePath is provided, validate it exists
            let validatedPackagePath: string | undefined;
            if (packagePath) {
                // Validate package path (prevents path traversal)
                validatedPackagePath = validatePackagePath(packagePath);

                try {
                    await fs.access(path.join(validatedPackagePath, 'Move.toml'));
                } catch {
                    return {
                        success: false,
                        format,
                        error: `Invalid package path: No Move.toml found in ${validatedPackagePath}`,
                    };
                }
            }

            // Create a temp directory for the summary output
            const os = await import('os');
            const tempDir = await fs.mkdtemp(path.join(os.default.tmpdir(), 'sui-summary-'));
            const outputDir = path.join(tempDir, 'package_summaries');

            const args = [
                'move',
                'summary',
                '--output-format', format,
                '--output-directory', outputDir,
            ];

            // Add packageId if provided (takes precedence over path)
            if (packageId) {
                args.push('--package-id', packageId, '--bytecode');
            }

            // Execute summary command
            console.log(`[DevToolsService] Running summary: sui ${args.join(' ')} in ${validatedPackagePath || tempDir}`);
            await this.executor.execute(args, {
                cwd: validatedPackagePath || tempDir,
            });

            // Read the generated summary files
            const summaryData = await this.readSummaryFiles(outputDir, format, packageId);

            // Cleanup temp directory
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch {
                console.warn('[DevToolsService] Could not cleanup temp directory:', tempDir);
            }

            if (!summaryData.success) {
                return {
                    success: false,
                    format,
                    error: summaryData.error || 'Failed to read summary files',
                };
            }

            return {
                success: true,
                summary: summaryData.summary,
                format,
                packageId: summaryData.packageId,
                modules: summaryData.modules,
            };
        } catch (error: any) {
            console.error('[DevToolsService] Summary generation failed:', error);
            return {
                success: false,
                format,
                error: sanitizeErrorMessage(error),
            };
        }
    }

    /**
     * Read and parse generated summary files from the output directory
     */
    private async readSummaryFiles(
        outputDir: string,
        format: string,
        targetPackageId?: string
    ): Promise<{ success: boolean; summary?: object; packageId?: string; modules?: string[]; error?: string }> {
        try {
            // Check if output directory exists
            try {
                await fs.access(outputDir);
            } catch {
                return {
                    success: false,
                    error: 'Summary output directory not found',
                };
            }

            // Read root_package_metadata.json for package info
            const metadataPath = path.join(outputDir, `root_package_metadata.${format}`);
            let metadata: any = null;
            try {
                const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                metadata = format === 'json' ? JSON.parse(metadataContent) : metadataContent;
            } catch {
                console.warn('[DevToolsService] Could not read root_package_metadata');
            }

            // Determine which package to read
            const rootPackageId = metadata?.root_package_id || targetPackageId;
            if (!rootPackageId) {
                return {
                    success: false,
                    error: 'Could not determine package ID from summary',
                };
            }

            // Read module summaries from the package subdirectory
            const packageDir = path.join(outputDir, rootPackageId);
            const modules: string[] = [];
            const moduleSummaries: Record<string, any> = {};

            try {
                const files = await fs.readdir(packageDir);
                for (const file of files) {
                    if (file.endsWith(`.${format}`)) {
                        const moduleName = file.replace(`.${format}`, '');
                        modules.push(moduleName);

                        const modulePath = path.join(packageDir, file);
                        const moduleContent = await fs.readFile(modulePath, 'utf-8');

                        if (format === 'json') {
                            try {
                                moduleSummaries[moduleName] = JSON.parse(moduleContent);
                            } catch {
                                moduleSummaries[moduleName] = moduleContent;
                            }
                        } else {
                            moduleSummaries[moduleName] = moduleContent;
                        }
                    }
                }
            } catch {
                console.warn('[DevToolsService] Could not read package directory:', packageDir);
            }

            // Combine into a comprehensive summary
            const summary = {
                packageId: rootPackageId,
                metadata: metadata || {},
                modules: moduleSummaries,
                moduleCount: modules.length,
                generatedAt: new Date().toISOString(),
            };

            return {
                success: true,
                summary,
                packageId: rootPackageId,
                modules,
            };
        } catch (error: any) {
            console.error('[DevToolsService] Failed to read summary files:', error);
            return {
                success: false,
                error: sanitizeErrorMessage(error),
            };
        }
    }

    /**
     * Check if a Move package has active (non-commented) test functions
     * This helps detect when tests are present but commented out
     */
    private async checkForActiveTests(packagePath: string): Promise<boolean> {
        const dirsToCheck = [
            path.join(packagePath, 'sources'),
            path.join(packagePath, 'tests'),
        ];

        for (const dir of dirsToCheck) {
            try {
                const files = await fs.readdir(dir);
                for (const file of files) {
                    if (!file.endsWith('.move')) continue;

                    const content = await fs.readFile(path.join(dir, file), 'utf-8');

                    // Remove block comments /* ... */ to check for actual active tests
                    const withoutBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, '');

                    // Remove line comments // ...
                    const withoutComments = withoutBlockComments.replace(/\/\/.*$/gm, '');

                    // Now check for #[test] or #[test_only] in the uncommented code
                    if (withoutComments.includes('#[test]') || withoutComments.includes('#[test_only]')) {
                        return true;
                    }
                }
            } catch {
                // Directory doesn't exist or can't be read
            }
        }

        return false;
    }
}
