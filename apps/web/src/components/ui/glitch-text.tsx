import { useState } from 'react';

interface GlitchTextProps {
  children: React.ReactNode;
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
}

export function GlitchText({ children, className = '', intensity = 'medium' }: GlitchTextProps) {
  const [isGlitching, setIsGlitching] = useState(false);

  const intensityClasses = {
    low: 'glitch-text-low',
    medium: 'glitch-text-medium',
    high: 'glitch-text-high',
  };

  return (
    <span
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsGlitching(true)}
      onMouseLeave={() => setIsGlitching(false)}
    >
      <span className={`relative ${isGlitching ? intensityClasses[intensity] : ''}`}>
        {children}
      </span>

      {/* Glitch layers for RGB split effect */}
      {isGlitching && (
        <>
          <span
            className="absolute top-0 left-0 w-full text-rose-500 opacity-70 pointer-events-none glitch-layer-1"
            aria-hidden="true"
          >
            {children}
          </span>
          <span
            className="absolute top-0 left-0 w-full text-cyan-500 opacity-70 pointer-events-none glitch-layer-2"
            aria-hidden="true"
          >
            {children}
          </span>
        </>
      )}

      <style jsx>{`
        @keyframes glitch-anim-1 {
          0% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(-2px, -2px); }
          60% { transform: translate(2px, 2px); }
          80% { transform: translate(2px, -2px); }
          100% { transform: translate(0); }
        }

        @keyframes glitch-anim-2 {
          0% { transform: translate(0); }
          20% { transform: translate(2px, -2px); }
          40% { transform: translate(2px, 2px); }
          60% { transform: translate(-2px, -2px); }
          80% { transform: translate(-2px, 2px); }
          100% { transform: translate(0); }
        }

        .glitch-text-low {
          animation: glitch-anim-1 0.3s ease-in-out 1;
        }

        .glitch-text-medium {
          animation: glitch-anim-1 0.3s ease-in-out 2;
        }

        .glitch-text-high {
          animation: glitch-anim-1 0.2s ease-in-out infinite;
        }

        .glitch-layer-1 {
          animation: glitch-anim-1 0.3s ease-in-out infinite;
        }

        .glitch-layer-2 {
          animation: glitch-anim-2 0.3s ease-in-out infinite;
        }
      `}</style>
    </span>
  );
}
