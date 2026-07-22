import { GripVertical } from 'lucide-react';
import { Group, Panel, Separator, type GroupProps, type PanelProps, type SeparatorProps } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

function Resizable({ className, ...props }: GroupProps) {
  return (
    <Group
      className={cn('flex h-full w-full data-[orientation=vertical]:flex-col', className)}
      {...props}
    />
  );
}

function ResizablePanel({ className, ...props }: PanelProps) {
  return <Panel className={cn('min-w-0 min-h-0', className)} {...props} />;
}

function ResizableHandle({
  className,
  withHandle = false,
  ...props
}: SeparatorProps & { withHandle?: boolean }) {
  return (
    <Separator
      className={cn(
        'relative flex w-px items-center justify-center bg-border transition-colors',
        'hover:bg-[#4da2ff]/50 data-[resize-handle-active]:bg-[#4da2ff]',
        'data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full',
        'cursor-col-resize data-[orientation=vertical]:cursor-row-resize',
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-8 w-3 items-center justify-center rounded-sm border border-border bg-card">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
    </Separator>
  );
}

export { Resizable, ResizablePanel, ResizableHandle };
