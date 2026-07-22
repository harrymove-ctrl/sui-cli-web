import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatedList } from '@/components/ui/animated-list';
import { FeatureGates, useFeatureFlags } from '@/hooks/useFeatureFlags';
import { CATEGORY_ORDER, VIEW_TO_ROUTE } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { DEFAULT_COMMANDS } from '@/types';

interface PaletteItem {
  index: number;
  icon?: string;
  title: string;
  subtitle?: string;
  subtitleActiveClassName?: string;
  ariaLabel: string;
  onSelect: () => void;
}

interface PaletteGroup {
  heading: string;
  items: PaletteItem[];
}

interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickSwitcher({ isOpen, onClose }: QuickSwitcherProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { isEnabled } = useFeatureFlags();
  const { addresses, environments } = useAppStore();

  const activeAddress = addresses.find((a) => a.isActive);
  const activeEnv = environments.find((e) => e.isActive);

  // Reset transient state whenever the switcher opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const filteredCommands = useMemo(() => {
    let commands = DEFAULT_COMMANDS;

    commands = commands.filter((cmd) => {
      if (!cmd.featureFlag) return true;
      const flagEnabled = isEnabled(cmd.featureFlag as keyof typeof FeatureGates);
      if (cmd.hideWhenFlagEnabled) return !flagEnabled;
      return flagEnabled;
    });

    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.subtitle?.toLowerCase().includes(q) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }, [query, isEnabled]);

  const navigateTo = useCallback(
    (path: string) => {
      navigate(path);
      onClose();
    },
    [navigate, onClose]
  );

  // Single source of truth for both rendering and keyboard nav.
  const groups = useMemo<PaletteGroup[]>(() => {
    let nextIndex = 0;
    const result: PaletteGroup[] = [];

    result.push({
      heading: 'Status',
      items: [
        {
          index: nextIndex++,
          icon: '🌐',
          title: activeEnv?.alias || 'Not set',
          subtitle: activeEnv?.rpc || 'No RPC configured',
          ariaLabel: `Environment: ${activeEnv?.alias || 'Not set'}`,
          onSelect: () => navigateTo('/app/environments'),
        },
        {
          index: nextIndex++,
          icon: '👤',
          title: activeAddress?.alias || 'No address',
          subtitle: `${activeAddress?.balance || '0'} SUI`,
          subtitleActiveClassName: 'text-[#4da2ff]',
          ariaLabel: `Address: ${activeAddress?.alias || 'No address'}, Balance: ${activeAddress?.balance || '0'} SUI`,
          onSelect: () => navigateTo('/app/addresses'),
        },
      ],
    });

    for (const category of CATEGORY_ORDER) {
      const categoryCommands = filteredCommands.filter((cmd) => cmd.category === category);
      if (categoryCommands.length === 0) continue;

      result.push({
        heading: category,
        items: categoryCommands.map((cmd) => ({
          index: nextIndex++,
          icon: cmd.icon,
          title: cmd.title,
          subtitle: cmd.subtitle,
          ariaLabel: `${cmd.title}${cmd.subtitle ? `: ${cmd.subtitle}` : ''}`,
          onSelect: () => {
            if (VIEW_TO_ROUTE[cmd.action]) navigateTo(VIEW_TO_ROUTE[cmd.action]);
          },
        })),
      });
    }

    return result;
  }, [activeEnv, activeAddress, filteredCommands, navigateTo]);

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        flatItems[selectedIndex]?.onSelect();
      }
    },
    [isOpen, flatItems, selectedIndex, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="w-full max-w-lg mx-4 rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Quick switcher"
      >
        <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search pages and actions..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] text-muted-foreground bg-secondary rounded border border-border">
            esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2" role="listbox" aria-label="Results">
          {groups.map((group) => (
            <div key={group.heading}>
              <div className="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-tertiary">
                {group.heading}
              </div>
              <AnimatedList delay={0}>
                {group.items.map((item) => {
                  const isSelected = selectedIndex === item.index;
                  return (
                    <div
                      key={item.index}
                      role="option"
                      aria-selected={isSelected}
                      aria-label={item.ariaLabel}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg cursor-pointer transition-colors',
                        isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                      )}
                      onClick={() => {
                        setSelectedIndex(item.index);
                        item.onSelect();
                      }}
                    >
                      {item.icon && <span className="text-base flex-shrink-0 w-5 text-center">{item.icon}</span>}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground truncate">{item.title}</div>
                        {item.subtitle && (
                          <div
                            className={cn(
                              'text-xs truncate',
                              isSelected
                                ? (item.subtitleActiveClassName ?? 'text-muted-foreground')
                                : 'text-tertiary'
                            )}
                          >
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <kbd className="flex-shrink-0 px-1.5 py-0.5 text-[10px] bg-secondary text-muted-foreground rounded border border-border">
                          enter
                        </kbd>
                      )}
                    </div>
                  );
                })}
              </AnimatedList>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
