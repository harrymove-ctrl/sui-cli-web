import { ArrowDown } from 'lucide-react';

interface ScrollIndicatorProps {
  onClick?: () => void;
  className?: string;
}

export function ScrollIndicator({ onClick, className = '' }: ScrollIndicatorProps) {
  return (
    <div className={`flex flex-col items-center gap-2 cursor-pointer group ${className}`} onClick={onClick}>
      <span className="text-white/40 text-sm font-mono uppercase tracking-wider group-hover:text-rose-400 transition-colors">
        Scroll Down
      </span>
      <div className="relative">
        {/* Outer glow ring */}
        <div className="absolute inset-0 animate-ping opacity-20">
          <div className="w-12 h-12 rounded-full border-2 border-rose-500" />
        </div>

        {/* Main arrow container */}
        <div className="relative w-12 h-12 rounded-full border border-rose-500/30 bg-rose-500/10 backdrop-blur-sm flex items-center justify-center group-hover:border-rose-500/60 group-hover:bg-rose-500/20 transition-all">
          {/* Arrow with bounce animation */}
          <ArrowDown
            className="w-5 h-5 text-rose-400 animate-bounce group-hover:text-rose-300 transition-colors"
            strokeWidth={2.5}
          />
        </div>

        {/* Pulsing glow effect */}
        <div className="absolute inset-0 rounded-full bg-rose-500/20 blur-xl animate-pulse" />
      </div>

      {/* Vertical dotted line below */}
      <div className="w-px h-16 bg-gradient-to-b from-rose-500/50 via-rose-500/20 to-transparent" />
    </div>
  );
}
