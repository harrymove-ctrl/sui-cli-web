import { GripVertical, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Responsive, type Layout, type Layouts } from 'react-grid-layout';
import { cn } from '@/lib/utils';
import './grid.css';

// 12 cols on desktop, collapsing to fewer as the viewport narrows. RGL clamps any
// item wider than the current cols, so a 12-wide item just spans the full row on
// small screens instead of overflowing.
export const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
export const GRID_COLS = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 };
export const GRID_ROW_HEIGHT = 30;

export interface DashboardGridItem {
  /** Stable id - must match the `i` used in the layout objects. */
  i: string;
  node: ReactNode;
}

export function DashboardGrid({
  items,
  layouts,
  editing,
  onLayoutChange,
  onRemove,
}: {
  items: DashboardGridItem[];
  layouts: Layouts;
  editing: boolean;
  /** Omitted (undefined) outside edit mode so auto/breakpoint reflows are never persisted. */
  onLayoutChange?: (current: Layout[], all: Layouts) => void;
  /** Remove a widget from the dashboard (shown as an × on each card in edit mode). */
  onRemove?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // True while a card is actively being dragged/resized. During that window we do
  // NOT push the layout back into RGL: onLayoutChange fires on every mouse-move,
  // and feeding a freshly-rebuilt layout array back mid-drag makes RGL re-sync
  // from the prop and snap the card back - which read as "drag doesn't work". We
  // let RGL own the layout during the gesture and only persist once it stops.
  const interactingRef = useRef(false);

  // Measure the container ourselves instead of react-grid-layout's WidthProvider.
  // WidthProvider only re-measures on `window` resize, so when it takes its one
  // measurement too early - before Lenis smooth-scroll and the framer-motion page
  // transition have settled the layout - it locks in a wrong/tiny width and never
  // corrects, collapsing every card. A ResizeObserver re-measures on any container
  // size change (mount settle, sidebar collapse, window resize) and self-heals.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full min-w-0">
      {/* Render the grid only once a real width is known - a 0-width first paint is
          exactly what produced the collapsed layout, so we skip it entirely. */}
      {width > 0 && (
        <Responsive
          className={cn('dashboard-grid', editing && 'is-editing')}
          width={width}
          layouts={layouts}
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={GRID_ROW_HEIGHT}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          isDraggable={editing}
          isResizable={editing}
          // The whole card is the drag surface in edit mode (matching the grab
          // cursor we show), EXCEPT the resize handle - otherwise grabbing the
          // corner would start a move instead of a resize. A click without motion
          // still registers as a click, so buttons/rows keep working.
          draggableCancel=".react-resizable-handle,.dashboard-remove-btn"
          onDragStart={() => {
            interactingRef.current = true;
          }}
          onResizeStart={() => {
            interactingRef.current = true;
          }}
          onDragStop={() => {
            interactingRef.current = false;
          }}
          onResizeStop={() => {
            interactingRef.current = false;
          }}
          // RGL fires onLayoutChange during the gesture (skipped) and once more
          // right after onDragStop/onResizeStop clears the flag (persisted).
          onLayoutChange={(current, all) => {
            if (!interactingRef.current) onLayoutChange?.(current, all);
          }}
          useCSSTransforms
        >
          {items.map((item) => (
            <div key={item.i} className="h-full">
              <div className="relative h-full">
                {editing && (
                  // Visual affordance only - the whole card is draggable now, so
                  // this just signals "edit mode / grab me" and never blocks the card.
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-6 items-center justify-center rounded-t-xl bg-primary/10 text-primary/70"
                    title="Drag to move"
                  >
                    <GripVertical className="h-3.5 w-3.5 rotate-90" />
                  </div>
                )}
                {editing && onRemove && (
                  <button
                    type="button"
                    className="dashboard-remove-btn absolute right-1.5 top-0.5 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm transition-colors hover:bg-red-500 hover:text-white"
                    title="Remove from dashboard"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.i);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {/* Push content below the handle strip only while editing so the handle
                    never overlaps the card's own header. */}
                <div className={cn('h-full', editing && 'pt-6')}>{item.node}</div>
              </div>
            </div>
          ))}
        </Responsive>
      )}
    </div>
  );
}
