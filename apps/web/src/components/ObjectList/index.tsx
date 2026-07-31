import { extractCoinType } from '@sui-cli-web/shared';
import {
  ChevronRight,
  ClipboardCopy,
  Coins,
  Combine,
  Crown,
  Droplet,
  FileText,
  FlaskConical,
  Gamepad2,
  ImageIcon,
  KeyRound,
  Loader2,
  Package,
  PackageOpen,
  Search,
  Send,
  Split,
  Sword,
  Wand2,
  X,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getObject } from '@/api/client';
import {
  type BlobSummary,
  getBlobSummaries,
  getNftMetadata,
  type NftMetadata,
} from '@/api/services/objects';
import { transferObject } from '@/api/services/transfers';
import { DitherAvatar } from '@/components/dither-kit/avatar';
import { BlobGlassIcon } from '@/components/icons/BlobGlassIcon';
import { FileGlassIcon } from '@/components/icons/FileGlassIcon';
import { ImageGlassIcon } from '@/components/icons/ImageGlassIcon';
import { KeyGlassIcon } from '@/components/icons/KeyGlassIcon';
import { WalletContentGlassIcon } from '@/components/icons/WalletContentGlassIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyForAiMenu } from '@/components/ui/copy-for-ai';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { ShimmerSkeleton } from '@/components/unlumen-ui/shimmer-skeleton';
import { useCopyToClipboard } from '@/hooks';
import { useIsMobile } from '@/hooks/use-mobile';
import { buildAiContext } from '@/lib/ai-context';
import { useAppStore } from '@/stores/useAppStore';
import { Spinner } from '../shared/Spinner';
import { ObjectAttributePanel } from './ObjectAttributePanel';
import { ObjectDetail } from './ObjectDetail';

type ObjectCategory = 'all' | 'coin' | 'nft' | 'cap' | 'game' | 'memory' | 'other';

// Known/priority coins for sorting (lower = higher priority)
const COIN_PRIORITY: Record<string, number> = {
  '0x2::sui::SUI': 1,
  '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL': 2, // WAL mainnet
  '0x9f992cc2430a1f442ca7a5ca7638169f5d5c00e0ebc3977a65e9ac6e497fe5ef::wal::WAL': 2, // WAL testnet
  '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN': 3, // USDC
  '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN': 4, // USDT
};

const VERIFIED_COINS = new Set(Object.keys(COIN_PRIORITY));

/** Chips beyond this are a scroll hazard; the overflow is surfaced as a count. */
const TYPE_CHIP_CAP = 12;

/**
 * Short, human label for a full Move type. `0x2::coin::Coin<0x2::sui::SUI>`
 * reads as `Coin<SUI>` - the module path is noise once you're already scanning a
 * single account's objects.
 */
function shortTypeLabel(type: string): string {
  if (!type) return 'Unknown';
  const [base, ...rest] = type.split('<');
  const name = base.split('::').pop() ?? base;
  if (!rest.length) return name;
  const generic = rest.join('<').replace(/>+$/, '');
  const genericName = generic.split('::').pop() ?? generic;
  return `${name}<${genericName}>`;
}

/** Objects come off the RPC loosely typed; read the Move type without widening. */
function typeOf(obj: unknown): string {
  const o = obj as { type?: string; data?: { type?: string } };
  return o?.type ?? o?.data?.type ?? '';
}

function getObjectRowId(obj: Record<string, unknown>, index: number): string {
  return ((obj.objectId as string) || (obj.data as any)?.objectId || `obj-${index}`) as string;
}

interface CategoryConfig {
  id: ObjectCategory;
  label: string;
  icon: ReactNode;
  match: (type: string) => boolean;
}

// Game demo package ID for filtering
const GAME_PACKAGE_ID = '0xd5a27c2bc7870cde3e3104bf9946ad93eccec5b3ab517b29c7d3bc732003f4b5';

// Walrus Memory (memwal) package IDs - the on-chain `account` module (MemWalAccount,
// AccountRegistry) - and Walrus storage `::blob::Blob` objects, which is the actual
// data that ends up owned by an address (MemWalAccount itself is a *shared* object,
// so it can never show up in a per-address owned-objects list like this one).
const MEMWAL_PACKAGE_IDS = [
  '0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6', // testnet
  '0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6', // mainnet
];
const isWalrusMemoryObject = (type: string): boolean => {
  const lower = type.toLowerCase();
  return MEMWAL_PACKAGE_IDS.some((id) => lower.includes(id)) || lower.includes('::blob::blob');
};

const CATEGORIES: CategoryConfig[] = [
  { id: 'all', label: 'All', icon: <FileGlassIcon size={16} />, match: () => true },
  {
    id: 'coin',
    label: 'Coins',
    icon: <WalletContentGlassIcon size={16} />,
    match: (t) => t.toLowerCase().includes('coin'),
  },
  {
    id: 'nft',
    label: 'NFTs',
    icon: <ImageGlassIcon size={16} />,
    match: (t) => t.toLowerCase().includes('nft') || t.toLowerCase().includes('display'),
  },
  {
    id: 'game',
    label: 'Game Demo',
    icon: '🎮',
    match: (t) =>
      t.includes(GAME_PACKAGE_ID) ||
      t.toLowerCase().includes('character') ||
      t.toLowerCase().includes('::item::item'),
  },
  {
    id: 'memory',
    label: 'Walrus Memory',
    icon: <BlobGlassIcon size={16} />,
    match: isWalrusMemoryObject,
  },
  {
    id: 'cap',
    label: 'Capabilities',
    icon: <KeyGlassIcon size={16} />,
    match: (t) => t.toLowerCase().includes('cap'),
  },
  { id: 'other', label: 'Other', icon: '📄', match: () => true },
];

// Helper to get coin balance from object
function getCoinBalance(obj: Record<string, unknown>): string | null {
  const content = obj.data?.content || obj.content;
  if (content?.dataType === 'moveObject' && content?.fields) {
    return (content.fields.balance as string) || null;
  }
  return null;
}

// Helper to format balance with decimals
function formatCoinBalance(balance: string, decimals: number = 9): string {
  const balanceBigInt = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const integerPart = balanceBigInt / divisor;
  const fractionalPart = balanceBigInt % divisor;

  let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  fractionalStr = fractionalStr.replace(/0+$/, '');
  if (fractionalStr.length < 2) {
    fractionalStr = fractionalStr.padEnd(2, '0');
  } else if (fractionalStr.length > 4) {
    fractionalStr = fractionalStr.slice(0, 4);
  }

  return `${integerPart}.${fractionalStr}`;
}

// Get coin symbol from type
function getCoinSymbol(coinType: string): string {
  const parts = coinType.split('::');
  const typeName = parts[parts.length - 1] || '';

  // Known mappings
  if (coinType.includes('sui::SUI')) return 'SUI';
  if (coinType.includes('wal::WAL')) return 'WAL';
  if (coinType === '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN')
    return 'USDC';
  if (coinType === '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN')
    return 'USDT';

  return typeName;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = -1;
  do {
    size /= 1024;
    unitIndex++;
  } while (size >= 1024 && unitIndex < units.length - 1);
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatRelativeTime(ms: number | null): string {
  if (ms === null) return '-';
  const diffSec = Math.max(0, (Date.now() - ms) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = diffSec / 60;
  if (diffMin < 60) return `${Math.floor(diffMin)}m ago`;
  const diffHr = diffMin / 60;
  if (diffHr < 24) return `${Math.floor(diffHr)}h ago`;
  const diffDay = diffHr / 24;
  if (diffDay < 30) return `${Math.floor(diffDay)}d ago`;
  const diffMonth = diffDay / 30;
  if (diffMonth < 12) return `${Math.floor(diffMonth)}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

/** Square NFT preview: the real image when the NFT carries one, otherwise a
 * generative dither-kit pixel avatar seeded by the object id - so stat-only NFTs
 * (no on-chain image) each get a distinct, stable glyph instead of a blank. */
function NftThumbnail({
  meta,
  objectId,
  type,
  size = 32,
}: {
  meta: NftMetadata | undefined;
  objectId: string;
  type: string;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);
  const label = (meta?.name || type.split('::').pop() || '?').trim();

  if (meta?.imageUrl && !errored) {
    return (
      <img
        src={meta.imageUrl}
        alt={label}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setErrored(true)}
        className="rounded-md object-cover flex-shrink-0 bg-muted"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <DitherAvatar
      name={objectId || type}
      size={size}
      // Static paint (no per-mount RAF loop): with the list virtualizing rows in
      // and out on scroll, animating every avatar saturates the main thread and
      // makes wheel scrolling feel frozen.
      animate={false}
      className="rounded-md flex-shrink-0"
    />
  );
}

export function ObjectList() {
  const { objects, addresses, isLoading, searchQuery, setSearchQuery, fetchObjects } =
    useAppStore();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { objectId: urlObjectId } = useParams<{ objectId: string }>();
  const [selectedObject, setSelectedObject] = useState<Record<string, unknown> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTransferOpen, setBulkTransferOpen] = useState(false);
  const [bulkTransferAddress, setBulkTransferAddress] = useState('');
  const [isBulkTransferring, setIsBulkTransferring] = useState(false);
  // Packages used to be a tab here; keep old links (and any ?packageId=) working.
  useEffect(() => {
    if (searchParams.get('tab') !== 'packages') return;
    const pid = searchParams.get('packageId');
    navigate(pid ? `/app/packages?packageId=${encodeURIComponent(pid)}` : '/app/packages', {
      replace: true,
    });
  }, [searchParams, navigate]);

  // Multi-select: an empty set means "no narrowing", otherwise it's a union of
  // the picked types (an object has exactly one type, so intersecting would
  // always yield nothing).
  const [typeFilter, setTypeFilter] = useState<Set<string>>(() => new Set());
  const [activeCategory, setActiveCategory] = useState<ObjectCategory>('all');
  const [directLookupObject, setDirectLookupObject] = useState<Record<string, unknown> | null>(
    null
  );
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [fetchedUrlObjectId, setFetchedUrlObjectId] = useState<string | null>(null);
  const [blobSummaries, setBlobSummaries] = useState<Record<string, BlobSummary>>({});
  const [nftMetadata, setNftMetadata] = useState<Record<string, NftMetadata>>({});

  // Below the mobile breakpoint the wide multi-column table can't fit, so the
  // list collapses to a compact single-line-per-object layout (see render).
  const isMobile = useIsMobile();

  // Support viewing objects for any address via query param (e.g., multi-sig addresses)
  const queryAddress = searchParams.get('address');

  // `searchQuery` is shared across the coin/address/environment lists too, so a
  // leftover object search would silently filter those after navigating away.
  // Clear it on unmount (and on first mount, in case another view left one set).
  useEffect(() => {
    return () => setSearchQuery('');
  }, [setSearchQuery]);
  const activeAddress = addresses.find((a) => a.isActive);

  // Use query address if provided, otherwise use active address
  const targetAddress = queryAddress || activeAddress?.address;
  const displayLabel = queryAddress
    ? `${queryAddress.slice(0, 10)}...${queryAddress.slice(-6)}`
    : activeAddress?.alias || `${activeAddress?.address.slice(0, 16)}...`;
  const isExternalAddress = !!queryAddress && queryAddress !== activeAddress?.address;

  useEffect(() => {
    if (targetAddress) {
      fetchObjects(targetAddress);
    }
  }, [targetAddress, fetchObjects]);

  // Auto-fetch object when navigated via URL param (e.g., from DynamicFieldExplorer)
  useEffect(() => {
    // Only fetch if we have a new URL objectId that we haven't fetched yet
    if (urlObjectId && urlObjectId !== fetchedUrlObjectId) {
      const fetchObjectFromUrl = async () => {
        setIsLookingUp(true);
        try {
          // getObject returns the object data directly (fetchApi unwraps the response).
          // The single-object endpoint returns `objType`, while the address/list endpoint
          // (used by row clicks) returns `type` - ObjectDetail only reads `type`, so without
          // this normalization the Walrus Memory tab never appears when arriving via a direct URL.
          const objectData = await getObject(urlObjectId);
          if (objectData) {
            setSelectedObject({ ...objectData, type: objectData.type ?? objectData.objType });
            setFetchedUrlObjectId(urlObjectId);
          } else {
            toast.error('Object not found');
            navigate('/app/objects');
          }
        } catch {
          toast.error('Failed to fetch object');
          navigate('/app/objects');
        } finally {
          setIsLookingUp(false);
        }
      };
      fetchObjectFromUrl();
    } else if (!urlObjectId && fetchedUrlObjectId) {
      // Clear when navigating away from object detail URL
      setSelectedObject(null);
      setFetchedUrlObjectId(null);
    }
  }, [urlObjectId, fetchedUrlObjectId, navigate]);

  // Check if search query is a full Object ID (0x + 64 hex chars = 66 total)
  const isFullObjectId = useCallback((query: string) => {
    return (
      query && query.startsWith('0x') && query.length === 66 && /^0x[a-fA-F0-9]{64}$/.test(query)
    );
  }, []);

  // Direct object lookup when user searches for a full Object ID
  useEffect(() => {
    const lookupObject = async () => {
      if (!searchQuery || !isFullObjectId(searchQuery)) {
        setDirectLookupObject(null);
        return;
      }

      setIsLookingUp(true);
      try {
        // getObject returns the object data directly (fetchApi unwraps the response);
        // normalize objType -> type, see comment on the URL-param fetch above.
        const objectData = await getObject(searchQuery);
        if (objectData) {
          setDirectLookupObject({ ...objectData, type: objectData.type ?? objectData.objType });
        } else {
          setDirectLookupObject(null);
        }
      } catch {
        setDirectLookupObject(null);
      } finally {
        setIsLookingUp(false);
      }
    };

    // Debounce the lookup
    const timer = setTimeout(lookupObject, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isFullObjectId]);

  // Helper to check if type is a game object
  const isGameObject = (type: string) => {
    return (
      type.includes(GAME_PACKAGE_ID) ||
      type.toLowerCase().includes('character') ||
      type.toLowerCase().includes('::item::item')
    );
  };

  // Batch-fetch decoded Blob details (size, certification, last-touched) once
  // the Walrus Memory tab is opened - the plain objects list has no decoded
  // fields at all, so the extra columns there need this dedicated fetch.
  useEffect(() => {
    if (activeCategory !== 'memory') return;
    const blobIds = objects
      .map((obj) => ({
        type: ((obj.type as string) || (obj.data as any)?.type || '') as string,
        objectId: ((obj.objectId as string) || (obj.data as any)?.objectId || '') as string,
      }))
      .filter((o) => o.objectId && o.type.toLowerCase().includes('::blob::blob'))
      .map((o) => o.objectId)
      .filter((id) => !blobSummaries[id]);

    if (blobIds.length === 0) return;

    getBlobSummaries(blobIds)
      .then((results) => {
        setBlobSummaries((prev) => {
          const next = { ...prev };
          for (const summary of results) next[summary.objectId] = summary;
          return next;
        });
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, objects]);

  // NFT presentation metadata (image, name, key attributes) - only when the NFTs
  // tab is opened, batched, deduped against already-fetched. Mirrors the blob
  // fetch above: the plain objects list carries no decoded fields, so previews
  // need this dedicated call.
  useEffect(() => {
    if (activeCategory !== 'nft') return;
    const nftIds = objects
      .map((obj) => ({
        type: ((obj.type as string) || (obj.data as any)?.type || '') as string,
        objectId: ((obj.objectId as string) || (obj.data as any)?.objectId || '') as string,
      }))
      .filter(
        (o) =>
          o.objectId &&
          (o.type.toLowerCase().includes('nft') || o.type.toLowerCase().includes('display'))
      )
      .map((o) => o.objectId)
      .filter((id) => !nftMetadata[id]);

    if (nftIds.length === 0) return;

    getNftMetadata(nftIds)
      .then((results) => {
        setNftMetadata((prev) => {
          const next = { ...prev };
          for (const meta of results) next[meta.objectId] = meta;
          return next;
        });
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, objects]);

  // Group objects by type
  const { filteredObjects, categoryCounts } = useMemo(() => {
    const counts: Record<ObjectCategory, number> = {
      all: 0,
      coin: 0,
      nft: 0,
      cap: 0,
      game: 0,
      memory: 0,
      other: 0,
    };

    const filtered = objects.filter((obj) => {
      const objectId = obj.objectId || obj.data?.objectId || '';
      const type = obj.type || obj.data?.type || '';

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!objectId.toLowerCase().includes(query) && !type.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Count by category
      counts.all++;
      const lower = type.toLowerCase();
      if (lower.includes('coin')) {
        counts.coin++;
      } else if (lower.includes('nft') || lower.includes('display')) {
        counts.nft++;
      } else if (isGameObject(type)) {
        counts.game++;
      } else if (isWalrusMemoryObject(type)) {
        counts.memory++;
      } else if (lower.includes('cap')) {
        counts.cap++;
      } else {
        counts.other++;
      }

      // Category filter
      if (activeCategory === 'all') return true;
      if (activeCategory === 'coin') return lower.includes('coin');
      if (activeCategory === 'nft') return lower.includes('nft') || lower.includes('display');
      if (activeCategory === 'game') return isGameObject(type);
      if (activeCategory === 'memory') return isWalrusMemoryObject(type);
      if (activeCategory === 'cap') return lower.includes('cap') && !isWalrusMemoryObject(type);
      if (activeCategory === 'other') {
        return (
          !lower.includes('coin') &&
          !lower.includes('nft') &&
          !lower.includes('display') &&
          !isGameObject(type) &&
          !isWalrusMemoryObject(type) &&
          !lower.includes('cap')
        );
      }
      return true;
    });

    // Sort coins by priority when in coin category
    if (activeCategory === 'coin') {
      filtered.sort((a, b) => {
        const typeA = a.type || a.data?.type || '';
        const typeB = b.type || b.data?.type || '';

        const coinTypeA = extractCoinType(typeA) || '';
        const coinTypeB = extractCoinType(typeB) || '';

        const priorityA = COIN_PRIORITY[coinTypeA] ?? 999;
        const priorityB = COIN_PRIORITY[coinTypeB] ?? 999;

        // Both have priority - sort by priority
        if (priorityA !== 999 && priorityB !== 999) {
          return priorityA - priorityB;
        }
        // Only A has priority
        if (priorityA !== 999) return -1;
        // Only B has priority
        if (priorityB !== 999) return 1;

        // Neither has priority - sort by balance descending
        const balanceA = getCoinBalance(a);
        const balanceB = getCoinBalance(b);
        if (balanceA && balanceB) {
          return BigInt(balanceB) > BigInt(balanceA) ? 1 : -1;
        }

        return 0;
      });
    }

    return { filteredObjects: filtered, categoryCounts: counts };
  }, [objects, searchQuery, activeCategory]);

  // Distinct Move types inside the current tab, most common first. Derived from
  // the category-filtered set (not the type-filtered one) so the chips don't
  // disappear the moment you pick one.
  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const obj of filteredObjects) {
      const type = typeOf(obj);
      if (!type) continue;
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([type, count]) => ({ type, count, label: shortTypeLabel(type) }));
  }, [filteredObjects]);

  // A type from the Coins tab is meaningless under NFTs - drop the selection
  // whenever the tab or search changes rather than silently showing zero rows.
  useEffect(() => {
    setTypeFilter(new Set());
  }, [activeCategory, searchQuery]);

  const toggleTypeFilter = (type: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const visibleObjects = useMemo(() => {
    if (typeFilter.size === 0) return filteredObjects;
    return filteredObjects.filter((obj) => typeFilter.has(typeOf(obj)));
  }, [filteredObjects, typeFilter]);

  const selectedObjects = useMemo(
    () => visibleObjects.filter((obj, i) => selectedIds.has(getObjectRowId(obj, i))),
    [visibleObjects, selectedIds]
  );

  // Merge only makes sense when every selected row is the same real coin type
  // (Sui's merge operation combines coin objects of one type into one).
  const commonCoinType = useMemo(() => {
    if (selectedObjects.length < 2) return null;
    const types = selectedObjects.map((obj) => {
      const type = ((obj.type as string) || (obj.data as any)?.type || '') as string;
      return type.toLowerCase().includes('coin') ? extractCoinType(type) : null;
    });
    const first = types[0];
    if (!first) return null;
    return types.every((t) => t === first) ? first : null;
  }, [selectedObjects]);

  const handleBulkTransfer = async () => {
    if (!bulkTransferAddress.trim()) return;
    setIsBulkTransferring(true);
    let succeeded = 0;
    let failed = 0;
    for (const obj of selectedObjects) {
      const objectId = ((obj.objectId as string) || (obj.data as any)?.objectId || '') as string;
      if (!objectId) continue;
      try {
        await transferObject(bulkTransferAddress.trim(), objectId);
        succeeded++;
      } catch {
        failed++;
      }
    }
    setIsBulkTransferring(false);
    setBulkTransferOpen(false);
    setBulkTransferAddress('');
    if (succeeded > 0) {
      toast.success(`Transferred ${succeeded} object${succeeded === 1 ? '' : 's'}`);
      setSelectedIds(new Set());
      if (targetAddress) fetchObjects(targetAddress);
    }
    if (failed > 0) {
      toast.error(`${failed} transfer${failed === 1 ? '' : 's'} failed`);
    }
  };

  // Copy the selected objects as JSON - full object IDs + types + versions with
  // wallet/network context, formatted to paste straight into an AI coding agent
  // (or anywhere else that wants structured data).
  const handleCopySelected = async () => {
    if (selectedObjects.length === 0) return;
    const objects = selectedObjects.map((obj) => {
      const objectId = ((obj.objectId as string) || (obj.data as any)?.objectId || '') as string;
      const type = ((obj.type as string) || (obj.data as any)?.type || '') as string;
      const version = (obj.version as number) ?? (obj.data as any)?.version ?? '';
      return { objectId, type, version };
    });
    const payload = {
      wallet: activeAddress
        ? { alias: activeAddress.alias || null, address: activeAddress.address }
        : null,
      objects,
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(
        `Copied ${selectedObjects.length} object${selectedObjects.length === 1 ? '' : 's'}`
      );
    } catch {
      toast.error('Copy failed');
    }
  };

  const copyToClipboard = useCopyToClipboard();

  const getTypeDisplay = (type: string) => {
    if (!type) return 'Unknown';
    const parts = type.split('::');
    return parts[parts.length - 1] || type;
  };

  const getModuleName = (type: string) => {
    if (!type) return '';
    const parts = type.split('::');
    return parts.length >= 2 ? parts[1] : '';
  };

  const getTypeIcon = (type: string) => {
    const lower = type.toLowerCase();
    const iconCls = 'w-4 h-4';
    if (lower.includes('::blob::')) return <BlobGlassIcon size={20} />;
    if (lower.includes('coin')) return <Coins className={iconCls} />;
    if (lower.includes('nft')) return <ImageIcon className={iconCls} />;
    if (lower.includes('package')) return <PackageOpen className={iconCls} />;
    if (lower.includes('upgradecap')) return <PackageOpen className={iconCls} />;
    if (lower.includes('admincap')) return <Crown className={iconCls} />;
    if (lower.includes('cap')) return <KeyRound className={iconCls} />;
    if (lower.includes('test')) return <FlaskConical className={iconCls} />;
    // Game objects
    if (lower.includes('character')) return <Wand2 className={iconCls} />;
    if (lower.includes('::item::item')) return <Sword className={iconCls} />;
    if (type.includes(GAME_PACKAGE_ID)) return <Gamepad2 className={iconCls} />;
    return <FileText className={iconCls} />;
  };

  const getTypeColor = (type: string) => {
    const lower = type.toLowerCase();
    if (lower.includes('coin')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (lower.includes('nft')) return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    if (lower.includes('upgradecap')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (lower.includes('admincap')) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (lower.includes('cap')) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    if (lower.includes('test')) return 'bg-green-500/20 text-green-400 border-green-500/30';
    // Game objects - cyan/teal color
    if (lower.includes('character')) return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    if (lower.includes('::item::item'))
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (type.includes(GAME_PACKAGE_ID)) return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    return 'bg-muted text-muted-foreground border-border';
  };

  // Virtualized table columns - stays smooth at 10k+ rows (@tanstack/react-virtual),
  // sortable/resizable/reorderable headers (@tanstack/react-table), sticky header.
  const tableColumns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        id: 'type',
        header: 'Type',
        accessor: (obj) => (obj.type as string) || (obj.data as any)?.type || '',
        sortable: true,
        size: 260,
        cell: (obj) => {
          const type = ((obj.type as string) || (obj.data as any)?.type || '') as string;
          const isCoin = type.toLowerCase().includes('coin');
          const coinType = isCoin ? extractCoinType(type) : null;
          const coinSymbol = coinType ? getCoinSymbol(coinType) : '';
          const isVerified = coinType ? VERIFIED_COINS.has(coinType) : false;
          const moduleName = getModuleName(type);
          return (
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0">{getTypeIcon(type)}</span>
              <span className="text-base text-foreground truncate">
                {isCoin && coinSymbol ? coinSymbol : getTypeDisplay(type)}
              </span>
              {isCoin && isVerified && (
                <span className="text-[10px] text-success flex-shrink-0">✓</span>
              )}
              {!isCoin && moduleName && (
                <span className="text-xs text-tertiary font-mono flex-shrink-0">
                  ::{moduleName}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'objectId',
        header: 'Object ID',
        accessor: (obj) => (obj.objectId as string) || (obj.data as any)?.objectId || '',
        sortable: true,
        size: 300,
        grow: true,
        cell: (obj) => (
          <span className="text-sm text-tertiary font-mono truncate">
            {(obj.objectId as string) || (obj.data as any)?.objectId || ''}
          </span>
        ),
      },
      {
        id: 'balance',
        header: 'Balance',
        accessor: (obj) => {
          const type = ((obj.type as string) || (obj.data as any)?.type || '') as string;
          if (!type.toLowerCase().includes('coin')) return null;
          const raw = getCoinBalance(obj);
          return raw ? Number(raw) : null;
        },
        sortable: true,
        size: 160,
        align: 'right',
        cell: (obj) => {
          const type = ((obj.type as string) || (obj.data as any)?.type || '') as string;
          const isCoin = type.toLowerCase().includes('coin');
          if (!isCoin) return null;
          const coinType = extractCoinType(type);
          const coinSymbol = coinType ? getCoinSymbol(coinType) : '';
          const coinBalance = getCoinBalance(obj);
          if (!coinBalance) return null;
          return (
            <span className="text-sm text-primary">
              {formatCoinBalance(coinBalance)}{' '}
              <span className="text-muted-foreground">{coinSymbol}</span>
            </span>
          );
        },
      },
      {
        id: 'version',
        header: 'Version',
        accessor: (obj) => Number((obj.version as string) || (obj.data as any)?.version || 0),
        sortable: true,
        size: 100,
        align: 'right',
        cell: (obj) => (
          <span className="text-xs text-tertiary">
            v{(obj.version as string) || (obj.data as any)?.version || ''}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        accessor: () => null,
        sortable: false,
        // Two "icon + label" ghost buttons (Send, Split) need more than 140px or their
        // labels get hard-clipped by the cell's `truncate` wrapper (data-table.tsx) -
        // each button alone is ~75px (px-3 padding + icon + gap + text). minSize matches
        // size so the column-resize handle can't be dragged back below the usable width.
        size: 200,
        minSize: 200,
        cell: (obj) => {
          const type = ((obj.type as string) || (obj.data as any)?.type || '') as string;
          const objectId = ((obj.objectId as string) ||
            (obj.data as any)?.objectId ||
            '') as string;
          const isCoin = type.toLowerCase().includes('coin');
          const coinType = isCoin ? extractCoinType(type) : null;
          if (!isCoin || !coinType) return null;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(
                    `/app/coins/transfer?coinId=${objectId}&type=${encodeURIComponent(coinType)}`
                  );
                }}
              >
                <Package className="w-3.5 h-3.5" />
                Send
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(
                    `/app/coins/split?coinId=${objectId}&type=${encodeURIComponent(coinType)}`
                  );
                }}
              >
                <Split className="w-3.5 h-3.5" />
                Split
              </Button>
            </div>
          );
        },
      },
    ],
    [navigate]
  );

  // Dedicated columns for the "Walrus Memory" tab - Balance/Version aren't
  // meaningful for Blob objects, so this swaps them for the decoded fields
  // (size, certification, storage window, last-touched) fetched in the
  // effect above instead.
  const memoryTableColumns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        id: 'type',
        header: 'Type',
        accessor: (obj) => (obj.type as string) || (obj.data as any)?.type || '',
        sortable: true,
        size: 140,
        cell: (obj) => {
          const type = ((obj.type as string) || (obj.data as any)?.type || '') as string;
          const moduleName = getModuleName(type);
          return (
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0">{getTypeIcon(type)}</span>
              <span className="text-base text-foreground truncate">{getTypeDisplay(type)}</span>
              {moduleName && (
                <span className="text-xs text-tertiary font-mono flex-shrink-0">
                  ::{moduleName}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'objectId',
        header: 'Object ID',
        accessor: (obj) => (obj.objectId as string) || (obj.data as any)?.objectId || '',
        sortable: true,
        size: 260,
        grow: true,
        cell: (obj) => (
          <span className="text-sm text-tertiary font-mono truncate">
            {(obj.objectId as string) || (obj.data as any)?.objectId || ''}
          </span>
        ),
      },
      {
        id: 'size',
        header: 'Size',
        accessor: (obj) => {
          const objectId = ((obj.objectId as string) ||
            (obj.data as any)?.objectId ||
            '') as string;
          return blobSummaries[objectId]?.size ?? -1;
        },
        sortable: true,
        size: 100,
        align: 'right',
        cell: (obj) => {
          const objectId = ((obj.objectId as string) ||
            (obj.data as any)?.objectId ||
            '') as string;
          return (
            <span className="text-sm text-foreground">
              {formatBytes(blobSummaries[objectId]?.size ?? null)}
            </span>
          );
        },
      },
      {
        id: 'certified',
        header: (
          <Tooltip
            content="Certified = the Walrus network has confirmed this memory is fully stored across storage nodes and safe to retrieve. Distributing = still being uploaded/replicated - not fully retrievable yet."
            side="bottom"
          >
            <span className="cursor-help border-b border-dotted border-current">Availability</span>
          </Tooltip>
        ),
        accessor: (obj) => {
          const objectId = ((obj.objectId as string) ||
            (obj.data as any)?.objectId ||
            '') as string;
          return blobSummaries[objectId]?.certifiedEpoch ?? -1;
        },
        sortable: true,
        size: 150,
        cell: (obj) => {
          const objectId = ((obj.objectId as string) ||
            (obj.data as any)?.objectId ||
            '') as string;
          const summary = blobSummaries[objectId];
          if (!summary) return <span className="text-sm text-tertiary">-</span>;
          return summary.certifiedEpoch !== null ? (
            <span className="text-sm text-success">✓ Stored on Walrus</span>
          ) : (
            <span className="text-sm text-warning">⏳ Distributing…</span>
          );
        },
      },
      {
        id: 'storageUntil',
        header: 'Storage Until',
        accessor: (obj) => {
          const objectId = ((obj.objectId as string) ||
            (obj.data as any)?.objectId ||
            '') as string;
          return blobSummaries[objectId]?.storageEndEpoch ?? -1;
        },
        sortable: true,
        size: 120,
        align: 'right',
        cell: (obj) => {
          const objectId = ((obj.objectId as string) ||
            (obj.data as any)?.objectId ||
            '') as string;
          const epoch = blobSummaries[objectId]?.storageEndEpoch;
          return (
            <span className="text-sm text-muted-foreground">
              {epoch !== undefined && epoch !== null ? `epoch ${epoch}` : '-'}
            </span>
          );
        },
      },
      {
        id: 'lastTouched',
        header: 'Last Interaction',
        accessor: (obj) => {
          const objectId = ((obj.objectId as string) ||
            (obj.data as any)?.objectId ||
            '') as string;
          return blobSummaries[objectId]?.lastTouchedMs ?? -1;
        },
        sortable: true,
        size: 130,
        align: 'right',
        cell: (obj) => {
          const objectId = ((obj.objectId as string) ||
            (obj.data as any)?.objectId ||
            '') as string;
          return (
            <span className="text-sm text-muted-foreground">
              {formatRelativeTime(blobSummaries[objectId]?.lastTouchedMs ?? null)}
            </span>
          );
        },
      },
    ],
    [blobSummaries]
  );

  // NFT columns: a preview thumbnail (image or generated tile) + name, then the
  // key attributes as compact badges, so a row reads visually instead of as a
  // bare hex id. Used when the NFTs tab is active.
  const nftTableColumns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        id: 'preview',
        header: 'NFT',
        accessor: (obj) => {
          const objectId = ((obj.objectId as string) ||
            (obj.data as any)?.objectId ||
            '') as string;
          return nftMetadata[objectId]?.name || (obj.type as string) || '';
        },
        sortable: true,
        size: 280,
        cell: (obj) => {
          const type = ((obj.type as string) || (obj.data as any)?.type || '') as string;
          const objectId = ((obj.objectId as string) ||
            (obj.data as any)?.objectId ||
            '') as string;
          const meta = nftMetadata[objectId];
          return (
            <div className="flex items-center gap-3 min-w-0">
              <NftThumbnail meta={meta} objectId={objectId} type={type} size={36} />
              <div className="flex flex-col min-w-0">
                <span className="text-base text-foreground truncate">
                  {meta?.name || getTypeDisplay(type)}
                </span>
                <span className="text-xs text-tertiary font-mono truncate">
                  ::{getModuleName(type)}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'objectId',
        header: 'Object ID',
        accessor: (obj) => (obj.objectId as string) || (obj.data as any)?.objectId || '',
        sortable: true,
        size: 240,
        grow: true,
        cell: (obj) => (
          <span className="text-sm text-tertiary font-mono truncate">
            {(obj.objectId as string) || (obj.data as any)?.objectId || ''}
          </span>
        ),
      },
      {
        id: 'attributes',
        header: 'Attributes',
        accessor: () => '',
        sortable: false,
        size: 320,
        cell: (obj) => {
          const objectId = ((obj.objectId as string) ||
            (obj.data as any)?.objectId ||
            '') as string;
          const attrs = nftMetadata[objectId]?.attributes ?? [];
          if (attrs.length === 0) return <span className="text-xs text-tertiary">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {attrs.slice(0, 4).map((a) => (
                <span
                  key={a.label}
                  className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap"
                >
                  {a.label} <span className="text-foreground font-medium">{a.value}</span>
                </span>
              ))}
            </div>
          );
        },
      },
      {
        id: 'version',
        header: 'Version',
        accessor: (obj) => (obj.version as number) || (obj.data as any)?.version || 0,
        sortable: true,
        size: 100,
        align: 'right',
        cell: (obj) => (
          <span className="text-xs text-muted-foreground font-mono">
            v{(obj.version as number) || (obj.data as any)?.version || '?'}
          </span>
        ),
      },
    ],
    [nftMetadata]
  );

  // Handle closing object detail view
  const handleCloseDetail = () => {
    setSelectedObject(null);
    setFetchedUrlObjectId(null);
    // If we came from URL, navigate back to objects list
    if (urlObjectId) {
      navigate('/app/objects');
    }
  };

  // Show loading state when fetching object from URL
  if (urlObjectId && !selectedObject) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Spinner />
        <span className="text-sm text-muted-foreground">Loading object...</span>
      </div>
    );
  }

  // Show object detail view
  if (selectedObject) {
    return (
      <ObjectDetail object={selectedObject} onBack={handleCloseDetail} onCopy={copyToClipboard} />
    );
  }

  if (!targetAddress) {
    return <div className="px-3 py-8 text-center text-muted-foreground">No address selected</div>;
  }

  if (isLoading && objects.length === 0) {
    return (
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center justify-between px-1">
          <ShimmerSkeleton className="h-5 w-24" />
          <ShimmerSkeleton className="h-5 w-32" />
        </div>

        {/* Tabs skeleton */}
        <div className="flex items-center gap-2 mb-4 px-1">
          <ShimmerSkeleton className="h-8 w-16" rounded="full" />
          <ShimmerSkeleton className="h-8 w-20" rounded="full" />
          <ShimmerSkeleton className="h-8 w-24" rounded="full" />
        </div>

        {/* List items skeleton */}
        <div className="space-y-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border-l-2 border-l-transparent"
            >
              <ShimmerSkeleton className="h-6 w-6 shrink-0" rounded="full" />
              <div className="flex-1 space-y-2">
                <ShimmerSkeleton className="h-4 w-1/4" />
                <ShimmerSkeleton className="h-3 w-2/5" />
              </div>
              <ShimmerSkeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // "Copy for AI" payloads describing the currently-filtered object list. Capped
  // so a wallet with thousands of objects doesn't produce a multi-MB clipboard.
  const AI_ROW_CAP = 200;
  const aiRows = visibleObjects.slice(0, AI_ROW_CAP).map((obj) => {
    const type = ((obj.type as string) || (obj.data as any)?.type || '') as string;
    return {
      type,
      objectId: ((obj.objectId as string) || (obj.data as any)?.objectId || '') as string,
      version: ((obj.version as string) || (obj.data as any)?.version || '') as string,
    };
  });
  const aiTruncated = visibleObjects.length > AI_ROW_CAP;
  const activeCategoryLabel = CATEGORIES.find((c) => c.id === activeCategory)?.label ?? 'All';
  const aiJson = JSON.stringify(
    {
      address: targetAddress,
      filter: activeCategoryLabel,
      total: visibleObjects.length,
      objects: aiRows,
    },
    null,
    2
  );
  const aiMarkdown = [
    `# Objects for ${displayLabel}`,
    '',
    `- **Address:** \`${targetAddress}\``,
    `- **Filter:** ${activeCategoryLabel}`,
    `- **Showing:** ${aiRows.length} of ${visibleObjects.length}${aiTruncated ? ' (truncated)' : ''}`,
    '',
    '| Type | Object ID | Version |',
    '| --- | --- | --- |',
    ...aiRows.map(
      (r) => `| ${getTypeDisplay(r.type) || '—'} | \`${r.objectId}\` | ${r.version || '—'} |`
    ),
  ].join('\n');
  const aiPrompt = buildAiContext({
    title: 'Sui owned objects',
    intro: [
      `On-chain objects owned by \`${targetAddress}\`, as currently filtered in the UI`,
      `(${activeCategoryLabel}${typeFilter.size > 0 ? ` + ${typeFilter.size} type filter(s)` : ''}: ${visibleObjects.length} shown${aiTruncated ? `, first ${AI_ROW_CAP} listed below` : ''}).`,
    ],
    stateJson: aiJson,
    extra: aiMarkdown,
    endpoints: [
      {
        method: 'GET',
        path: '/addresses/:address/objects',
        effect: 'every object owned by an address',
      },
      {
        // `type` is required - without it the route 400s.
        method: 'GET',
        path: '/addresses/:address/objects/by-type?type=<pattern>',
        effect: 'objects matching a Move type pattern (type param is required)',
      },
      { method: 'GET', path: '/coins/:address', effect: 'coin objects only, with balances' },
      {
        method: 'POST',
        path: '/transfers/object',
        body: '{ to, objectId, gasBudget? }',
        effect: 'signs and submits an object transfer',
        mutating: true,
      },
      {
        method: 'POST',
        path: '/transfers/object/dry-run',
        body: '{ to, objectId, gasBudget? }',
        effect: 'simulate the transfer',
      },
    ],
    rules: [
      'The category tabs (Coins/NFTs/Capabilities/...) are heuristics over the type string, not on-chain classes',
      'An object has exactly one Move type; the full type is `package::module::Struct<TypeArgs>`',
      'Only the listed rows are included here - the account may own more than is shown',
      'Transferring an object moves the whole object; there is no partial transfer except for coins (split first)',
    ],
    examples: [
      'group these by what they actually are',
      'find anything unusual or unexpected',
      'work out which are safe to clean up',
    ],
  });

  // Single-line-per-object rows for the mobile compact list (the desktop uses the
  // full DataTable).
  const plainObjectRows = visibleObjects.map((obj, i) => {
    const type = ((obj.type as string) || (obj.data as any)?.type || '') as string;
    const objectId = ((obj.objectId as string) || (obj.data as any)?.objectId || '') as string;
    const version = ((obj.version as string) || (obj.data as any)?.version || '') as string;
    const isCoin = type.toLowerCase().includes('coin');
    const coinType = isCoin ? extractCoinType(type) : null;
    const label =
      isCoin && coinType ? getCoinSymbol(coinType) || getTypeDisplay(type) : getTypeDisplay(type);
    return (
      <button
        type="button"
        key={getObjectRowId(obj, i)}
        onClick={() => {
          setSelectedObject(obj);
          if (objectId) navigate(`/app/objects/${objectId}`);
        }}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
      >
        <span className="flex-shrink-0">{getTypeIcon(type)}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-foreground truncate">{label}</div>
          <div className="text-xs text-tertiary font-mono truncate">
            {objectId ? `${objectId.slice(0, 10)}...${objectId.slice(-6)}` : ''}
          </div>
        </div>
        {version && <span className="text-xs text-tertiary flex-shrink-0">v{version}</span>}
        <ChevronRight className="w-4 h-4 text-tertiary flex-shrink-0" />
      </button>
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
          <span>Objects</span>
          {isExternalAddress && (
            <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-[10px]">
              External
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <button
            className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors font-mono truncate"
            onClick={() => {
              navigator.clipboard.writeText(targetAddress);
              toast.success('Address copied');
            }}
            title="Click to copy"
          >
            {displayLabel}
          </button>
          {visibleObjects.length > 0 && (
            <CopyForAiMenu
              prompt={aiPrompt}
              json={aiJson}
              markdown={aiMarkdown}
              onCopy={copyToClipboard}
              className="flex-shrink-0"
            />
          )}
        </div>
      </div>

      {/* Find object - drives the shared searchQuery, which filters the list by
          Object ID / type and (for a full 0x… id) triggers the direct lookup below. */}
      <div className="px-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find an object by ID or type… (paste a full 0x… ID to fetch any object)"
            className="w-full pl-10 pr-9 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-[#4da2ff]/50 transition-colors"
            aria-label="Find an object"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="mt-1.5 px-1 text-xs text-muted-foreground">
            {visibleObjects.length} match{visibleObjects.length !== 1 ? 'es' : ''} in{' '}
            {activeCategoryLabel}
          </div>
        )}
      </div>

      {/* Category filter - single shared TabsContent below (the list is already
          filtered by activeCategory), not discrete per-tab panels. */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as ObjectCategory)}>
        <TabsList className="overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id];
            if (cat.id !== 'all' && count === 0) return null;

            return (
              <TabsTrigger key={cat.id} value={cat.id} icon={<span>{cat.icon}</span>} badge={count}>
                {cat.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value={activeCategory}>
          <>
            {/* Concrete-type filter. The category tabs are heuristic buckets
                  ("anything with 'cap' in the type"); this narrows to one exact
                  Move type, which is what you want once a bucket has hundreds. */}
            {typeOptions.length > 1 && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTypeFilter(new Set())}
                  aria-pressed={typeFilter.size === 0}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    typeFilter.size === 0
                      ? 'border-[#4da2ff]/40 bg-[#4da2ff]/10 text-[#4da2ff]'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All types
                </button>
                {typeOptions.slice(0, TYPE_CHIP_CAP).map((opt) => {
                  const on = typeFilter.has(opt.type);
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => toggleTypeFilter(opt.type)}
                      aria-pressed={on}
                      title={opt.type}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        on
                          ? 'border-[#4da2ff]/40 bg-[#4da2ff]/10 text-[#4da2ff]'
                          : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="font-mono">{opt.label}</span>
                      <span className="ml-1 text-tertiary">{opt.count}</span>
                    </button>
                  );
                })}
                {typeOptions.length > TYPE_CHIP_CAP && (
                  <span className="text-[11px] text-tertiary">
                    +{typeOptions.length - TYPE_CHIP_CAP} more type
                    {typeOptions.length - TYPE_CHIP_CAP !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
            {/* Direct Object Lookup Result - when user searches for a full Object ID */}
            {isFullObjectId(searchQuery) && (
              <div className="mb-3">
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                  <Search className="w-3 h-3" />
                  Direct Object Lookup
                </div>
                {isLookingUp ? (
                  <div className="flex items-center gap-2 px-3 py-4 bg-muted/30 rounded-lg">
                    <Spinner />
                    <span className="text-sm text-muted-foreground">Looking up object...</span>
                  </div>
                ) : directLookupObject ? (
                  <div
                    className="flex items-center gap-3 px-3 py-3 rounded-lg bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 transition-colors cursor-pointer"
                    onClick={() => setSelectedObject(directLookupObject)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-lg">
                      {getTypeIcon(
                        (directLookupObject as any).data?.type ||
                          (directLookupObject as any).type ||
                          ''
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-green-400">Found Object</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getTypeColor((directLookupObject as any).data?.type || (directLookupObject as any).type || '')}`}
                        >
                          {getTypeDisplay(
                            (directLookupObject as any).data?.type ||
                              (directLookupObject as any).type ||
                              ''
                          )}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate mt-1">
                        {searchQuery}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        v
                        {(directLookupObject as any).data?.version ||
                          (directLookupObject as any).version ||
                          '?'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-green-400" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <span className="text-red-400">❌</span>
                    <span className="text-sm text-red-400">Object not found or deleted</span>
                  </div>
                )}
              </div>
            )}

            {visibleObjects.length === 0 && !isFullObjectId(searchQuery) ? (
              <div className="px-3 py-8 text-center text-muted-foreground">
                <div className="text-4xl mb-2">{objects.length === 0 ? '📭' : '🔍'}</div>
                <div className="mb-2">
                  {objects.length === 0
                    ? 'This address has no objects yet'
                    : 'No objects match your filter'}
                </div>

                {objects.length === 0 && (
                  <div className="mt-4 p-4 bg-muted/30 rounded-lg text-left max-w-sm mx-auto">
                    <p className="text-xs text-muted-foreground mb-3">
                      {isExternalAddress
                        ? 'This might be a new multi-sig address. To start using it:'
                        : 'To add objects to this address:'}
                    </p>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                          1
                        </span>
                        <span>Get test SUI from faucet</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                          2
                        </span>
                        <span>Transfer assets to this address</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="mt-3" asChild>
                      <a href={`/app/faucet?address=${targetAddress}`}>
                        <Droplet className="w-3.5 h-3.5" />
                        Request from Faucet
                      </a>
                    </Button>
                  </div>
                )}

                {activeCategory !== 'all' && objects.length > 0 && (
                  <button
                    onClick={() => setActiveCategory('all')}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Show all objects
                  </button>
                )}
              </div>
            ) : visibleObjects.length === 0 &&
              isFullObjectId(searchQuery) ? /* Only direct lookup result shown */
            null : (
              /* Virtualized table - smooth at 10k+ rows, sortable/resizable/reorderable
           headers, sticky header, row selection. */
              <div className="rounded-lg border border-border overflow-hidden">
                {selectedIds.size > 0 && (
                  <div className="border-b border-border bg-accent">
                    <div className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="text-foreground">{selectedIds.size} selected</span>
                      <div className="flex items-center gap-3">
                        {commonCoinType && (
                          <button
                            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              navigate(
                                `/app/coins/merge?type=${encodeURIComponent(commonCoinType)}`
                              )
                            }
                          >
                            <Combine className="w-3.5 h-3.5" />
                            Merge
                          </button>
                        )}
                        <button
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                          onClick={handleCopySelected}
                          title="Copy selected objects as JSON (for pasting into an AI agent)"
                        >
                          <ClipboardCopy className="w-3.5 h-3.5" />
                          Copy
                        </button>
                        <button
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                          onClick={() => setBulkTransferOpen((o) => !o)}
                        >
                          <Send className="w-3.5 h-3.5" />
                          Transfer
                        </button>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setSelectedIds(new Set());
                            setBulkTransferOpen(false);
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    {bulkTransferOpen && (
                      <div className="flex items-center gap-2 px-3 pb-2">
                        <input
                          type="text"
                          value={bulkTransferAddress}
                          onChange={(e) => setBulkTransferAddress(e.target.value)}
                          placeholder="0x... recipient address"
                          className="flex-1 text-xs font-mono px-2 py-1.5 rounded border border-border bg-background text-foreground placeholder:text-tertiary"
                          disabled={isBulkTransferring}
                        />
                        <Button
                          size="sm"
                          disabled={!bulkTransferAddress.trim() || isBulkTransferring}
                          onClick={handleBulkTransfer}
                        >
                          {isBulkTransferring ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            `Send ${selectedIds.size}`
                          )}
                        </Button>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setBulkTransferOpen(false)}
                          disabled={isBulkTransferring}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {isMobile ? (
                  // Narrow screens: the multi-column resizable table can't fit, so fall
                  // back to a compact single-line-per-object list (icon + type + id).
                  <div className="max-h-[min(70vh,720px)] overflow-y-auto divide-y divide-border/50">
                    {plainObjectRows}
                  </div>
                ) : (
                  <DataTable
                    // Distinct column set (and therefore distinct column ids) for the
                    // Walrus Memory tab - remount rather than reuse so DataTable's
                    // internal column order/sizing state doesn't carry over stale ids.
                    key={
                      activeCategory === 'memory'
                        ? 'memory-columns'
                        : activeCategory === 'nft'
                          ? 'nft-columns'
                          : 'default-columns'
                    }
                    columns={
                      activeCategory === 'memory'
                        ? memoryTableColumns
                        : activeCategory === 'nft'
                          ? nftTableColumns
                          : tableColumns
                    }
                    data={visibleObjects}
                    getRowId={getObjectRowId}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    onRowClick={(obj) => {
                      setSelectedObject(obj);
                      const clickedId =
                        (obj.objectId as string) || (obj.data as { objectId?: string })?.objectId;
                      if (clickedId) {
                        navigate(`/app/objects/${clickedId}`);
                      }
                    }}
                    rowHeight={56}
                    // Click a row (or its chevron) to expand a richer attributes panel -
                    // owner, digest, previous tx, storage rebate, transferable, Display -
                    // fetched lazily per row. "View full details" inside opens the object page.
                    renderExpanded={(obj) => (
                      <ObjectAttributePanel
                        objectId={
                          (obj.objectId as string) ||
                          (obj.data as { objectId?: string })?.objectId ||
                          ''
                        }
                        baseType={(obj.type as string) || (obj.data as { type?: string })?.type}
                        baseVersion={
                          (obj.version as string) || (obj.data as { version?: string })?.version
                        }
                        baseOwner={
                          (obj.owner as unknown) ?? (obj.data as { owner?: unknown })?.owner
                        }
                      />
                    )}
                    expandedRowHeight={300}
                    // Fixed 560px used to leave a lot of dead space below the scrollable box on
                    // tall viewports - the visible table card looked taller than the actual
                    // wheel-scrollable region, so scrolling only worked in a narrow strip instead
                    // of anywhere over the table (bad UX - had to hunt for the real scrollbar).
                    // Scales with the viewport instead, bounded so it never gets unreasonably short.
                    className="h-[min(70vh,720px)] min-h-[320px]"
                  />
                )}
              </div>
            )}
          </>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="mt-3 px-1 py-2 border-t border-border flex items-center justify-between text-xs text-tertiary">
        <span>
          {visibleObjects.length}/{objects.length} objects
        </span>
        <span>Click to inspect</span>
      </div>
    </div>
  );
}
