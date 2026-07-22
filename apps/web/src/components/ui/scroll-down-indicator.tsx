import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface ScrollDownIndicatorProps {
  onClick?: () => void;
  className?: string;
}

export function ScrollDownIndicator({ onClick, className = '' }: ScrollDownIndicatorProps) {
  return (
    <motion.button
      onClick={onClick}
      className={`group flex flex-col items-center gap-2 cursor-pointer ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.5, duration: 0.5 }}
    >
      <span className="text-xs font-mono text-rose-400/60 uppercase tracking-widest">
        Scroll Down
      </span>
      <motion.div
        className="relative"
        animate={{ y: [0, 8, 0] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 blur-md bg-rose-500/50 rounded-full" />
        <div className="relative p-2 border border-rose-500/50 rounded-full bg-black/50 backdrop-blur-sm group-hover:border-rose-400 group-hover:bg-rose-500/10 transition-all">
          <ChevronDown className="w-5 h-5 text-rose-400" />
        </div>
      </motion.div>
    </motion.button>
  );
}
