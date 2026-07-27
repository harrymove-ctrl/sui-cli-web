/**
 * PackageExplorer - Inspect a published Move package's on-chain interface.
 *
 * Given a package ID, fetches the normalized modules over gRPC and renders each
 * module's exposed functions (visibility, entry, type params, params, returns)
 * and datatypes (structs/enums with abilities and fields) - the same shape a
 * developer needs before building a PTB against an unfamiliar contract.
 *
 * The module/function/type rendering lives in the shared PackageModulesView so
 * the same breakdown can be embedded in an object's Package tab; this file owns
 * the page chrome (search box, empty state, Copy-for-AI export).
 */

import { ArrowLeft, Copy, ExternalLink, Package, Play, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  explorePackage,
  getPublishedPackages,
  type PackageModules,
  type PublishedPackageInfo,
} from '@/api/services/packages';
import { Button } from '@/components/ui/button';
import { CopyForAiMenu } from '@/components/ui/copy-for-ai';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { buildAiContext } from '@/lib/ai-context';
import { detectNetwork } from '@/lib/explorer';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { Spinner } from '../shared/Spinner';
import { PackageModulesPanel } from './PackageModulesPanel';
import { formatSignature, PackageModulesView } from './PackageModulesView';

/** Map a `0x2::package` upgrade-policy byte to the name the CLI uses for it. */
function upgradePolicyLabel(policy: number): string {
  switch (policy) {
    case 0:
      return 'Compatible';
    case 128:
      return 'Additive';
    case 192:
      return 'Dependency-only';
    default:
      return `Policy ${policy}`;
  }
}

function shortId(id: string, chars = 6): string {
  if (!id || id.length <= chars * 2 + 3) return id;
  return `${id.slice(0, chars)}…${id.slice(-chars)}`;
}

/**
 * @param embedded - when rendered inside another page (the Objects "Packages"
 * tab) the standalone page title is dropped and outer page padding collapses,
 * so it slots cleanly under the host page's own header. The Copy-for-AI export
 * is kept (it describes the loaded package, which the host header can't).
 */
export function PackageExplorer({ embedded = false }: { embedded?: boolean } = {}) {
  const [searchParams] = useSearchParams();
  const [packageId, setPackageId] = useState('');
  const [pkg, setPkg] = useState<PackageModules | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoQueried, setAutoQueried] = useState(false);

  // The external explorer link has to point at the network the package was read
  // from - the explore route resolves modules over the *active* env's RPC, so a
  // hardcoded network would mislabel every non-testnet package. Local RPCs get
  // no link at all: no public explorer has a localnet/devstack package to show.
  const navigate = useNavigate();
  const { environments, addresses } = useAppStore();
  const activeEnv = environments.find((e) => e.isActive);
  const activeAddress = addresses.find((a) => a.isActive);
  const network = detectNetwork(activeEnv?.alias, activeEnv?.rpc);
  const rpc = activeEnv?.rpc ?? '';
  const isLocalNetwork =
    network === 'localnet' || rpc.includes('127.0.0.1') || rpc.includes('localhost');

  // "My packages" - the packages this address published, derived server-side from
  // its UpgradeCap objects. This is the default landing view: a wall of UpgradeCaps
  // in "My Objects" doesn't tell you which *packages* you own, and this does.
  const [myPackages, setMyPackages] = useState<PublishedPackageInfo[] | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);

  const loadMyPackages = async () => {
    setLoadingPackages(true);
    setPackagesError(null);
    try {
      const result = await getPublishedPackages(activeAddress?.address);
      // Newest version first - a rough proxy for "most recently worked on".
      const sorted = [...result.packages].sort((a, b) => Number(b.version) - Number(a.version));
      setMyPackages(sorted);
    } catch (err) {
      setPackagesError(err instanceof Error ? err.message : 'Failed to load your packages');
    } finally {
      setLoadingPackages(false);
    }
  };

  // Load the list once on mount, but only when not deep-linked to a specific
  // package (that path renders the interface, not the list).
  useEffect(() => {
    if (!searchParams.get('packageId') && myPackages === null && !loadingPackages) {
      loadMyPackages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress?.address]);

  const query = async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) {
      toast.error('Please enter a package ID');
      return;
    }
    setIsLoading(true);
    setError(null);
    setPkg(null);
    try {
      const result = await explorePackage(trimmed);
      setPkg(result);
      const fnCount = result.modules.reduce((n, m) => n + m.functions.length, 0);
      toast.success(
        `${result.modules.length} module${result.modules.length !== 1 ? 's' : ''}, ${fnCount} function${fnCount !== 1 ? 's' : ''}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load package');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fill and query from URL param (e.g. deep-linked from an object detail).
  useEffect(() => {
    const urlId = searchParams.get('packageId');
    if (urlId && !autoQueried) {
      setPackageId(urlId);
      setAutoQueried(true);
      query(urlId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, autoQueried]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const stats = useMemo(() => {
    if (!pkg) return { modules: 0, functions: 0, datatypes: 0 };
    return {
      modules: pkg.modules.length,
      functions: pkg.modules.reduce((n, m) => n + m.functions.length, 0),
      datatypes: pkg.modules.reduce((n, m) => n + m.datatypes.length, 0),
    };
  }, [pkg]);

  // Copy-for-AI export of the explored package's on-chain interface.
  const aiExport = useMemo(() => {
    if (!pkg) return null;
    const interfaceListing = [
      '## Interface',
      ...pkg.modules.map((m) => {
        const fns = m.functions.map((fn) => `    ${formatSignature(fn)}`).join('\n');
        return `- ${m.name} (${m.functions.length} fn, ${m.datatypes.length} type${m.datatypes.length !== 1 ? 's' : ''})${fns ? `\n${fns}` : ''}`;
      }),
    ].join('\n');
    const json = JSON.stringify(
      {
        storageId: pkg.storageId,
        originalId: pkg.originalId,
        version: pkg.version,
        network,
        modules: pkg.modules.map((m) => ({
          name: m.name,
          functions: m.functions.map((fn) => ({
            name: fn.name,
            visibility: fn.visibility,
            isEntry: fn.isEntry,
            typeParameters: fn.typeParameters,
            parameters: fn.parameters,
            returns: fn.returns,
          })),
          datatypes: m.datatypes.map((d) => ({
            kind: d.kind,
            name: d.name,
            abilities: d.abilities,
            typeParameters: d.typeParameters,
            fields: d.fields,
          })),
        })),
      },
      null,
      2
    );
    const markdown = [
      `# Package \`${pkg.storageId}\` (v${pkg.version}, ${network})`,
      '',
      ...pkg.modules.flatMap((m) => [
        `## ${m.name}`,
        '',
        ...(m.functions.length
          ? [
              '**Functions**',
              '',
              ...m.functions.map(
                (fn) =>
                  `- \`${formatSignature(fn)}\` (${fn.visibility}${fn.isEntry ? ', entry' : ''})`
              ),
              '',
            ]
          : []),
        ...(m.datatypes.length
          ? ['**Types**', '', ...m.datatypes.map((d) => `- ${d.kind} \`${d.name}\``), '']
          : []),
      ]),
    ].join('\n');
    const prompt = buildAiContext({
      title: `Sui Move package ${pkg.storageId}`,
      intro: [
        `Published package on ${network}, version ${pkg.version}:`,
        `${stats.modules} module${stats.modules !== 1 ? 's' : ''}, ${stats.functions} function${stats.functions !== 1 ? 's' : ''}, ${stats.datatypes} type${stats.datatypes !== 1 ? 's' : ''}.`,
      ],
      stateJson: json,
      extra: interfaceListing,
      endpoints: [
        {
          method: 'GET',
          path: '/packages/:id/explore',
          effect: 'normalized modules, functions and datatypes',
        },
        { method: 'GET', path: '/packages/:id', effect: 'raw package object' },
        {
          method: 'GET',
          path: '/packages/published',
          effect: "packages published by an address (derived from its UpgradeCaps)",
        },
        {
          method: 'POST',
          path: '/packages/:id/call',
          body: '{ module, function, args, typeArgs, gasBudget? }',
          effect: 'signs and submits a Move call',
          mutating: true,
        },
      ],
      rules: [
        'Only `entry` functions can be called directly in a transaction; `public` non-entry ones need a PTB',
        'The CLI supplies `&mut TxContext` itself - never pass it as an argument',
        'Type arguments take full paths, e.g. `0x2::sui::SUI`',
        'Object arguments are passed by object ID; the caller must own or have access to them',
        '`storageId` is the current on-chain address; `originalId` is the first-published address and is what type strings embed',
      ],
      examples: [
        'explain what this package does',
        'build a call to <function>',
        'write the sui client call command',
      ],
    });

    return { prompt, json, markdown };
  }, [pkg, stats, network]);

  // Columns for the "Your packages" table - the same DataTable the Objects tabs
  // use, so packages list consistently (with an expandable interface panel per row).
  const packageTableColumns = useMemo<DataTableColumn<PublishedPackageInfo>[]>(
    () => [
      {
        id: 'packageId',
        header: 'Package ID',
        accessor: (p) => p.packageId,
        sortable: true,
        // The ID truncates anyway, and `grow` hands it whatever slack the fixed
        // columns leave - so the base size only has to cover the narrow case.
        size: 280,
        grow: true,
        cell: (p) => (
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-3.5 h-3.5 text-[#4da2ff] flex-shrink-0" />
            <span className="font-mono text-sm text-foreground truncate">{p.packageId}</span>
          </div>
        ),
      },
      {
        id: 'version',
        header: 'Version',
        accessor: (p) => Number(p.version),
        sortable: true,
        size: 90,
        align: 'right',
        cell: (p) => (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-tertiary font-mono">
            v{p.version}
          </span>
        ),
      },
      {
        id: 'policy',
        header: 'Compatibility',
        accessor: (p) => p.policy,
        sortable: true,
        size: 130,
        cell: (p) => (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
            {upgradePolicyLabel(p.policy)}
          </span>
        ),
      },
      {
        id: 'upgradeCap',
        header: 'UpgradeCap',
        accessor: (p) => p.upgradeCapId,
        sortable: false,
        size: 210,
        cell: (p) => (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <span className="font-mono truncate">{shortId(p.upgradeCapId)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copy(p.upgradeCapId, 'UpgradeCap ID');
              }}
              className="hover:text-foreground flex-shrink-0"
              title="Copy UpgradeCap ID"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/app/objects/${p.upgradeCapId}`);
              }}
              className="hover:text-foreground inline-flex items-center gap-0.5 flex-shrink-0"
              title="Inspect the UpgradeCap object"
            >
              Inspect <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        accessor: () => null,
        sortable: false,
        size: 160,
        minSize: 160,
        cell: (p) => (
          <div className="flex items-center justify-end gap-2">
            {/* Move Studio switches to its Interact tab on its own when it sees a
                `packageId` param, so this lands straight on the call form. */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/app/move?packageId=${p.packageId}&tab=interact`);
              }}
              title="Call this package's functions in Move Studio"
              className="text-xs text-[#4da2ff] hover:underline inline-flex items-center gap-1 flex-shrink-0"
            >
              <Play className="w-3 h-3" /> Call
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copy(p.packageId, 'Package ID');
              }}
              title="Copy the package ID"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 flex-shrink-0"
            >
              <Copy className="w-3 h-3" /> Copy ID
            </button>
          </div>
        ),
      },
    ],
    // copy/navigate are stable enough for a small table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    // Full width either way: the packages table carries ~900px of columns, and a
    // 3xl column clipped the trailing ones.
    <div className={cn('space-y-6', embedded ? 'px-0' : 'px-2 py-2')}>
      {/* Header - the standalone page title is redundant when embedded under the
          Objects "Packages" tab, but the package's own Copy-for-AI stays useful. */}
      {(!embedded || aiExport) && (
        <div className="flex items-center justify-between gap-2 px-1">
          {embedded ? (
            <span />
          ) : (
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold text-foreground">Package Explorer</h1>
            </div>
          )}
          {aiExport && (
            <CopyForAiMenu
              prompt={aiExport.prompt}
              json={aiExport.json}
              markdown={aiExport.markdown}
              onCopy={copy}
            />
          )}
        </div>
      )}

      {/* Search Input */}
      <div className="px-1">
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">Package ID</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && query(packageId)}
                placeholder="0x2 or a full package address..."
                className="w-full pl-10 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm font-mono text-foreground placeholder:text-tertiary focus:outline-none focus:border-[#4da2ff]/50 transition-colors"
                disabled={isLoading}
              />
            </div>
            <Button onClick={() => query(packageId)} disabled={isLoading || !packageId.trim()}>
              {isLoading ? 'Loading...' : 'Explore'}
            </Button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-1">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && !pkg && (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      )}

      {/* Results */}
      {pkg && !isLoading && (
        <div className="px-1 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => {
                setPkg(null);
                setError(null);
                setPackageId('');
                if (myPackages === null) loadMyPackages();
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> My packages
            </button>
            <button
              onClick={() => navigate(`/app/move?packageId=${pkg.storageId}&tab=interact`)}
              title="Call this package's functions in Move Studio"
              className="inline-flex flex-shrink-0 items-center gap-1 text-xs text-[#4da2ff] hover:underline"
            >
              <Play className="w-3.5 h-3.5" /> Call in Move Studio
            </button>
          </div>
          <PackageModulesView
            key={pkg.storageId}
            pkg={pkg}
            network={network}
            isLocalNetwork={isLocalNetwork}
            onCopy={copy}
          />
        </div>
      )}

      {/* My Packages (default view) */}
      {!pkg && !isLoading && !error && (
        <div className="px-1 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">Your packages</div>
              <div className="text-xs text-muted-foreground truncate">
                {activeAddress
                  ? `Published from ${activeAddress.alias || shortId(activeAddress.address)} · derived from your UpgradeCaps`
                  : 'Connect an address to see the packages you published'}
              </div>
            </div>
            <button
              onClick={loadMyPackages}
              disabled={loadingPackages}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors flex-shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPackages ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingPackages ? (
            <div className="flex items-center justify-center py-10">
              <Spinner />
            </div>
          ) : packagesError ? (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {packagesError}
            </div>
          ) : myPackages && myPackages.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <DataTable
                columns={packageTableColumns}
                data={myPackages ?? []}
                getRowId={(p) => p.upgradeCapId}
                initialSort={{ columnId: 'version', desc: true }}
                // Expand a row to see that package's on-chain interface inline -
                // the package equivalent of the objects table's attribute panel.
                renderExpanded={(p) => <PackageModulesPanel packageId={p.packageId} />}
                expandedRowHeight={360}
                rowHeight={52}
                className="h-[min(60vh,560px)] min-h-[220px]"
              />
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-border bg-card text-center">
              <div className="text-3xl mb-2">📦</div>
              <div className="text-foreground font-medium mb-1">
                No packages published from this address
              </div>
              <div className="text-xs text-muted-foreground">
                Deploy one in Move Studio, or explore any package by ID above.
              </div>
            </div>
          )}

          <div className="pt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Or explore a system package:</span>
            {['0x2', '0x3'].map((id) => (
              <button
                key={id}
                onClick={() => {
                  setPackageId(id);
                  query(id);
                }}
                className="font-mono text-[#4da2ff] hover:underline"
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PackageExplorer;
