/**
 * EventExplorer - Decode and understand Sui events
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  Copy,
  Database,
  ExternalLink,
  FileCode,
  Filter,
  Info,
  Loader2,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { CopyForAiMenu } from '@/components/ui/copy-for-ai';
import { useCopyToClipboard } from '@/hooks';
import { buildExplorerUrl, detectNetwork, getDefaultExplorer } from '@/lib/explorer';
import { useAppStore } from '@/stores/useAppStore';

interface ParsedEvent {
  id: string;
  type: string;
  packageId: string;
  module: string;
  eventName: string;
  sender: string;
  transactionDigest: string;
  timestamp?: number;
  parsedFields: Record<string, any>;
  rawData: any;
}

// Known protocol detection
const KNOWN_PROTOCOLS: Record<string, { name: string; color: string; icon: React.ReactNode }> = {
  '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e': {
    name: 'Pyth Oracle',
    color: 'text-purple-400',
    icon: <TrendingUp className="w-4 h-4" />,
  },
  '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf': {
    name: 'Wormhole',
    color: 'text-blue-400',
    icon: <Shield className="w-4 h-4" />,
  },
  '0xa0eba10b173538c8fecca1dff298e488402cc9ff374f8a12ca7758eebe830b66': {
    name: 'Cetus DEX',
    color: 'text-cyan-400',
    icon: <ArrowRightLeft className="w-4 h-4" />,
  },
  '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1': {
    name: 'Turbos DEX',
    color: 'text-green-400',
    icon: <ArrowRightLeft className="w-4 h-4" />,
  },
  '0xdee9': { name: 'DeepBook', color: 'text-yellow-400', icon: <BarChart3 className="w-4 h-4" /> },
  '0x2': { name: 'Sui Framework', color: 'text-blue-400', icon: <FileCode className="w-4 h-4" /> },
  '0x3': { name: 'Sui System', color: 'text-blue-400', icon: <Database className="w-4 h-4" /> },
};

// Event type descriptions
const EVENT_DESCRIPTIONS: Record<string, string> = {
  // DeFi
  SwapEvent: 'Token swap executed',
  AddLiquidityEvent: 'Liquidity added to pool',
  RemoveLiquidityEvent: 'Liquidity removed from pool',
  FlashLoanEvent: 'Flash loan executed',
  BorrowEvent: 'Asset borrowed',
  RepayEvent: 'Loan repaid',
  LiquidateEvent: 'Position liquidated',
  // Oracle
  PriceFeedUpdateEvent: 'Price feed updated',
  TemporalNumericValueFeedUpdateEvent: 'Oracle price update',
  PriceInfoObject: 'Price information stored',
  // NFT
  MintEvent: 'NFT minted',
  TransferEvent: 'Asset transferred',
  BurnEvent: 'Asset burned',
  // Staking
  StakeEvent: 'Tokens staked',
  UnstakeEvent: 'Tokens unstaked',
  ClaimRewardsEvent: 'Rewards claimed',
  // General
  PackagePublish: 'Contract deployed',
  Upgrade: 'Contract upgraded',
};

function truncateAddress(address: string, chars = 6): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

function detectProtocol(packageId: string) {
  // Check exact match first
  if (KNOWN_PROTOCOLS[packageId]) return KNOWN_PROTOCOLS[packageId];

  // Check prefix match for short IDs like 0x2, 0x3
  for (const [key, value] of Object.entries(KNOWN_PROTOCOLS)) {
    if (packageId.startsWith(key)) return value;
  }

  return null;
}

function getEventDescription(eventName: string): string {
  // Check exact match
  if (EVENT_DESCRIPTIONS[eventName]) return EVENT_DESCRIPTIONS[eventName];

  // Check partial match
  for (const [key, desc] of Object.entries(EVENT_DESCRIPTIONS)) {
    if (eventName.toLowerCase().includes(key.toLowerCase())) return desc;
  }

  // Generate from name
  const words = eventName
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ');
  return words.join(' ').toLowerCase();
}

function getEventIcon(eventName: string): React.ReactNode {
  const name = eventName.toLowerCase();
  if (name.includes('swap')) return <ArrowRightLeft className="w-4 h-4" />;
  if (name.includes('transfer')) return <Coins className="w-4 h-4" />;
  if (name.includes('mint')) return <Sparkles className="w-4 h-4" />;
  if (name.includes('price') || name.includes('oracle') || name.includes('feed'))
    return <TrendingUp className="w-4 h-4" />;
  if (name.includes('stake')) return <Database className="w-4 h-4" />;
  if (name.includes('liquidity')) return <Users className="w-4 h-4" />;
  return <Zap className="w-4 h-4" />;
}

function EventCard({
  event,
  isExpanded,
  onToggle,
}: {
  event: ParsedEvent;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const protocol = detectProtocol(event.packageId);
  const description = getEventDescription(event.eventName);
  const icon = getEventIcon(event.eventName);

  const copyToClipboardBase = useCopyToClipboard();
  const copyToClipboard = (text: string, label: string) => {
    copyToClipboardBase(text, label);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left"
      >
        <div className="flex-shrink-0 text-yellow-400">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>

        <div className={`flex-shrink-0 ${protocol?.color || 'text-yellow-400'}`}>
          {protocol?.icon || icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{event.eventName}</span>
            {protocol && (
              <span className={`text-xs px-2 py-0.5 rounded-full bg-accent ${protocol.color}`}>
                {protocol.name}
              </span>
            )}
          </div>
          <div className="text-xs text-tertiary">{description}</div>
        </div>

        <div className="text-xs text-tertiary flex-shrink-0">{event.module}</div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-secondary rounded-lg">
                  <div className="text-xs text-tertiary">Package</div>
                  <div className="flex items-center gap-1 mt-1">
                    <code className="text-xs text-muted-foreground truncate font-mono">
                      {truncateAddress(event.packageId, 8)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(event.packageId, 'pkg')}
                      className="text-tertiary hover:text-muted-foreground"
                    >
                      {copied === 'pkg' ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-2 bg-secondary rounded-lg">
                  <div className="text-xs text-tertiary">Sender</div>
                  <div className="flex items-center gap-1 mt-1">
                    <code className="text-xs text-muted-foreground truncate font-mono">
                      {truncateAddress(event.sender, 8)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(event.sender, 'sender')}
                      className="text-tertiary hover:text-muted-foreground"
                    >
                      {copied === 'sender' ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Full Type */}
              <div className="p-2 bg-secondary rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-tertiary">Event Type</span>
                  <button
                    onClick={() => copyToClipboard(event.type, 'type')}
                    className="text-tertiary hover:text-muted-foreground"
                  >
                    {copied === 'type' ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <code className="text-xs text-muted-foreground break-all font-mono">
                  {event.type}
                </code>
              </div>

              {/* Event Data */}
              {Object.keys(event.parsedFields).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-tertiary">Event Data</span>
                    <button
                      onClick={() =>
                        copyToClipboard(JSON.stringify(event.parsedFields, null, 2), 'data')
                      }
                      className="text-xs text-tertiary hover:text-muted-foreground flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy JSON
                    </button>
                  </div>
                  <div className="bg-secondary rounded-lg p-3 font-mono text-xs overflow-x-auto max-h-60">
                    <pre className="text-muted-foreground whitespace-pre-wrap break-all">
                      {JSON.stringify(event.parsedFields, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function EventExplorer() {
  const { environments } = useAppStore();
  const activeEnv = environments.find((e) => e.isActive);
  const currentNetwork = detectNetwork(activeEnv?.alias, activeEnv?.rpc);
  const [digest, setDigest] = useState('');
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState({ module: '', eventName: '' });

  const fetchEvents = useCallback(async () => {
    if (!digest.trim()) return;
    setIsLoading(true);
    setError(null);
    setEvents([]);

    try {
      const response = await apiClient.get(`/inspector/events/transaction/${digest.trim()}`);
      if (response.success) {
        setEvents(response.events || []);
        if (response.events?.[0]) {
          setExpandedIds(new Set([response.events[0].id]));
        }
      } else {
        setError(response.error || 'Failed to fetch events');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  }, [digest]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') fetchEvents();
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredEvents = events.filter((event) => {
    if (filter.module && !event.module.toLowerCase().includes(filter.module.toLowerCase()))
      return false;
    if (filter.eventName && !event.eventName.toLowerCase().includes(filter.eventName.toLowerCase()))
      return false;
    return true;
  });

  // Group events by type for summary
  const eventSummary = useMemo(() => {
    const summary: Record<string, { count: number; protocol: any }> = {};
    events.forEach((event) => {
      const key = event.eventName;
      if (!summary[key]) {
        summary[key] = { count: 0, protocol: detectProtocol(event.packageId) };
      }
      summary[key].count++;
    });
    return summary;
  }, [events]);

  // Detect main protocols involved
  const protocolsInvolved = useMemo(() => {
    const protocols = new Set<string>();
    events.forEach((event) => {
      const protocol = detectProtocol(event.packageId);
      if (protocol) protocols.add(protocol.name);
    });
    return Array.from(protocols);
  }, [events]);

  const copyForAi = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  // AI export of the current event query and its results (capped so we don't
  // dump thousands of events into a prompt).
  const EVENT_EXPORT_CAP = 200;
  const aiJson = useMemo(() => {
    if (filteredEvents.length === 0) return undefined;
    return JSON.stringify(
      {
        digest: digest.trim(),
        filter,
        protocols: protocolsInvolved,
        eventTypeBreakdown: Object.fromEntries(
          Object.entries(eventSummary).map(([name, data]) => [name, data.count])
        ),
        totalEvents: filteredEvents.length,
        events: filteredEvents.slice(0, EVENT_EXPORT_CAP).map((e) => ({
          type: e.type,
          module: e.module,
          eventName: e.eventName,
          packageId: e.packageId,
          sender: e.sender,
          fields: e.parsedFields,
        })),
      },
      null,
      2
    );
  }, [filteredEvents, digest, filter, protocolsInvolved, eventSummary]);

  const aiPrompt = useMemo(() => {
    if (filteredEvents.length === 0) return '';
    const shown = Math.min(filteredEvents.length, EVENT_EXPORT_CAP);
    return [
      `Explain what happened in this Sui transaction based on its emitted events.`,
      '',
      `- Digest: ${digest.trim()}`,
      `- Events: ${filteredEvents.length}${shown < filteredEvents.length ? ` (showing first ${shown})` : ''}`,
      protocolsInvolved.length > 0 ? `- Protocols: ${protocolsInvolved.join(', ')}` : '',
      '',
      'Event breakdown:',
      ...Object.entries(eventSummary).map(([name, data]) => `- ${name} ×${data.count}`),
      '',
      `Walk me through what this transaction did and call out anything notable.`,
    ]
      .filter(Boolean)
      .join('\n');
  }, [filteredEvents, digest, protocolsInvolved, eventSummary]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-foreground">Event Explorer</h2>
          </div>
          {filteredEvents.length > 0 && (
            <CopyForAiMenu prompt={aiPrompt} json={aiJson} onCopy={copyForAi} />
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
            <input
              type="text"
              value={digest}
              onChange={(e) => setDigest(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste transaction digest..."
              className="w-full pl-9 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-tertiary focus:outline-none focus:border-yellow-500/50 font-mono"
            />
          </div>
          <Button onClick={fetchEvents} disabled={isLoading || !digest.trim()} size="lg">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
          </Button>
        </div>

        {/* Filters */}
        {events.length > 0 && (
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-tertiary" />
              <input
                type="text"
                value={filter.module}
                onChange={(e) => setFilter((f) => ({ ...f, module: e.target.value }))}
                placeholder="Filter by module..."
                className="w-full pl-8 pr-3 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-tertiary focus:outline-none"
              />
            </div>
            <input
              type="text"
              value={filter.eventName}
              onChange={(e) => setFilter((f) => ({ ...f, eventName: e.target.value }))}
              placeholder="Filter by event name..."
              className="flex-1 px-3 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-tertiary focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Transaction Summary */}
        {events.length > 0 && (
          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-foreground">Transaction Summary</span>
              </div>
              <a
                href={buildExplorerUrl(getDefaultExplorer(), currentNetwork, 'tx', digest)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                View on Suiscan <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center p-2 bg-secondary rounded-lg">
                <div className="text-2xl font-bold text-foreground">{events.length}</div>
                <div className="text-xs text-muted-foreground">Events</div>
              </div>
              <div className="text-center p-2 bg-secondary rounded-lg">
                <div className="text-2xl font-bold text-foreground">
                  {Object.keys(eventSummary).length}
                </div>
                <div className="text-xs text-muted-foreground">Event Types</div>
              </div>
              <div className="text-center p-2 bg-secondary rounded-lg">
                <div className="text-2xl font-bold text-foreground">
                  {protocolsInvolved.length || '-'}
                </div>
                <div className="text-xs text-muted-foreground">Protocols</div>
              </div>
            </div>

            {/* Protocols */}
            {protocolsInvolved.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {protocolsInvolved.map((name) => (
                  <span
                    key={name}
                    className="text-xs px-2 py-1 bg-accent rounded-full text-muted-foreground"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            {/* Event Type Breakdown */}
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2">Event Breakdown</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(eventSummary).map(([name, data]) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 px-2 py-1 bg-secondary rounded text-xs"
                  >
                    <span className="text-muted-foreground">{name}</span>
                    <span className="text-yellow-400 font-medium">×{data.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Events Header */}
        {events.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() =>
                setExpandedIds((prev) =>
                  prev.size === filteredEvents.length
                    ? new Set()
                    : new Set(filteredEvents.map((e) => e.id))
                )
              }
              className="text-xs text-tertiary hover:text-muted-foreground transition-colors"
            >
              {expandedIds.size === filteredEvents.length ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        )}

        {/* Event Cards */}
        <div className="space-y-2">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              isExpanded={expandedIds.has(event.id)}
              onToggle={() => toggleExpanded(event.id)}
            />
          ))}
        </div>

        {/* Empty State */}
        {!isLoading && events.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-yellow-500/10 rounded-2xl mb-4">
              <Zap className="w-10 h-10 text-yellow-400/60" />
            </div>
            <h3 className="text-foreground font-medium mb-2">Explore Transaction Events</h3>
            <p className="text-sm text-tertiary max-w-sm mb-6">
              See what happened in a transaction - swaps, transfers, oracle updates, and more
            </p>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Try these examples:</div>
              {[
                {
                  digest: '7SZsZ8RzL7JcteKbcJh4D5xXjz6vGkuxNzj6wJtB73Dv',
                  label: 'Pyth Oracle Update',
                },
                {
                  digest: '95iEUzhvYWZoceBtgq7LkMsZxhrtfK3iJQk7AFV6Xgnk',
                  label: 'DeFi Transaction',
                },
              ].map((example) => (
                <button
                  key={example.digest}
                  onClick={() => setDigest(example.digest)}
                  className="block w-full p-2 bg-secondary hover:bg-accent rounded-lg text-left transition-colors"
                >
                  <div className="text-xs text-yellow-400 font-mono truncate">{example.digest}</div>
                  <div className="text-xs text-tertiary">{example.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Reference */}
        {events.length > 0 && (
          <div className="bg-secondary rounded-xl p-4 border border-dashed border-border">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-tertiary" />
              <span className="text-xs font-medium text-muted-foreground">
                Understanding Events
              </span>
            </div>
            <div className="text-xs text-tertiary space-y-1">
              <p>
                <span className="text-yellow-400">Events</span> are logs emitted by smart contracts
                during execution
              </p>
              <p>
                <span className="text-purple-400">Oracle events</span> update price feeds from
                external data sources
              </p>
              <p>
                <span className="text-cyan-400">Swap events</span> indicate token exchanges on DEXes
              </p>
              <p>Click any event to see its full data and copy values</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EventExplorer;
