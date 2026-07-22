'use client';

import { motion, useInView } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

interface TextRevealProps {
  text: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
  delay?: number;
  staggerDelay?: number;
  once?: boolean;
}

/**
 * Horizontal text reveal animation with word-by-word staggered reveal.
 * Features smooth transitions, opacity changes, and skew effects.
 */
export function TextReveal({
  text,
  className = '',
  as: Component = 'h2',
  delay = 0,
  staggerDelay = 0.08,
  once = true,
}: TextRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-100px' });

  const words = text.split(' ');

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: delay,
      },
    },
  };

  // Optimized: removed blur filter animation (GPU-intensive during scroll)
  // Using transform-only animations for better performance
  const wordVariants: Variants = {
    hidden: {
      opacity: 0,
      x: 40,
      skewX: -8,
    },
    visible: {
      opacity: 1,
      x: 0,
      skewX: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      className="overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      <Component className={`flex flex-wrap gap-x-[0.3em] ${className}`}>
        {words.map((word, index) => (
          <motion.span
            key={`${word}-${index}`}
            variants={wordVariants}
            className="inline-block"
          >
            {word}
          </motion.span>
        ))}
      </Component>
    </motion.div>
  );
}

interface TextRevealCharProps {
  text: string;
  className?: string;
  charDelay?: number;
  once?: boolean;
}

/**
 * Character-level reveal animation for short titles/headings.
 * Each character animates with a 3D rotation effect.
 */
export function TextRevealChar({
  text,
  className = '',
  charDelay = 0.03,
  once = true,
}: TextRevealCharProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-50px' });

  const chars = text.split('');

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: charDelay,
      },
    },
  };

  const charVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 20,
      rotateX: -90,
    },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        type: 'spring',
        stiffness: 200,
        damping: 20,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      className={`overflow-hidden ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      style={{ perspective: '1000px' }}
    >
      {chars.map((char, index) => (
        <motion.span
          key={`${char}-${index}`}
          variants={charVariants}
          className="inline-block"
          style={{ transformOrigin: 'center bottom' }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </motion.div>
  );
}

interface RevealOnScrollProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

/**
 * Generic reveal wrapper for any content.
 * Animates children when scrolled into view.
 * Optimized: removed blur filter animation for better scroll performance.
 */
export function RevealOnScroll({
  children,
  className = '',
  delay = 0,
  direction = 'up',
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const directionOffset = {
    up: { y: 40, x: 0 },
    down: { y: -40, x: 0 },
    left: { y: 0, x: 40 },
    right: { y: 0, x: -40 },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ willChange: 'transform, opacity' }}
      initial={{
        opacity: 0,
        ...directionOffset[direction],
      }}
      animate={
        isInView
          ? { opacity: 1, x: 0, y: 0 }
          : { opacity: 0, ...directionOffset[direction] }
      }
      transition={{
        type: 'spring',
        stiffness: 100,
        damping: 20,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}
