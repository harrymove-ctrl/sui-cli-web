import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Text used to derive the fallback initial (e.g. an alias or address) */
  label?: string;
}

function Avatar({ className, label, children, ...props }: AvatarProps) {
  const initial = label?.trim()?.[0]?.toUpperCase() ?? '?';
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-semibold flex-shrink-0 overflow-hidden',
        className
      )}
      {...props}
    >
      {children ?? initial}
    </div>
  );
}

export { Avatar };
