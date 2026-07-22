import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type Header,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ChevronsUpDown, GripVertical } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { DataTableCheckbox } from './data-table-checkbox';
import { ScrollArea } from './scroll-area';
import { ScrollProgress } from './scroll-progress';

export interface DataTableColumn<T> {
  id: string;
  header: string | ReactNode;
  accessor: (row: T) => unknown;
  cell?: (row: T, value: unknown) => ReactNode;
  sortable?: boolean;
  size?: number;
  minSize?: number;
  maxSize?: number;
  align?: 'left' | 'right' | 'center';
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T, index: number) => string;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  initialSort?: { columnId: string; desc: boolean };
  onRowClick?: (row: T) => void;
  rowHeight?: number;
  emptyState?: ReactNode;
  className?: string;
}

const SELECT_COL_ID = '__select';

function alignClass(align?: 'left' | 'right' | 'center') {
  if (align === 'right') return 'text-right justify-end';
  if (align === 'center') return 'text-center justify-center';
  return 'text-left justify-start';
}

/**
 * Draggable/resizable/sortable header cell. Column reorder uses @dnd-kit
 * (already a dependency elsewhere in the app, so zero marginal bundle cost)
 * restricted to the header row only - body rows are not draggable.
 */
function HeaderCell<T>({
  header,
  onSortClick,
  sortDirection,
  sortable,
  reduceMotion,
}: {
  header: Header<T, unknown>;
  onSortClick?: () => void;
  sortDirection: false | 'asc' | 'desc';
  sortable: boolean;
  reduceMotion: boolean;
}) {
  const isSelectCol = header.id === SELECT_COL_ID;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: header.id,
    disabled: isSelectCol,
  });

  const style = {
    width: header.getSize(),
    transform: !reduceMotion && transform ? CSS.Translate.toString(transform) : undefined,
    transition: isDragging && !reduceMotion ? 'transform 120ms ease' : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative flex items-center gap-1 px-3 py-2 text-xs font-medium text-muted-foreground select-none flex-shrink-0',
        isDragging && 'z-10'
      )}
    >
      {!isSelectCol && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-tertiary hover:text-muted-foreground flex-shrink-0"
          aria-label={`Reorder ${
            typeof header.column.columnDef.header === 'string'
              ? header.column.columnDef.header
              : header.id
          } column`}
        >
          <GripVertical className="w-3 h-3" />
        </button>
      )}
      <button
        type="button"
        onClick={sortable ? onSortClick : undefined}
        className={cn(
          'flex items-center gap-1 flex-1 min-w-0 truncate',
          alignClass(
            (header.column.columnDef.meta as { align?: 'left' | 'right' | 'center' })?.align
          ),
          sortable && 'hover:text-foreground cursor-pointer'
        )}
        disabled={!sortable}
      >
        <span className="truncate">
          {typeof header.column.columnDef.header === 'function'
            ? flexRender(header.column.columnDef.header, header.getContext())
            : header.column.columnDef.header}
        </span>
        {sortable &&
          (sortDirection === 'asc' ? (
            <ArrowUp className="w-3 h-3 flex-shrink-0" />
          ) : sortDirection === 'desc' ? (
            <ArrowDown className="w-3 h-3 flex-shrink-0" />
          ) : (
            <ChevronsUpDown className="w-3 h-3 flex-shrink-0 opacity-40" />
          ))}
      </button>
      {header.column.getCanResize() && (
        // Column-resize drag handle - inherently pointer/touch-only (dragging a column
        // edge), same as native OS window/column resize handles; no keyboard equivalent to add.
        // biome-ignore lint/a11y/noStaticElementInteractions: see comment above
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={cn(
            'absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none flex-shrink-0',
            'hover:bg-primary/40',
            header.column.getIsResizing() && 'bg-primary'
          )}
        />
      )}
    </div>
  );
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  selectedIds,
  onSelectionChange,
  initialSort,
  onRowClick,
  rowHeight = 44,
  emptyState,
  className,
}: DataTableProps<T>) {
  const reduceMotion = useReducedMotion() ?? false;
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectionEnabled = Boolean(selectedIds && onSelectionChange);

  const [sorting, setSorting] = useState<SortingState>(
    initialSort ? [{ id: initialSort.columnId, desc: initialSort.desc }] : []
  );
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => [
    ...(selectionEnabled ? [SELECT_COL_ID] : []),
    ...columns.map((c) => c.id),
  ]);

  const tanstackColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    const cols: ColumnDef<T, unknown>[] = [];

    if (selectionEnabled) {
      cols.push({
        id: SELECT_COL_ID,
        header: () => {
          const allIds = data.map(getRowId);
          const selectedCount = allIds.filter((id) => selectedIds?.has(id)).length;
          const state: boolean | 'indeterminate' =
            selectedCount === 0 ? false : selectedCount === allIds.length ? true : 'indeterminate';
          return (
            <DataTableCheckbox
              checked={state}
              aria-label="Select all rows"
              onChange={(checked) => {
                onSelectionChange?.(checked ? new Set(allIds) : new Set());
              }}
            />
          );
        },
        cell: ({ row }) => {
          const id = getRowId(row.original, row.index);
          return (
            <DataTableCheckbox
              checked={selectedIds?.has(id) ?? false}
              aria-label="Select row"
              onChange={(checked) => {
                const next = new Set(selectedIds);
                if (checked) next.add(id);
                else next.delete(id);
                onSelectionChange?.(next);
              }}
            />
          );
        },
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableResizing: false,
      });
    }

    for (const col of columns) {
      cols.push({
        id: col.id,
        header: col.header as string,
        accessorFn: col.accessor,
        cell: ({ row, getValue }) =>
          col.cell ? col.cell(row.original, getValue()) : String(getValue() ?? ''),
        enableSorting: col.sortable !== false,
        size: col.size ?? 160,
        minSize: col.minSize ?? 60,
        maxSize: col.maxSize ?? 800,
        meta: { align: col.align },
      });
    }

    return cols;
  }, [columns, selectionEnabled, data, getRowId, selectedIds, onSelectionChange]);

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting, columnSizing, columnOrder },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const headerGroup = table.getHeaderGroups()[0];

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder((order) => {
      const oldIndex = order.indexOf(String(active.id));
      const newIndex = order.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return order;
      return arrayMove(order, oldIndex, newIndex);
    });
  };

  const totalWidth = headerGroup.headers.reduce((sum, h) => sum + h.getSize(), 0);

  if (data.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    // `ScrollArea`'s own root clips overflow (needed for its rounded corners/fade), so
    // the tick-mark scroll indicator lives one level up, as a sibling - otherwise it'd
    // get cut off any time the fill approaches 0%/100%.
    <div className={cn('relative', className)}>
      <ScrollArea className="h-full w-full" viewportRef={scrollRef} viewportClassName="scroll-fade">
        <div style={{ width: Math.max(totalWidth, 1), minWidth: '100%' }}>
          {/* Sticky header */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={headerGroup.headers.map((h) => h.id)}
              strategy={horizontalListSortingStrategy}
            >
              {/* Virtualized rows are absolutely-positioned divs (translateY), which can't be
                  real <tr>/<td> inside a <table> layout - role="row"/"cell" (below) preserve
                  the a11y tree without breaking virtualization. This header row is static
                  (no click/sort handler on the row itself - sorting is per-column-button
                  inside), so it has nothing to focus. */}
              {/* biome-ignore lint/a11y/useSemanticElements: see comment above */}
              {/* biome-ignore lint/a11y/useFocusableInteractive: see comment above */}
              <div
                className="sticky top-0 z-20 flex bg-background border-b border-border"
                role="row"
              >
                {headerGroup.headers.map((header) => (
                  <HeaderCell
                    key={header.id}
                    header={header}
                    sortable={header.column.getCanSort()}
                    sortDirection={header.column.getIsSorted()}
                    onSortClick={() => header.column.toggleSorting()}
                    reduceMotion={reduceMotion}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Virtualized body */}
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const id = getRowId(row.original, row.index);
              const isSelected = selectionEnabled && selectedIds?.has(id);
              return (
                // biome-ignore lint/a11y/useSemanticElements: see the header row's comment above
                <div
                  key={row.id}
                  role="row"
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={() => onRowClick?.(row.original)}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onRowClick(row.original);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={cn(
                    'flex items-center border-b border-border/50 transition-colors',
                    onRowClick &&
                      'cursor-pointer hover:bg-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2',
                    isSelected && 'bg-accent'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    // biome-ignore lint/a11y/useSemanticElements: see the header row's comment above
                    <div
                      key={cell.id}
                      role="cell"
                      style={{ width: cell.column.getSize() }}
                      className={cn(
                        'flex items-center px-3 text-sm text-foreground min-w-0 flex-shrink-0',
                        alignClass(
                          (cell.column.columnDef.meta as { align?: 'left' | 'right' | 'center' })
                            ?.align
                        )
                      )}
                    >
                      <div className="truncate min-w-0">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
      {/* Nudged left of Radix's own scrollbar track (~14px) so the two don't overlap. */}
      <ScrollProgress
        container={scrollRef}
        position="right"
        tickCount={28}
        height={120}
        width={8}
        showLabel={false}
        className="right-4"
      />
    </div>
  );
}
