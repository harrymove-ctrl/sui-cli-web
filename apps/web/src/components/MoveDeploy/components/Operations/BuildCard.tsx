/**
 * Build operations card component
 */

import { Hammer, Play, Settings } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBuildPackage } from '../../hooks/api/useBuildPackage';
import { OperationCard } from './OperationCard';
import { ErrorDisplay } from '../Feedback/ErrorDisplay';
import { OutputDisplay } from '../Results/OutputDisplay';
import { LoadingState } from '../Feedback/LoadingState';

export function BuildCard() {
  const { build, loading, success, error, data, canBuild } = useBuildPackage();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState({
    skipFetchLatest: false,
    withUnpublished: false,
  });

  const handleBuild = async () => {
    try {
      await build(options);
    } catch (err) {
      // Error handled by state
    }
  };

  const getStatus = () => {
    if (loading) return 'loading';
    if (error) return 'error';
    if (success) return 'success';
    return 'idle';
  };

  return (
    <OperationCard
      title="Build Package"
      description="Compile your Move package and verify bytecode"
      icon={<Hammer className="h-5 w-5" />}
      status={getStatus()}
      defaultExpanded
    >
      {/* Advanced Options */}
      <div className="space-y-3">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          {showAdvanced ? 'Hide' : 'Show'} Advanced Options
        </button>

        {showAdvanced && (
          <div className="space-y-2 pl-6 border-l border-border">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={options.skipFetchLatest}
                onChange={(e) =>
                  setOptions({ ...options, skipFetchLatest: e.target.checked })
                }
                className="rounded border-border bg-secondary text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                disabled={loading}
              />
              Skip fetching latest dependencies
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={options.withUnpublished}
                onChange={(e) =>
                  setOptions({ ...options, withUnpublished: e.target.checked })
                }
                className="rounded border-border bg-secondary text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                disabled={loading}
              />
              Include unpublished dependencies
            </label>
          </div>
        )}
      </div>

      {/* Build Button */}
      <Button onClick={handleBuild} disabled={!canBuild} className="w-full">
        <Play className="h-4 w-4" />
        {loading ? 'Building...' : 'Build Package'}
      </Button>

      {/* Loading State */}
      {loading && (
        <LoadingState
          message="Compiling Move modules..."
          submessage="This may take a few moments"
        />
      )}

      {/* Error Display */}
      {error && (
        <ErrorDisplay error={error} onRetry={handleBuild} className="mt-4" />
      )}

      {/* Success Output */}
      {data && success && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div>
              <p className="text-sm font-medium text-green-400">Build Successful</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.modules?.length || 0} module(s) compiled in {data.duration}ms
              </p>
            </div>
          </div>

          {/* Modules List */}
          {data.modules && data.modules.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Compiled Modules:</p>
              <div className="space-y-1">
                {data.modules.map((module, index) => (
                  <div
                    key={index}
                    className="text-sm text-muted-foreground font-mono bg-secondary rounded-lg px-3 py-2"
                  >
                    {module}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Output */}
          <OutputDisplay
            output={data.output}
            type="success"
            maxHeight={300}
            copyable
          />
        </div>
      )}
    </OperationCard>
  );
}
