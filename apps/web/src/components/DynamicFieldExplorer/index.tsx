import {
  AlertTriangle,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  History,
  Info,
  Layers,
  Link2,
  Network,
  Package,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { type DynamicFieldItem, getDynamicFields } from '@/api/services/objects';
import type { ChartConfig } from '@/components/dither-kit/chart-context';
import { Pie } from '@/components/dither-kit/pie';
import { PieChart } from '@/components/dither-kit/pie-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyForAiMenu } from '@/components/ui/copy-for-ai';
import { Tooltip } from '@/components/ui/tooltip';
import { useCopyToClipboard } from '@/hooks';
import { buildAiContext } from '@/lib/ai-context';
import { buildExplorerUrl, detectNetwork, getDefaultExplorer } from '@/lib/explorer';
import { useAppStore } from '@/stores/useAppStore';
import { formatBalance, truncateAddress } from '@/utils/format';
import { Spinner } from '../shared/Spinner';

// Helper to extract short type name (e.g., 0x2::coin::Coin<0x2::sui::SUI> -> Coin<SUI>)
function getShortTypeName(fullType: string): string {
  if (!fullType) return 'unknown';
  return (
    fullType
      .replace(/0x[a-fA-F0-9]{1,64}::/g, '')
      .split('::')
      .pop() || fullType
  );
}

// Parse field key/name info from GraphQL/JSON payload
function parseFieldKey(nameRaw: any): {
  type: string;
  value: string;
  displayType: string;
  displayValue: string;
} {
  if (nameRaw && typeof nameRaw === 'object') {
    const type = nameRaw.type || 'unknown';
    let value = nameRaw.value;
    if (value === undefined && nameRaw.json !== undefined) {
      value = nameRaw.json;
    }
    if (typeof value === 'object' && value !== null) {
      value = JSON.stringify(value);
    } else if (value === undefined) {
      value = JSON.stringify(nameRaw);
    } else {
      value = String(value);
    }

    const displayType = getShortTypeName(type);
    const displayValue =
      typeof value === 'string' && value.length > 24
        ? `${value.slice(0, 12)}...${value.slice(-8)}`
        : String(value);

    return { type, value: String(value), displayType, displayValue };
  }
  return {
    type: 'string',
    value: String(nameRaw ?? 'unknown'),
    displayType: 'string',
    displayValue: String(nameRaw ?? 'unknown'),
  };
}

// Normalized internal field format
interface NormalizedField {
  raw: DynamicFieldItem;
  index: number;
  kind: 'FIELD' | 'OBJECT';
  fieldId: string;
  nameType: string;
  shortNameType: string;
  nameValue: string;
  shortNameValue: string;
  valueType: string;
  shortValueType: string;
  childObjectId: string;
  version: string;
  previousTx: string;
  storageRebate: string;
  storageRebateSui: string;
  jsonContent: any;
}

function normalizeFieldItem(item: DynamicFieldItem, index: number): NormalizedField {
  const kind: 'FIELD' | 'OBJECT' =
    item.kind === 'OBJECT' || item.kind === 'dynamic_object_field' ? 'OBJECT' : 'FIELD';

  const keyInfo = parseFieldKey(item.name);
  const valueType =
    item.valueType ||
    item.fieldObject?.objectType ||
    item.value?.type ||
    item.objectType ||
    'unknown';
  const childObjectId = item.fieldObject?.objectId || item.objectId || item.fieldId || '';
  const version = item.fieldObject?.version || item.version || '1';
  const previousTx = item.fieldObject?.previousTransaction || item.digest || '';
  const storageRebate = item.fieldObject?.storageRebate || '0';
  const storageRebateSui = formatBalance(storageRebate);

  const jsonContent =
    item.fieldObject?.json ||
    item.fieldObject?.contents ||
    item.value?.json ||
    (typeof item.value === 'object' ? item.value : null) ||
    item.name?.json ||
    null;

  return {
    raw: item,
    index,
    kind,
    fieldId: item.fieldId || childObjectId,
    nameType: keyInfo.type,
    shortNameType: keyInfo.displayType,
    nameValue: keyInfo.value,
    shortNameValue: keyInfo.displayValue,
    valueType,
    shortValueType: getShortTypeName(valueType),
    childObjectId,
    version,
    previousTx,
    storageRebate,
    storageRebateSui,
    jsonContent,
  };
}

export function DynamicFieldExplorer() {
  const navigate = useNavigate();
  const { environments } = useAppStore();
  const activeEnv = environments.find((e) => e.isActive);
  const currentNetwork = detectNetwork(activeEnv?.alias, activeEnv?.rpc);
  const [searchParams] = useSearchParams();
  const [objectId, setObjectId] = useState('');
  const [queriedObjectId, setQueriedObjectId] = useState('');
  const [rawFields, setRawFields] = useState<DynamicFieldItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Tabs & filters
  const [activeTab, setActiveTab] = useState<'table' | 'graph' | 'activity'>('table');
  const [kindFilter, setKindFilter] = useState<'ALL' | 'FIELD' | 'OBJECT'>('ALL');
  const [selectedNameTypes, setSelectedNameTypes] = useState<Set<string>>(new Set());
  const [selectedValueTypes, setSelectedValueTypes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showOrphanWarning, setShowOrphanWarning] = useState(true);
  const [autoQueried, setAutoQueried] = useState(false);

  // Graph state for lazy expansion: parentObjectId -> child fields
  const [graphData, setGraphData] = useState<Map<string, DynamicFieldItem[]>>(new Map());
  const [loadingGraphNodes, setLoadingGraphNodes] = useState<Set<string>>(new Set());

  const handleQueryWithId = useCallback(
    async (id: string, cursor?: string) => {
      const cleanId = id.trim();
      if (!cleanId && !cursor) {
        toast.error('Please enter a valid Sui object ID');
        return;
      }

      setIsLoading(true);
      try {
        const result = await getDynamicFields(cursor ? queriedObjectId : cleanId, cursor, 50);

        if (!cursor) {
          setRawFields(result.data);
          setQueriedObjectId(cleanId);
          setExpandedRows(new Set());
          setSelectedNameTypes(new Set());
          setSelectedValueTypes(new Set());
          setGraphData(new Map());
        } else {
          setRawFields((prev) => [...prev, ...result.data]);
        }

        setHasNextPage(result.hasNextPage);
        setNextCursor(result.nextCursor);

        if (!cursor) {
          toast.success(
            `Loaded ${result.data.length} dynamic field${result.data.length !== 1 ? 's' : ''}`
          );
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to fetch dynamic fields';
        toast.error(msg);
        if (!cursor) {
          setRawFields([]);
          setHasNextPage(false);
          setNextCursor(null);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [queriedObjectId]
  );

  // Auto-fill from URL search params
  useEffect(() => {
    const urlObjectId = searchParams.get('objectId');
    if (urlObjectId && !autoQueried) {
      setObjectId(urlObjectId);
      setAutoQueried(true);
      setTimeout(() => {
        handleQueryWithId(urlObjectId);
      }, 100);
    }
  }, [searchParams, autoQueried, handleQueryWithId]);

  const handleQuery = (cursor?: string) => {
    handleQueryWithId(objectId, cursor);
  };

  // Expand graph child dynamic fields
  const handleExpandGraphChild = async (childId: string) => {
    if (graphData.has(childId) || loadingGraphNodes.has(childId)) return;

    setLoadingGraphNodes((prev) => new Set(prev).add(childId));
    try {
      const res = await getDynamicFields(childId, undefined, 20);
      setGraphData((prev) => new Map(prev).set(childId, res.data));
      toast.success(`Expanded ${res.data.length} child fields for ${truncateAddress(childId)}`);
    } catch {
      toast.error(`Could not fetch dynamic fields for child object ${truncateAddress(childId)}`);
      setGraphData((prev) => new Map(prev).set(childId, []));
    } finally {
      setLoadingGraphNodes((prev) => {
        const next = new Set(prev);
        next.delete(childId);
        return next;
      });
    }
  };

  // Normalize all items
  const normalizedFields = useMemo(() => {
    return rawFields.map((f, i) => normalizeFieldItem(f, i));
  }, [rawFields]);

  // Aggregations for composition summary (§2.1)
  const stats = useMemo(() => {
    const total = normalizedFields.length;
    let fieldCount = 0;
    let objectCount = 0;
    const nameTypesMap = new Map<string, number>();
    const valueTypesMap = new Map<string, number>();

    normalizedFields.forEach((f) => {
      if (f.kind === 'OBJECT') objectCount++;
      else fieldCount++;

      nameTypesMap.set(f.nameType, (nameTypesMap.get(f.nameType) || 0) + 1);
      valueTypesMap.set(f.valueType, (valueTypesMap.get(f.valueType) || 0) + 1);
    });

    const distinctNameTypes = Array.from(nameTypesMap.keys());
    const distinctValueTypes = Array.from(valueTypesMap.keys());

    // Donut chart dataset
    const donutData = [
      { name: 'wrapped dynamic_field', count: fieldCount },
      { name: 'child dynamic_object_field', count: objectCount },
    ].filter((d) => d.count > 0);

    const donutConfig: ChartConfig = {
      'wrapped dynamic_field': { label: 'FIELD (wrapped)', color: 'blue' },
      'child dynamic_object_field': { label: 'OBJECT (child)', color: 'green' },
    };

    return {
      total,
      fieldCount,
      objectCount,
      distinctNameTypes,
      distinctValueTypes,
      donutData,
      donutConfig,
      nameTypesMap,
      valueTypesMap,
    };
  }, [normalizedFields]);

  // Filtering
  const filteredFields = useMemo(() => {
    return normalizedFields.filter((f) => {
      if (kindFilter !== 'ALL' && f.kind !== kindFilter) return false;

      if (selectedNameTypes.size > 0 && !selectedNameTypes.has(f.nameType)) return false;
      if (selectedValueTypes.size > 0 && !selectedValueTypes.has(f.valueType)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesKey =
          f.nameValue.toLowerCase().includes(q) || f.nameType.toLowerCase().includes(q);
        const matchesVal =
          f.valueType.toLowerCase().includes(q) || f.childObjectId.toLowerCase().includes(q);
        if (!matchesKey && !matchesVal) return false;
      }

      return true;
    });
  }, [normalizedFields, kindFilter, selectedNameTypes, selectedValueTypes, searchQuery]);

  // Recency sorted fields for Activity tab (§2.4)
  const recencyFields = useMemo(() => {
    return [...filteredFields].sort((a, b) => {
      const vA = parseInt(a.version, 10) || 0;
      const vB = parseInt(b.version, 10) || 0;
      return vB - vA;
    });
  }, [filteredFields]);

  // Copy for AI export (§4)
  const aiExportContext = useMemo(() => {
    if (!queriedObjectId || normalizedFields.length === 0) return null;

    const CAP = 200;
    const capped = normalizedFields.slice(0, CAP);
    const statePayload = {
      parentObjectId: queriedObjectId,
      totalFields: normalizedFields.length,
      fieldKindSplit: {
        wrapped_dynamic_field: stats.fieldCount,
        child_dynamic_object_field: stats.objectCount,
      },
      distinctNameTypesCount: stats.distinctNameTypes.length,
      distinctValueTypesCount: stats.distinctValueTypes.length,
      fields: capped.map((f) => ({
        kind: f.kind,
        nameType: f.nameType,
        nameValue: f.nameValue,
        childObjectId: f.childObjectId,
        valueType: f.valueType,
        version: f.version,
        storageRebate: f.storageRebate,
        previousTransaction: f.previousTx,
        isAddressableByObjectId: f.kind === 'OBJECT',
      })),
    };

    const rules = [
      'dynamic_field (FIELD): Value is wrapped in a Field object. It does NOT have its own key ability and CANNOT be queried independently by object ID.',
      'dynamic_object_field (OBJECT): Value stays its own object with key+store abilities. It IS independently addressable and viewable in object explorers / wallets.',
      'Lazy loading: Dynamic fields cost gas only when accessed in Move (unlike standard struct fields which are loaded together).',
      'Orphaned fields warning: Deleting a parent object UID without deleting attached dynamic fields renders those fields permanently inaccessible and storage rebate unrecoverable.',
      'Limit: Maximum 1000 dynamic fields can be touched in a single transaction.',
    ];

    const markdownTable = [
      `# Dynamic Fields of \`${queriedObjectId}\``,
      '',
      `Total fields: **${stats.total}** (${stats.fieldCount} FIELD wrapped, ${stats.objectCount} OBJECT child)`,
      '',
      '| Kind | Key Type | Key Value | Child Object ID | Value Type | Addressable? | Version |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...capped.map(
        (f) =>
          `| **${f.kind}** | \`${f.shortNameType}\` | \`${f.shortNameValue}\` | \`${f.childObjectId}\` | \`${f.shortValueType}\` | ${
            f.kind === 'OBJECT' ? 'Yes (DOF child)' : 'No (Wrapped DF)'
          } | ${f.version} |`
      ),
    ].join('\n');

    const promptText = buildAiContext({
      title: `Sui Dynamic Fields - ${queriedObjectId}`,
      intro: [
        `Analysis of dynamic fields attached to Sui parent object \`${queriedObjectId}\`.`,
        `Contains ${stats.total} attached fields (${stats.fieldCount} wrapped \`dynamic_field\`s and ${stats.objectCount} child \`dynamic_object_field\`s).`,
      ],
      stateJson: JSON.stringify(statePayload, null, 2),
      endpoints: [
        {
          method: 'GET',
          path: `/api/dynamic-fields/${queriedObjectId}`,
          effect: 'Query attached dynamic fields list for object ID',
        },
      ],
      rules,
      examples: [
        'Explain why I cannot find a wrapped dynamic_field value by its object ID',
        'Identify which dynamic object fields are child objects that can be transferred or inspected',
        'Analyze gas rebate unrecoverable if parent UID is deleted',
      ],
      extra: markdownTable,
    });

    return {
      prompt: promptText,
      json: JSON.stringify(statePayload, null, 2),
      markdown: markdownTable,
    };
  }, [queriedObjectId, normalizedFields, stats]);

  const copyToClipboard = useCopyToClipboard();

  const toggleNameTypeFilter = (type: string) => {
    setSelectedNameTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleValueTypeFilter = (type: string) => {
    setSelectedValueTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleRowExpanded = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Link2 className="w-4.5 h-4.5" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Dynamic Fields Explorer
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Inspect heterogeneous runtime key-value storage attached to Move objects
            (`sui::dynamic_field` & `sui::dynamic_object_field`).
          </p>
        </div>

        {aiExportContext && (
          <CopyForAiMenu
            prompt={aiExportContext.prompt}
            json={aiExportContext.json}
            markdown={aiExportContext.markdown}
            onCopy={copyToClipboard}
          />
        )}
      </div>

      {/* Query Search Bar */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
        <label
          htmlFor="dynamic-fields-object-id"
          className="block text-xs font-medium text-muted-foreground uppercase tracking-wider"
        >
          Parent Object ID
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="dynamic-fields-object-id"
              type="text"
              value={objectId}
              onChange={(e) => setObjectId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuery();
              }}
              placeholder="Enter Sui object ID (e.g., 0x5 or 0x...)"
              className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-sm font-mono text-foreground placeholder:text-tertiary focus:outline-none focus:border-primary/50 transition-colors"
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={() => handleQuery()}
            disabled={isLoading || !objectId.trim()}
            className="px-6 h-10 font-medium"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" /> Querying...
              </span>
            ) : (
              'Query Fields'
            )}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading && normalizedFields.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Spinner size="lg" />
          <p className="text-sm text-muted-foreground animate-pulse">
            Loading dynamic fields from Sui chain...
          </p>
        </div>
      ) : queriedObjectId && normalizedFields.length > 0 ? (
        <div className="space-y-6">
          {/* Section 2.1: Header Composition Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Donut Chart: DF vs DOF Split */}
            <div className="p-5 rounded-xl border border-border bg-card flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Storage Composition
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {stats.total} total
                </Badge>
              </div>

              <div className="flex items-center gap-4 py-2">
                <div className="w-24 h-24 flex-shrink-0">
                  <PieChart
                    data={stats.donutData}
                    config={stats.donutConfig}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={0.65}
                    bloom="low"
                  >
                    <Pie variant="gradient" />
                  </PieChart>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">{stats.fieldCount} FIELD</div>
                      <div className="text-[11px] text-muted-foreground">
                        Wrapped `dynamic_field`
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">
                        {stats.objectCount} OBJECT
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Child `dynamic_object_field`
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Heterogeneous Types Summary */}
            <div className="p-5 rounded-xl border border-border bg-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Heterogeneous Storage
                  </span>
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="grid grid-cols-2 gap-3 my-2">
                  <div className="p-2.5 rounded-lg bg-secondary/60 border border-border">
                    <div className="text-lg font-bold text-foreground">
                      {stats.distinctValueTypes.length}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Distinct Value Types</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/60 border border-border">
                    <div className="text-lg font-bold text-foreground">
                      {stats.distinctNameTypes.length}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Distinct Name Types</div>
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground truncate pt-1">
                Top value type:{' '}
                <span className="font-mono text-foreground font-medium">
                  {getShortTypeName(stats.distinctValueTypes[0] || '')}
                </span>
              </div>
            </div>

            {/* Parent Object Context Card */}
            <div className="p-5 rounded-xl border border-border bg-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Parent Object Context
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleQueryWithId(queriedObjectId)}
                    title="Refresh fields"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <button
                  type="button"
                  className="w-full p-2 rounded-lg bg-secondary/60 border border-border font-mono text-xs text-foreground truncate cursor-pointer hover:text-primary transition-colors flex items-center justify-between text-left"
                  onClick={() => copyToClipboard(queriedObjectId, 'Parent Object ID')}
                >
                  <span className="truncate">{queriedObjectId}</span>
                  <Copy className="w-3.5 h-3.5 flex-shrink-0 opacity-60 ml-2" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/app/objects/${queriedObjectId}`)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Parent Object
                </Button>
                <a
                  href={buildExplorerUrl(
                    getDefaultExplorer(),
                    currentNetwork,
                    'object',
                    queriedObjectId
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  SuiScan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Orphaned Fields & Ability Warning Banner */}
          {showOrphanWarning && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200/90 text-xs relative space-y-1.5">
              <div className="flex items-center justify-between font-semibold text-amber-400">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Important Concept: Dynamic Fields & Orphaned Storage</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOrphanWarning(false)}
                  className="text-amber-400/60 hover:text-amber-300 text-xs px-1"
                >
                  Dismiss
                </button>
              </div>
              <p className="leading-relaxed">
                • <strong>FIELD (`dynamic_field`)</strong> values are <em>wrapped</em> in a `Field`
                struct and carry `store`. They are <strong>not addressable by object ID</strong>.
                <br />• <strong>OBJECT (`dynamic_object_field`)</strong> values retain their
                `key+store` abilities as child objects and <strong>can</strong> be viewed by object
                ID.
                <br />• <strong>Orphaned Fields Footgun:</strong> Deleting a parent object&apos;s
                `UID` without explicitly removing attached fields makes those fields permanently
                inaccessible, locking their storage rebate forever.
              </p>
            </div>
          )}

          {/* View Mode Tabs & Filter Controls */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border pb-3">
              {/* Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-secondary/80 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setActiveTab('table')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === 'table'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Table View
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('graph')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === 'graph'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Network className="w-3.5 h-3.5" />
                  Relationships Graph
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === 'activity'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  Recency Timeline
                </button>
              </div>

              {/* Kind Filter Buttons */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-1">Kind:</span>
                {(['ALL', 'FIELD', 'OBJECT'] as const).map((k) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setKindFilter(k)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                      kindFilter === k
                        ? 'bg-primary/20 text-primary border border-primary/30 font-semibold'
                        : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {k === 'ALL'
                      ? `All (${stats.total})`
                      : k === 'FIELD'
                        ? `FIELD (${stats.fieldCount})`
                        : `OBJECT (${stats.objectCount})`}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Bar: Chips & Search */}
            <div className="p-3 rounded-xl bg-card border border-border space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by key name, value, or object ID..."
                    className="w-full pl-9 pr-3 py-1.5 bg-secondary border border-border rounded-lg text-xs font-mono text-foreground placeholder:text-tertiary focus:outline-none focus:border-primary/50"
                  />
                </div>

                {(selectedNameTypes.size > 0 || selectedValueTypes.size > 0 || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedNameTypes(new Set());
                      setSelectedValueTypes(new Set());
                      setSearchQuery('');
                    }}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              {/* Filter Chips: Name Types */}
              {stats.distinctNameTypes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-tertiary text-[11px] font-medium mr-1">Name Types:</span>
                  {stats.distinctNameTypes.map((t) => {
                    const active = selectedNameTypes.has(t);
                    const short = getShortTypeName(t);
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => toggleNameTypeFilter(t)}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-mono transition-all border ${
                          active
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 font-semibold'
                            : 'bg-secondary/80 text-muted-foreground border-border hover:border-primary/30'
                        }`}
                      >
                        {short} ({stats.nameTypesMap.get(t)})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Filter Chips: Value Types */}
              {stats.distinctValueTypes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-tertiary text-[11px] font-medium mr-1">Value Types:</span>
                  {stats.distinctValueTypes.map((t) => {
                    const active = selectedValueTypes.has(t);
                    const short = getShortTypeName(t);
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => toggleValueTypeFilter(t)}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-mono transition-all border ${
                          active
                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/40 font-semibold'
                            : 'bg-secondary/80 text-muted-foreground border-border hover:border-primary/30'
                        }`}
                      >
                        {short} ({stats.valueTypesMap.get(t)})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Render Tab Views */}
          {filteredFields.length === 0 ? (
            <div className="p-8 text-center bg-card rounded-xl border border-border text-muted-foreground text-xs">
              No dynamic fields match the active filter criteria.
            </div>
          ) : activeTab === 'table' ? (
            /* ================= VIEW 2.2: TABLE VIEW ================= */
            <div className="space-y-3">
              {filteredFields.map((f) => {
                const isExpanded = expandedRows.has(f.index);
                const isObjectKind = f.kind === 'OBJECT';

                return (
                  <div
                    key={`${f.childObjectId}-${f.index}`}
                    className="rounded-xl bg-card border border-border overflow-hidden transition-colors"
                  >
                    {/* Item Row Bar */}
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
                      {/* Kind Badge */}
                      <Tooltip
                        content={
                          isObjectKind
                            ? 'dynamic_object_field (OBJECT): Child object with key+store abilities. Addressable by object ID.'
                            : 'dynamic_field (FIELD): Wrapped value with store ability. NOT addressable by object ID.'
                        }
                        side="right"
                      >
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold tracking-wide border ${
                            isObjectKind
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          }`}
                        >
                          {f.kind}
                        </span>
                      </Tooltip>

                      {/* Key & Value Brief */}
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center text-xs">
                        {/* Name (Key) */}
                        <div className="truncate">
                          <span className="text-tertiary text-[11px] block font-mono">
                            Key ({f.shortNameType})
                          </span>
                          <span className="font-mono text-foreground font-medium truncate">
                            {f.shortNameValue}
                          </span>
                        </div>

                        {/* Value Type */}
                        <div className="truncate">
                          <span className="text-tertiary text-[11px] block font-mono">
                            Value Type
                          </span>
                          <span className="font-mono text-purple-400 truncate font-medium">
                            {f.shortValueType}
                          </span>
                        </div>

                        {/* Child Object ID */}
                        <div className="truncate">
                          <span className="text-tertiary text-[11px] block font-mono">
                            Child ID
                          </span>
                          {isObjectKind ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/app/objects/${f.childObjectId}`);
                              }}
                              className="font-mono text-primary hover:underline truncate cursor-pointer flex items-center gap-1"
                              title="Click to view child object details"
                            >
                              {truncateAddress(f.childObjectId)}
                              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
                            </button>
                          ) : (
                            <Tooltip content="Wrapped dynamic field value — not independently addressable by object ID">
                              <span className="font-mono text-muted-foreground/60 truncate cursor-not-allowed">
                                {truncateAddress(f.childObjectId)} (wrapped)
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleRowExpanded(f.index)}
                        className="p-1 -m-1 rounded hover:bg-accent transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        <ChevronDown
                          className={`w-4 h-4 text-muted-foreground transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {/* Expanded Row Detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border/60 bg-secondary/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
                          {/* Name (Key) Detail Box */}
                          <div className="p-3 rounded-lg bg-card border border-border space-y-2">
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                              <span>🔑 Key Specification</span>
                            </div>
                            <div className="space-y-1.5 font-mono text-[11px]">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Type:</span>
                                <span
                                  className="text-foreground truncate max-w-[240px]"
                                  title={f.nameType}
                                >
                                  {f.nameType}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Value:</span>
                                <span
                                  className="text-foreground truncate max-w-[240px]"
                                  title={f.nameValue}
                                >
                                  {f.nameValue}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Value / Child Object Detail Box */}
                          <div className="p-3 rounded-lg bg-card border border-border space-y-2">
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                              <span>📦 Stored Field Object</span>
                            </div>
                            <div className="space-y-1.5 font-mono text-[11px]">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Kind:</span>
                                <span
                                  className={
                                    isObjectKind
                                      ? 'text-emerald-400 font-semibold'
                                      : 'text-blue-400 font-semibold'
                                  }
                                >
                                  {f.kind === 'OBJECT' ? 'dynamic_object_field' : 'dynamic_field'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Object ID:</span>
                                <span
                                  className="text-foreground truncate max-w-[220px]"
                                  title={f.childObjectId}
                                >
                                  {f.childObjectId}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Version:</span>
                                <span className="text-foreground">{f.version}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Storage Rebate:</span>
                                <span className="text-foreground">
                                  {f.storageRebateSui} SUI ({f.storageRebate} MIST)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions Row */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {isObjectKind ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => navigate(`/app/objects/${f.childObjectId}`)}
                              className="h-8 text-xs gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Child Object
                            </Button>
                          ) : (
                            <Tooltip content="Wrapped dynamic field value — not independently addressable by object ID">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                className="h-8 text-xs gap-1.5 opacity-50 cursor-not-allowed"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Child Unaddressable
                              </Button>
                            </Tooltip>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQueryWithId(f.childObjectId)}
                            className="h-8 text-xs gap-1.5"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            Explore Child Fields
                          </Button>

                          {f.previousTx && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/app/inspector?digest=${f.previousTx}`)}
                              className="h-8 text-xs gap-1.5"
                            >
                              <Zap className="w-3.5 h-3.5 text-amber-400" />
                              Last Tx Details
                            </Button>
                          )}
                        </div>

                        {/* Decoded JSON Content */}
                        {f.jsonContent && (
                          <div className="space-y-1.5 pt-2">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                              Decoded Field Contents (JSON)
                            </span>
                            <pre className="p-3 rounded-lg bg-black/60 border border-border text-[11px] font-mono text-emerald-400/90 overflow-x-auto max-h-48">
                              {JSON.stringify(f.jsonContent, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : activeTab === 'graph' ? (
            /* ================= VIEW 2.3: RELATIONSHIPS GRAPH VIEW ================= */
            <div className="p-6 rounded-xl bg-card border border-border space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Network className="w-4 h-4 text-primary" />
                    Dynamic Field Hierarchy Tree
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Parent → Children node tree. Solid borders represent addressable `OBJECT`
                    children; dashed borders represent wrapped `FIELD` values.
                  </p>
                </div>
              </div>

              {/* Tree Container */}
              <div className="space-y-4 font-mono text-xs overflow-x-auto pb-4">
                {/* Root Parent Node */}
                <div className="inline-flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/40 text-foreground">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-bold">Parent Object</span>
                  <span className="text-muted-foreground">
                    ({truncateAddress(queriedObjectId)})
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {filteredFields.length} fields
                  </Badge>
                </div>

                {/* Level 1 Children List */}
                <div className="pl-6 border-l-2 border-primary/30 space-y-3 pt-2">
                  {filteredFields.slice(0, 50).map((f) => {
                    const isObj = f.kind === 'OBJECT';
                    const childFields = graphData.get(f.childObjectId);
                    const isGraphLoading = loadingGraphNodes.has(f.childObjectId);

                    return (
                      <div key={`graph-${f.childObjectId}-${f.index}`} className="space-y-2">
                        {/* Node Card */}
                        <div
                          className={`inline-flex flex-wrap items-center gap-2.5 p-2.5 rounded-lg bg-secondary/80 border transition-all ${
                            isObj ? 'border-emerald-500/40' : 'border-dashed border-blue-500/40'
                          }`}
                        >
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isObj
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {f.kind}
                          </span>

                          <span className="text-foreground font-semibold">
                            Key: {f.shortNameValue}
                          </span>
                          <span className="text-tertiary">→</span>
                          <span className="text-purple-400">{f.shortValueType}</span>

                          <span className="text-muted-foreground text-[11px]">
                            ({truncateAddress(f.childObjectId)})
                          </span>

                          {isObj && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleExpandGraphChild(f.childObjectId)}
                              disabled={isGraphLoading}
                              className="h-6 px-2 text-[11px] gap-1 text-primary hover:bg-primary/10"
                            >
                              {isGraphLoading ? (
                                <Spinner size="sm" />
                              ) : childFields !== undefined ? (
                                `Expanded (${childFields.length})`
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" /> Expand Branch
                                </>
                              )}
                            </Button>
                          )}
                        </div>

                        {/* Level 2 Sub-Children Graph */}
                        {childFields && childFields.length > 0 && (
                          <div className="pl-6 border-l-2 border-emerald-500/30 space-y-2 pt-1">
                            {childFields.slice(0, 20).map((cf, cidx) => {
                              const norm = normalizeFieldItem(cf, cidx);
                              return (
                                <div
                                  key={`subgraph-${norm.childObjectId}-${cidx}`}
                                  className={`inline-flex items-center gap-2 p-2 rounded bg-card border text-[11px] ${
                                    norm.kind === 'OBJECT'
                                      ? 'border-emerald-500/30 text-emerald-300'
                                      : 'border-dashed border-blue-500/30 text-blue-300'
                                  }`}
                                >
                                  <span className="font-semibold">{norm.kind}</span>
                                  <span>{norm.shortNameValue}</span>
                                  <span className="text-tertiary">→</span>
                                  <span>{norm.shortValueType}</span>
                                  <span className="text-muted-foreground">
                                    ({truncateAddress(norm.childObjectId)})
                                  </span>
                                </div>
                              );
                            })}
                            {childFields.length > 20 && (
                              <div className="text-[11px] text-muted-foreground italic pl-2">
                                + {childFields.length - 20} more nested child fields hidden
                              </div>
                            )}
                          </div>
                        )}
                        {childFields && childFields.length === 0 && (
                          <div className="pl-6 text-[11px] text-tertiary italic">
                            No nested dynamic fields.
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {filteredFields.length > 50 && (
                    <div className="p-2 text-xs text-amber-400/90 font-medium">
                      ⚠️ Graph capped at first 50 nodes (+ {filteredFields.length - 50} more fields
                      available in Table View).
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ================= VIEW 2.4: ACTIVITY & RECENCY VIEW ================= */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Info className="w-4 h-4 text-primary" />
                  <span>
                    Sorted by <strong>version descending</strong> as a proxy for update recency.
                  </span>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {recencyFields.length} fields
                </Badge>
              </div>

              <div className="space-y-3">
                {recencyFields.map((f) => (
                  <div
                    key={`recency-${f.childObjectId}-${f.index}`}
                    className="p-4 rounded-xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            f.kind === 'OBJECT'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {f.kind}
                        </span>
                        <span className="font-mono text-foreground font-semibold">
                          Key: {f.shortNameValue}
                        </span>
                        <span className="text-tertiary">•</span>
                        <span className="font-mono text-purple-400">{f.shortValueType}</span>
                      </div>
                      <div className="font-mono text-muted-foreground text-[11px]">
                        Child ID: {f.childObjectId}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right font-mono text-xs">
                      <div>
                        <div className="text-tertiary text-[10px]">Version</div>
                        <div className="text-foreground font-semibold">{f.version}</div>
                      </div>
                      <div>
                        <div className="text-tertiary text-[10px]">Storage Rebate</div>
                        <div className="text-foreground">{f.storageRebateSui} SUI</div>
                      </div>
                      {f.previousTx ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/app/inspector?digest=${f.previousTx}`)}
                          className="h-8 text-xs gap-1"
                        >
                          <Zap className="w-3 h-3 text-amber-400" />
                          Tx
                        </Button>
                      ) : (
                        <span className="text-tertiary text-[11px]">-</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Load More Button */}
          {hasNextPage && (
            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full h-10 text-xs"
                onClick={() => handleQuery(nextCursor || undefined)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" /> Loading more fields...
                  </span>
                ) : (
                  'Load Next Page (50 Fields)'
                )}
              </Button>
            </div>
          )}
        </div>
      ) : queriedObjectId ? (
        /* Empty State */
        <div className="p-10 rounded-xl border border-border bg-card text-center space-y-4">
          <div className="text-4xl">📭</div>
          <h3 className="text-base font-semibold text-foreground">No Dynamic Fields Found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            The object{' '}
            <code className="text-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">
              {queriedObjectId}
            </code>{' '}
            exists but has no attached dynamic fields (`sui::dynamic_field` or
            `sui::dynamic_object_field`).
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/app/objects/${queriedObjectId}`)}
          >
            View Parent Object Details
          </Button>
        </div>
      ) : (
        /* Initial Ready State */
        <div className="p-10 rounded-xl border border-border bg-card text-center space-y-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary text-2xl">
            🔍
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Explore Dynamic Fields</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Enter any Sui object ID above to inspect its heterogeneous runtime storage,
              relationship tree, and ability rules.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left text-xs font-mono">
            <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-1">
              <div className="text-blue-400 font-bold">1. FIELD (`dynamic_field`)</div>
              <div className="text-[11px] text-muted-foreground font-sans">
                Wrapped value with `store` ability. Not independently addressable by object ID.
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-1">
              <div className="text-emerald-400 font-bold">2. OBJECT (`dynamic_object_field`)</div>
              <div className="text-[11px] text-muted-foreground font-sans">
                Child object with `key+store` abilities. Addressable & viewable by object ID.
              </div>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border space-y-1">
              <div className="text-purple-400 font-bold">3. Hierarchy Tree</div>
              <div className="text-[11px] text-muted-foreground font-sans">
                Interactive graph view with lazy node branch expansion.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
