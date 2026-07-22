/**
 * Package path selector with validation and recent projects
 */

import { Folder, Check, Clock, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useMoveDevStore, selectCurrentPackage, selectRecentProjects } from '../../hooks/state/useMoveDevState';

export function PackageSelector() {
  const currentPackage = useMoveDevStore(selectCurrentPackage);
  const recentProjects = useMoveDevStore(selectRecentProjects);
  const setPackage = useMoveDevStore((state) => state.setPackage);
  const clearPackage = useMoveDevStore((state) => state.clearPackage);

  const [inputPath, setInputPath] = useState(currentPackage?.path || '');
  const [showRecent, setShowRecent] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (currentPackage?.path) {
      setInputPath(currentPackage.path);
    }
  }, [currentPackage?.path]);

  const handleSelectPath = async (path: string) => {
    setValidating(true);
    setValidationError(null);

    try {
      // Basic validation
      if (!path.trim()) {
        throw new Error('Package path cannot be empty');
      }

      // TODO: Add backend validation endpoint to check if path exists and has Move.toml
      await setPackage(path);
      setShowRecent(false);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Invalid package path');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSelectPath(inputPath);
  };

  const handleClear = () => {
    clearPackage();
    setInputPath('');
    setValidationError(null);
  };

  return (
    <div className="space-y-4">
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Package Path
          </label>
          <div className="relative">
            <Folder className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              onFocus={() => setShowRecent(true)}
              placeholder="/path/to/your/move/package"
              className="w-full pl-10 pr-20 py-2.5 bg-card border border-border rounded-lg text-foreground placeholder-tertiary focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {currentPackage && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {validationError && (
            <p className="mt-1.5 text-xs text-red-400">{validationError}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button type="submit" disabled={validating || !inputPath.trim()} className="flex-1">
            {validating ? (
              <>
                <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Select Package
              </>
            )}
          </Button>

          {recentProjects.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowRecent(!showRecent)}
              title="Recent projects"
            >
              <Clock className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Recent Projects Dropdown */}
      {showRecent && recentProjects.length > 0 && (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground">Recent Projects</p>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {recentProjects.map((project) => (
              <button
                key={project.path}
                onClick={() => handleSelectPath(project.path)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {project.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {project.path}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="inline-block px-2 py-0.5 text-xs bg-accent rounded-full">
                    {project.network}
                  </span>
                  <p className="text-xs text-tertiary mt-1">
                    {formatTimestamp(project.lastAccessed)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current Package Info */}
      {currentPackage && !validationError && (
        <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <Check className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-400">Package Selected</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
              {currentPackage.path}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format timestamp
function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
