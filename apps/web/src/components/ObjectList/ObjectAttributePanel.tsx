import { ArrowRight, Copy, ExternalLink, Lock, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getObjectsAttributes, type ObjectAttributes } from '@/api/services/objects';
import { Loader } from '@/components/ui/loader';
import { detectNetwork, openInExplorer } from '@/lib/explorer';
import { useAppStore } from '@/stores/useAppStore';

function shortId(id: string, chars = 8): string {
  if (!id) return '';
  return id.length <= chars * 2 + 3 ? id : `${id.slice(0, chars)}...${id.slice(-chars)}`;
}

function formatMistToSui(mist: string | null): string {
  if (mist == null) return '—';
  const n = Number(mist) / 1e9;
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(n > 0 && n < 0.01 ? 6 : 4)} SUI`;
}

function parseOwner(
  owner: unknown,
  activeAddress?: string
): { label: string; address: string | null; kind: 'address' | 'object' | 'shared' | 'immutable' | 'unknown' } {
  if (owner === 'Immutable') return { label: 'Immutable', address: null, kind: 'immutable' };
  if (owner && typeof owner === 'object') {
    const o = owner as Record<string, any>;
    if (o.AddressOwner) {
      const addr = String(o.AddressOwner);
      return {
        label: activeAddress && addr === activeAddress ? 'You' : shortId(addr),
        address: addr,
        kind: 'address',
      };
    }
    if (o.ObjectOwner) return { label: `Object ${shortId(String(o.ObjectOwner))}`, address: String(o.ObjectOwner), kind: 'object' };
    if (o.Shared) return { label: 'Shared', address: null, kind: 'shared' };
  }
  return { label: 'Unknown', address: null, kind: 'unknown' };
}

/** One label/value row with an optional copy button and explorer link. */
function AttrRow({
  label,
  value,
  mono,
  copyText,
  onExplorer,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  copyText?: string;
  onExplorer?: () => void;
  children?: React.ReactNode;
}) {
  const copy = () => {
    if (!copyText) return;
    navigator.clipboard.writeText(copyText);
    toast.success(`${label} copied`);
  };
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        {children ?? (
          <span className={`text-xs text-foreground truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
        )}
        {copyText && (
          <button onClick={copy} className="text-tertiary hover:text-foreground flex-shrink-0" title={`Copy ${label}`}>
            <Copy className="w-3 h-3" />
          </button>
        )}
        {onExplorer && (
          <button onClick={onExplorer} className="text-tertiary hover:text-foreground flex-shrink-0" title="Open in explorer">
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Expandable per-object attribute panel for the objects table. Shows what the
 * list rows can't fit - owner, digest, previous tx, storage rebate, transferable,
 * and any Display name/image - fetched lazily (only when a row is expanded). Base
 * type/version/owner from the list row render immediately while the rest loads.
 */
export function ObjectAttributePanel({
  objectId,
  baseType,
  baseVersion,
  baseOwner,
}: {
  objectId: string;
  baseType?: string;
  baseVersion?: string;
  baseOwner?: unknown;
}) {
  const navigate = useNavigate();
  const { environments, addresses } = useAppStore();
  const activeEnv = environments.find((e) => e.isActive);
  const network = detectNetwork(activeEnv?.alias, activeEnv?.rpc);
  const activeAddress = addresses.find((a) => a.isActive)?.address;

  const [attrs, setAttrs] = useState<ObjectAttributes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getObjectsAttributes([objectId])
      .then((res) => {
        if (alive) setAttrs(res[0] ?? null);
      })
      .catch(() => {
        if (alive) setAttrs(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [objectId]);

  const type = attrs?.type ?? baseType ?? '';
  const version = attrs?.version ?? baseVersion ?? '';
  const owner = attrs?.owner ?? baseOwner;
  const ownerInfo = parseOwner(owner, activeAddress);
  const display = attrs?.display;
  const digest = attrs?.digest ?? '';
  const prevTx = attrs?.previousTransaction ?? '';
  const transferable = attrs?.hasPublicTransfer;

  return (
    <div className="px-4 py-3">
      {/* Display preview (name + image) when the object carries Display metadata. */}
      {(display?.imageUrl || display?.name) && (
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border/50">
          {display.imageUrl && (
            <img
              src={display.imageUrl}
              alt={display.name || 'Object'}
              className="w-12 h-12 rounded-lg object-cover bg-secondary flex-shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          {display.name && (
            <span className="text-sm font-medium text-foreground truncate">{display.name}</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <AttrRow label="Object ID" mono value={shortId(objectId)} copyText={objectId} onExplorer={() => openInExplorer(network, 'object', objectId)} />
        <AttrRow label="Owner">
          <span className="text-xs text-foreground truncate">{ownerInfo.label}</span>
          {ownerInfo.kind === 'shared' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 flex-shrink-0">shared</span>
          )}
          {ownerInfo.kind === 'immutable' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 flex-shrink-0">frozen</span>
          )}
        </AttrRow>

        <AttrRow label="Version" value={version ? `v${version}` : '—'} />
        <AttrRow label="Transferable">
          {transferable == null ? (
            <span className="text-xs text-tertiary">{loading ? '…' : 'unknown'}</span>
          ) : transferable ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <ShieldCheck className="w-3 h-3" /> public
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Lock className="w-3 h-3" /> restricted
            </span>
          )}
        </AttrRow>

        <AttrRow
          label="Digest"
          mono
          value={digest ? shortId(digest) : loading ? '…' : '—'}
          copyText={digest || undefined}
        />
        <AttrRow label="Storage rebate" value={loading && attrs == null ? '…' : formatMistToSui(attrs?.storageRebate ?? null)} />

        <AttrRow
          label="Previous tx"
          mono
          value={prevTx ? shortId(prevTx) : loading ? '…' : '—'}
          copyText={prevTx || undefined}
          onExplorer={prevTx ? () => openInExplorer(network, 'tx', prevTx) : undefined}
        />
        {type && (
          <AttrRow label="Type" mono value={type.split('::').slice(-2).join('::') || type} copyText={type} />
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
        {loading && <Loader variant="dots" size={14} label="Loading attributes" className="text-tertiary" />}
        <button
          onClick={() => navigate(`/app/objects/${objectId}`)}
          className="ml-auto flex items-center gap-1 text-xs text-[#4da2ff] hover:underline"
        >
          View full details <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
