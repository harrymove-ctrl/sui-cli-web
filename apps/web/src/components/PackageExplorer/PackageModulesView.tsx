/**
 * PackageModulesView - the shared rendering of a package's on-chain interface.
 *
 * Extracted from PackageExplorer so the same summary card + module/function/type
 * breakdown can be embedded elsewhere (e.g. the Package tab of an object's
 * detail view) without duplicating the layout. Owns its own filter/expand state,
 * so callers should mount it with `key={pkg.storageId}` to reset that state when
 * the package changes.
 */

import { useMemo, useState } from 'react';
import type { MoveDatatype, MoveFunction, PackageModules } from '@/api/services/packages';
import { buildExplorerUrl, getDefaultExplorer, type NetworkType } from '@/lib/explorer';
import { ArrowRight, Boxes, Braces, ChevronDown, Copy, ExternalLink, Filter } from 'lucide-react';

export function truncate(id: string, chars = 8): string {
  if (!id || id.length <= chars * 2 + 3) return id;
  return `${id.slice(0, chars)}...${id.slice(-chars)}`;
}

type VisibilityKind = 'entry' | 'public' | 'friend';

function visibilityStyle(fn: MoveFunction): { label: string; className: string } {
  if (fn.visibility === 'public')
    return { label: 'public', className: 'text-green-400 bg-green-500/10 border-green-500/20' };
  if (fn.visibility === 'public(friend)')
    return { label: 'friend', className: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  return { label: 'private', className: 'text-muted-foreground bg-secondary border-border' };
}

/** Render a function signature the way it reads in Move source. */
export function formatSignature(fn: MoveFunction): string {
  const generics = fn.typeParameters.length ? `<${fn.typeParameters.join(', ')}>` : '';
  const params = fn.parameters.join(', ');
  const returns = fn.returns.length
    ? `: ${fn.returns.length === 1 ? fn.returns[0] : `(${fn.returns.join(', ')})`}`
    : '';
  return `${fn.name}${generics}(${params})${returns}`;
}

function FunctionRow({ fn }: { fn: MoveFunction }) {
  const vis = visibilityStyle(fn);
  return (
    <div className="p-3 bg-secondary rounded-lg border border-border">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-sm font-mono font-medium text-foreground">{fn.name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${vis.className}`}>
          {vis.label}
        </span>
        {fn.isEntry && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#4da2ff]/30 bg-[#4da2ff]/10 text-[#4da2ff] font-medium">
            entry
          </span>
        )}
      </div>
      <code className="text-xs font-mono text-muted-foreground break-all leading-relaxed block">
        {formatSignature(fn)}
      </code>
    </div>
  );
}

function DatatypeRow({ dt }: { dt: MoveDatatype }) {
  const generics = dt.typeParameters.length ? `<${dt.typeParameters.join(', ')}>` : '';
  return (
    <div className="p-3 bg-secondary rounded-lg border border-border">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded border border-purple-500/20 bg-purple-500/10 text-purple-400 font-medium">
          {dt.kind}
        </span>
        <span className="text-sm font-mono font-medium text-foreground">
          {dt.name}
          {generics}
        </span>
        {dt.abilities.map((a) => (
          <span
            key={a}
            className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-tertiary font-mono"
          >
            {a}
          </span>
        ))}
      </div>
      {dt.fields.length > 0 && (
        <div className="space-y-1 pl-2 border-l-2 border-border">
          {dt.fields.map((f) => (
            <div key={f.name} className="flex items-baseline gap-2 text-xs font-mono">
              <span className="text-muted-foreground">{f.name}:</span>
              <span className="text-tertiary break-all">{f.type}</span>
            </div>
          ))}
        </div>
      )}
      {dt.variants && dt.variants.length > 0 && (
        <div className="space-y-2 mt-1">
          {dt.variants.map((v) => (
            <div key={v.name} className="pl-2 border-l-2 border-purple-500/30">
              <div className="text-xs font-mono text-purple-300 mb-0.5">{v.name}</div>
              {v.fields.map((f) => (
                <div key={f.name} className="flex items-baseline gap-2 text-xs font-mono pl-2">
                  <span className="text-muted-foreground">{f.name}:</span>
                  <span className="text-tertiary break-all">{f.type}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface PackageModulesViewProps {
  pkg: PackageModules;
  /** Network the package was read from - drives the external explorer link. */
  network: NetworkType;
  /** True for localnet/devstack RPCs, where no public explorer has the package. */
  isLocalNetwork: boolean;
  onCopy: (text: string, label: string) => void;
}

export function PackageModulesView({
  pkg,
  network,
  isLocalNetwork,
  onCopy,
}: PackageModulesViewProps) {
  // Open the first module by default so the view isn't a wall of collapsed rows.
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    pkg.modules[0] ? new Set([pkg.modules[0].name]) : new Set()
  );
  const [filter, setFilter] = useState('');
  // Visibility narrowing, on top of the text filter. "entry" is the one that
  // matters most in practice - those are the functions you can actually call in
  // a transaction, and they're a minority of a typical package's surface.
  // Multi-select, unioned: picking entry+public shows anything that is either.
  const [visFilter, setVisFilter] = useState<Set<VisibilityKind>>(() => new Set());

  const toggleVis = (kind: VisibilityKind) => {
    setVisFilter((prev) => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  };

  const matchesVisibility = (fn: MoveFunction): boolean => {
    if (visFilter.size === 0) return true;
    if (visFilter.has('entry') && fn.isEntry) return true;
    if (visFilter.has('public') && fn.visibility === 'public') return true;
    if (visFilter.has('friend') && fn.visibility === 'public(friend)') return true;
    return false;
  };

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const filteredModules = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const narrowing = q.length > 0 || visFilter.size > 0;
    if (!narrowing) return pkg.modules;
    return pkg.modules
      .map((m) => {
        // A module-name hit still has to respect the visibility chip, otherwise
        // picking "entry" and typing a module name would show private functions.
        const nameHit = q.length > 0 && m.name.toLowerCase().includes(q);
        const functions = m.functions.filter(
          (f) => (nameHit || !q || f.name.toLowerCase().includes(q)) && matchesVisibility(f)
        );
        // Datatypes have no visibility, so a chip other than "all" hides them.
        const datatypes =
          visFilter.size > 0
            ? []
            : m.datatypes.filter((d) => nameHit || !q || d.name.toLowerCase().includes(q));
        if (functions.length || datatypes.length) return { ...m, functions, datatypes };
        return null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [pkg, filter, visFilter]);

  const stats = useMemo(
    () => ({
      modules: pkg.modules.length,
      functions: pkg.modules.reduce((n, m) => n + m.functions.length, 0),
      datatypes: pkg.modules.reduce((n, m) => n + m.datatypes.length, 0),
    }),
    [pkg]
  );

  return (
    <div className="space-y-4">
      {/* Package Summary */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Package</span>
          {!isLocalNetwork && (
            <a
              href={buildExplorerUrl(getDefaultExplorer(), network, 'package', pkg.storageId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Suiscan <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div
          className="text-sm font-mono text-foreground truncate cursor-pointer hover:text-[#4da2ff] transition-colors flex items-center gap-2"
          onClick={() => onCopy(pkg.storageId, 'Package ID')}
        >
          <span className="truncate">{pkg.storageId}</span>
          <Copy className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-secondary rounded-lg">
            <div className="text-lg font-bold text-foreground">{stats.modules}</div>
            <div className="text-[10px] text-muted-foreground">Modules</div>
          </div>
          <div className="text-center p-2 bg-secondary rounded-lg">
            <div className="text-lg font-bold text-foreground">{stats.functions}</div>
            <div className="text-[10px] text-muted-foreground">Functions</div>
          </div>
          <div className="text-center p-2 bg-secondary rounded-lg">
            <div className="text-lg font-bold text-foreground">{stats.datatypes}</div>
            <div className="text-[10px] text-muted-foreground">Types</div>
          </div>
          <div className="text-center p-2 bg-secondary rounded-lg">
            <div className="text-lg font-bold text-foreground">v{pkg.version}</div>
            <div className="text-[10px] text-muted-foreground">Version</div>
          </div>
        </div>

        {pkg.originalId !== pkg.storageId && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Original ID</span>
            <span
              className="font-mono text-tertiary cursor-pointer hover:text-[#4da2ff]"
              onClick={() => onCopy(pkg.originalId, 'Original ID')}
            >
              {truncate(pkg.originalId)}
            </span>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tertiary" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter modules, functions, types..."
          className="w-full pl-9 pr-3 py-2 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-tertiary focus:outline-none focus:border-[#4da2ff]/50"
        />
      </div>

      {/* Visibility chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setVisFilter(new Set())}
          aria-pressed={visFilter.size === 0}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
            visFilter.size === 0
              ? 'border-[#4da2ff]/40 bg-[#4da2ff]/10 text-[#4da2ff]'
              : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
        {(['entry', 'public', 'friend'] as const).map((kind) => {
          const on = visFilter.has(kind);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggleVis(kind)}
              aria-pressed={on}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                on
                  ? 'border-[#4da2ff]/40 bg-[#4da2ff]/10 text-[#4da2ff]'
                  : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {kind}
            </button>
          );
        })}
        {visFilter.size > 0 && <span className="text-[11px] text-tertiary">types hidden</span>}
      </div>

      {/* Expand/Collapse all */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {filteredModules.length} module{filteredModules.length !== 1 ? 's' : ''}
          {(filter.trim() || visFilter.size > 0) &&
            ` · ${filteredModules.reduce((n, m) => n + m.functions.length, 0)} fn`}
        </span>
        <button
          onClick={() =>
            setExpanded((prev) =>
              prev.size === filteredModules.length
                ? new Set()
                : new Set(filteredModules.map((m) => m.name))
            )
          }
          className="text-xs text-tertiary hover:text-muted-foreground transition-colors"
        >
          {expanded.size === filteredModules.length ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* Modules */}
      <div className="space-y-3">
        {filteredModules.map((m) => {
          const isOpen = expanded.has(m.name);
          return (
            <div key={m.name} className="rounded-xl bg-card border border-border overflow-hidden">
              <button
                onClick={() => toggle(m.name)}
                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-[#4da2ff]/10 flex items-center justify-center">
                  <Braces className="w-4 h-4 text-[#4da2ff]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono font-medium text-foreground truncate">
                    {m.name}
                  </div>
                  <div className="text-xs text-tertiary">
                    {m.functions.length} fn · {m.datatypes.length} type
                    {m.datatypes.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="px-3 pb-3 border-t border-border space-y-4 pt-3">
                  {/* Functions */}
                  {m.functions.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <ArrowRight className="w-3.5 h-3.5" />
                        Functions
                      </div>
                      {m.functions.map((fn) => (
                        <FunctionRow key={fn.name} fn={fn} />
                      ))}
                    </div>
                  )}

                  {/* Datatypes */}
                  {m.datatypes.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Boxes className="w-3.5 h-3.5" />
                        Types
                      </div>
                      {m.datatypes.map((dt) => (
                        <DatatypeRow key={dt.name} dt={dt} />
                      ))}
                    </div>
                  )}

                  {m.functions.length === 0 && m.datatypes.length === 0 && (
                    <div className="text-xs text-tertiary text-center py-2">
                      No exposed functions or types
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
