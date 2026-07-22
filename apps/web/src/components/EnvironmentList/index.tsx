import { clsx } from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getChainIdentifier } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/useAppStore';
import { Spinner } from '../shared/Spinner';

export function EnvironmentList() {
  const {
    environments,
    isLoading,
    searchQuery,
    fetchEnvironments,
    switchEnvironment,
    addEnvironment,
    removeEnvironment,
  } = useAppStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [newRpc, setNewRpc] = useState('');
  const [chainId, setChainId] = useState<string | null>(null);
  const [chainNetwork, setChainNetwork] = useState<string | null>(null);
  const [loadingChainId, setLoadingChainId] = useState(false);

  // Fetch chain identifier when environments change (after switching)
  const fetchChainId = async () => {
    setLoadingChainId(true);
    try {
      const result = await getChainIdentifier();
      setChainId(result.chainId);
      setChainNetwork(result.network || null);
    } catch {
      setChainId(null);
      setChainNetwork(null);
    } finally {
      setLoadingChainId(false);
    }
  };

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  // Fetch chain ID when active environment changes
  useEffect(() => {
    const activeEnv = environments.find((e) => e.isActive);
    if (activeEnv) {
      fetchChainId();
    }
  }, [environments]);

  const filteredEnvs = environments.filter((env) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return env.alias.toLowerCase().includes(query) || env.rpc.toLowerCase().includes(query);
  });

  const handleSwitch = async (alias: string) => {
    try {
      await switchEnvironment(alias);
      toast.success(`Switched to ${alias}`);
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleAdd = async () => {
    if (!newAlias || !newRpc) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      await addEnvironment(newAlias, newRpc);
      toast.success(`Added environment: ${newAlias}`);
      setShowAddForm(false);
      setNewAlias('');
      setNewRpc('');
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleRemove = async (alias: string) => {
    if (!confirm(`Remove environment "${alias}"?`)) return;
    try {
      await removeEnvironment(alias);
      toast.success(`Removed environment: ${alias}`);
    } catch (error) {
      toast.error(String(error));
    }
  };

  const getNetworkIcon = (alias: string) => {
    const lower = alias.toLowerCase();
    if (lower.includes('mainnet')) return '🟢';
    if (lower.includes('testnet')) return '🟡';
    if (lower.includes('devnet')) return '🔵';
    if (lower.includes('local')) return '⚪';
    return '🌐';
  };

  if (isLoading && environments.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chain Identifier Display */}
      {chainId && (
        <div className="px-3 py-2 rounded-lg border border-border bg-secondary/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Chain ID</span>
              <code className="text-xs text-accent font-mono bg-accent/10 px-1.5 py-0.5 rounded">
                {chainId}
              </code>
              {chainNetwork && (
                <span
                  className={clsx(
                    'text-xs px-1.5 py-0.5 rounded-full',
                    chainNetwork === 'mainnet' && 'bg-green-500/20 text-green-400',
                    chainNetwork === 'testnet' && 'bg-yellow-500/20 text-yellow-400',
                    chainNetwork === 'devnet' && 'bg-blue-500/20 text-blue-400',
                    chainNetwork === 'custom' && 'bg-purple-500/20 text-purple-400'
                  )}
                >
                  {chainNetwork}
                </span>
              )}
            </div>
            {loadingChainId && <Spinner />}
          </div>
        </div>
      )}

      {/* Add new environment button/form */}
      {showAddForm ? (
        <div className="p-4 rounded-lg border border-border bg-secondary/50 space-y-4">
          <div className="text-sm font-medium text-foreground">New environment</div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Alias</label>
              <input
                type="text"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder="my-network"
                className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">RPC URL</label>
              <input
                type="text"
                value={newRpc}
                onChange={(e) => setNewRpc(e.target.value)}
                placeholder="https://fullnode.devnet.sui.io:443"
                className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground font-mono placeholder:text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleAdd}>
                Add
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowAddForm(true)} className="w-full border-dashed">
          <Plus className="w-4 h-4" />
          Add New Environment
        </Button>
      )}

      {/* Environment list */}
      {filteredEnvs.length === 0 ? (
        <div className="px-3 py-8 text-center text-muted-foreground">No environments found</div>
      ) : (
        <div className="space-y-1">
          {filteredEnvs.map((env) => (
            <div
              key={env.alias}
              className={clsx(
                'group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors',
                env.isActive ? 'bg-accent' : 'hover:bg-accent/50'
              )}
              onClick={() => !env.isActive && handleSwitch(env.alias)}
            >
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-lg">
                {getNetworkIcon(env.alias)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{env.alias}</span>
                  {env.isActive && (
                    <Badge variant="outline" className="border-[#4da2ff]/30 text-[#4da2ff] text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate font-mono">{env.rpc}</div>
              </div>
              {!env.isActive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(env.alias);
                  }}
                  className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
