import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '../shared/Spinner';
import * as api from '@/api/client';
import { getNftMetadata, type NftMetadata } from '@/api/services/objects';
import { DitherAvatar } from '@/components/dither-kit/avatar';
import { useAppStore } from '@/stores/useAppStore';
import { detectNetwork, openInExplorer, EXPLORERS, type NetworkType } from '@/lib/explorer';
import { extractCoinType, isCoinType } from '@sui-cli-web/shared';
import { Link2 } from 'lucide-react';
import {
  getWalrusMemoryAccount,
  decryptWalrusMemoryBlob,
  addWalrusMemoryDelegateKey,
  removeWalrusMemoryDelegateKey,
  type MemwalAccountSummary,
  type DecryptResult,
} from '@/api/services/walrusMemory';

type Tab = 'overview' | 'fields' | 'package' | 'memory' | 'transaction';

interface SuiObjectData {
  objectId?: string;
  type?: string;
  version?: string;
  digest?: string;
  previousTransaction?: string;
  owner?: Record<string, unknown> | string;
  content?: {
    fields?: Record<string, unknown>;
    hasPublicTransfer?: boolean;
  };
  storageRebate?: string;
  data?: SuiObjectData;
}

interface ObjectDetailProps {
  object: SuiObjectData;
  onBack: () => void;
  onCopy: (text: string, label: string) => void;
}

export function ObjectDetail({ object, onBack, onCopy }: ObjectDetailProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [packageSummary, setPackageSummary] = useState<Record<string, unknown> | null>(null);
  const [txBlock, setTxBlock] = useState<Record<string, unknown> | null>(null);
  const [blobContent, setBlobContent] = useState<Record<string, unknown> | null>(null);
  const [isLoadingPackage, setIsLoadingPackage] = useState(false);
  const [isLoadingTx, setIsLoadingTx] = useState(false);
  const [isLoadingBlob, setIsLoadingBlob] = useState(false);
  const [selectedExplorer, setSelectedExplorer] = useState(0);

  const { environments, addresses } = useAppStore();
  const activeEnv = environments.find((e) => e.isActive);
  const currentNetwork: NetworkType = detectNetwork(activeEnv?.alias, activeEnv?.rpc);

  const data = object.data || object;
  const objectId = data.objectId || '';
  const type = data.type || '';
  const version = data.version || '';
  const digest = data.digest || '';
  const previousTransaction = data.previousTransaction || '';
  const owner = data.owner || {};
  const content = data.content || {};
  const fields = content.fields || {};
  const storageRebate = data.storageRebate || '0';
  // `hasPublicTransfer` is never actually populated anywhere in this codebase (checked both
  // client and server) - it silently defaulted to `false`, so this always read "No" regardless
  // of the object's real abilities. Distinguish "confirmed false" from "we never fetched this"
  // so the UI says "Unknown" instead of confidently lying.
  const knowsPublicTransfer = 'hasPublicTransfer' in content;
  const hasPublicTransfer = content.hasPublicTransfer ?? false;

  // Extract package ID from type. Strip any generic parameter (`<...>`) before splitting on
  // '::' - a generic's own type argument (e.g. `Coin<0x2::sui::SUI>`) contains further '::'
  // separators, so splitting the raw type string directly picked up a fragment of the
  // generic instead of the real struct name (real bug: this is what showed a garbled
  // "Coin<0x000...002" breadcrumb title instead of "Coin" for every generic type).
  const outerType = type.split('<')[0];
  const packageId = outerType.split('::')[0] || '';
  const structName = outerType.split('::')[2] || '';

  // Check if this is an UpgradeCap
  const isUpgradeCap = type.includes('::package::UpgradeCap');
  const linkedPackageId = isUpgradeCap ? (fields.package as string | null) : null;

  // Check if this is a Coin type
  const isCoin = isCoinType(type);
  const coinType = isCoin ? extractCoinType(type) : null;
  const coinBalance = isCoin ? (fields.balance as string | undefined) : null;

  // Check if this is a Walrus storage Blob (the actual data object behind a
  // Walrus Memory "memory" - see walrus::blob::Blob for the on-chain struct).
  const isWalrusBlob = type.toLowerCase().includes('::blob::blob');

  // NFT preview - image when the collection carries one, else a generated tile.
  const isNft = type.toLowerCase().includes('nft') || type.toLowerCase().includes('display');
  const [nftMeta, setNftMeta] = useState<NftMetadata | null>(null);
  useEffect(() => {
    if (!isNft || !objectId) return;
    let cancelled = false;
    getNftMetadata([objectId])
      .then((res) => {
        if (!cancelled) setNftMeta(res[0] ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isNft, objectId]);

  // Check if object can have dynamic fields
  // Objects with 'id' field (UID) can have dynamic fields attached
  // Also include container types like Table, Bag, ObjectTable, etc.
  const canHaveDynamicFields = (() => {
    // Container types that store dynamic fields
    const containerTypes = ['Table', 'Bag', 'ObjectBag', 'ObjectTable', 'LinkedTable', 'VecSet', 'VecMap'];
    if (containerTypes.some(t => type.includes(`::${t.toLowerCase()}::`) || structName === t)) {
      return true;
    }
    // Objects with 'id' field (UID) - most custom Move objects
    if (fields.id) {
      return true;
    }
    // Game objects that typically have inventory/dynamic storage
    if (type.toLowerCase().includes('character') || type.toLowerCase().includes('inventory')) {
      return true;
    }
    return false;
  })();

  // Format coin balance
  const formatCoinBalance = (balance: string | undefined, decimals: number = 9) => {
    if (!balance) return '0';
    const balanceBigInt = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const integerPart = balanceBigInt / divisor;
    const fractionalPart = balanceBigInt % divisor;
    let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    fractionalStr = fractionalStr.replace(/0+$/, '') || '0';
    if (fractionalStr.length < 4) fractionalStr = fractionalStr.padEnd(4, '0');
    return `${integerPart}.${fractionalStr}`;
  };

  // Coin action handlers
  const handleCoinTransfer = () => {
    if (coinType) {
      navigate(`/app/coins/transfer?coinId=${objectId}&type=${encodeURIComponent(coinType)}`);
    }
  };

  const handleCoinSplit = () => {
    if (coinType) {
      navigate(`/app/coins/split?coinId=${objectId}&type=${encodeURIComponent(coinType)}`);
    }
  };

  const handleCoinMerge = () => {
    if (coinType) {
      navigate(`/app/coins/merge?coinId=${objectId}&type=${encodeURIComponent(coinType)}`);
    }
  };

  // Load package summary when tab is selected
  useEffect(() => {
    if (activeTab === 'package' && linkedPackageId && !packageSummary) {
      setIsLoadingPackage(true);
      api.getPackageSummary(linkedPackageId)
        .then(setPackageSummary)
        .catch(console.error)
        .finally(() => setIsLoadingPackage(false));
    }
  }, [activeTab, linkedPackageId, packageSummary]);

  // Load transaction when tab is selected
  useEffect(() => {
    if (activeTab === 'transaction' && previousTransaction && !txBlock) {
      setIsLoadingTx(true);
      api.getTransactionBlock(previousTransaction)
        .then(setTxBlock)
        .catch(console.error)
        .finally(() => setIsLoadingTx(false));
    }
  }, [activeTab, previousTransaction, txBlock]);

  // Load full blob content when the Walrus Memory tab is selected. The object
  // list only has `sui client objects --json`'s raw BCS bytes (no decoded
  // struct fields at all), so blob_id/size/certified_epoch/storage have to
  // come from a fresh `sui client object <id> --json` fetch, which decodes
  // them onto `content` directly (no `.fields` nesting, unlike the RPC shape).
  useEffect(() => {
    if (activeTab === 'memory' && isWalrusBlob && objectId && !blobContent) {
      setIsLoadingBlob(true);
      api.getObject(objectId)
        .then((res) => setBlobContent((res as { content?: Record<string, unknown> })?.content ?? {}))
        .catch(console.error)
        .finally(() => setIsLoadingBlob(false));
    }
  }, [activeTab, isWalrusBlob, objectId, blobContent]);

  const getOwnerDisplay = () => {
    if (owner.AddressOwner) {
      return { type: 'Address', value: owner.AddressOwner };
    }
    if (owner.ObjectOwner) {
      return { type: 'Object', value: owner.ObjectOwner };
    }
    if (owner.Shared) {
      return { type: 'Shared', value: `Initial version: ${owner.Shared.initial_shared_version}` };
    }
    if (owner === 'Immutable') {
      return { type: 'Immutable', value: 'Cannot be modified' };
    }
    return { type: 'Unknown', value: JSON.stringify(owner) };
  };

  const ownerInfo = getOwnerDisplay();

  const handleOpenExplorer = (type: 'object' | 'tx' | 'address' | 'package', id: string) => {
    openInExplorer(currentNetwork, type, id, EXPLORERS[selectedExplorer].name);
  };

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'overview', label: 'Overview', show: true },
    { id: 'memory', label: 'Walrus Memory', show: isWalrusBlob },
    { id: 'fields', label: 'Fields', show: Object.keys(fields).length > 0 },
    { id: 'package', label: 'Package', show: !!linkedPackageId },
    { id: 'transaction', label: 'Transaction', show: !!previousTransaction },
  ];

  return (
    <div className="px-2 py-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 mb-3">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {structName || 'Object Details'}
          </div>
          <div className="text-xs text-muted-foreground font-mono truncate">
            {objectId.slice(0, 20)}...{objectId.slice(-8)}
          </div>
        </div>
        <button
          onClick={() => onCopy(objectId, 'Object ID')}
          className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
          title="Copy Object ID"
        >
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-2 mb-3 border-b border-border pb-2">
        {tabs.filter(t => t.show).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-2">
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* NFT preview - big image when the NFT carries one, else a generated
                tile + name + attributes so stat-only NFTs still read visually. */}
            {isNft && (
              <div className="p-4 border border-border rounded-lg flex gap-4 items-start">
                {nftMeta?.imageUrl ? (
                  <img
                    src={nftMeta.imageUrl}
                    alt={(nftMeta?.name || 'NFT').trim()}
                    className="w-28 h-28 rounded-lg object-cover flex-shrink-0 bg-muted"
                    loading="lazy"
                  />
                ) : (
                  // No on-chain image - generative dither-kit pixel avatar seeded by the object id.
                  <DitherAvatar name={objectId || type} size={112} className="rounded-lg flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-foreground truncate">
                    {nftMeta?.name || structName || 'NFT'}
                  </div>
                  <div className="text-xs text-tertiary font-mono truncate mb-2">{type.split('::').slice(-2).join('::')}</div>
                  {nftMeta && nftMeta.attributes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {nftMeta.attributes.map((a) => (
                        <span key={a.label} className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {a.label} <span className="text-foreground font-medium">{a.value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {!nftMeta && <div className="text-xs text-muted-foreground">Loading preview…</div>}
                  {nftMeta && !nftMeta.imageUrl && nftMeta.attributes.length === 0 && (
                    <div className="text-xs text-muted-foreground">This NFT has no on-chain image or attributes.</div>
                  )}
                </div>
              </div>
            )}
            {/* Coin Actions Panel - shown only for Coin objects */}
            {isCoin && coinType && (
              <div className="p-4 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-muted-foreground">Coin Balance</div>
                  <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full border border-border">
                    {coinType.split('::').pop() || 'COIN'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-foreground tabular-nums mb-4">
                  {formatCoinBalance(coinBalance)} {coinType.split('::').pop() || ''}
                </div>
                <div className="text-xs text-muted-foreground mb-2">Quick Actions</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={handleCoinTransfer}
                    className="flex flex-col items-center gap-1.5 p-3 bg-muted/60 hover:bg-accent text-foreground rounded-lg border border-border transition-colors"
                  >
                    <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span className="text-xs font-medium">Transfer</span>
                  </button>
                  <button
                    onClick={handleCoinSplit}
                    className="flex flex-col items-center gap-1.5 p-3 bg-muted/60 hover:bg-accent text-foreground rounded-lg border border-border transition-colors"
                  >
                    <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span className="text-xs font-medium">Split</span>
                  </button>
                  <button
                    onClick={handleCoinMerge}
                    className="flex flex-col items-center gap-1.5 p-3 bg-muted/60 hover:bg-accent text-foreground rounded-lg border border-border transition-colors"
                  >
                    <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a4 4 0 004-4V4M6 10a4 4 0 01-4-4V4m4 6v6a4 4 0 004 4h2" />
                    </svg>
                    <span className="text-xs font-medium">Merge</span>
                  </button>
                </div>
              </div>
            )}

            {/* Type */}
            <InfoRow
              label="Type"
              value={type}
              onCopy={() => onCopy(type, 'Type')}
              truncate
            />

            {/* Version & Digest */}
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Version" value={version} small />
              <InfoRow
                label="Digest"
                value={digest}
                onCopy={() => onCopy(digest, 'Digest')}
                truncate
                small
              />
            </div>

            {/* Owner */}
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Owner ({ownerInfo.type})</div>
              <div className="text-sm font-mono text-foreground break-all">
                {ownerInfo.value.length > 42
                  ? `${ownerInfo.value.slice(0, 20)}...${ownerInfo.value.slice(-8)}`
                  : ownerInfo.value
                }
              </div>
              {ownerInfo.type === 'Address' && (
                <button
                  onClick={() => onCopy(ownerInfo.value, 'Owner address')}
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Copy address
                </button>
              )}
            </div>

            {/* Storage & Transfer */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Storage Rebate</div>
                <div className="text-sm font-mono text-foreground">
                  {(parseInt(storageRebate) / 1_000_000_000).toFixed(6)} SUI
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Public Transfer</div>
                <div
                  className={`text-sm font-medium ${
                    knowsPublicTransfer
                      ? hasPublicTransfer
                        ? 'text-success'
                        : 'text-muted-foreground'
                      : 'text-tertiary'
                  }`}
                  title={
                    knowsPublicTransfer
                      ? undefined
                      : "Not reported by this object's fetch - not the same as \"No\""
                  }
                >
                  {knowsPublicTransfer ? (hasPublicTransfer ? 'Yes' : 'No') : 'Unknown'}
                </div>
              </div>
            </div>

            {/* Explore Dynamic Fields - only show for objects with UID (id field) */}
            {canHaveDynamicFields && (
              <button
                onClick={() => navigate(`/app/dynamic-fields?objectId=${objectId}`)}
                className="w-full p-3 bg-card border border-border rounded-lg hover:bg-accent transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-foreground">
                      Explore Dynamic Fields
                    </div>
                    <div className="text-xs text-muted-foreground">
                      View attached key-value data (Table, Bag, etc.)
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            )}

            {/* Explorer Selector */}
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-muted-foreground">
                  Network: <span className="text-foreground font-medium">{currentNetwork}</span>
                </div>
                <select
                  value={selectedExplorer}
                  onChange={(e) => setSelectedExplorer(Number(e.target.value))}
                  className="text-xs bg-secondary border-none rounded px-2 py-1 text-foreground"
                >
                  {EXPLORERS.map((exp, idx) => (
                    <option key={exp.name} value={idx}>
                      {exp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenExplorer('object', objectId)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Object
                </button>
                {packageId && (
                  <button
                    onClick={() => handleOpenExplorer('package', packageId)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Package
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'memory' && (
          isLoadingBlob ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <WalrusBlobView
              fields={blobContent ?? fields}
              objectId={objectId}
              ownerAddress={ownerInfo.type === 'Address' ? ownerInfo.value : null}
              walletAddresses={addresses}
              onCopy={onCopy}
            />
          )
        )}

        {activeTab === 'fields' && (
          <div className="space-y-2">
            {Object.entries(fields).map(([key, value]) => (
              <FieldItem key={key} name={key} value={value} onCopy={onCopy} />
            ))}
          </div>
        )}

        {activeTab === 'package' && (
          <div>
            {isLoadingPackage ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : packageSummary ? (
              <PackageSummaryView summary={packageSummary} onCopy={onCopy} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Failed to load package summary
              </div>
            )}
          </div>
        )}

        {activeTab === 'transaction' && (
          <div>
            {isLoadingTx ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : txBlock ? (
              <TransactionView tx={txBlock as TransactionBlock} onCopy={onCopy} network={currentNetwork} onOpenExplorer={handleOpenExplorer} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Failed to load transaction
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components

function InfoRow({
  label,
  value,
  onCopy,
  truncate,
  small,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  truncate?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`p-3 bg-muted/30 rounded-lg ${small ? 'p-2' : ''}`}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div
        className={`font-mono text-foreground ${truncate ? 'truncate' : ''} ${
          small ? 'text-xs' : 'text-sm'
        }`}
      >
        {value}
      </div>
      {onCopy && (
        <button
          onClick={onCopy}
          className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Copy
        </button>
      )}
    </div>
  );
}

function FieldItem({
  name,
  value,
  onCopy,
}: {
  name: string;
  value: unknown;
  onCopy: (text: string, label: string) => void;
}) {
  const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  const isObject = typeof value === 'object';

  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-foreground">{name}</span>
        <button
          onClick={() => onCopy(displayValue, name)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Copy
        </button>
      </div>
      {isObject ? (
        <pre className="text-xs font-mono text-foreground overflow-x-auto max-h-32 overflow-y-auto">
          {displayValue}
        </pre>
      ) : (
        <div className="text-sm font-mono text-foreground break-all">
          {displayValue}
        </div>
      )}
    </div>
  );
}

// Walrus `Blob` struct (see walrus::blob::Blob):
//   id, registered_epoch, blob_id, size, encoding_type,
//   certified_epoch: Option<u32>, storage: Storage, deletable
// `Storage` (see walrus::storage_resource::Storage): id, start_epoch, end_epoch, storage_size
const ENCODING_TYPES: Record<number, string> = {
  1: 'RS2 (Reed-Solomon)',
};

function formatBytes(value: unknown): string {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes)) return String(value ?? '0');
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = -1;
  do {
    size /= 1024;
    unitIndex++;
  } while (size >= 1024 && unitIndex < units.length - 1);
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Move `Option<T>` most commonly comes back over the RPC as `{ fields: { vec: [] | [value] } }`
// or `{ vec: [] | [value] }`; a few paths flatten it to the raw value or `null` directly.
function extractOption(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    const vec = (value as { vec?: unknown[]; fields?: { vec?: unknown[] } }).vec
      ?? (value as { fields?: { vec?: unknown[] } }).fields?.vec;
    if (Array.isArray(vec)) return vec.length > 0 ? String(vec[0]) : null;
    return null;
  }
  return String(value);
}

function WalrusBlobView({
  fields,
  objectId,
  ownerAddress,
  walletAddresses,
  onCopy,
}: {
  fields: Record<string, unknown>;
  objectId: string;
  ownerAddress: string | null;
  walletAddresses: { address: string; alias?: string }[];
  onCopy: (text: string, label: string) => void;
}) {
  const blobId = fields.blob_id !== undefined ? String(fields.blob_id) : null;
  const size = fields.size;
  const encodingType = Number(fields.encoding_type ?? -1);
  const registeredEpoch = fields.registered_epoch !== undefined ? String(fields.registered_epoch) : null;
  const certifiedEpoch = extractOption(fields.certified_epoch);
  const deletable = Boolean(fields.deletable);

  const storageRaw = fields.storage as { fields?: Record<string, unknown> } | Record<string, unknown> | undefined;
  const storage = (storageRaw as { fields?: Record<string, unknown> })?.fields ?? (storageRaw as Record<string, unknown>) ?? {};

  return (
    <div className="space-y-3">
      <div className="p-3 bg-muted/40 border border-border rounded-lg">
        <div className="text-xs text-muted-foreground mb-1">
          This object is a receipt on Sui - the actual (encrypted) memory content lives on the
          Walrus storage network, addressed by Blob ID below.
        </div>
      </div>

      {blobId && (
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Blob ID</div>
          <div className="text-sm font-mono text-foreground break-all">{blobId}</div>
          <button
            onClick={() => onCopy(blobId, 'Blob ID')}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Copy
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Size</div>
          <div className="text-sm font-mono text-foreground">{formatBytes(size)}</div>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Encoding</div>
          <div className="text-sm font-mono text-foreground">
            {ENCODING_TYPES[encodingType] || `Type ${encodingType}`}
          </div>
        </div>
      </div>

      <div className="p-3 bg-muted/30 rounded-lg">
        <div className="text-xs text-muted-foreground mb-1">Certification</div>
        {certifiedEpoch ? (
          <div className="text-sm font-medium text-success">
            Certified available on Walrus (epoch {certifiedEpoch})
          </div>
        ) : (
          <div className="text-sm font-medium text-warning">
            Not yet certified - still being distributed to storage nodes
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Registered Epoch</div>
          <div className="text-sm font-mono text-foreground">{registeredEpoch ?? '-'}</div>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Deletable</div>
          <div className="text-sm font-medium text-foreground">{deletable ? 'Yes' : 'No (permanent for storage period)'}</div>
        </div>
      </div>

      {(storage.start_epoch !== undefined || storage.end_epoch !== undefined) && (
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="text-xs text-muted-foreground mb-2">Storage Reservation</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">From epoch: </span>
              <span className="font-mono text-foreground">{String(storage.start_epoch ?? '-')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Until epoch: </span>
              <span className="font-mono text-foreground">{String(storage.end_epoch ?? '-')}</span>
            </div>
            {storage.storage_size !== undefined && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Reserved space: </span>
                <span className="font-mono text-foreground">{formatBytes(storage.storage_size)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <WalrusMemoryDecryptSection
        blobObjectId={objectId}
        ownerAddress={ownerAddress}
        walletAddresses={walletAddresses}
        onCopy={onCopy}
      />
    </div>
  );
}

function WalrusMemoryDecryptSection({
  blobObjectId,
  ownerAddress,
  walletAddresses,
  onCopy,
}: {
  blobObjectId: string;
  ownerAddress: string | null;
  walletAddresses: { address: string; alias?: string; isActive?: boolean }[];
  onCopy: (text: string, label: string) => void;
}) {
  const [accountInfo, setAccountInfo] = useState<MemwalAccountSummary | null | undefined>(undefined);
  const [signerAddress, setSignerAddress] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptResult, setDecryptResult] = useState<DecryptResult | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  const [ownerSignerAddress, setOwnerSignerAddress] = useState('');
  const [delegateAddress, setDelegateAddress] = useState('');
  const [delegateLabel, setDelegateLabel] = useState('');
  const [isAddingDelegate, setIsAddingDelegate] = useState(false);
  const [addDelegateError, setAddDelegateError] = useState<string | null>(null);
  const [addDelegateDigest, setAddDelegateDigest] = useState<string | null>(null);
  const [removingDelegate, setRemovingDelegate] = useState<string | null>(null);
  const [removeDelegateError, setRemoveDelegateError] = useState<string | null>(null);

  const refreshAccountInfo = (owner: string) => {
    setAccountInfo(undefined);
    return getWalrusMemoryAccount(owner)
      .then((res) => setAccountInfo(res.account))
      .catch(() => setAccountInfo(null));
  };

  useEffect(() => {
    // Reset so the owner-signer effect below re-evaluates against the new
    // account instead of keeping a selection picked for a previous one.
    setOwnerSignerAddress('');
    if (!ownerAddress) {
      setAccountInfo(null);
      return;
    }
    refreshAccountInfo(ownerAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerAddress]);

  useEffect(() => {
    if (!signerAddress && walletAddresses.length > 0) {
      const active = walletAddresses.find((a) => a.isActive);
      setSignerAddress(active?.address ?? walletAddresses[0].address);
    }
  }, [walletAddresses, signerAddress]);

  useEffect(() => {
    // Wait for the account lookup to resolve (accountInfo starts `undefined`
    // while in flight) so this doesn't default to the active wallet before
    // the real on-chain owner is known - see refreshAccountInfo above.
    if (ownerSignerAddress || walletAddresses.length === 0 || accountInfo === undefined) return;
    const ownerInWallet = accountInfo?.owner
      ? walletAddresses.find((a) => a.address.toLowerCase() === accountInfo.owner!.toLowerCase())
      : undefined;
    const active = walletAddresses.find((a) => a.isActive);
    setOwnerSignerAddress(ownerInWallet?.address ?? active?.address ?? walletAddresses[0].address);
  }, [walletAddresses, accountInfo, ownerSignerAddress]);

  const handleDecrypt = async () => {
    if (!signerAddress) return;
    setIsDecrypting(true);
    setDecryptError(null);
    setDecryptResult(null);
    try {
      const result = await decryptWalrusMemoryBlob(blobObjectId, signerAddress);
      setDecryptResult(result);
    } catch (err) {
      setDecryptError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleAddDelegate = async () => {
    if (!accountInfo || !ownerSignerAddress || !delegateAddress || !delegateLabel.trim()) return;
    setIsAddingDelegate(true);
    setAddDelegateError(null);
    setAddDelegateDigest(null);
    try {
      const result = await addWalrusMemoryDelegateKey(
        accountInfo.accountId,
        ownerSignerAddress,
        delegateAddress.trim(),
        delegateLabel.trim()
      );
      setAddDelegateDigest(result.digest);
      setDelegateAddress('');
      setDelegateLabel('');
      if (ownerAddress) await refreshAccountInfo(ownerAddress);
    } catch (err) {
      setAddDelegateError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAddingDelegate(false);
    }
  };

  const handleRemoveDelegate = async (delegateToRemove: string) => {
    if (!accountInfo || !ownerSignerAddress) return;
    setRemovingDelegate(delegateToRemove);
    setRemoveDelegateError(null);
    try {
      await removeWalrusMemoryDelegateKey(accountInfo.accountId, ownerSignerAddress, delegateToRemove);
      if (ownerAddress) await refreshAccountInfo(ownerAddress);
    } catch (err) {
      setRemoveDelegateError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemovingDelegate(null);
    }
  };

  return (
    <div className="p-3 bg-muted/30 rounded-lg space-y-3">
      <div className="text-xs text-muted-foreground">Walrus Memory Account</div>
      {accountInfo === undefined ? (
        <div className="text-xs text-muted-foreground">Looking up account…</div>
      ) : accountInfo ? (
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-foreground break-all">{accountInfo.accountId}</span>
            <button
              onClick={() => onCopy(accountInfo.accountId, 'Account ID')}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              Copy
            </button>
          </div>
          <div className={accountInfo.active ? 'text-success' : 'text-warning'}>
            {accountInfo.active ? 'Active' : 'Deactivated'}
          </div>
          {accountInfo.delegateKeys.length > 0 ? (
            <div className="space-y-1">
              <div className="text-muted-foreground">Delegate keys:</div>
              {accountInfo.delegateKeys.map((k) => (
                <div key={k.suiAddress} className="flex items-center justify-between gap-2 pl-2">
                  <span className="text-foreground truncate">
                    {k.label || k.suiAddress.slice(0, 10)}{' '}
                    <span className="text-muted-foreground font-mono">({k.suiAddress.slice(0, 10)}…)</span>
                  </span>
                  <button
                    onClick={() => handleRemoveDelegate(k.suiAddress)}
                    disabled={removingDelegate !== null || !ownerSignerAddress}
                    className="text-error hover:underline flex-shrink-0 disabled:opacity-50"
                  >
                    {removingDelegate === k.suiAddress ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              ))}
              {removeDelegateError && (
                <div className="text-xs text-error bg-error/10 border border-error/20 rounded-lg p-2 break-words">
                  {removeDelegateError}
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground">No delegate keys registered</div>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          {ownerAddress ? 'No Walrus Memory account found for this owner' : 'Owner address unavailable'}
        </div>
      )}

      <div className="border-t border-border pt-3 space-y-2">
        <div className="text-xs text-muted-foreground">
          Decrypt as (address must already be in your local sui.keystore)
        </div>
        <select
          value={signerAddress}
          onChange={(e) => setSignerAddress(e.target.value)}
          className="w-full text-xs bg-secondary border-none rounded px-2 py-2 text-foreground"
        >
          {walletAddresses.map((a) => (
            <option key={a.address} value={a.address}>
              {a.alias || a.address}
            </option>
          ))}
        </select>
        <button
          onClick={handleDecrypt}
          disabled={isDecrypting || !signerAddress}
          className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {isDecrypting ? 'Decrypting…' : 'Decrypt'}
        </button>

        {decryptError && (
          <div className="text-xs text-error bg-error/10 border border-error/20 rounded-lg p-2 break-words">
            {decryptError}
          </div>
        )}

        {decryptResult && (
          <div className="text-xs">
            {decryptResult.isText ? (
              <pre className="whitespace-pre-wrap break-all font-mono text-foreground bg-black/20 rounded-lg p-2 max-h-64 overflow-y-auto">
                {decryptResult.text}
              </pre>
            ) : (
              <div className="text-muted-foreground">
                Binary content ({decryptResult.byteLength} bytes) - not displayable as text.
              </div>
            )}
          </div>
        )}
      </div>

      {accountInfo && (
        <div className="border-t border-border pt-3 space-y-2">
          <div className="text-xs text-muted-foreground">
            Add a delegate account (lets a second address decrypt this account's memories - must be signed by
            the account owner, whose key must be in your local sui.keystore)
          </div>
          <select
            value={ownerSignerAddress}
            onChange={(e) => setOwnerSignerAddress(e.target.value)}
            className="w-full text-xs bg-secondary border-none rounded px-2 py-2 text-foreground"
          >
            {walletAddresses.map((a) => (
              <option key={a.address} value={a.address}>
                Sign as: {a.alias || a.address}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={delegateAddress}
            onChange={(e) => setDelegateAddress(e.target.value)}
            placeholder="Delegate address (0x...)"
            className="w-full text-xs bg-secondary border-none rounded px-2 py-2 text-foreground font-mono placeholder:text-muted-foreground"
          />
          <input
            type="text"
            value={delegateLabel}
            onChange={(e) => setDelegateLabel(e.target.value)}
            placeholder="Label (e.g. Laptop, Mobile App)"
            maxLength={64}
            className="w-full text-xs bg-secondary border-none rounded px-2 py-2 text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={handleAddDelegate}
            disabled={isAddingDelegate || !ownerSignerAddress || !delegateAddress.trim() || !delegateLabel.trim()}
            className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {isAddingDelegate ? 'Adding delegate…' : 'Add delegate account'}
          </button>

          {addDelegateError && (
            <div className="text-xs text-error bg-error/10 border border-error/20 rounded-lg p-2 break-words">
              {addDelegateError}
            </div>
          )}

          {addDelegateDigest && (
            <div className="text-xs text-success bg-success/10 border border-success/20 rounded-lg p-2 break-all">
              Delegate added. Tx: {addDelegateDigest}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PackageModule {
  name: string;
  functions?: Record<string, { visibility?: string; parameters?: unknown[] }>;
  structs?: Record<string, { abilities?: string[] }>;
}

interface PackageSummary {
  packageId: string;
  modules?: PackageModule[];
}

function PackageSummaryView({
  summary,
  onCopy,
}: {
  summary: PackageSummary;
  onCopy: (text: string, label: string) => void;
}) {
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="p-3 bg-muted/30 rounded-lg">
        <div className="text-xs text-muted-foreground mb-1">Package ID</div>
        <div className="text-sm font-mono text-foreground truncate">
          {summary.packageId}
        </div>
        <button
          onClick={() => onCopy(summary.packageId, 'Package ID')}
          className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Copy
        </button>
      </div>

      <div className="text-xs font-medium text-foreground mb-2">
        Modules ({summary.modules?.length || 0})
      </div>

      {summary.modules?.map((module) => (
        <div key={module.name} className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedModule(expandedModule === module.name ? null : module.name)}
            className="w-full flex items-center justify-between p-3 bg-muted/20 hover:bg-muted/40 transition-colors"
          >
            <span className="text-sm font-medium text-foreground">{module.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {Object.keys(module.functions || {}).length} functions
              </span>
              <svg
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  expandedModule === module.name ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {expandedModule === module.name && (
            <div className="p-3 space-y-2">
              {/* Structs */}
              {module.structs && Object.keys(module.structs).length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Structs</div>
                  {Object.entries(module.structs).map(([name, struct]) => (
                    <div key={name} className="text-xs font-mono text-foreground py-1">
                      <span className="text-foreground">{name}</span>
                      <span className="text-muted-foreground ml-2">
                        [{struct.abilities?.join(', ')}]
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Functions */}
              {module.functions && Object.keys(module.functions).length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1 mt-2">Functions</div>
                  {Object.entries(module.functions).map(([name, func]) => (
                    <div key={name} className="text-xs font-mono py-1 flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        func.visibility === 'Public'
                          ? 'bg-success/20 text-success'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {func.visibility === 'Public' ? 'pub' : 'priv'}
                      </span>
                      <span className="text-foreground">{name}</span>
                      <span className="text-muted-foreground">
                        ({func.parameters?.length || 0} params)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface TransactionBlock {
  digest?: string;
  effects?: {
    status?: { status?: string };
    gasUsed?: {
      computationCost?: string;
      storageCost?: string;
      storageRebate?: string;
    };
    executedEpoch?: string;
    created?: Array<{ reference?: { objectId?: string } }>;
  };
  transaction?: {
    data?: {
      transaction?: { kind?: string };
    };
  };
}

function TransactionView({
  tx,
  onCopy,
  network,
  onOpenExplorer,
}: {
  tx: TransactionBlock;
  onCopy: (text: string, label: string) => void;
  network: NetworkType;
  onOpenExplorer: (type: 'object' | 'tx' | 'address' | 'package', id: string) => void;
}) {
  const status = tx.effects?.status?.status || 'unknown';
  const gasUsed = tx.effects?.gasUsed || {};
  const txData = tx.transaction?.data?.transaction || {};

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
        <div className={`w-2 h-2 rounded-full ${status === 'success' ? 'bg-success' : 'bg-error'}`} />
        <span className="text-sm font-medium text-foreground capitalize">{status}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          Epoch {tx.effects?.executedEpoch}
        </span>
      </div>

      {/* Digest */}
      <div className="p-3 bg-muted/30 rounded-lg">
        <div className="text-xs text-muted-foreground mb-1">Transaction Digest</div>
        <div className="text-sm font-mono text-foreground truncate">{tx.digest}</div>
        <button
          onClick={() => onCopy(tx.digest, 'Tx Digest')}
          className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Copy
        </button>
      </div>

      {/* Transaction Kind */}
      <div className="p-3 bg-muted/30 rounded-lg">
        <div className="text-xs text-muted-foreground mb-1">Transaction Type</div>
        <div className="text-sm font-medium text-foreground">{txData.kind || 'Unknown'}</div>
      </div>

      {/* Gas Used */}
      <div className="p-3 bg-muted/30 rounded-lg">
        <div className="text-xs text-muted-foreground mb-2">Gas Used</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Computation: </span>
            <span className="font-mono text-foreground">
              {(parseInt(gasUsed.computationCost || '0') / 1_000_000_000).toFixed(6)} SUI
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Storage: </span>
            <span className="font-mono text-foreground">
              {(parseInt(gasUsed.storageCost || '0') / 1_000_000_000).toFixed(6)} SUI
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Rebate: </span>
            <span className="font-mono text-foreground">
              {(parseInt(gasUsed.storageRebate || '0') / 1_000_000_000).toFixed(6)} SUI
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Total: </span>
            <span className="font-mono text-foreground">
              {(
                (parseInt(gasUsed.computationCost || '0') +
                  parseInt(gasUsed.storageCost || '0') -
                  parseInt(gasUsed.storageRebate || '0')) /
                1_000_000_000
              ).toFixed(6)} SUI
            </span>
          </div>
        </div>
      </div>

      {/* Created Objects */}
      {tx.effects?.created && tx.effects.created.length > 0 && (
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="text-xs text-muted-foreground mb-2">
            Created Objects ({tx.effects.created.length})
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {tx.effects.created.map((obj, i) => (
              <div key={i} className="text-xs font-mono text-foreground truncate">
                {obj.reference?.objectId}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View on Explorer */}
      <button
        onClick={() => tx.digest && onOpenExplorer('tx', tx.digest)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        View on Explorer ({network})
      </button>
    </div>
  );
}
