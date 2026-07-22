import { FastifyInstance } from 'fastify';
import { promises as fs, realpathSync } from 'fs';
import path from 'path';
import os from 'os';
import type { ApiResponse } from '@sui-cli-web/shared';
import { handleRouteError } from '../utils/errorHandler';

interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isPackage?: boolean;
}

// Cross-platform: Normalize path separators to forward slashes for consistent client handling
function normalizePathForResponse(p: string): string {
  return p.replace(/\\/g, '/');
}

// Cross-platform: Check for Move.toml with case variations (Windows is case-insensitive)
const MOVE_TOML_VARIANTS = ['Move.toml', 'move.toml', 'MOVE.TOML', 'Move.TOML'];

async function isMovePackage(dirPath: string): Promise<boolean> {
  for (const variant of MOVE_TOML_VARIANTS) {
    try {
      await fs.access(path.join(dirPath, variant));
      return true;
    } catch {
      // Try next variant
    }
  }
  return false;
}

interface BrowseResponse {
  currentPath: string;
  parentPath: string | null;
  entries: DirectoryEntry[];
}

// Security: Whitelist of allowed base directories
function getAllowedBaseDirs(): string[] {
  const homeDir = os.homedir();
  const baseDirs = [homeDir];

  // Common development directories
  const commonDirs = [
    path.join(homeDir, 'Documents'),
    path.join(homeDir, 'Desktop'),
    path.join(homeDir, 'Projects'),
    path.join(homeDir, 'Development'),
    path.join(homeDir, 'Code'),
    path.join(homeDir, 'dev'),
    '/tmp',
    '/opt',
  ];

  // On Windows, also allow common drive roots for development
  if (process.platform === 'win32') {
    baseDirs.push('C:\\Users', 'D:\\', 'E:\\');
  }

  return [...baseDirs, ...commonDirs];
}

// Security: Validate path to prevent traversal attacks
function isPathAllowed(targetPath: string): boolean {
  const allowedDirs = getAllowedBaseDirs();

  // Normalize and resolve the path to get canonical form
  // This prevents attacks like /home/user/../../../etc/passwd
  let canonicalPath: string;
  try {
    // Use realpathSync to resolve symlinks and get absolute path
    canonicalPath = realpathSync(targetPath);
  } catch {
    // Path doesn't exist yet or not accessible, use normalized path
    canonicalPath = path.normalize(path.resolve(targetPath));
  }

  // Check if canonical path starts with any allowed directory
  for (const allowedDir of allowedDirs) {
    // Normalize the allowed dir too
    const normalizedAllowed = path.normalize(allowedDir);
    if (canonicalPath.startsWith(normalizedAllowed)) {
      return true;
    }
  }

  // On Windows, allow any path under user's home or drive roots
  if (process.platform === 'win32') {
    const isWindowsDrive = /^[A-Za-z]:[/\\]/.test(canonicalPath);
    if (isWindowsDrive) {
      return true;
    }
  }

  return false;
}

export async function filesystemRoutes(fastify: FastifyInstance) {
  // Browse directory
  fastify.get<{
    Querystring: { path?: string };
    Reply: ApiResponse<BrowseResponse>;
  }>('/filesystem/browse', async (request, reply) => {
    try {
      const { path: requestedPath } = request.query;

      // Default to home directory if no path provided
      let targetPath = requestedPath?.trim() || os.homedir();

      // Security: Normalize path to prevent traversal attacks
      // This handles cases like: ../../etc/passwd, /home/user/../../../etc/passwd
      targetPath = path.normalize(path.resolve(targetPath));

      // Security: Validate against whitelist of allowed directories
      if (!isPathAllowed(targetPath)) {
        reply.status(403);
        return {
          success: false,
          error: 'Access denied: Path is outside allowed directories',
        };
      }

      // Check if directory exists and is readable
      try {
        const stats = await fs.stat(targetPath);
        if (!stats.isDirectory()) {
          reply.status(400);
          return {
            success: false,
            error: 'Path is not a directory',
          };
        }
      } catch (error) {
        reply.status(404);
        return {
          success: false,
          error: 'Directory not found or not accessible',
        };
      }

      // Read directory contents
      const files = await fs.readdir(targetPath, { withFileTypes: true });

      // Filter and map entries
      const entries: DirectoryEntry[] = [];

      for (const file of files) {
        // Skip hidden files (starting with .)
        if (file.name.startsWith('.')) continue;

        const fullPath = path.join(targetPath, file.name);

        const entry: DirectoryEntry = {
          name: file.name,
          path: fullPath,
          isDirectory: file.isDirectory(),
        };

        // Check if directory is a Move package (contains Move.toml - case insensitive for Windows)
        if (file.isDirectory()) {
          entry.isPackage = await isMovePackage(fullPath);
        }

        // Normalize path for cross-platform consistency
        entry.path = normalizePathForResponse(entry.path);
        entries.push(entry);
      }

      // Sort: directories first, then files, alphabetically
      entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      // Get parent directory
      const parentPath = path.dirname(targetPath);
      const isRoot = targetPath === parentPath;

      return {
        success: true,
        data: {
          currentPath: normalizePathForResponse(targetPath),
          parentPath: isRoot ? null : normalizePathForResponse(parentPath),
          entries,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Scan directory recursively for Move packages
  fastify.get<{
    Querystring: { path?: string; maxDepth?: string };
    Reply: ApiResponse<{ packages: Array<{ name: string; path: string; relativePath: string }> }>;
  }>('/filesystem/scan-packages', async (request, reply) => {
    try {
      const { path: requestedPath, maxDepth: maxDepthStr } = request.query;
      const maxDepth = Math.min(parseInt(maxDepthStr || '5', 10), 10); // Max 10 levels deep

      let targetPath = requestedPath?.trim() || os.homedir();
      targetPath = path.normalize(path.resolve(targetPath));

      if (!isPathAllowed(targetPath)) {
        reply.status(403);
        return {
          success: false,
          error: 'Access denied: Path is outside allowed directories',
        };
      }

      const packages: Array<{ name: string; path: string; relativePath: string }> = [];

      // Recursive function to scan directories
      async function scanDir(dirPath: string, depth: number): Promise<void> {
        if (depth > maxDepth) return;

        try {
          const files = await fs.readdir(dirPath, { withFileTypes: true });

          for (const file of files) {
            if (!file.isDirectory()) continue;
            if (file.name.startsWith('.')) continue; // Skip hidden
            if (file.name === 'node_modules' || file.name === 'target' || file.name === 'build') continue; // Skip common non-package dirs

            const fullPath = path.join(dirPath, file.name);

            // Check if this is a Move package (case insensitive for Windows)
            if (await isMovePackage(fullPath)) {
              packages.push({
                name: file.name,
                path: normalizePathForResponse(fullPath),
                relativePath: normalizePathForResponse(path.relative(targetPath, fullPath)),
              });
              // Don't recurse into Move packages (they won't have nested packages)
              continue;
            }

            // Recurse into subdirectory
            await scanDir(fullPath, depth + 1);
          }
        } catch {
          // Permission denied or other error, skip this directory
        }
      }

      await scanDir(targetPath, 0);

      // Sort by relative path
      packages.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

      return {
        success: true,
        data: { packages },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Get suggested starting directories
  fastify.get<{
    Reply: ApiResponse<{ directories: Array<{ name: string; path: string }> }>;
  }>('/filesystem/suggested', async (request, reply) => {
    try {
      const homeDir = os.homedir();
      const suggestions: Array<{ name: string; path: string }> = [
        { name: 'Home', path: normalizePathForResponse(homeDir) },
      ];

      // Add common directories if they exist
      const commonDirs = [
        { name: 'Documents', path: path.join(homeDir, 'Documents') },
        { name: 'Desktop', path: path.join(homeDir, 'Desktop') },
        { name: 'Projects', path: path.join(homeDir, 'Projects') },
        { name: 'Development', path: path.join(homeDir, 'Development') },
        { name: 'Code', path: path.join(homeDir, 'Code') },
        { name: 'dev', path: path.join(homeDir, 'dev') },
      ];

      // On Windows, add drive roots
      if (process.platform === 'win32') {
        commonDirs.push(
          { name: 'C: Drive', path: 'C:/' },
          { name: 'D: Drive', path: 'D:/' }
        );
      }

      for (const dir of commonDirs) {
        try {
          await fs.access(dir.path);
          suggestions.push({
            name: dir.name,
            path: normalizePathForResponse(dir.path),
          });
        } catch {
          // Directory doesn't exist, skip
        }
      }

      return {
        success: true,
        data: { directories: suggestions },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
