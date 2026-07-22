import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface LiquidGlassProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'cyan' | 'purple' | 'emerald' | 'amber' | 'rose';
  intensity?: 'low' | 'medium' | 'high';
  animated?: boolean;
  glow?: boolean;
}

export function LiquidGlass({
  children,
  className,
  variant = 'default',
  intensity = 'medium',
  animated = true,
  glow = true,
}: LiquidGlassProps) {
  const variants = {
    default: {
      border: 'border-white/20',
      gradient: 'from-white/10 via-white/5 to-transparent',
      glow: 'shadow-[0_0_80px_rgba(77,162,255,0.15)]',
      accent: 'before:from-[#4da2ff]/20 before:to-transparent',
    },
    cyan: {
      border: 'border-cyan-500/30',
      gradient: 'from-cyan-500/15 via-cyan-500/5 to-transparent',
      glow: 'shadow-[0_0_80px_rgba(34,211,238,0.2)]',
      accent: 'before:from-cyan-400/30 before:to-transparent',
    },
    purple: {
      border: 'border-purple-500/30',
      gradient: 'from-purple-500/15 via-purple-500/5 to-transparent',
      glow: 'shadow-[0_0_80px_rgba(168,85,247,0.2)]',
      accent: 'before:from-purple-400/30 before:to-transparent',
    },
    emerald: {
      border: 'border-emerald-500/30',
      gradient: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      glow: 'shadow-[0_0_80px_rgba(52,211,153,0.2)]',
      accent: 'before:from-emerald-400/30 before:to-transparent',
    },
    amber: {
      border: 'border-amber-500/30',
      gradient: 'from-amber-500/15 via-amber-500/5 to-transparent',
      glow: 'shadow-[0_0_80px_rgba(245,158,11,0.2)]',
      accent: 'before:from-amber-400/30 before:to-transparent',
    },
    rose: {
      border: 'border-rose-500/30',
      gradient: 'from-rose-500/15 via-rose-500/5 to-transparent',
      glow: 'shadow-[0_0_80px_rgba(244,63,94,0.2)]',
      accent: 'before:from-rose-400/30 before:to-transparent',
    },
  };

  const intensities = {
    low: {
      backdrop: 'backdrop-blur-sm',
      bg: 'bg-white/[0.02]',
    },
    medium: {
      backdrop: 'backdrop-blur-xl',
      bg: 'bg-white/[0.05]',
    },
    high: {
      backdrop: 'backdrop-blur-2xl',
      bg: 'bg-white/[0.08]',
    },
  };

  const v = variants[variant];
  const i = intensities[intensity];

  return (
    <div
      className={cn(
        'relative rounded-3xl overflow-hidden',
        i.backdrop,
        i.bg,
        v.border,
        'border',
        glow && v.glow,
        animated && 'transition-all duration-500 hover:scale-[1.01]',
        // Inner gradient overlay
        'before:absolute before:inset-0 before:bg-gradient-to-br',
        v.accent,
        'before:pointer-events-none before:opacity-50',
        // Shimmer effect
        animated &&
          'after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent after:translate-x-[-200%] hover:after:translate-x-[200%] after:transition-transform after:duration-1000 after:pointer-events-none',
        className
      )}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// Aurora Background Effect
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />

      {/* Aurora blobs */}
      <div
        className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-cyan-500/30 via-transparent to-transparent animate-aurora blur-3xl"
        style={{ animationDelay: '0s' }}
      />
      <div
        className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-purple-500/20 via-transparent to-transparent animate-aurora blur-3xl"
        style={{ animationDelay: '5s' }}
      />
      <div
        className="absolute top-1/4 right-1/4 w-1/2 h-1/2 bg-gradient-radial from-blue-500/20 via-transparent to-transparent animate-aurora blur-3xl"
        style={{ animationDelay: '2.5s' }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(rgba(77,162,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(77,162,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay">
        <svg className="w-full h-full">
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </div>
    </div>
  );
}

// Morphing blob
export function MorphBlob({
  className,
  color = 'cyan',
}: {
  className?: string;
  color?: 'cyan' | 'purple' | 'emerald' | 'blue';
}) {
  const colors = {
    cyan: 'from-cyan-500/40 to-cyan-300/20',
    purple: 'from-purple-500/40 to-purple-300/20',
    emerald: 'from-emerald-500/40 to-emerald-300/20',
    blue: 'from-blue-500/40 to-blue-300/20',
  };

  return (
    <div
      className={cn(
        'absolute w-64 h-64 bg-gradient-to-br blur-3xl animate-morph',
        colors[color],
        className
      )}
    />
  );
}

// Glowing orb
export function GlowOrb({
  className,
  size = 'md',
  color = 'cyan',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'cyan' | 'purple' | 'emerald' | 'amber';
}) {
  const sizes = {
    sm: 'w-32 h-32',
    md: 'w-48 h-48',
    lg: 'w-64 h-64',
    xl: 'w-96 h-96',
  };

  const colors = {
    cyan: 'bg-cyan-500',
    purple: 'bg-purple-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
  };

  return (
    <div
      className={cn(
        'absolute rounded-full blur-3xl opacity-30 animate-glow-pulse',
        sizes[size],
        colors[color],
        className
      )}
    />
  );
}

// Status indicator with ripple
export function StatusIndicator({
  status,
  label,
  className,
}: {
  status: 'connected' | 'disconnected' | 'pending';
  label?: string;
  className?: string;
}) {
  const statusConfig = {
    connected: {
      color: 'bg-emerald-500',
      ring: 'ring-emerald-500/30',
      glow: 'shadow-emerald-500/50',
      text: 'text-emerald-400',
    },
    disconnected: {
      color: 'bg-rose-500',
      ring: 'ring-rose-500/30',
      glow: 'shadow-rose-500/50',
      text: 'text-rose-400',
    },
    pending: {
      color: 'bg-amber-500',
      ring: 'ring-amber-500/30',
      glow: 'shadow-amber-500/50',
      text: 'text-amber-400',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative">
        <div
          className={cn(
            'w-3 h-3 rounded-full',
            config.color,
            'shadow-lg',
            config.glow
          )}
        />
        {status === 'pending' && (
          <div
            className={cn(
              'absolute inset-0 rounded-full animate-ripple',
              config.color,
              'opacity-40'
            )}
          />
        )}
        <div
          className={cn(
            'absolute -inset-1 rounded-full ring-2',
            config.ring,
            'animate-pulse'
          )}
        />
      </div>
      {label && (
        <span className={cn('text-sm font-medium', config.text)}>{label}</span>
      )}
    </div>
  );
}
