import { cn } from '@/lib/utils';

interface AnimatedGradientProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'blue' | 'green' | 'purple' | 'ocean' | 'teal';
}

export function AnimatedGradient({ children, className, variant = 'blue' }: AnimatedGradientProps) {
  const gradients = {
    blue: 'from-blue-500/10 via-cyan-500/10 to-blue-500/10',
    green: 'from-green-500/10 via-emerald-500/10 to-green-500/10',
    purple: 'from-purple-500/10 via-pink-500/10 to-purple-500/10',
    ocean: 'from-blue-600/10 via-teal-500/10 to-cyan-500/10',
    teal: 'from-teal-500/10 via-cyan-500/10 to-teal-500/10',
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Animated gradient background */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-r animate-gradient-x',
          gradients[variant]
        )}
        style={{
          backgroundSize: '200% 200%',
        }}
      />
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
