import { useEffect, useState } from 'react';

interface ProgressDotsProps {
  sections: string[];
  currentSection: number;
  className?: string;
  onDotClick?: (index: number) => void;
}

export function ProgressDots({
  sections,
  currentSection,
  className = '',
  onDotClick
}: ProgressDotsProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(currentSection);
  }, [currentSection]);

  return (
    <div className={`fixed right-8 top-1/2 -translate-y-1/2 z-50 ${className}`}>
      <div className="flex flex-col gap-4">
        {sections.map((section, index) => (
          <button
            key={section}
            onClick={() => onDotClick?.(index)}
            className="group relative flex items-center justify-end"
            aria-label={`Navigate to ${section}`}
          >
            {/* Label - shows on hover */}
            <span className="absolute right-8 px-3 py-1.5 bg-slate-900/90 border border-rose-500/30 rounded-lg text-xs font-mono text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {section}
            </span>

            {/* Dot */}
            <div className="relative">
              {/* Active glow */}
              {index === progress && (
                <div className="absolute inset-0 rounded-full bg-rose-500/30 blur-md animate-pulse" />
              )}

              {/* Dot circle */}
              <div
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  index === progress
                    ? 'bg-rose-500 scale-150'
                    : index < progress
                    ? 'bg-rose-500/50'
                    : 'bg-white/20 group-hover:bg-white/40'
                }`}
              />
            </div>
          </button>
        ))}

        {/* Progress line */}
        <div className="absolute top-0 right-1 w-px h-full -z-10">
          <div className="w-full h-full bg-white/10" />
          <div
            className="absolute top-0 w-full bg-gradient-to-b from-rose-500 to-pink-500 transition-all duration-500"
            style={{ height: `${(progress / (sections.length - 1)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
