import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

interface Section {
  id: string;
  title: ReactNode;
  level: number;
}

interface ScrollIndicatorProps {
  sections: Section[];
  /** Extra offset from the top when deciding which section is current, in px.
   *  Should match the page's scroll-margin so a clicked target reads as active. */
  topOffset?: number;
  className?: string;
}

const TOTAL_TICKS = 60;

/**
 * A ruler down the right edge that tracks which section the reader is in.
 *
 * Two things differ from the usual "table of contents" version. It watches the
 * document rather than a scroll container, because this page scrolls the window.
 * And the active section is the last heading to have passed the top of the
 * viewport, not whichever heading happens to be intersecting - with entries
 * taller than the screen, an intersection test leaves long stretches where no
 * heading is on screen at all and the indicator falls back to nothing.
 */
export function ScrollIndicator({ sections, topOffset = 96, className }: ScrollIndicatorProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [trackHeight, setTrackHeight] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const progressY = useMotionValue(0);
  const smoothY = useSpring(progressY, {
    stiffness: reduceMotion ? 1000 : 300,
    damping: reduceMotion ? 100 : 30,
  });

  const filteredSections = sections.filter((s) => s.level === 2 || s.level === 3);
  const count = filteredSections.length;

  const updateHeight = useCallback(() => {
    if (trackRef.current) setTrackHeight(trackRef.current.clientHeight);
  }, []);

  useEffect(() => {
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [updateHeight]);

  // Scroll spy. rAF-throttled because scroll fires far more often than the
  // answer can change, and every recompute reads layout.
  useEffect(() => {
    if (count === 0) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      let current = 0;
      for (let i = 0; i < count; i++) {
        const el = document.getElementById(filteredSections[i].id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - topOffset <= 1) current = i;
      }
      // Bottom of the page can leave the last section unreachable when it is
      // shorter than the viewport; treat "scrolled to the end" as being in it.
      const atEnd =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setActiveIndex(atEnd ? count - 1 : current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [count, filteredSections, topOffset]);

  useEffect(() => {
    if (trackHeight <= 0 || count === 0) return;
    progressY.set((activeIndex / Math.max(count - 1, 1)) * trackHeight);
  }, [activeIndex, trackHeight, count, progressY]);

  const handleClick = (index: number) => {
    const el = document.getElementById(filteredSections[index].id);
    if (!el) return;
    // The page sets scroll-mt on the entries, so scrollIntoView lands correctly
    // without recomputing offsets here.
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  if (count === 0) return null;

  return (
    <div className={className}>
      <nav
        aria-label="Releases"
        ref={trackRef}
        className="relative h-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={(e) => {
          // Keep the labels up while focus moves between them.
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsHovered(false);
        }}
      >
        <div className="absolute inset-0">
          {Array.from({ length: TOTAL_TICKS }).map((_, i) => {
            const y = (i / (TOTAL_TICKS - 1)) * trackHeight;
            const isMajor = i % 5 === 0;
            const isPast = i / (TOTAL_TICKS - 1) <= activeIndex / Math.max(count - 1, 1);

            return (
              <div key={i} className="absolute right-0 flex items-center" style={{ top: `${y}px` }}>
                <div
                  className={[
                    'h-px transition-colors duration-150',
                    isMajor ? 'w-3' : 'w-1.5',
                    isPast ? 'bg-white' : isMajor ? 'bg-white/50' : 'bg-white/25',
                  ].join(' ')}
                />
              </div>
            );
          })}

          {filteredSections.map((section, i) => {
            const y = (i / Math.max(count - 1, 1)) * trackHeight;
            const isActive = i === activeIndex;

            return (
              <div key={section.id}>
                <div
                  className={[
                    'absolute right-0 h-px transition-colors duration-200',
                    section.level === 2 ? 'w-4' : 'w-3',
                    isActive ? 'bg-white' : 'bg-white/60',
                  ].join(' ')}
                  style={{ top: `${y}px` }}
                />

                <div
                  className={[
                    'absolute flex items-center',
                    reduceMotion ? '' : 'transition-[opacity,transform] duration-200 ease-out',
                    isHovered ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0',
                  ].join(' ')}
                  style={{
                    top: `${y - 7}px`,
                    right: '20px',
                    // Staggered on the way in, simultaneous on the way out, so
                    // dismissing never feels like it is unwinding a list.
                    transitionDelay: isHovered ? `${i * 35}ms` : '0ms',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleClick(i)}
                    tabIndex={isHovered ? 0 : -1}
                    className={[
                      'cursor-pointer whitespace-nowrap rounded-sm border-0 bg-transparent p-0',
                      'font-mono text-[11px] uppercase tracking-wider transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white',
                      isActive ? 'text-white' : 'text-white/50 hover:text-white',
                    ].join(' ')}
                  >
                    {section.title}
                  </button>
                </div>
              </div>
            );
          })}

          <motion.div className="absolute right-0 z-20" style={{ top: smoothY }}>
            <div className="h-px w-4 bg-white" />
            <div
              className={[
                'absolute top-0 -left-8 -translate-y-1/2 transition-opacity duration-200',
                isHovered ? 'opacity-0' : 'opacity-100',
              ].join(' ')}
            >
              <span className="font-mono text-[10px] tabular-nums text-white">
                {activeIndex + 1}/{count}
              </span>
            </div>
          </motion.div>
        </div>
      </nav>
    </div>
  );
}

export default ScrollIndicator;
