import {
  Coins,
  Droplet,
  Globe,
  Hammer,
  Key,
  Link2,
  type LucideIcon,
  LayoutDashboard,
  Package,
  PanelLeft,
  PanelLeftClose,
  Search,
  Send,
  ShieldCheck,
  User,
  Wrench,
} from 'lucide-react';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileTree, type FileTreeElement } from '@/components/unlumen-ui/file-tree';
import { Tooltip } from '@/components/ui/tooltip';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { CATEGORY_ORDER, VIEW_TO_ROUTE } from '@/lib/routes';
import { DEFAULT_COMMANDS } from '@/types';
import { WalletCard } from './WalletCard';

const NAV_ICON_MAP: Record<string, LucideIcon> = {
  addresses: User,
  environments: Globe,
  objects: Package,
  gas: Coins,
  'dynamic-fields': Link2,
  transfer: Send,
  faucet: Droplet,
  move: Hammer,
  inspector: Search,
  devtools: Wrench,
  keytool: Key,
  security: ShieldCheck,
};

// Same highlight as the FileTree's default (unlumen-ui), so the active nav item
// looks identical in the collapsed rail and the expanded tree.
const NAV_HIGHLIGHT = '#f472b6';

const ADDRESS_SUB_ITEMS = [
  { id: 'addresses-all', label: 'All Addresses', search: '' },
  { id: 'addresses-new', label: 'New Address', search: '?action=new' },
  { id: 'addresses-import', label: 'Import Address', search: '?action=import' },
];

interface SidebarProps {
  onSearchClick?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ onSearchClick, collapsed = false, onToggleCollapse }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const addresses = useAppStore((s) => s.addresses);
  const activeAddress = addresses.find((a) => a.isActive);

  // Flat nav list (Dashboard + every routed command) - drives the collapsed icon rail.
  const flatNav = useMemo(() => {
    const items: { id: string; title: string; icon: LucideIcon; to: string }[] = [
      { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard, to: '/app' },
    ];
    for (const cmd of DEFAULT_COMMANDS) {
      const to = VIEW_TO_ROUTE[cmd.action];
      const Icon = NAV_ICON_MAP[cmd.id];
      if (to && Icon) items.push({ id: cmd.id, title: cmd.title, icon: Icon, to });
    }
    return items;
  }, []);

  // Single continuous FileTree covering every category (including "Security", rendered
  // as a "Settings" folder) - one scrollable tree, no separate pinned block/divider.
  const treeElements = useMemo<FileTreeElement[]>(() => {
    const categories = CATEGORY_ORDER.map((category): FileTreeElement | null => {
      const items = DEFAULT_COMMANDS.filter((cmd) => cmd.category === category);
      if (items.length === 0) return null;

      const folderName = category === 'Security' ? 'Settings' : category;

      return {
        id: `category-${category}`,
        name: folderName,
        type: 'folder',
        defaultOpen: true,
        children: items
          .map((cmd): FileTreeElement | null => {
            const to = VIEW_TO_ROUTE[cmd.action];
            if (!to) return null;
            const Icon = NAV_ICON_MAP[cmd.id];

            if (cmd.id === 'addresses') {
              const onAddresses = location.pathname === to;
              return {
                id: cmd.id,
                name: cmd.title,
                type: 'folder',
                icon: Icon,
                defaultOpen: onAddresses,
                children: ADDRESS_SUB_ITEMS.map((sub) => ({
                  id: sub.id,
                  name: sub.label,
                  type: 'file',
                  active: onAddresses && location.search === sub.search,
                  onSelect: () => navigate(`${to}${sub.search}`),
                })),
              };
            }

            return {
              id: cmd.id,
              name: cmd.title,
              type: 'file',
              icon: Icon,
              active: location.pathname === to,
              onSelect: () => navigate(to),
            };
          })
          .filter((n): n is FileTreeElement => n !== null),
      };
    }).filter((n): n is FileTreeElement => n !== null);

    const dashboardElement: FileTreeElement = {
      id: 'dashboard',
      name: 'Dashboard',
      type: 'file',
      icon: LayoutDashboard,
      active: location.pathname === '/app',
      onSelect: () => navigate('/app'),
    };

    return [dashboardElement, ...categories];
  }, [location.pathname, location.search, navigate, activeAddress?.alias]);

  // ---- Collapsed icon rail ----
  if (collapsed) {
    return (
      <aside className="flex flex-col items-center h-full w-full py-4 gap-1">
        {/* Expand toggle */}
        <Tooltip content="Expand sidebar" side="right">
          <button
            onClick={onToggleCollapse}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
            aria-label="Expand sidebar"
          >
            <PanelLeft className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>

        {/* Brand */}
        <div className="w-9 h-9 my-1 rounded-lg bg-foreground flex items-center justify-center text-background text-sm font-bold flex-shrink-0">
          S
        </div>

        {/* Search */}
        <Tooltip content="Search  ⌘K" side="right">
          <button
            onClick={onSearchClick}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
            aria-label="Search"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>

        <div className="w-8 h-px my-1 bg-border" />

        {/* Nav icons */}
        <nav className="flex-1 flex flex-col items-center gap-1 overflow-y-auto" aria-label="Primary navigation">
          {flatNav.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Tooltip key={item.id} content={item.title} side="right">
                <button
                  onClick={() => navigate(item.to)}
                  aria-label={item.title}
                  aria-current={active ? 'page' : undefined}
                  // Match the expanded FileTree active style exactly (pink text on a
                  // 10%-opacity tint), so the highlight is uniform across both modes.
                  style={active ? { color: NAV_HIGHLIGHT, backgroundColor: `${NAV_HIGHLIGHT}1a` } : undefined}
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    !active && 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                  )}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </button>
              </Tooltip>
            );
          })}
        </nav>

        {/* Active wallet avatar */}
        {activeAddress && (
          <Tooltip content={activeAddress.alias || activeAddress.address} side="right">
            <button
              onClick={() => navigate('/app/addresses')}
              className="mt-1 flex-shrink-0"
              aria-label="Active wallet"
            >
              <Avatar label={activeAddress.alias || activeAddress.address} className="w-9 h-9" />
            </button>
          </Tooltip>
        )}
      </aside>
    );
  }

  // ---- Expanded sidebar ----
  return (
    <aside className="flex flex-col h-full w-full px-3 py-4">
      {/* Brand + collapse toggle */}
      <div className="flex items-center gap-2 px-2 mb-4">
        <div className="w-7 h-7 rounded-md bg-foreground flex items-center justify-center text-background text-sm font-bold">
          S
        </div>
        <span className="text-base font-semibold text-foreground flex-1">Sui CLI</span>
        {onToggleCollapse && (
          <Tooltip content="Collapse sidebar" side="bottom">
            <button
              onClick={onToggleCollapse}
              className="p-1.5 -mr-1 rounded-md text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* Search - opens the Cmd+K quick-switcher */}
      <div className="mb-4 px-2">
        <button
          onClick={onSearchClick}
          className="flex items-center gap-2 h-9 w-full px-3 rounded-lg border border-border bg-card text-muted-foreground text-sm hover:text-foreground transition-colors"
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-secondary rounded border border-border">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Nav - rendered via the unlumen-ui FileTree component, built from
          DEFAULT_COMMANDS/CATEGORY_ORDER (same source of truth as the quick-switcher).
          One continuous tree, including the "Settings" folder - no separate pinned block. */}
      <nav className="flex-1 overflow-y-auto px-1" aria-label="Primary navigation">
        <FileTree elements={treeElements} className="border-none" indentSize={16} />
      </nav>

      <div className="px-1 pt-3 mt-3 border-t border-border">
        <WalletCard />
      </div>
    </aside>
  );
}
