import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getDynamicFields } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '../shared/Spinner';
import toast from 'react-hot-toast';
import { Link2, Eye, Search, Copy, ExternalLink, ChevronDown, RefreshCw, ArrowRight } from 'lucide-react';

interface DynamicField {
  name: any;
  bcsName: string;
  type: string;
  objectType: string;
  objectId: string;
  version: string;
  digest: string;
}

// Parse field key from name object
function parseFieldKey(name: any): { type: string; value: string; displayType: string; displayValue: string } {
  if (typeof name === 'object' && name !== null) {
    const type = name.type || 'unknown';
    const value = name.value || JSON.stringify(name);

    // Human-readable type (remove package prefix)
    const displayType = type.split('::').pop() || type;

    // Shortened value for display
    const displayValue = typeof value === 'string' && value.length > 20
      ? `${value.slice(0, 10)}...${value.slice(-8)}`
      : String(value);

    return { type, value, displayType, displayValue };
  }
  return {
    type: 'string',
    value: String(name),
    displayType: 'string',
    displayValue: String(name)
  };
}

// Get short type name from full type path
function getShortTypeName(fullType: string): string {
  const parts = fullType.split('::');
  return parts[parts.length - 1] || fullType;
}

// Get package ID from full type
function getPackageId(fullType: string): string {
  const parts = fullType.split('::');
  if (parts[0] && parts[0].startsWith('0x')) {
    return parts[0].length > 16 ? `${parts[0].slice(0, 8)}...${parts[0].slice(-6)}` : parts[0];
  }
  return '';
}

// Get type-based styling
function getTypeStyle(objectType: string): { icon: string; colorClass: string; bgClass: string; borderClass: string } {
  const type = objectType.toLowerCase();
  if (type.includes('table')) return { icon: '📊', colorClass: 'text-cyan-400', bgClass: 'bg-cyan-500/20', borderClass: 'border-cyan-500/30' };
  if (type.includes('bag')) return { icon: '🎒', colorClass: 'text-purple-400', bgClass: 'bg-purple-500/20', borderClass: 'border-purple-500/30' };
  if (type.includes('vec') || type.includes('vector')) return { icon: '📋', colorClass: 'text-green-400', bgClass: 'bg-green-500/20', borderClass: 'border-green-500/30' };
  if (type.includes('item') || type.includes('nft') || type.includes('character')) return { icon: '🎮', colorClass: 'text-orange-400', bgClass: 'bg-orange-500/20', borderClass: 'border-orange-500/30' };
  if (type.includes('coin')) return { icon: '🪙', colorClass: 'text-yellow-400', bgClass: 'bg-yellow-500/20', borderClass: 'border-yellow-500/30' };
  return { icon: '📦', colorClass: 'text-blue-400', bgClass: 'bg-blue-500/20', borderClass: 'border-blue-500/30' };
}

export function DynamicFieldExplorer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [objectId, setObjectId] = useState('');
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [queriedObjectId, setQueriedObjectId] = useState<string>('');
  const [expandedFields, setExpandedFields] = useState<Set<number>>(new Set());
  const [autoQueried, setAutoQueried] = useState(false);

  // Auto-fill and query from URL param
  useEffect(() => {
    const urlObjectId = searchParams.get('objectId');
    if (urlObjectId && !autoQueried) {
      setObjectId(urlObjectId);
      setAutoQueried(true);
      setTimeout(() => {
        handleQueryWithId(urlObjectId);
      }, 100);
    }
  }, [searchParams, autoQueried]);

  const handleQueryWithId = async (id: string, cursor?: string) => {
    if (!id.trim() && !cursor) {
      toast.error('Please enter an object ID');
      return;
    }

    setIsLoading(true);
    try {
      const result = await getDynamicFields(
        cursor ? queriedObjectId : id,
        cursor,
        50
      );

      if (!cursor) {
        setFields(result.data);
        setQueriedObjectId(id);
        setExpandedFields(new Set()); // Collapse all on new query
      } else {
        setFields(prev => [...prev, ...result.data]);
      }

      setHasNextPage(result.hasNextPage);
      setNextCursor(result.nextCursor);

      if (result.data.length === 0 && !cursor) {
        // Don't show toast, we have a nice empty state
      } else if (!cursor) {
        toast.success(`Found ${result.data.length} field${result.data.length !== 1 ? 's' : ''}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to query dynamic fields';
      toast.error(message);
      if (!cursor) {
        setFields([]);
        setHasNextPage(false);
        setNextCursor(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuery = async (cursor?: string) => {
    await handleQueryWithId(objectId, cursor);
  };

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedFields(newExpanded);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const handleViewObject = (objectId: string) => {
    navigate(`/app/objects/${objectId}`);
  };

  const handleExploreFields = (newObjectId: string) => {
    setObjectId(newObjectId);
    handleQueryWithId(newObjectId);
  };

  const handleOpenExplorer = (objectId: string) => {
    // Default to testnet, could be made dynamic based on active env
    window.open(`https://suiscan.xyz/testnet/object/${objectId}`, '_blank');
  };

  return (
    <div className="px-2 py-2 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Link2 className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Dynamic Fields</h1>
      </div>

      {/* Search Input */}
      <div className="px-1">
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <label className="block text-xs font-medium text-muted-foreground">
            Parent object ID
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={objectId}
                onChange={(e) => setObjectId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleQuery();
                  }
                }}
                placeholder="0x..."
                className="w-full pl-10 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm font-mono text-foreground placeholder:text-tertiary focus:outline-none focus:border-[#4da2ff]/50 transition-colors"
                disabled={isLoading}
              />
            </div>
            <Button onClick={() => handleQuery()} disabled={isLoading || !objectId.trim()}>
              {isLoading ? 'Querying...' : 'Query'}
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading && fields.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : fields.length > 0 ? (
        <div className="space-y-4">
          {/* Parent Object Card */}
          <div className="px-1">
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Parent object</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleQueryWithId(queriedObjectId)}
                  title="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div
                className="text-sm font-mono text-foreground truncate cursor-pointer hover:text-[#4da2ff] transition-colors flex items-center gap-2"
                onClick={() => copyToClipboard(queriedObjectId, 'Object ID')}
              >
                <span className="truncate">{queriedObjectId}</span>
                <Copy className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary">
                  {fields.length} field{fields.length !== 1 ? 's' : ''}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => handleViewObject(queriedObjectId)}>
                  <Eye className="w-3.5 h-3.5" />
                  View object
                </Button>
              </div>
            </div>
          </div>

          {/* Fields List */}
          <div className="space-y-3 px-1">
            {fields.map((field, index) => {
              const isExpanded = expandedFields.has(index);
              const keyInfo = parseFieldKey(field.name);
              const typeStyle = getTypeStyle(field.objectType);
              const shortType = getShortTypeName(field.objectType);

              return (
                <div
                  key={`${field.objectId}-${index}`}
                  className="rounded-xl bg-card border border-border overflow-hidden"
                >
                  {/* Field Header */}
                  <div
                    className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => toggleExpanded(index)}
                  >
                    <div className={`w-9 h-9 rounded-lg ${typeStyle.bgClass} flex items-center justify-center text-lg`}>
                      {typeStyle.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-medium ${typeStyle.colorClass}`}>
                          {shortType}
                        </span>
                        <span className="text-xs text-tertiary">•</span>
                        <span className="text-xs text-muted-foreground">
                          Field {index + 1}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {field.objectId.slice(0, 12)}...{field.objectId.slice(-8)}
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3 border-t border-border">
                      {/* Key Section */}
                      <div className="pt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">🔑</span>
                          <span className="text-xs font-medium text-muted-foreground">Key</span>
                        </div>
                        <div className="p-3 bg-secondary rounded-lg border border-border space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Type</span>
                            <span className="text-xs font-mono text-foreground">{keyInfo.displayType}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">Value</span>
                            <div
                              className="text-xs font-mono text-foreground truncate cursor-pointer hover:text-[#4da2ff] flex items-center gap-1 max-w-[200px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(keyInfo.value, 'Key value');
                              }}
                            >
                              <span className="truncate">{keyInfo.displayValue}</span>
                              <Copy className="w-3 h-3 flex-shrink-0 opacity-50" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex justify-center">
                        <ArrowRight className="w-4 h-4 text-tertiary rotate-90" />
                      </div>

                      {/* Value Section */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{typeStyle.icon}</span>
                          <span className="text-xs font-medium text-muted-foreground">
                            Value (stored object)
                          </span>
                        </div>
                        <div className="p-3 bg-secondary rounded-lg border border-border space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">Object ID</span>
                            <div
                              className="text-xs font-mono text-foreground truncate cursor-pointer hover:text-[#4da2ff] flex items-center gap-1 max-w-[200px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(field.objectId, 'Object ID');
                              }}
                            >
                              <span className="truncate">{field.objectId.slice(0, 10)}...{field.objectId.slice(-8)}</span>
                              <Copy className="w-3 h-3 flex-shrink-0 opacity-50" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Type</span>
                            <span className={`text-xs font-medium ${typeStyle.colorClass}`}>{shortType}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Version</span>
                            <span className="text-xs font-mono text-foreground">{field.version}</span>
                          </div>
                          {getPackageId(field.objectType) && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Package</span>
                              <span className="text-xs font-mono text-muted-foreground">{getPackageId(field.objectType)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewObject(field.objectId);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View object
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExploreFields(field.objectId);
                          }}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          Explore fields
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenExplorer(field.objectId);
                          }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          SuiScan
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Load More Button */}
          {hasNextPage && (
            <div className="px-1">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleQuery(nextCursor || undefined)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner />
                    Loading more...
                  </span>
                ) : (
                  'Load more fields'
                )}
              </Button>
            </div>
          )}

          {/* Footer Stats */}
          <div className="px-1 text-center">
            <span className="text-xs text-muted-foreground">
              {fields.length} field{fields.length !== 1 ? 's' : ''} loaded
              {hasNextPage && ' • more available'}
            </span>
          </div>
        </div>
      ) : queriedObjectId ? (
        /* Empty State with Education */
        <div className="px-1">
          <div className="p-6 rounded-xl border border-border bg-card text-center">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-foreground font-medium mb-1">No dynamic fields</div>
            <div className="text-xs text-muted-foreground mb-4">This object doesn't have any dynamic fields attached.</div>

            <div className="mt-4 p-4 bg-secondary rounded-lg border border-border text-left">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">💡</span>
                <span className="text-xs font-medium text-foreground">What are dynamic fields?</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-2">
                <p>Dynamic fields let you attach key-value data to objects at runtime without declaring them in the Move struct definition.</p>
                <div className="space-y-1 mt-2">
                  <div className="flex items-center gap-2">
                    <span>🎮</span>
                    <span>Game inventory (items on a character)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🖼️</span>
                    <span>NFT metadata extensions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>⚙️</span>
                    <span>Dynamic configuration storage</span>
                  </div>
                </div>
              </div>
            </div>

            <Button className="mt-4" onClick={() => handleViewObject(queriedObjectId)}>
              View object details
            </Button>
          </div>
        </div>
      ) : (
        /* Initial State */
        <div className="px-1">
          <div className="p-6 rounded-xl border border-border bg-card text-center">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-foreground font-medium mb-1">Explore dynamic fields</div>
            <div className="text-xs text-muted-foreground mb-4">
              Enter an object ID to see its attached dynamic fields
            </div>

            <div className="mt-4 p-4 bg-secondary rounded-lg border border-border text-left">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                What you'll see
              </div>
              <div className="text-xs text-muted-foreground space-y-1.5">
                <div className="flex items-center gap-2">
                  <span>🔑</span>
                  <span>Key type and value for each field</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📦</span>
                  <span>Stored object details (type, version)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🔗</span>
                  <span>Navigation to view or explore nested objects</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
