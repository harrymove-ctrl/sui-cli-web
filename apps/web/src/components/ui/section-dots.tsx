import { motion } from 'framer-motion';

interface SectionDotsProps {
  sections: { id: string; label: string }[];
  activeIndex: number;
  onDotClick: (id: string) => void;
}

export function SectionDots({ sections, activeIndex, onDotClick }: SectionDotsProps) {
  return (
    <motion.div
      className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 2, duration: 0.5 }}
    >
      {sections.map((section, index) => (
        <button
          key={section.id}
          onClick={() => onDotClick(section.id)}
          className="group relative flex items-center justify-end"
          aria-label={`Go to ${section.label}`}
        >
          {/* Label on hover */}
          <span className="absolute right-8 px-2 py-1 bg-black/80 border border-rose-500/30 rounded text-xs font-mono text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {section.label}
          </span>

          {/* Dot */}
          <motion.div
            className={`w-2.5 h-2.5 rounded-full border transition-all ${
              index === activeIndex
                ? 'bg-rose-500 border-rose-500 scale-125'
                : 'bg-transparent border-rose-500/50 hover:border-rose-400'
            }`}
            whileHover={{ scale: 1.3 }}
            whileTap={{ scale: 0.9 }}
          />
        </button>
      ))}
    </motion.div>
  );
}
