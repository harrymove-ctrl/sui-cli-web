/**
 * MoveMigrate - Migrate Move packages to Move 2024
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileCode,
  FolderOpen,
  History,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import React, { useState } from 'react';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { CopyForAiMenu } from '@/components/ui/copy-for-ai';
import { useCopyToClipboard } from '@/hooks';

interface MigrationChange {
  file: string;
  line: number;
  before: string;
  after: string;
  type: 'syntax' | 'deprecation' | 'feature';
}

interface MigrationPreview {
  success: boolean;
  changes: MigrationChange[];
  totalFiles: number;
  totalChanges: number;
  error?: string;
}

interface MigrationResult {
  success: boolean;
  filesModified: number;
  backupPath?: string;
  error?: string;
}

export function MoveMigrate() {
  const [packagePath, setPackagePath] = useState('');
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!packagePath) {
      setError('Please enter a package path');
      return;
    }

    setIsPreviewing(true);
    setError(null);
    setPreview(null);
    setResult(null);

    try {
      const response = await apiClient.post('/move/migrate/preview', {
        packagePath,
      });

      if (response.success) {
        setPreview(response as MigrationPreview);
      } else {
        setError(response.error || 'Preview failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleMigrate = async () => {
    if (!packagePath) {
      setError('Please enter a package path');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.post('/move/migrate', {
        packagePath,
        createBackup: true,
      });

      if (response.success) {
        setResult(response as MigrationResult);
      } else {
        setError(response.error || 'Migration failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = useCopyToClipboard();

  // Copy-for-AI: assemble the current migration state into shareable context
  const packageName = packagePath.trim()
    ? packagePath.trim().split('/').pop() || packagePath.trim()
    : null;
  const previewChanges = (preview?.changes || []).slice(0, 200);
  const hasExportable = !!(packagePath.trim() || preview || result || error);

  const aiJson = JSON.stringify(
    {
      packagePath: packagePath.trim() || null,
      packageName,
      preview: preview
        ? {
            success: preview.success,
            totalFiles: preview.totalFiles,
            totalChanges: preview.totalChanges,
            changes: previewChanges,
          }
        : null,
      result: result
        ? {
            success: result.success,
            filesModified: result.filesModified,
            backupPath: result.backupPath ?? null,
          }
        : null,
      error: error ?? null,
    },
    null,
    2
  );

  const aiMarkdown = [
    '# Sui Move 2024 migration',
    '',
    `- **Package path:** ${packagePath.trim() || 'not set'}`,
    packageName ? `- **Package name:** ${packageName}` : null,
    preview
      ? `- **Preview:** ${preview.totalChanges} changes across ${preview.totalFiles} files`
      : null,
    result?.success ? `- **Migrated:** ${result.filesModified} files modified` : null,
    result?.backupPath ? `- **Backup:** ${result.backupPath}` : null,
    error ? `- **Error:** ${error}` : null,
    previewChanges.length > 0 ? '' : null,
    previewChanges.length > 0 ? '## Proposed changes' : null,
    previewChanges.length > 0 ? '| File | Type | Before | After |' : null,
    previewChanges.length > 0 ? '|---|---|---|---|' : null,
    ...previewChanges.map(
      (c) => `| ${c.file}:${c.line} | ${c.type} | \`${c.before}\` | \`${c.after}\` |`
    ),
  ]
    .filter((line) => line !== null)
    .join('\n');

  const aiPrompt = `Here's my Sui Move 2024 migration state:\n\n${aiMarkdown}\n\nExplain what these edition changes do, whether they're safe to apply, and anything I should double-check before migrating.`;

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'syntax':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'deprecation':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'feature':
        return 'text-green-400 bg-green-500/10 border-green-500/30';
      default:
        return 'text-muted-foreground bg-secondary border-border';
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <RefreshCw className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Move 2024 Migration</h1>
            <p className="text-xs text-muted-foreground">
              Upgrade your Move packages to the latest edition
            </p>
          </div>
        </div>
        {hasExportable && (
          <CopyForAiMenu
            prompt={aiPrompt}
            json={aiJson}
            markdown={aiMarkdown}
            onCopy={copyToClipboard}
          />
        )}
      </motion.div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg"
      >
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-300/80 space-y-1">
          <p>
            Move 2024 introduces new features like method syntax, positional fields, and loop
            labels.
          </p>
          <p>This tool helps migrate your existing code to the new edition.</p>
        </div>
      </motion.div>

      {/* Input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card backdrop-blur-md border border-border rounded-lg p-4 space-y-4"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Package Path
          </label>
          <input
            type="text"
            placeholder="/path/to/your/move/package"
            value={packagePath}
            onChange={(e) => setPackagePath(e.target.value)}
            className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-foreground text-sm font-mono placeholder:text-tertiary focus:outline-none focus:border-orange-500/50"
          />
          <p className="text-xs text-muted-foreground">
            Enter the path to your Move package directory
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={isPreviewing || !packagePath}
            className="flex-1"
          >
            {isPreviewing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileCode className="w-4 h-4" />
            )}
            {isPreviewing ? 'Analyzing...' : 'Preview Changes'}
          </Button>

          <Button
            onClick={handleMigrate}
            disabled={isLoading || !packagePath}
            className="flex-1 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-400"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isLoading ? 'Migrating...' : 'Migrate'}
          </Button>
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
            >
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Preview Results */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-card backdrop-blur-md border border-border rounded-lg p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Preview</h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">{preview.totalFiles} files</span>
                <span className="text-orange-400">{preview.totalChanges} changes</span>
              </div>
            </div>

            {preview.changes.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {preview.changes.map((change, index) => (
                  <div
                    key={index}
                    className="p-3 bg-secondary border border-border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono">
                        {change.file}:{change.line}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full border ${getChangeTypeColor(change.type)}`}
                      >
                        {change.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-red-400/80 line-through">{change.before}</span>
                      <ArrowRight className="w-3 h-3 text-tertiary" />
                      <span className="text-green-400">{change.after}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>No changes needed - package is already compatible!</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Migration Result */}
      <AnimatePresence>
        {result?.success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-card backdrop-blur-md border border-green-500/20 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Migration Complete!</span>
            </div>

            <div className="text-xs font-mono text-muted-foreground space-y-1">
              <p>{result.filesModified} files modified</p>
              {result.backupPath && (
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5" />
                  <span>Backup saved to: {result.backupPath}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help */}
      <div className="text-xs text-muted-foreground space-y-1 p-3 bg-secondary rounded-lg">
        <p>
          <span className="text-orange-400">Move 2024 features:</span>
        </p>
        <p>
          • Method syntax: <span className="text-green-400 font-mono">obj.method()</span> instead of{' '}
          <span className="text-muted-foreground font-mono">module::method(&obj)</span>
        </p>
        <p>• Positional fields in structs</p>
        <p>• Loop labels for break/continue</p>
        <p>• New standard library functions</p>
      </div>
    </div>
  );
}

export default MoveMigrate;
