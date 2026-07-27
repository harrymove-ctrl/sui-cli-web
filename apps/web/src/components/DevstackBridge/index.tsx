import { Boxes, CircleAlert, CircleCheck, Link2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import type { DevstackCapabilities, DevstackDeployment } from '@sui-cli-web/shared';
import {
  attachDevstack,
  getDevstackCapabilities,
  getDevstackDeployment,
} from '@/api/services/devstack';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Attach Sui CLI Web to a devstack project the developer already runs.
 *
 * Deliberately inspection-only: there is no boot button. `devstack up` starts
 * Docker containers and this server has no authentication, so booting is left
 * to the terminal where the developer can see it. What the UI adds is the part
 * that is tedious by hand - reading the stack's RPC out of deployment.json and
 * switching the whole app onto it, along with the funded accounts and package
 * ids the stack published.
 */
export function DevstackBridge() {
  const [dir, setDir] = useState('');
  const [capabilities, setCapabilities] = useState<DevstackCapabilities | null>(null);
  const [deployment, setDeployment] = useState<DevstackDeployment | null>(null);
  const [checked, setChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const inspect = useCallback(async () => {
    const target = dir.trim();
    if (!target) {
      toast.error('Enter the project directory that holds devstack.config.ts');
      return;
    }

    setIsLoading(true);
    setChecked(false);
    try {
      const caps = await getDevstackCapabilities(target);
      setCapabilities(caps);

      // Only worth reading a deployment when devstack is there to describe it -
      // otherwise `devstack config` fails and reads as a second error for the
      // same cause.
      if (caps.installed) {
        try {
          setDeployment(await getDevstackDeployment(target));
        } catch {
          // A config that does not resolve is a project problem, not a bridge
          // failure; the capabilities panel above already explains the state.
          setDeployment(null);
        }
      } else {
        setDeployment(null);
      }
      setChecked(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not inspect that directory');
    } finally {
      setIsLoading(false);
    }
  }, [dir]);

  const attach = useCallback(
    async (network: string) => {
      setIsLoading(true);
      try {
        const result = await attachDevstack(dir.trim(), network);
        toast.success(`${result.reused ? 'Switched to' : 'Added'} env "${result.alias}"`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not attach to that stack');
      } finally {
        setIsLoading(false);
      }
    },
    [dir]
  );

  return (
    <div className="px-2 py-2 space-y-4">
      <div className="px-4 py-3 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-2 mb-1">
          <Boxes className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Devstack project</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Point at a directory containing <span className="font-mono">devstack.config.ts</span>. The
          stack is read, never started - run <span className="font-mono">devstack up</span> in your
          terminal.
        </p>
        <div className="flex gap-2">
          <Input
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            placeholder="~/projects/my-dapp"
            className="font-mono text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') inspect();
            }}
          />
          <Button onClick={inspect} disabled={isLoading}>
            Inspect
          </Button>
        </div>
      </div>

      {checked && capabilities && (
        <div className="px-4 py-3 bg-card border border-border rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            {capabilities.ready ? (
              <CircleCheck className="w-4 h-4 text-muted-foreground" />
            ) : (
              <CircleAlert className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-sm text-foreground">
              {capabilities.installed
                ? `devstack ${capabilities.version ?? ''} (${capabilities.source})`
                : 'devstack not found'}
            </span>
          </div>

          {capabilities.blockers.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-1">
              {capabilities.blockers.map((blocker) => (
                <li key={blocker} className="flex items-start gap-2">
                  <span className="mt-[0.45em] shrink-0 w-2 h-px bg-current" aria-hidden="true" />
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          )}

          {capabilities.reports.length > 0 && (
            <div className="pt-1 grid gap-1">
              {capabilities.reports.map((report) => (
                <div key={report.name} className="flex items-baseline gap-2 text-xs">
                  <span className="font-mono text-tertiary w-28 shrink-0">{report.name}</span>
                  <span className="text-foreground">{report.status}</span>
                  <span className="text-muted-foreground truncate">{report.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {checked && capabilities?.installed && !deployment && (
        <div className="px-4 py-3 text-xs text-muted-foreground border border-border rounded-xl">
          This project has a devstack config but no booted stack. Run{' '}
          <span className="font-mono text-foreground">devstack up</span> and inspect again.
        </div>
      )}

      {deployment && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-sm text-foreground">
              {deployment.app} <span className="text-muted-foreground">/ {deployment.stack}</span>
            </div>
          </div>

          {Object.entries(deployment.networks).map(([name, network]) => (
            <div key={name} className="px-4 py-3 border-b border-border last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-foreground">
                    {name}
                    {name === deployment.defaultNetwork && (
                      <span className="text-xs text-muted-foreground"> · default</span>
                    )}
                  </div>
                  <div className="text-xs font-mono text-tertiary truncate">{network.rpc}</div>
                </div>
                <Button variant="secondary" disabled={isLoading} onClick={() => attach(name)}>
                  <Link2 className="w-3 h-3" />
                  Use this network
                </Button>
              </div>

              {Object.keys(network.packages).length > 0 && (
                <div className="mt-2 grid gap-1">
                  {Object.entries(network.packages).map(([pkg, id]) => (
                    <div key={pkg} className="flex items-baseline gap-2 text-xs">
                      <span className="text-muted-foreground w-24 shrink-0">{pkg}</span>
                      <span className="font-mono text-tertiary truncate">{id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {Object.keys(deployment.accounts).length > 0 && (
            <div className="px-4 py-3 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2">Funded accounts</div>
              <div className="grid gap-1">
                {Object.entries(deployment.accounts).map(([name, address]) => (
                  <div key={name} className="flex items-baseline gap-2 text-xs">
                    <span className="text-foreground w-24 shrink-0">{name}</span>
                    <span className="font-mono text-tertiary truncate">{address}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DevstackBridge;
