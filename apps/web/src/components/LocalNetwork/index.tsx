/**
 * LocalNetwork - Manage local Sui network (sui start)
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Square,
  RefreshCw,
  Server,
  Activity,
  AlertCircle,
  Terminal,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface NetworkStatus {
  running: boolean;
  processId?: string;
  rpcUrl?: string;
  faucetUrl?: string;
  uptime?: number;
}

export function LocalNetwork() {
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);

  // Options
  const [withFaucet, setWithFaucet] = useState(true);
  const [forceRegenesis, setForceRegenesis] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await apiClient.get('/network/status');
      if (response.success) {
        setStatus(response as NetworkStatus);
      }
    } catch (err) {
      // Network might not be running
      setStatus({ running: false });
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const startNetwork = async () => {
    setIsStarting(true);
    setError(null);
    setOutput([]);

    try {
      const response = await apiClient.post('/network/start', {
        withFaucet,
        forceRegenesis,
      });

      if (response.success) {
        setOutput(prev => [...prev, 'Network starting...']);
        await fetchStatus();
      } else {
        setError(response.error || 'Failed to start network');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start network');
    } finally {
      setIsStarting(false);
    }
  };

  const stopNetwork = async () => {
    setIsStopping(true);
    setError(null);

    try {
      const response = await apiClient.post('/network/stop', {});

      if (response.success) {
        setOutput(prev => [...prev, 'Network stopped']);
        setStatus({ running: false });
      } else {
        setError(response.error || 'Failed to stop network');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop network');
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Server className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Local Network</h1>
            <p className="text-xs text-muted-foreground">Local development network</p>
          </div>
        </div>

        {/* Status Badge */}
        <Badge
          variant={status?.running ? 'default' : 'secondary'}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
            status?.running
              ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
              : 'bg-secondary text-muted-foreground border border-border'
          }`}
        >
          {status?.running ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              Running
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              Stopped
            </>
          )}
        </Badge>
      </motion.div>

      {/* Control Panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-lg p-4 space-y-4"
      >
        {/* Options */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Options</h3>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={withFaucet}
              onChange={(e) => setWithFaucet(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-secondary text-blue-500 focus:ring-blue-500/50"
            />
            <div>
              <span className="text-sm text-foreground">Enable Faucet</span>
              <p className="text-xs text-muted-foreground">Run local faucet for test tokens</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={forceRegenesis}
              onChange={(e) => setForceRegenesis(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-secondary text-blue-500 focus:ring-blue-500/50"
            />
            <div>
              <span className="text-sm text-foreground">Force Regenesis</span>
              <p className="text-xs text-muted-foreground">Start fresh (clears all data)</p>
            </div>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!status?.running ? (
            <Button
              onClick={startNetwork}
              disabled={isStarting}
              className="flex-1"
            >
              {isStarting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isStarting ? 'Starting...' : 'Start Network'}
            </Button>
          ) : (
            <Button
              onClick={stopNetwork}
              disabled={isStopping}
              variant="destructive"
              className="flex-1"
            >
              {isStopping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {isStopping ? 'Stopping...' : 'Stop Network'}
            </Button>
          )}

          <Button
            onClick={fetchStatus}
            disabled={isLoading}
            variant="outline"
            size="icon"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg"
            >
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Status Info */}
      {status?.running && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-emerald-500/20 rounded-lg p-4 space-y-3"
        >
          <div className="flex items-center gap-2 text-emerald-500">
            <Activity className="w-4 h-4" />
            <span className="text-sm font-medium">Network Active</span>
          </div>

          <div className="grid gap-2 text-xs">
            {status.rpcUrl && (
              <div className="flex items-center justify-between p-2 bg-secondary rounded-md">
                <span className="text-muted-foreground">RPC URL:</span>
                <span className="text-foreground font-mono">{status.rpcUrl}</span>
              </div>
            )}
            {status.faucetUrl && (
              <div className="flex items-center justify-between p-2 bg-secondary rounded-md">
                <span className="text-muted-foreground">Faucet URL:</span>
                <span className="text-foreground font-mono">{status.faucetUrl}</span>
              </div>
            )}
            {status.processId && (
              <div className="flex items-center justify-between p-2 bg-secondary rounded-md">
                <span className="text-muted-foreground">Process ID:</span>
                <span className="text-foreground font-mono">{status.processId}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Output Console */}
      {output.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-secondary border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Terminal className="w-4 h-4" />
            <span className="text-xs">Output</span>
          </div>
          <div className="font-mono text-xs text-foreground space-y-1 max-h-40 overflow-y-auto">
            {output.map((line, i) => (
              <div key={i} className="text-emerald-500/90">{line}</div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Help */}
      <div className="text-xs text-muted-foreground space-y-1 p-3 bg-secondary/60 rounded-lg">
        <p><span className="text-blue-400">Note:</span> Local network requires Sui CLI installed</p>
        <p>Use <span className="text-amber-400">Force Regenesis</span> to start fresh (new addresses)</p>
        <p>Faucet provides unlimited test tokens on local network</p>
      </div>
    </div>
  );
}

export default LocalNetwork;
