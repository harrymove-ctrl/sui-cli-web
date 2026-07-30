import { Plus, Check, Minus } from 'lucide-react';
import { DitherButton } from '@/components/dither-kit/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface AddableWidget {
  id: string;
  title: string;
  category: string;
  description: string;
}

/**
 * Header action that replaces the old "Request Faucet" button: opens a menu of
 * every dashboard widget, grouped by category, and toggles the chosen one on or
 * off the grid. Placed widgets read as checked and remove on click, so the menu
 * is the single place to manage the dashboard - no need to enter Customize mode
 * just to drop a chart.
 */
export function AddComponentMenu({
  widgets,
  activeIds,
  onAdd,
  onRemove,
}: {
  widgets: AddableWidget[];
  activeIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const active = new Set(activeIds);
  // Removing the last widget would leave activeIds empty, and the config
  // reconciler reads "empty" as "unconfigured" and restores the whole default
  // set - so the final card has to stay put.
  const isLast = active.size <= 1;
  const categories = [...new Set(widgets.map((w) => w.category))];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <DitherButton
          variant="gradient"
          bloom="low"
          className="h-9 rounded-full px-3 lg:px-4"
          title="Add a chart or panel to your dashboard"
          aria-label="Add component"
        >
          <Plus className="h-4 w-4" />
          {/* Icon-only on narrow screens: the dashboard content column is ~240px
              on a phone, where four labelled pills stack into three rows. */}
          <span className="hidden lg:inline">Add component</span>
        </DitherButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-72 overflow-y-auto">
        {categories.map((category, ci) => (
          <div key={category}>
            {ci > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">{category}</DropdownMenuLabel>
            {widgets
              .filter((w) => w.category === category)
              .map((w) => {
                const added = active.has(w.id);
                const pinned = added && isLast;
                return (
                  <DropdownMenuItem
                    key={w.id}
                    disabled={pinned}
                    title={
                      pinned
                        ? 'Keep at least one component on the dashboard'
                        : added
                          ? `Remove ${w.title}`
                          : `Add ${w.title}`
                    }
                    onSelect={(e) => {
                      // Stay open so several widgets can be toggled in one pass.
                      e.preventDefault();
                      if (pinned) return;
                      if (added) onRemove(w.id);
                      else onAdd(w.id);
                    }}
                    className="group flex cursor-pointer flex-col items-start gap-0.5 py-2"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{w.title}</span>
                      {added ? (
                        // Check at rest, minus on hover: the icon previews what the
                        // click does rather than just restating the current state.
                        <>
                          <Check
                            className={cn(
                              'h-3.5 w-3.5 flex-shrink-0 text-green-500',
                              !pinned && 'group-focus:hidden group-hover:hidden'
                            )}
                          />
                          {!pinned && (
                            <Minus className="hidden h-3.5 w-3.5 flex-shrink-0 text-destructive group-focus:block group-hover:block" />
                          )}
                        </>
                      ) : (
                        <Plus className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground group-focus:text-foreground group-hover:text-foreground" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{w.description}</span>
                  </DropdownMenuItem>
                );
              })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
