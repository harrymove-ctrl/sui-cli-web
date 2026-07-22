'use client';

import { motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';

interface AnimatedGradientBackgroundProps {
  /**
   * Initial size of the radial gradient, defining the starting width.
   * @default 125
   */
  startingGap?: number;

  /**
   * Enables or disables the breathing animation effect.
   * @default false
   */
  breathing?: boolean;

  /**
   * Array of colors to use in the radial gradient.
   * @default Rainbow gradient with black center
   */
  gradientColors?: string[];

  /**
   * Array of percentage stops corresponding to each color.
   * @default [35, 50, 60, 70, 80, 90, 100]
   */
  gradientStops?: number[];

  /**
   * Speed of the breathing animation.
   * @default 0.02
   */
  animationSpeed?: number;

  /**
   * Maximum range for the breathing animation.
   * @default 5
   */
  breathingRange?: number;

  /**
   * Additional inline styles for the gradient container.
   */
  containerStyle?: React.CSSProperties;

  /**
   * Additional class names for the gradient container.
   */
  containerClassName?: string;

  /**
   * Additional top offset for more flexible control.
   * @default 0
   */
  topOffset?: number;
}

/**
 * AnimatedGradientBackground
 *
 * Dark mode animated radial gradient background with a subtle breathing effect.
 * Creates a large black oval in center with colorful rainbow at edges.
 */
const AnimatedGradientBackground: React.FC<AnimatedGradientBackgroundProps> = ({
  startingGap = 125,
  breathing = false,
  gradientColors = [
    '#0A0A0A',     // Black core (center)
    '#2979FF',     // Blue
    '#FF80AB',     // Pink
    '#FF6D00',     // Orange
    '#FFD600',     // Yellow
    '#00E676',     // Green
    '#3D5AFE',     // Indigo edge
  ],
  gradientStops = [35, 50, 60, 70, 80, 90, 100],
  animationSpeed = 0.02,
  breathingRange = 5,
  containerStyle = {},
  topOffset = 0,
  containerClassName = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isLightMode, setIsLightMode] = useState(false);

  // Listen for theme changes
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsLightMode(theme === 'light');
    };

    // Initial check
    checkTheme();

    // Watch for theme attribute changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  // Validation
  if (gradientColors.length !== gradientStops.length) {
    throw new Error(
      `GradientColors and GradientStops must have the same length.
       Received gradientColors length: ${gradientColors.length},
       gradientStops length: ${gradientStops.length}`
    );
  }

  useEffect(() => {
    let animationFrame: number | null = null;
    let width = startingGap;
    let directionWidth = 1;

    const gradientStopsString = gradientStops
      .map((stop, index) => `${gradientColors[index]} ${stop}%`)
      .join(', ');

    // Set initial gradient immediately
    const setGradient = (w: number) => {
      const gradient = `radial-gradient(${w}% ${w + topOffset}% at 50% 20%, ${gradientStopsString})`;
      if (containerRef.current) {
        containerRef.current.style.background = gradient;
      }
    };

    // Set initial state
    setGradient(width);

    // Only run animation loop if breathing is enabled
    if (!breathing) {
      return; // No cleanup needed - no animation started
    }

    const animateGradient = () => {
      if (width >= startingGap + breathingRange) directionWidth = -1;
      if (width <= startingGap - breathingRange) directionWidth = 1;

      width += directionWidth * animationSpeed;
      setGradient(width);

      animationFrame = requestAnimationFrame(animateGradient);
    };

    animationFrame = requestAnimationFrame(animateGradient);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [
    startingGap,
    breathing,
    gradientColors,
    gradientStops,
    animationSpeed,
    breathingRange,
    topOffset,
  ]);

  // Don't render in light mode - let CSS background handle it
  if (isLightMode) {
    return null;
  }

  return (
    <motion.div
      key="animated-gradient-background"
      initial={{
        opacity: 0,
        scale: 1.2,
      }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: {
          duration: 1.5,
          ease: [0.25, 0.1, 0.25, 1],
        },
      }}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${containerClassName}`}
    >
      <div
        ref={containerRef}
        style={containerStyle}
        className="absolute inset-0"
      />
      {/* Subtle noise texture overlay for depth */}
      <div
        className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </motion.div>
  );
};

export default AnimatedGradientBackground;
