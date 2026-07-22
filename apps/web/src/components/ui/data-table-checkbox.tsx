import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataTableCheckboxProps {
  checked: boolean | 'indeterminate';
  onChange: (checked: boolean) => void;
  'aria-label': string;
}

export function DataTableCheckbox({ checked, onChange, ...props }: DataTableCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked === 'indeterminate' ? 'mixed' : checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange(checked !== true);
      }}
      className={cn(
        'flex items-center justify-center w-4 h-4 rounded border transition-colors flex-shrink-0',
        checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/50'
      )}
      {...props}
    >
      {checked === 'indeterminate' ? (
        <Minus className="w-3 h-3" strokeWidth={3} />
      ) : checked ? (
        <Check className="w-3 h-3" strokeWidth={3} />
      ) : null}
    </button>
  );
}
