'use client';

import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState, useRef, useCallback } from 'react';

interface Section {
  id: string;
  title: string;
}

interface ScrollProgressProps {
  sections?: Section[];
  showPercentage?: boolean;
  showSectionNav?: boolean;
}

export function ScrollProgress({
  sections = [],
  showPercentage = true,
  showSectionNav = true,
}: ScrollProgressProps) {
  const { scrollYProgress } = useScroll();
  const [activeSection, setActiveSection] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [displayPercentage, setDisplayPercentage] = useState(0);

  // Use refs to avoid re-renders during scroll
  const rafRef = useRef<number | null>(null);
  const lastPercentageRef = useRef(0);

  // Smooth spring animation for progress bar - optimized settings
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 25,
    restDelta: 0.01, // Less precise = fewer updates
  });

  // Percentage display - throttled updates
  const percentage = useTransform(scrollYProgress, [0, 1], [0, 100]);

  useEffect(() => {
    const unsubscribe = percentage.on('change', (v) => {
      const rounded = Math.round(v);
      // Only update if changed by more than 1%
      if (Math.abs(rounded - lastPercentageRef.current) >= 1) {
        lastPercentageRef.current = rounded;
        setDisplayPercentage(rounded);
      }
    });
    return () => unsubscribe();
  }, [percentage]);

  // Combined scroll handler with RAF throttling
  const handleScrollThrottled = useCallback(() => {
    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      // Visibility check
      const shouldBeVisible = window.scrollY > 100;
      setIsVisible(prev => prev !== shouldBeVisible ? shouldBeVisible : prev);

      // Section tracking
      if (sections.length > 0) {
        const viewportThreshold = window.innerHeight / 3;
        let currentSection = 0;

        for (let i = sections.length - 1; i >= 0; i--) {
          const el = document.getElementById(sections[i].id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= viewportThreshold) {
              currentSection = i;
              break;
            }
          }
        }

        setActiveSection(prev => prev !== currentSection ? currentSection : prev);
      }

      rafRef.current = null;
    });
  }, [sections]);

  useEffect(() => {
    window.addEventListener('scroll', handleScrollThrottled, { passive: true });
    handleScrollThrottled(); // Initial check
    return () => {
      window.removeEventListener('scroll', handleScrollThrottled);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScrollThrottled]);

  return (
    <>
      {/* Fixed Progress Bar at Top */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-white/5 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: isVisible ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-[#4da2ff] to-[#00d4ff] origin-left"
          style={{ scaleX }}
        />
        {/* Glow effect */}
        <motion.div
          className="absolute top-0 h-1 w-20 bg-gradient-to-r from-transparent via-[#4da2ff]/50 to-transparent blur-sm"
          style={{
            left: useTransform(scrollYProgress, [0, 1], ['0%', '100%']),
            x: '-50%',
          }}
        />
      </motion.div>

      {/* Floating Percentage Indicator - Hidden on mobile, positioned to avoid ThemeToggle overlap */}
      {showPercentage && (
        <motion.div
          className="fixed top-20 sm:top-4 right-4 sm:right-20 z-40 hidden sm:block"
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{
            opacity: isVisible ? 1 : 0,
            y: isVisible ? 0 : -20,
            scale: isVisible ? 1 : 0.9,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="glass rounded-lg px-3 py-2 font-mono text-sm flex items-center gap-1">
            <span className="text-[#4da2ff] font-semibold tabular-nums">
              {displayPercentage}
            </span>
            <span className="text-white/40">%</span>
          </div>
        </motion.div>
      )}

      {/* Section Navigation - Hidden on mobile, shown on desktop */}
      {showSectionNav && sections.length > 0 && (
        <motion.div
          className="fixed bottom-6 left-1/2 z-50 hidden sm:block w-[calc(100vw-48px)] max-w-4xl"
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{
            opacity: isVisible ? 1 : 0,
            y: isVisible ? 0 : 20,
            x: '-50%',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        >
          <div className="glass rounded-full px-2 py-1.5 flex gap-1 justify-center">
            {sections.map((section, index) => (
              <motion.button
                key={section.id}
                onClick={() => {
                  document.getElementById(section.id)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }}
                className={`
                  px-2 lg:px-3 py-1.5 rounded-full text-[10px] lg:text-xs font-mono transition-all duration-200
                  truncate min-w-0
                  ${index === activeSection
                    ? 'bg-[#4da2ff] text-white shadow-lg shadow-[#4da2ff]/25'
                    : 'text-white/50 hover:text-white hover:bg-white/10'
                  }
                `}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={section.title}
              >
                {section.title}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Mobile: Simple dot navigation */}
      {showSectionNav && sections.length > 0 && (
        <motion.div
          className="fixed bottom-4 left-1/2 z-50 sm:hidden"
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{
            opacity: isVisible ? 1 : 0,
            y: isVisible ? 0 : 20,
            x: '-50%',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
        >
          <div className="glass rounded-full px-3 py-2 flex gap-2 items-center">
            {sections.map((section, index) => (
              <button
                key={section.id}
                onClick={() => {
                  document.getElementById(section.id)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }}
                className={`
                  w-2 h-2 rounded-full transition-all duration-200
                  ${index === activeSection
                    ? 'bg-[#4da2ff] scale-125'
                    : 'bg-white/30 hover:bg-white/50'
                  }
                `}
                aria-label={section.title}
              />
            ))}
          </div>
        </motion.div>
      )}
    </>
  );
}
