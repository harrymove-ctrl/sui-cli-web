import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface MasonryGridProps {
  children: ReactNode[];
  columns?: number;
  gap?: number;
  className?: string;
}

export function MasonryGrid({
  children,
  columns = 3,
  gap = 16,
  className
}: MasonryGridProps) {
  const [columnWrappers, setColumnWrappers] = useState<ReactNode[][]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = Array.from(children);
    const cols: ReactNode[][] = Array.from({ length: columns }, () => []);

    items.forEach((child, i) => {
      cols[i % columns].push(child);
    });

    setColumnWrappers(cols);
  }, [children, columns]);

  return (
    <div
      ref={containerRef}
      className={cn('flex', className)}
      style={{ gap: `${gap}px` }}
    >
      {columnWrappers.map((col, colIndex) => (
        <div
          key={colIndex}
          className="flex-1 flex flex-col"
          style={{ gap: `${gap}px` }}
        >
          {col.map((item, itemIndex) => (
            <div
              key={itemIndex}
              className="animate-fade-in"
              style={{
                animationDelay: `${(colIndex * 50) + (itemIndex * 100)}ms`,
                animationFillMode: 'backwards'
              }}
            >
              {item}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
