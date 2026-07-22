'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState, useEffect, useMemo, type ReactNode } from 'react';

/**
 * Hook to get the current theme from data-theme attribute
 */
function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Get initial theme
    const getTheme = () => {
      const dataTheme = document.documentElement.getAttribute('data-theme');
      return dataTheme === 'light' ? 'light' : 'dark';
    };

    setTheme(getTheme());

    // Observe theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          setTheme(getTheme());
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  return theme;
}

interface ProgressiveBlurProps {
  children: ReactNode;
  className?: string;
  /** Start blur at this scroll progress (0-1) */
  blurStart?: number;
  /** End blur at this scroll progress (0-1) */
  blurEnd?: number;
  /** Maximum blur amount in pixels */
  maxBlur?: number;
}

/**
 * Scroll-based progressive blur effect.
 * Content gradually blurs as user scrolls past.
 * Optimized: Uses CSS will-change and memoized transforms.
 */
export function ProgressiveBlur({
  children,
  className = '',
  blurStart = 0.6,
  blurEnd = 1,
  maxBlur = 8,
}: ProgressiveBlurProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Memoize transforms to prevent recreation on every render
  const blur = useTransform(
    scrollYProgress,
    [blurStart, blurEnd],
    [0, maxBlur],
    { clamp: true }
  );

  const opacity = useTransform(
    scrollYProgress,
    [blurStart, blurEnd],
    [1, 0.5]
  );

  // Pre-compute filter string transform (stable reference)
  const filterBlur = useTransform(blur, (v) => `blur(${v}px)`);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <motion.div
        style={{
          filter: filterBlur,
          opacity,
          willChange: 'filter, opacity',
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

interface BlurOverlayProps {
  direction?: 'top' | 'bottom' | 'both';
  intensity?: 'light' | 'medium' | 'heavy';
  height?: string;
  className?: string;
}

/**
 * Static CSS-only blur overlay for text sections.
 * Creates elegant visual depth with gradient overlays.
 * Theme-aware: adapts colors to light/dark mode.
 */
export function BlurOverlay({
  direction = 'bottom',
  intensity = 'medium',
  height = '80px',
  className = '',
}: BlurOverlayProps) {
  const theme = useTheme();

  const blurValues = {
    light: '4px',
    medium: '8px',
    heavy: '16px',
  };

  const blur = blurValues[intensity];

  // Theme-aware colors
  const bgColor = theme === 'light' ? 'rgba(250, 250, 250' : 'rgba(10, 10, 10';

  const baseStyles = {
    height,
    backdropFilter: `blur(${blur})`,
    WebkitBackdropFilter: `blur(${blur})`,
  };

  const topGradient = {
    ...baseStyles,
    background: `linear-gradient(to bottom, ${bgColor}, 0.9) 0%, ${bgColor}, 0.6) 30%, transparent 100%)`,
    maskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
    WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 100%)',
  };

  const bottomGradient = {
    ...baseStyles,
    background: `linear-gradient(to top, ${bgColor}, 0.9) 0%, ${bgColor}, 0.6) 30%, transparent 100%)`,
    maskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
    WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
  };

  return (
    <div className={`absolute inset-x-0 pointer-events-none ${className}`}>
      {(direction === 'top' || direction === 'both') && (
        <div className="absolute top-0 left-0 right-0" style={topGradient} />
      )}
      {(direction === 'bottom' || direction === 'both') && (
        <div className="absolute bottom-0 left-0 right-0" style={bottomGradient} />
      )}
    </div>
  );
}

interface FadeEdgesProps {
  children: ReactNode;
  className?: string;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  size?: string;
}

/**
 * Fade edges wrapper - adds gradient fade to specified edges.
 * Great for long content sections.
 */
export function FadeEdges({
  children,
  className = '',
  edges = ['bottom'],
  size = '60px',
}: FadeEdgesProps) {
  const maskParts: string[] = [];

  if (edges.includes('top')) {
    maskParts.push(`linear-gradient(to bottom, transparent, black ${size})`);
  } else {
    maskParts.push('linear-gradient(black, black)');
  }

  if (edges.includes('bottom')) {
    maskParts.push(`linear-gradient(to top, transparent, black ${size})`);
  } else {
    maskParts.push('linear-gradient(black, black)');
  }

  // Combine masks for vertical edges
  let maskImage = maskParts.join(', ');

  // Handle horizontal edges with additional gradients
  if (edges.includes('left') || edges.includes('right')) {
    const horizontalMasks: string[] = [];
    if (edges.includes('left')) {
      horizontalMasks.push(`linear-gradient(to right, transparent, black ${size})`);
    }
    if (edges.includes('right')) {
      horizontalMasks.push(`linear-gradient(to left, transparent, black ${size})`);
    }
    maskImage = [maskImage, ...horizontalMasks].join(', ');
  }

  return (
    <div
      className={`relative ${className}`}
      style={{
        maskImage,
        WebkitMaskImage: maskImage,
        maskComposite: 'intersect',
        WebkitMaskComposite: 'source-in',
      }}
    >
      {children}
    </div>
  );
}

/* ========================================
   READING BLUR - CSS-only Progressive Blur
   ======================================== */

interface ReadingBlurProps {
  /** Additional CSS classes */
  className?: string;
  /** Background color that blends with page (default: page background) */
  backgroundColor?: string;
  /** Position: 'top' | 'bottom' | 'both' */
  position?: 'top' | 'bottom' | 'both';
  /** Height of the blur overlay */
  height?: string;
  /** Blur intensity in pixels */
  blurAmount?: number;
  /** Offset from top (to avoid covering navbar) */
  topOffset?: string;
  /** Offset from bottom (to avoid covering footer nav) */
  bottomOffset?: string;
}

/**
 * CSS-only Progressive Blur for reading experience.
 * Creates a fixed blur overlay at top/bottom of viewport for visual depth.
 * Theme-aware: adapts colors to light/dark mode automatically.
 *
 * Features:
 * - Pure CSS (no JavaScript scroll handlers)
 * - backdrop-filter for real blur effect
 * - Gradient mask for smooth fade
 * - Works with any scrollable content
 * - Auto-adapts to light/dark theme
 * - Optimized: RAF-throttled scroll handler
 */
export function ReadingBlur({
  className = '',
  backgroundColor: propBackgroundColor,
  position = 'both',
  height = '120px',
  blurAmount = 6,
  topOffset = '0px',
  bottomOffset = '0px',
}: ReadingBlurProps) {
  const [showTopBlur, setShowTopBlur] = useState(false);
  const theme = useTheme();
  const rafRef = useRef<number | null>(null);

  // Theme-aware background color
  const backgroundColor = propBackgroundColor ||
    (theme === 'light' ? 'rgba(250, 250, 250, 1)' : 'rgba(10, 10, 10, 1)');

  // Show top blur only after scrolling past threshold - RAF throttled
  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) return;

      rafRef.current = requestAnimationFrame(() => {
        const scrollThreshold = 200;
        const shouldShow = window.scrollY > scrollThreshold;
        setShowTopBlur(prev => prev !== shouldShow ? shouldShow : prev);
        rafRef.current = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Top blur styles - positioned below navbar
  const topBlurStyles: React.CSSProperties = {
    position: 'fixed',
    top: topOffset,
    left: 0,
    right: 0,
    height,
    background: `linear-gradient(to bottom, ${backgroundColor}, transparent)`,
    maskImage: 'linear-gradient(to bottom, black 40%, transparent)',
    WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent)',
    WebkitBackdropFilter: `blur(${blurAmount}px)`,
    backdropFilter: `blur(${blurAmount}px)`,
    pointerEvents: 'none',
    zIndex: 40,
    opacity: showTopBlur ? 1 : 0,
    transition: 'opacity 0.3s ease-out, background 0.3s ease-out',
  };

  // Bottom blur styles - positioned above footer nav
  const bottomBlurStyles: React.CSSProperties = {
    position: 'fixed',
    bottom: bottomOffset,
    left: 0,
    right: 0,
    height,
    background: `linear-gradient(to top, ${backgroundColor}, transparent)`,
    maskImage: 'linear-gradient(to top, black 50%, transparent)',
    WebkitMaskImage: 'linear-gradient(to top, black 50%, transparent)',
    WebkitBackdropFilter: `blur(${blurAmount}px)`,
    backdropFilter: `blur(${blurAmount}px)`,
    pointerEvents: 'none',
    zIndex: 45,
    transition: 'background 0.3s ease-out',
  };

  return (
    <div className={className} aria-hidden="true">
      {(position === 'top' || position === 'both') && (
        <div style={topBlurStyles} />
      )}
      {(position === 'bottom' || position === 'both') && (
        <div style={bottomBlurStyles} />
      )}
    </div>
  );
}
