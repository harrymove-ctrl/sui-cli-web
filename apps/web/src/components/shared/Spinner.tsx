import { Loader } from '@/components/ui/loader';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Preserve the original sm/md/lg API (used in ~10 places) but render the shared
// motion Loader underneath, so every existing `<Spinner />` becomes the new
// animated loader with no call-site changes. Colour stays `text-accent` unless a
// caller overrides it via className (twMerge keeps the last text-* class).
const SIZE_PX = { sm: 16, md: 24, lg: 32 } as const;

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <Loader variant="spinner" size={SIZE_PX[size]} className={cn('text-accent', className)} />
  );
}
