import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { explorePackage, type PackageModules } from '@/api/services/packages';
import { Loader } from '@/components/ui/loader';
import { detectNetwork } from '@/lib/explorer';
import { useAppStore } from '@/stores/useAppStore';
import { PackageModulesView } from './PackageModulesView';

/**
 * Lazily loads and renders a package's on-chain interface (modules/functions/
 * types) - the package equivalent of the object attribute panel, so a package
 * row in the table can expand inline instead of a bespoke card layout.
 */
export function PackageModulesPanel({ packageId }: { packageId: string }) {
  const { environments } = useAppStore();
  const activeEnv = environments.find((e) => e.isActive);
  const network = detectNetwork(activeEnv?.alias, activeEnv?.rpc);
  const rpc = activeEnv?.rpc ?? '';
  const isLocalNetwork =
    network === 'localnet' || rpc.includes('127.0.0.1') || rpc.includes('localhost');

  const [pkg, setPkg] = useState<PackageModules | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setPkg(null);
    explorePackage(packageId)
      .then((res) => {
        if (alive) setPkg(res);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load package');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [packageId]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader variant="dither" size={28} label="Loading package interface" className="text-primary" />
      </div>
    );
  }
  if (error || !pkg) {
    return (
      <div className="px-4 py-8 text-center text-sm text-tertiary">
        {error || 'Could not load this package interface.'}
      </div>
    );
  }

  return (
    <div className="px-2 py-2">
      <PackageModulesView pkg={pkg} network={network} isLocalNetwork={isLocalNetwork} onCopy={copy} />
    </div>
  );
}
