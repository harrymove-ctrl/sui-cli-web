import { FastifyInstance } from 'fastify';
import { DevToolsService } from '../services/dev/DevToolsService.js';
import type { ApiResponse } from '@sui-cli-web/shared';
import { handleRouteError } from '../utils/errorHandler.js';
import { validatePackagePath } from '../utils/validation.js';
import fs from 'fs/promises';
import path from 'path';

const devToolsService = new DevToolsService();

export async function devtoolsRoutes(fastify: FastifyInstance) {
    // Get modules from a Move package
    fastify.get<{
        Querystring: { packagePath: string };
        Reply: ApiResponse<{ modules: string[]; packagePath: string }>;
    }>('/devtools/modules', async (request, reply) => {
        try {
            const { packagePath } = request.query;

            // Validate package path (prevents path traversal)
            const validatedPath = validatePackagePath(packagePath);

            // Check sources directory for .move files
            const sourcesPath = path.join(validatedPath, 'sources');
            const modules: string[] = [];

            try {
                const files = await fs.readdir(sourcesPath);
                for (const file of files) {
                    if (file.endsWith('.move')) {
                        // Extract module name from filename (without .move extension)
                        modules.push(file.replace('.move', ''));
                    }
                }
            } catch (fsError: any) {
                // Log but don't fail - sources directory may not exist yet
                if (fsError.code !== 'ENOENT') {
                    console.warn(`[devtools/modules] Failed to read sources: ${fsError.message}`);
                }
            }

            return {
                success: true,
                data: { modules, packagePath: validatedPath },
            };
        } catch (error) {
            return handleRouteError(error, reply);
        }
    });
    // Run coverage analysis
    fastify.post<{
        Body: { packagePath: string; mode?: string; moduleName?: string };
        Reply: ApiResponse<{ output: string; mode: string; moduleName?: string }>;
    }>('/devtools/coverage', async (request, reply) => {
        try {
            const { packagePath, mode = 'summary', moduleName } = request.body;

            if (!packagePath) {
                reply.status(400);
                return { success: false, error: 'packagePath is required' };
            }

            const result = await devToolsService.runCoverage(packagePath, mode, moduleName);

            if (!result.success) {
                // Use 400 for user errors (missing coverage data), 500 for server errors
                const isUserError = result.error?.includes('coverage') ||
                    result.error?.includes('Run "sui move test') ||
                    result.error?.includes('Module name is required');
                reply.status(isUserError ? 400 : 500);
                return {
                    success: false,
                    error: result.error || result.output || 'Coverage analysis failed',
                };
            }

            return {
                success: true,
                data: {
                    output: result.output,
                    mode: result.mode,
                    moduleName: result.moduleName,
                },
            };
        } catch (error) {
            return handleRouteError(error, reply);
        }
    });

    // Disassemble a Move module
    fastify.post<{
        Body: { modulePath: string; showDebug?: boolean; showBytecodeMap?: boolean };
        Reply: ApiResponse<{ output: string; modulePath: string }>;
    }>('/devtools/disassemble', async (request, reply) => {
        try {
            const { modulePath, showDebug = false, showBytecodeMap = false } = request.body;

            if (!modulePath) {
                reply.status(400);
                return { success: false, error: 'modulePath is required' };
            }

            const result = await devToolsService.disassemble(
                modulePath,
                showDebug,
                showBytecodeMap
            );

            if (!result.success) {
                reply.status(500);
                return {
                    success: false,
                    error: result.output || result.error || 'Disassembly failed',
                };
            }

            return {
                success: true,
                data: {
                    output: result.output,
                    modulePath: result.modulePath,
                },
            };
        } catch (error) {
            return handleRouteError(error, reply);
        }
    });

    // Generate package summary
    fastify.post<{
        Body: { packagePath?: string; packageId?: string; format?: string };
        Reply: ApiResponse<{
            summary: object | string;
            format: string;
            packageId?: string;
            modules?: string[];
        }>;
    }>('/devtools/summary', async (request, reply) => {
        try {
            const { packagePath, packageId, format = 'json' } = request.body;

            // At least one of packagePath or packageId must be provided
            if (!packagePath && !packageId) {
                reply.status(400);
                return {
                    success: false,
                    error: 'Either packagePath or packageId is required',
                };
            }

            const result = await devToolsService.generateSummary(
                packagePath,
                packageId,
                format
            );

            if (!result.success) {
                reply.status(500);
                return {
                    success: false,
                    error: result.error || 'Summary generation failed',
                };
            }

            return {
                success: true,
                data: {
                    summary: result.summary!,
                    format: result.format,
                    packageId: result.packageId,
                    modules: result.modules,
                },
            };
        } catch (error) {
            return handleRouteError(error, reply);
        }
    });
}
