import { clsx } from 'clsx';

interface KbdProps {
  children: React.ReactNode;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={clsx(
        'inline-flex items-center justify-center px-1.5 py-0.5',
        'text-xs font-medium text-text-secondary',
        'bg-background-tertiary border border-border rounded',
        'min-w-[20px]',
        className
      )}
    >
      {children}
    </kbd>
  );
}
