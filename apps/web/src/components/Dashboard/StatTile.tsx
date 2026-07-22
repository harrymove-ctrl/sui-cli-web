import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  caption?: string;
  pillColor?: 'green' | 'blue' | 'amber';
  className?: string;
}

const DOT_COLOR: Record<NonNullable<StatTileProps['pillColor']>, string> = {
  green: 'bg-success',
  blue: 'bg-primary',
  amber: 'bg-warning',
};

export function StatTile({
  icon: Icon,
  label,
  value,
  caption,
  pillColor = 'blue',
  className,
}: StatTileProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', DOT_COLOR[pillColor])} />
        <span className="text-2xl font-semibold font-mono text-foreground">{value}</span>
      </div>
      {caption && <span className="text-xs text-tertiary">{caption}</span>}
    </div>
  );
}
