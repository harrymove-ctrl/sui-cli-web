import os from 'os';
import path from 'path';
import fs from 'fs';

/**
 * Platform detection and utilities for cross-platform compatibility
 * Supports: Windows, macOS, Linux, WSL
 */

export class Platform {
  private static _isWSL: boolean | null = null;

  /**
   * Detect if running in Windows Subsystem for Linux
   */
  static isWSL(): boolean {
    if (this._isWSL !== null) return this._isWSL;

    if (process.platform !== 'linux') {
      this._isWSL = false;
      return false;
    }

    try {
      const release = fs.readFileSync('/proc/version', 'utf8');
      this._isWSL = release.toLowerCase().includes('microsoft') ||
                    release.toLowerCase().includes('wsl');
      return this._isWSL;
    } catch {
      this._isWSL = false;
      return false;
    }
  }

  static isWindows(): boolean {
    return process.platform === 'win32';
  }

  static isMacOS(): boolean {
    return process.platform === 'darwin';
  }

  static isLinux(): boolean {
    return process.platform === 'linux' && !this.isWSL();
  }

  /**
   * Get platform name for display
   */
  static getPlatformName(): string {
    if (this.isWSL()) return 'WSL';
    if (this.isWindows()) return 'Windows';
    if (this.isMacOS()) return 'macOS';
    if (this.isLinux()) return 'Linux';
    return 'Unknown';
  }

  /**
   * Check if terminal supports ANSI color codes
   */
  static supportsANSI(): boolean {
    // Windows CMD doesn't support ANSI well
    if (this.isWindows() && !process.env.WT_SESSION) {
      return false;
    }
    return true;
  }

  /**
   * Get path separator for current platform
   */
  static getPathSeparator(): string {
    return this.isWindows() ? ';' : ':';
  }
}

/**
 * WSL path translation utilities
 */
export class WSLPath {
  /**
   * Convert WSL path to Windows path
   * /mnt/c/Users/foo → C:\Users\foo
   */
  static toWindows(wslPath: string): string | null {
    const match = wslPath.match(/^\/mnt\/([a-z])(\/.*)?$/i);
    if (!match) return null;

    const drive = match[1].toUpperCase();
    const restPath = match[2] || '';
    return `${drive}:${restPath.replace(/\//g, '\\')}`;
  }

  /**
   * Convert Windows path to WSL path
   * C:\Users\foo → /mnt/c/Users/foo
   */
  static toWSL(windowsPath: string): string | null {
    const match = windowsPath.match(/^([A-Za-z]):(\\.*)?$/);
    if (!match) return null;

    const drive = match[1].toLowerCase();
    const restPath = match[2] || '';
    return `/mnt/${drive}${restPath.replace(/\\/g, '/')}`;
  }

  /**
   * Normalize path for current platform
   */
  static normalize(inputPath: string): string {
    if (Platform.isWSL()) {
      // If it's a Windows path in WSL, convert it
      const wslPath = this.toWSL(inputPath);
      if (wslPath) return wslPath;
    }
    return path.normalize(inputPath);
  }
}

/**
 * File system utilities
 */
export class FileSystem {
  /**
   * Normalize long paths on Windows (>260 chars)
   */
  static normalizeLongPath(filePath: string): string {
    if (!Platform.isWindows()) return filePath;

    // Add \\?\ prefix for long paths
    if (filePath.length > 260 && !filePath.startsWith('\\\\?\\')) {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(filePath);
      return `\\\\?\\${absolutePath}`;
    }

    return filePath;
  }

  /**
   * Find file with case-insensitive search
   * Useful for Windows where filesystem is case-insensitive
   */
  static async findFileVariants(dirPath: string, fileName: string): Promise<string | null> {
    try {
      const files = await fs.promises.readdir(dirPath);
      const lowerFileName = fileName.toLowerCase();

      for (const file of files) {
        if (file.toLowerCase() === lowerFileName) {
          return path.join(dirPath, file);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if file is hidden (cross-platform)
   */
  static isHidden(filePath: string): boolean {
    const basename = path.basename(filePath);

    // Unix-style hidden files (start with .)
    if (basename.startsWith('.')) return true;

    // Windows hidden attribute check would require native module
    // For now, just check common Windows hidden files
    const windowsHidden = [
      'desktop.ini',
      'thumbs.db',
      '$recycle.bin',
      'system volume information'
    ];

    return windowsHidden.includes(basename.toLowerCase());
  }
}

/**
 * Platform-specific configuration
 */
export class PlatformConfig {
  /**
   * Get Sui config directory path
   */
  static getConfigPath(): string {
    if (Platform.isWindows()) {
      // Windows: %APPDATA%\sui
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(appData, 'sui');
    }

    // Unix-like: ~/.sui
    return path.join(os.homedir(), '.sui');
  }

  /**
   * Get binary search paths for Sui CLI
   */
  static getBinarySearchPaths(): string[] {
    const home = os.homedir();
    const paths: string[] = [];

    if (Platform.isWindows()) {
      // Windows paths
      paths.push(
        path.join(home, '.local', 'bin'),
        path.join(home, '.cargo', 'bin'),
        path.join(home, 'AppData', 'Local', 'Programs', 'sui'),
        path.join(home, '.sui', 'bin'),
        'C:\\Program Files\\sui',
        'C:\\Program Files (x86)\\sui'
      );
    } else if (Platform.isMacOS()) {
      // macOS paths
      paths.push(
        path.join(home, '.local', 'bin'),
        path.join(home, '.cargo', 'bin'),
        '/usr/local/bin',
        '/opt/homebrew/bin',
        '/opt/local/bin'
      );
    } else if (Platform.isWSL()) {
      // WSL paths (try both Linux and Windows paths)
      paths.push(
        path.join(home, '.local', 'bin'),
        path.join(home, '.cargo', 'bin'),
        '/usr/local/bin',
        '/usr/bin',
        '/snap/bin',
        // Try Windows Program Files from WSL
        '/mnt/c/Program Files/sui',
        '/mnt/c/Program Files (x86)/sui'
      );
    } else {
      // Linux paths
      paths.push(
        path.join(home, '.local', 'bin'),
        path.join(home, '.cargo', 'bin'),
        '/usr/local/bin',
        '/usr/bin',
        '/snap/bin',
        path.join(home, 'bin')
      );
    }

    return paths;
  }

  /**
   * Get command to kill process on port
   */
  static getPortKillCommand(port: number): string {
    if (Platform.isWindows()) {
      return `netstat -ano | findstr :${port} && taskkill /F /PID <PID>`;
    }
    return `lsof -ti:${port} | xargs kill -9`;
  }

  /**
   * Get common project directories
   */
  static getCommonProjectDirs(): string[] {
    const home = os.homedir();

    if (Platform.isWindows()) {
      return [
        path.join(home, 'Documents'),
        path.join(home, 'Desktop'),
        path.join(home, 'Projects'),
        path.join(home, 'source', 'repos'), // Visual Studio default
      ];
    }

    return [
      path.join(home, 'Documents'),
      path.join(home, 'Desktop'),
      path.join(home, 'Projects'),
      path.join(home, 'Developer'), // macOS default
      path.join(home, 'dev'),
    ];
  }

  /**
   * Get platform-specific temp directory
   */
  static getTempDir(): string {
    if (Platform.isWindows()) {
      return process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp';
    }
    return '/tmp';
  }
}

/**
 * Security utilities for path validation
 */
export class PathValidator {
  // Shell metacharacters that could be dangerous
  private static readonly SHELL_METACHAR = /[;&|`$(){}[\]\\'"<>!#~*?\n\r\x00-\x1F\x7F-\x9F]/;

  // Unicode direction overrides and confusables
  private static readonly UNICODE_DANGEROUS = /[\u202A-\u202E\u2066-\u2069\uFEFF]/;

  // Windows reserved names
  private static readonly WINDOWS_RESERVED = [
    'CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5',
    'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4',
    'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];

  /**
   * Validate that a string is safe for use as a command argument
   */
  static isSafeArg(arg: string): boolean {
    if (typeof arg !== 'string' || arg.length > 1024) {
      return false;
    }

    // Block shell metacharacters
    if (this.SHELL_METACHAR.test(arg)) {
      return false;
    }

    // Block Unicode direction overrides
    if (this.UNICODE_DANGEROUS.test(arg)) {
      return false;
    }

    // Ensure proper Unicode normalization
    if (arg !== arg.normalize('NFC')) {
      return false;
    }

    return true;
  }

  /**
   * Validate path is safe and within allowed directories
   */
  static async validatePath(requestedPath: string, allowedBases?: string[]): Promise<string> {
    // Use default allowed bases if not provided
    if (!allowedBases) {
      allowedBases = PlatformConfig.getCommonProjectDirs();
      allowedBases.push(os.homedir());
    }

    // Normalize path
    const normalized = Platform.isWSL()
      ? WSLPath.normalize(requestedPath)
      : path.normalize(requestedPath);

    // Check for path traversal
    if (normalized.includes('..')) {
      throw new Error('Path traversal detected');
    }

    // Resolve to absolute path
    const absolutePath = path.isAbsolute(normalized)
      ? normalized
      : path.resolve(normalized);

    // Check against allowlist
    const isAllowed = allowedBases.some(base => {
      const normalizedBase = path.normalize(base);
      return absolutePath.toLowerCase().startsWith(normalizedBase.toLowerCase());
    });

    if (!isAllowed) {
      throw new Error('Access denied to this directory');
    }

    // Platform-specific validations
    if (Platform.isWindows()) {
      // Block UNC paths
      if (absolutePath.startsWith('\\\\')) {
        throw new Error('UNC paths are not allowed');
      }

      // Block reserved names
      const pathParts = absolutePath.split(/[/\\]/);
      for (const part of pathParts) {
        if (this.WINDOWS_RESERVED.includes(part.toUpperCase())) {
          throw new Error('Path contains reserved Windows name');
        }
      }
    }

    // WSL-specific validations
    if (Platform.isWSL()) {
      // Block /mnt access to Windows system directories
      if (absolutePath.match(/^\/mnt\/[a-z]\/(Windows|Program Files)/i)) {
        throw new Error('Access denied to Windows system directory from WSL');
      }
    }

    return absolutePath;
  }

  /**
   * Sanitize path for display (remove sensitive parts)
   */
  static sanitizePath(filePath: string): string {
    const home = os.homedir();

    return filePath
      // Unix home directories
      .replace(new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '~')
      .replace(/\/Users\/[^/\s]+/g, '/Users/***')
      .replace(/\/home\/[^/\s]+/g, '/home/***')
      .replace(/\/mnt\/[a-z]\/Users\/[^/\s]+/gi, '/mnt/*/Users/***')
      // Windows paths
      .replace(/C:\\Users\\[^\\]+/gi, 'C:\\Users\\***')
      .replace(/[A-Z]:\\Users\\[^\\]+/gi, '*:\\Users\\***')
      // Network paths
      .replace(/\\\\[^\\]+\\[^\\]+\\[^\\]+/g, '\\\\***\\***\\***')
      .replace(/\/\/[^/]+\/[^/]+\/[^/]+/g, '//***/***/***');
  }
}
