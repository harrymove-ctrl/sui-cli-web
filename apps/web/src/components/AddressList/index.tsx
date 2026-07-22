import { clsx } from 'clsx';
import { Archive, Copy, ExternalLink, KeyRound, Package, Plus, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { UserGlassIcon } from '@/components/icons/UserGlassIcon';
import { Tooltip } from '@/components/ui/tooltip';
import {
  buildExplorerUrl,
  detectNetwork,
  getDefaultExplorer,
  type NetworkType,
} from '@/lib/explorer';
import { useAppStore } from '@/stores/useAppStore';
import type { SuiAddress } from '@/types';
import { AddressMetadata, addressMetadata } from '@/utils/addressMetadata';
import { useSmartPolling } from '@/utils/useSmartPolling';
import { Spinner } from '../shared/Spinner';
import { ExportPrivateKeyDialog } from './ExportPrivateKeyDialog';

// Format balance with thousand separators
function formatBalance(balance: string | undefined): string {
  if (!balance) return '0';
  const num = parseFloat(balance);
  if (isNaN(num)) return '0';
  // Show 4 decimals for small numbers, 2 for larger
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toFixed(2);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Memoized AddressCard component for optimal performance
interface AddressCardProps {
  addr: SuiAddress;
  addrMetadata?: AddressMetadata;
  isEditing: boolean;
  editingField: 'label' | 'notes' | null;
  editValue: string;
  editInputRef: React.RefObject<HTMLInputElement>;
  currentNetwork: NetworkType;
  onSwitch: (address: string) => void;
  onDelete: (address: string, alias?: string) => void;
  onCopy: (address: string) => void;
  onViewObjects: (address: string) => void;
  onOpenExplorer: (address: string) => void;
  onContextMenu: (e: React.MouseEvent, address: string) => void;
  startEdit: (address: string, field: 'label' | 'notes', value: string) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  setEditValue: (value: string) => void;
}

const AddressCard = memo(
  ({
    addr,
    addrMetadata,
    isEditing,
    editingField,
    editValue,
    editInputRef,
    currentNetwork,
    onSwitch,
    onDelete,
    onCopy,
    onViewObjects,
    onOpenExplorer,
    onContextMenu,
    startEdit,
    saveEdit,
    cancelEdit,
    setEditValue,
  }: AddressCardProps) => {
    return (
      <div
        className={clsx(
          'rounded-lg transition-all duration-150 relative group',
          addr.isActive ? 'bg-accent' : 'hover:bg-accent/50'
        )}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, addr.address);
        }}
      >
        <div
          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
          onClick={() => !addr.isActive && !isEditing && onSwitch(addr.address)}
        >
          {/* Avatar */}
          <span
            className={clsx(
              'flex-shrink-0 inline-flex items-center justify-center transition-transform',
              addr.isActive && 'scale-110'
            )}
          >
            <UserGlassIcon size={20} />
          </span>

          {/* Address info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={clsx(
                  'text-sm truncate transition-colors',
                  addr.isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {addr.alias || `${addr.address.slice(0, 8)}...${addr.address.slice(-6)}`}
              </span>
              {addr.isActive && (
                <Badge variant="outline" className="border-[#4da2ff]/30 text-[#4da2ff] text-[10px]">
                  Active
                </Badge>
              )}
            </div>

            {/* Label with inline edit */}
            {isEditing && editingField === 'label' ? (
              <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={editInputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  onBlur={saveEdit}
                  className="flex-1 px-2 py-0.5 bg-black/30 border border-[#4da2ff]/50 rounded text-xs text-white"
                  placeholder="label..."
                />
              </div>
            ) : addrMetadata?.label ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(addr.address, 'label', addrMetadata.label);
                }}
                className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer mt-0.5"
              >
                {addrMetadata.label}
              </div>
            ) : null}

            {/* Notes */}
            {isEditing && editingField === 'notes' ? (
              <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={editInputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  onBlur={saveEdit}
                  className="flex-1 px-2 py-0.5 bg-black/30 border border-[#4da2ff]/50 rounded text-xs text-white"
                  placeholder="notes..."
                />
              </div>
            ) : addrMetadata?.notes ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(addr.address, 'notes', addrMetadata.notes);
                }}
                className="text-[10px] text-tertiary hover:text-muted-foreground cursor-pointer truncate"
              >
                {addrMetadata.notes}
              </div>
            ) : null}

            <div
              className={clsx(
                'text-xs truncate mt-0.5 font-mono',
                addr.isActive ? 'text-muted-foreground' : 'text-tertiary'
              )}
            >
              {addr.address}
            </div>
          </div>

          {/* Balance */}
          <div className="text-right flex-shrink-0">
            <div
              className={clsx('text-sm', addr.isActive ? 'text-[#4da2ff]' : 'text-foreground')}
            >
              {formatBalance(addr.balance)}{' '}
              <span className="text-muted-foreground">SUI</span>
            </div>
          </div>

          {/* Actions - show on hover */}
          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip content="View objects" side="bottom">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewObjects(addr.address);
                }}
                className="p-1.5 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-foreground"
              >
                <Package className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <Tooltip content="Open in explorer" side="bottom">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenExplorer(addr.address);
                }}
                className="p-1.5 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <Tooltip content="Copy address" side="bottom">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(addr.address);
                }}
                className="p-1.5 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-foreground"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            {!addr.isActive && (
              <Tooltip content="Delete address" side="bottom">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(addr.address, addr.alias);
                  }}
                  className="p-1.5 hover:bg-destructive/20 rounded-md transition-colors text-destructive/70 hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for optimal memoization
    return (
      prevProps.addr.address === nextProps.addr.address &&
      prevProps.addr.isActive === nextProps.addr.isActive &&
      prevProps.addr.balance === nextProps.addr.balance &&
      prevProps.addr.alias === nextProps.addr.alias &&
      prevProps.isEditing === nextProps.isEditing &&
      prevProps.editingField === nextProps.editingField &&
      prevProps.editValue === nextProps.editValue &&
      prevProps.addrMetadata?.label === nextProps.addrMetadata?.label &&
      prevProps.addrMetadata?.notes === nextProps.addrMetadata?.notes &&
      prevProps.currentNetwork === nextProps.currentNetwork
    );
  }
);

export function AddressList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    addresses,
    environments,
    isLoading,
    searchQuery,
    fetchAddresses,
    switchAddress,
    createAddress,
    removeAddress,
  } = useAppStore();

  // Get current network from active environment
  const activeEnv = environments.find((e) => e.isActive);
  const currentNetwork: NetworkType = detectNetwork(activeEnv?.alias, activeEnv?.rpc);

  // URL params for action
  const actionParam = searchParams.get('action');
  const [showCreateForm, setShowCreateForm] = useState(() => actionParam === 'new');
  const [newAlias, setNewAlias] = useState('');
  const [keyScheme, setKeyScheme] = useState<'ed25519' | 'secp256k1' | 'secp256r1'>('ed25519');

  // Inline editing state
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'label' | 'notes' | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Export/Import state
  const [showExportImport, setShowExportImport] = useState(() => actionParam === 'import');

  // Sync state when URL changes (e.g., from FileTree navigation)
  useEffect(() => {
    if (actionParam === 'new' && !showCreateForm) {
      setShowCreateForm(true);
    } else if (actionParam === 'import' && !showExportImport) {
      setShowExportImport(true);
    }
  }, [actionParam]);

  // Address metadata state
  const [metadata, setMetadata] = useState<Map<string, AddressMetadata>>(new Map());

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; address: string } | null>(
    null
  );

  // Debounced search query for performance
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const [isSearching, setIsSearching] = useState(false);

  // Delete confirmation dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<{ address: string; alias?: string } | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportTarget, setExportTarget] = useState<{ address: string; alias?: string } | null>(null);

  // Initial load
  useEffect(() => {
    fetchAddresses();
    // Load metadata for all addresses
    const allMetadata = addressMetadata.getAll();
    const metaMap = new Map<string, AddressMetadata>();
    allMetadata.forEach((m) => metaMap.set(m.address, m));
    setMetadata(metaMap);
  }, [fetchAddresses]);

  // Smart polling with adaptive intervals
  useSmartPolling({
    onPoll: fetchAddresses,
    initialInterval: 15000, // 15s when tab is visible
    maxInterval: 60000, // 60s when tab is hidden
    enabled: addresses.length > 0, // Only poll if we have addresses
  });

  // Debounce search query (300ms delay)
  useEffect(() => {
    if (searchQuery !== debouncedSearchQuery) {
      setIsSearching(true);
    }
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearchQuery]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingAddress && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingAddress, editingField]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // Memoize filtered and sorted addresses with debounced search
  const sortedAddresses = useMemo(() => {
    const filtered = addresses.filter((addr) => {
      if (!debouncedSearchQuery) return true;
      const query = debouncedSearchQuery.toLowerCase();
      const addrMeta = metadata.get(addr.address);
      return (
        addr.address.toLowerCase().includes(query) ||
        addr.alias?.toLowerCase().includes(query) ||
        addrMeta?.label?.toLowerCase().includes(query) ||
        addrMeta?.notes?.toLowerCase().includes(query)
      );
    });

    // Sort: active first, then by balance
    return [...filtered].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const balA = parseFloat(a.balance || '0');
      const balB = parseFloat(b.balance || '0');
      return balB - balA;
    });
  }, [addresses, debouncedSearchQuery, metadata]);

  // Memoize handlers to prevent re-renders
  const handleSwitch = useCallback(
    async (address: string) => {
      try {
        await switchAddress(address);
        toast.success('Address switched successfully');
      } catch (error) {
        toast.error(String(error));
      }
    },
    [switchAddress]
  );

  const handleCreate = useCallback(async () => {
    try {
      const result = await createAddress(keyScheme, newAlias || undefined);
      toast.success(`Created address: ${result.address.slice(0, 10)}...`);
      if (result.phrase) {
        toast.success('Recovery phrase copied to clipboard');
        navigator.clipboard.writeText(result.phrase);
      }
      setShowCreateForm(false);
      setNewAlias('');
    } catch (error) {
      toast.error(String(error));
    }
  }, [createAddress, keyScheme, newAlias]);

  const copyAddress = useCallback((address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard');
  }, []);

  // View objects for an address - switch to it first then navigate
  const handleViewObjects = useCallback(
    async (address: string) => {
      try {
        // Switch to the address first if not active
        const targetAddr = addresses.find((a) => a.address === address);
        if (targetAddr && !targetAddr.isActive) {
          await switchAddress(address);
        }
        // Navigate to objects page
        navigate('/app/objects');
      } catch (error) {
        toast.error(String(error));
      }
    },
    [addresses, switchAddress, navigate]
  );

  // Open address in explorer
  const handleOpenExplorer = useCallback(
    (address: string) => {
      const explorer = getDefaultExplorer();
      const url = buildExplorerUrl(explorer, currentNetwork, 'address', address);
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [currentNetwork]
  );

  // Request delete confirmation (opens dialog)
  const handleDelete = useCallback((address: string, alias?: string) => {
    setDeleteError(null);
    setDeleteConfirm({ address, alias });
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteConfirm(null);
    setDeleteError(null);
  }, []);

  // Confirm delete (actual deletion). On failure the dialog stays open with
  // the real error shown inline - it used to close either way, which made a
  // rejected delete (e.g. "cannot remove active address") look like nothing
  // happened once the easy-to-miss toast disappeared.
  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const { address } = deleteConfirm;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await removeAddress(address);
      // Also remove metadata
      addressMetadata.delete(address);
      const newMeta = new Map(metadata);
      newMeta.delete(address);
      setMetadata(newMeta);
      toast.success('Address deleted successfully');
      setDeleteConfirm(null);
    } catch (error) {
      setDeleteError(String(error));
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirm, removeAddress, metadata]);

  // Start editing
  const startEdit = useCallback(
    (address: string, field: 'label' | 'notes', currentValue: string) => {
      setEditingAddress(address);
      setEditingField(field);
      setEditValue(currentValue || '');
    },
    []
  );

  // Save edit
  const saveEdit = useCallback(() => {
    if (!editingAddress || !editingField) return;

    const updates: Partial<AddressMetadata> = {};
    if (editingField === 'label') {
      updates.label = editValue.trim();
    } else if (editingField === 'notes') {
      updates.notes = editValue.trim();
    }

    addressMetadata.set(editingAddress, updates);

    // Update local state
    const newMeta = new Map(metadata);
    const existing = newMeta.get(editingAddress) || { address: editingAddress };
    newMeta.set(editingAddress, { ...existing, ...updates });
    setMetadata(newMeta);

    setEditingAddress(null);
    setEditingField(null);
    setEditValue('');
    toast.success('Saved');
  }, [editingAddress, editingField, editValue, metadata]);

  // Cancel edit
  const cancelEdit = useCallback(() => {
    setEditingAddress(null);
    setEditingField(null);
    setEditValue('');
  }, []);

  // Export metadata
  const handleExport = useCallback(() => {
    const json = addressMetadata.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sui-wallet-metadata-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Metadata exported');
  }, []);

  // Import metadata
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const result = addressMetadata.importFromJSON(json);
        if (result.success) {
          toast.success(`Imported ${result.imported} address(es)`);
          // Reload metadata
          const allMetadata = addressMetadata.getAll();
          const metaMap = new Map<string, AddressMetadata>();
          allMetadata.forEach((m) => metaMap.set(m.address, m));
          setMetadata(metaMap);
          setShowExportImport(false);
        } else {
          toast.error(result.error || 'Import failed');
        }
      } catch (error) {
        toast.error('Invalid file format');
      }
    };
    reader.readAsText(file);
  }, []);

  if (isLoading && addresses.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {addresses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {sortedAddresses.length !== addresses.length
                  ? `${sortedAddresses.length} of ${addresses.length}`
                  : `${addresses.length}`}{' '}
                address{addresses.length !== 1 ? 'es' : ''}
              </span>
              {isSearching && <span className="text-warning animate-pulse">searching...</span>}
            </div>
            <div className="flex items-center gap-3">
              <Tooltip content="Export/import metadata" side="bottom">
                <button
                  onClick={() => setShowExportImport(!showExportImport)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                >
                  <Archive className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Export/Import panel */}
          {showExportImport && (
            <div className="p-4 rounded-lg border border-border bg-secondary/50 space-y-3">
              <div className="text-xs font-medium uppercase tracking-wider text-tertiary">
                Backup &amp; restore
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={handleExport}>
                  Export JSON
                </Button>
                <label>
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <span className="cursor-pointer">
                      Import JSON
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="hidden"
                      />
                    </span>
                  </Button>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Backs up labels, notes, and other local metadata.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create new address */}
      {showCreateForm ? (
        <div className="p-4 rounded-lg border border-border bg-secondary/50 space-y-3">
          <div className="text-sm font-medium text-foreground">New address</div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Alias</label>
              <input
                type="text"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder="my-wallet"
                className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-[#4da2ff]/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Key scheme</label>
              <select
                value={keyScheme}
                onChange={(e) =>
                  setKeyScheme(e.target.value as 'ed25519' | 'secp256k1' | 'secp256r1')
                }
                className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-[#4da2ff]/50 transition-colors cursor-pointer"
              >
                <option value="ed25519">ed25519 (recommended)</option>
                <option value="secp256k1">secp256k1</option>
                <option value="secp256r1">secp256r1</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={handleCreate}>
                Create
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowCreateForm(true)}
          className="w-full border-dashed"
        >
          <Plus className="w-4 h-4" />
          New address
        </Button>
      )}

      {/* Address list */}
      {sortedAddresses.length === 0 ? (
        <div className="px-3 py-8 text-center text-muted-foreground">No addresses found</div>
      ) : (
        <div className="space-y-1">
          {sortedAddresses.map((addr) => {
            const addrMetadata = metadata.get(addr.address);
            const isEditing = editingAddress === addr.address;

            return (
              <AddressCard
                key={addr.address}
                addr={addr}
                addrMetadata={addrMetadata}
                isEditing={isEditing}
                editingField={editingField}
                editValue={editValue}
                editInputRef={editInputRef}
                currentNetwork={currentNetwork}
                onSwitch={handleSwitch}
                onDelete={handleDelete}
                onCopy={copyAddress}
                onViewObjects={handleViewObjects}
                onOpenExplorer={handleOpenExplorer}
                onContextMenu={(e, address) => {
                  setContextMenu({ x: e.clientX, y: e.clientY, address });
                }}
                startEdit={startEdit}
                saveEdit={saveEdit}
                cancelEdit={cancelEdit}
                setEditValue={setEditValue}
              />
            );
          })}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-background border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const addr = sortedAddresses.find((a) => a.address === contextMenu.address);
              const meta = metadata.get(contextMenu.address);
              startEdit(contextMenu.address, 'label', meta?.label || '');
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-accent/10 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            {metadata.get(contextMenu.address)?.label ? 'Edit Label' : 'Add Label'}
          </button>
          <button
            onClick={() => {
              const meta = metadata.get(contextMenu.address);
              startEdit(contextMenu.address, 'notes', meta?.notes || '');
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-accent/10 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            {metadata.get(contextMenu.address)?.notes ? 'Edit Notes' : 'Add Notes'}
          </button>
          <button
            onClick={() => {
              const addr = sortedAddresses.find((a) => a.address === contextMenu.address);
              setExportTarget({ address: contextMenu.address, alias: addr?.alias });
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-accent/10 transition-colors flex items-center gap-2 text-red-400"
          >
            <KeyRound className="w-4 h-4" />
            Export Private Key
          </button>
        </div>
      )}

      <ExportPrivateKeyDialog
        isOpen={!!exportTarget}
        address={exportTarget?.address ?? ''}
        alias={exportTarget?.alias}
        onClose={() => setExportTarget(null)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Delete Address"
        message={`Are you sure you want to delete "${deleteConfirm?.alias || (deleteConfirm?.address ? `${deleteConfirm.address.slice(0, 8)}...${deleteConfirm.address.slice(-6)}` : '')}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        errorMessage={deleteError}
        isConfirming={isDeleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
