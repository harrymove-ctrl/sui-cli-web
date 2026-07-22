import { ReactNode } from 'react';
import { clsx } from 'clsx';

type TerminalVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

interface TerminalSectionProps {
  title?: string;
  children: ReactNode;
  variant?: TerminalVariant;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  icon?: string;
  badge?: string;
  actions?: ReactNode;
}

const variantStyles: Record<TerminalVariant, { border: string; title: string; accent: string }> = {
  default: {
    border: 'border-white/10',
    title: 'text-white/60',
    accent: '#4da2ff'
  },
  success: {
    border: 'border-green-500/30',
    title: 'text-green-400/80',
    accent: '#34c759'
  },
  error: {
    border: 'border-red-500/30',
    title: 'text-red-400/80',
    accent: '#ff453a'
  },
  warning: {
    border: 'border-yellow-500/30',
    title: 'text-yellow-400/80',
    accent: '#ff9f0a'
  },
  info: {
    border: 'border-cyan-500/30',
    title: 'text-cyan-400/80',
    accent: '#64d2ff'
  }
};

export function TerminalSection({
  title,
  children,
  variant = 'default',
  className,
  icon,
  badge,
  actions,
}: TerminalSectionProps) {
  const styles = variantStyles[variant];

  return (
    <div className={clsx(
      'relative bg-black/40 backdrop-blur-sm border rounded-lg overflow-hidden',
      styles.border,
      className
    )}>
      {/* ASCII-style header */}
      {title && (
        <div className={clsx(
          'flex items-center justify-between px-3 py-2 border-b font-mono',
          styles.border
        )}>
          <div className="flex items-center gap-2">
            {/* ASCII corner decoration */}
            <span className="text-white/20 text-xs select-none">{'['}</span>

            {icon && <span className="text-sm">{icon}</span>}

            <span className={clsx('text-xs uppercase tracking-wider', styles.title)}>
              {title}
            </span>

            <span className="text-white/20 text-xs select-none">{']'}</span>

            {badge && (
              <span
                className="px-1.5 py-0.5 text-[10px] rounded font-medium"
                style={{
                  backgroundColor: `${styles.accent}20`,
                  color: styles.accent
                }}
              >
                {badge}
              </span>
            )}
          </div>

          {actions && (
            <div className="flex items-center gap-1">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-3 font-mono text-sm">
        {children}
      </div>

      {/* Subtle scanline overlay for terminal feel */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
        }}
      />
    </div>
  );
}

// Terminal-style divider
export function TerminalDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-2 font-mono">
      <div className="flex-1 border-t border-white/10 border-dashed" />
      {label && (
        <span className="text-[10px] text-white/30 uppercase tracking-widest">
          {label}
        </span>
      )}
      <div className="flex-1 border-t border-white/10 border-dashed" />
    </div>
  );
}

// Terminal-style key-value row
export function TerminalRow({
  label,
  value,
  mono = true,
  copyable = false,
  variant = 'default'
}: {
  label: string;
  value: string | ReactNode;
  mono?: boolean;
  copyable?: boolean;
  variant?: 'default' | 'highlight' | 'dim';
}) {
  const valueStyles = {
    default: 'text-white/80',
    highlight: 'text-[#4da2ff]',
    dim: 'text-white/40'
  };

  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-white/40">{label}</span>
      <span className={clsx(
        mono && 'font-mono',
        valueStyles[variant],
        copyable && 'cursor-pointer hover:text-white transition-colors'
      )}>
        {value}
      </span>
    </div>
  );
}

// Terminal-style status indicator
export function TerminalStatus({
  status,
  label
}: {
  status: 'success' | 'error' | 'pending' | 'warning';
  label?: string;
}) {
  const statusConfig = {
    success: { color: '#34c759', symbol: '✓', text: 'SUCCESS' },
    error: { color: '#ff453a', symbol: '✗', text: 'FAILED' },
    pending: { color: '#ff9f0a', symbol: '◌', text: 'PENDING' },
    warning: { color: '#ff9f0a', symbol: '!', text: 'WARNING' }
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <span
        className="w-4 text-center font-bold"
        style={{ color: config.color }}
      >
        {config.symbol}
      </span>
      <span style={{ color: config.color }}>
        {label || config.text}
      </span>
    </div>
  );
}

// Terminal-style command display
export function TerminalCommand({
  command,
  output,
  status
}: {
  command: string;
  output?: string;
  status?: 'running' | 'completed' | 'error';
}) {
  return (
    <div className="font-mono text-xs space-y-1">
      {/* Command line */}
      <div className="flex items-center gap-2">
        <span className="text-[#4da2ff] font-bold">$</span>
        <span className="text-white/90">{command}</span>
        {status === 'running' && (
          <span className="text-yellow-400 animate-pulse">...</span>
        )}
      </div>

      {/* Output */}
      {output && (
        <div className="pl-4 text-white/60 whitespace-pre-wrap">
          {output}
        </div>
      )}
    </div>
  );
}
