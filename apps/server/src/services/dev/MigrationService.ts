/**
 * MigrationService - Move 2024 migration support
 */

import { SuiCliExecutor } from '../../cli/SuiCliExecutor';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface MigrationChange {
  file: string;
  line: number;
  type: 'syntax' | 'import' | 'type' | 'function' | 'module';
  before: string;
  after: string;
  description: string;
}

export interface MigrationPreview {
  packagePath: string;
  packageName: string;
  currentEdition?: string;
  targetEdition: string;
  changes: MigrationChange[];
  warnings: string[];
  errors: string[];
  canAutoMigrate: boolean;
}

export interface MigrationResult {
  success: boolean;
  packagePath: string;
  migratedFiles: string[];
  backupPath?: string;
  errors: string[];
  warnings: string[];
}

export interface MigrationStatus {
  needsMigration: boolean;
  currentEdition?: string;
  targetEdition: string;
  packageName?: string;
}

const MOVE_2024_EDITION = '2024.beta';
const BACKUP_SUFFIX = '.backup';

export class MigrationService {
  private executor: SuiCliExecutor;

  constructor() {
    this.executor = SuiCliExecutor.getInstance();
  }

  /**
   * Check if a package needs migration
   */
  async checkMigrationStatus(packagePath: string): Promise<MigrationStatus> {
    try {
      const moveTomlPath = path.join(packagePath, 'Move.toml');
      const content = await fs.readFile(moveTomlPath, 'utf-8');

      // Parse edition from Move.toml
      const editionMatch = content.match(/edition\s*=\s*["']([^"']+)["']/);
      const currentEdition = editionMatch ? editionMatch[1] : undefined;

      // Parse package name
      const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
      const packageName = nameMatch ? nameMatch[1] : undefined;

      // Check if already on 2024
      const needsMigration = !currentEdition || !currentEdition.includes('2024');

      return {
        needsMigration,
        currentEdition,
        targetEdition: MOVE_2024_EDITION,
        packageName,
      };
    } catch (error) {
      // If Move.toml doesn't exist or can't be read, assume migration needed
      return {
        needsMigration: true,
        targetEdition: MOVE_2024_EDITION,
      };
    }
  }

  /**
   * Preview migration changes without applying
   */
  async preview(packagePath: string): Promise<MigrationPreview> {
    const status = await this.checkMigrationStatus(packagePath);

    const preview: MigrationPreview = {
      packagePath,
      packageName: status.packageName || 'unknown',
      currentEdition: status.currentEdition,
      targetEdition: status.targetEdition,
      changes: [],
      warnings: [],
      errors: [],
      canAutoMigrate: true,
    };

    if (!status.needsMigration) {
      preview.warnings.push('Package is already on Move 2024 edition');
      preview.canAutoMigrate = false;
      return preview;
    }

    try {
      // Run sui move migrate in dry-run mode to see what would change
      // Note: The actual CLI doesn't have a --dry-run flag for migrate,
      // so we'll analyze the Move files directly

      // Find all Move source files
      const sourcesDir = path.join(packagePath, 'sources');
      const moveFiles = await this.findMoveFiles(sourcesDir);

      for (const file of moveFiles) {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(packagePath, file);
        const changes = this.analyzeFileForMigration(content, relativePath);
        preview.changes.push(...changes);
      }

      // Check Move.toml changes
      preview.changes.push({
        file: 'Move.toml',
        line: 1,
        type: 'module',
        before: status.currentEdition ? `edition = "${status.currentEdition}"` : '(no edition)',
        after: `edition = "${MOVE_2024_EDITION}"`,
        description: 'Update Move edition to 2024',
      });

    } catch (error) {
      preview.errors.push(error instanceof Error ? error.message : String(error));
      preview.canAutoMigrate = false;
    }

    return preview;
  }

  /**
   * Find all Move files in a directory recursively
   */
  private async findMoveFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          files.push(...await this.findMoveFiles(fullPath));
        } else if (entry.name.endsWith('.move')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or not accessible
    }

    return files;
  }

  /**
   * Analyze a Move file for potential migration changes
   */
  private analyzeFileForMigration(content: string, relativePath: string): MigrationChange[] {
    const changes: MigrationChange[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for deprecated syntax patterns
      // These are examples - actual migration needs vary

      // Check for old-style friend declarations
      if (line.match(/^\s*friend\s+/)) {
        changes.push({
          file: relativePath,
          line: lineNum,
          type: 'syntax',
          before: line.trim(),
          after: '// friend declarations may need review in Move 2024',
          description: 'Friend declarations syntax may change',
        });
      }

      // Check for script blocks (deprecated in Move 2024)
      if (line.match(/^\s*script\s*\{/)) {
        changes.push({
          file: relativePath,
          line: lineNum,
          type: 'module',
          before: 'script {',
          after: '// Scripts should be converted to modules with entry functions',
          description: 'Script blocks are being phased out',
        });
      }

      // Check for acquires without explicit type
      if (line.match(/acquires\s+[A-Z]/)) {
        // This is just informational - acquires syntax is being simplified
      }

      // Check for public(script) visibility
      if (line.match(/public\s*\(\s*script\s*\)/)) {
        changes.push({
          file: relativePath,
          line: lineNum,
          type: 'function',
          before: line.trim(),
          after: line.replace(/public\s*\(\s*script\s*\)/, 'public entry'),
          description: 'public(script) replaced with public entry',
        });
      }

      // Check for public(friend) visibility
      if (line.match(/public\s*\(\s*friend\s*\)/)) {
        changes.push({
          file: relativePath,
          line: lineNum,
          type: 'function',
          before: line.trim(),
          after: line.replace(/public\s*\(\s*friend\s*\)/, 'public(package)'),
          description: 'public(friend) replaced with public(package)',
        });
      }
    }

    return changes;
  }

  /**
   * Apply migration with optional backup
   */
  async migrate(packagePath: string, createBackup: boolean = true): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      packagePath,
      migratedFiles: [],
      errors: [],
      warnings: [],
    };

    try {
      // Check if migration is needed
      const status = await this.checkMigrationStatus(packagePath);
      if (!status.needsMigration) {
        result.warnings.push('Package is already on Move 2024 edition');
        result.success = true;
        return result;
      }

      // Create backup if requested
      if (createBackup) {
        result.backupPath = await this.createBackup(packagePath);
      }

      // Run the actual migration command
      const args = ['move', 'migrate', '-p', packagePath];

      try {
        const output = await this.executor.execute(args, { timeout: 60000 });

        // Parse output to find migrated files
        const migratedMatch = output.match(/Migrated\s+(\d+)\s+file/);
        if (migratedMatch) {
          result.warnings.push(`Migration tool output: ${output}`);
        }

        result.success = true;

      } catch (error) {
        // Migration command might fail, try manual migration
        result.warnings.push('CLI migration failed, attempting manual migration...');

        try {
          await this.manualMigrate(packagePath, result);
          result.success = true;
        } catch (manualError) {
          result.errors.push(manualError instanceof Error ? manualError.message : String(manualError));
        }
      }

      // Get list of migrated files
      const sourcesDir = path.join(packagePath, 'sources');
      result.migratedFiles = await this.findMoveFiles(sourcesDir);
      result.migratedFiles.push(path.join(packagePath, 'Move.toml'));

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  /**
   * Manual migration when CLI fails
   */
  private async manualMigrate(packagePath: string, result: MigrationResult): Promise<void> {
    // Update Move.toml edition
    const moveTomlPath = path.join(packagePath, 'Move.toml');
    let moveToml = await fs.readFile(moveTomlPath, 'utf-8');

    if (moveToml.match(/edition\s*=/)) {
      moveToml = moveToml.replace(/edition\s*=\s*["'][^"']*["']/, `edition = "${MOVE_2024_EDITION}"`);
    } else {
      // Add edition after [package] section
      moveToml = moveToml.replace(/(\[package\][^\[]*)/s, `$1edition = "${MOVE_2024_EDITION}"\n`);
    }

    await fs.writeFile(moveTomlPath, moveToml);

    // Apply known transformations to Move files
    const sourcesDir = path.join(packagePath, 'sources');
    const moveFiles = await this.findMoveFiles(sourcesDir);

    for (const file of moveFiles) {
      let content = await fs.readFile(file, 'utf-8');
      let modified = false;

      // Replace public(script) with public entry
      if (content.includes('public(script)')) {
        content = content.replace(/public\s*\(\s*script\s*\)/g, 'public entry');
        modified = true;
      }

      // Replace public(friend) with public(package)
      if (content.includes('public(friend)')) {
        content = content.replace(/public\s*\(\s*friend\s*\)/g, 'public(package)');
        modified = true;
      }

      if (modified) {
        await fs.writeFile(file, content);
        result.warnings.push(`Manually migrated: ${path.relative(packagePath, file)}`);
      }
    }
  }

  /**
   * Create backup of package
   */
  private async createBackup(packagePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${packagePath}${BACKUP_SUFFIX}_${timestamp}`;

    await this.copyDirectory(packagePath, backupPath);

    return backupPath;
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });

    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      // Skip backup directories and build output
      if (entry.name.includes(BACKUP_SUFFIX) || entry.name === 'build') {
        continue;
      }

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Restore from backup
   */
  async restore(packagePath: string, backupPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify backup exists
      await fs.access(backupPath);

      // Remove current package content (except backup)
      const entries = await fs.readdir(packagePath);
      for (const entry of entries) {
        if (!entry.includes(BACKUP_SUFFIX)) {
          await fs.rm(path.join(packagePath, entry), { recursive: true });
        }
      }

      // Copy backup back
      await this.copyDirectory(backupPath, packagePath);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List available backups for a package
   */
  async listBackups(packagePath: string): Promise<string[]> {
    const parentDir = path.dirname(packagePath);
    const packageName = path.basename(packagePath);

    try {
      const entries = await fs.readdir(parentDir);
      return entries
        .filter(e => e.startsWith(packageName + BACKUP_SUFFIX))
        .map(e => path.join(parentDir, e));
    } catch {
      return [];
    }
  }
}
