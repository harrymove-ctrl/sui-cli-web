import { motion, Variants } from 'framer-motion';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { useReducedMotion } from '@/hooks/useScrollProgress';
import { ReactNode, forwardRef } from 'react';

export type AnimationType =
  | 'fade-up'
  | 'fade-down'
  | 'slide-left'
  | 'slide-right'
  | 'scale'
  | 'pop';

interface AnimatedSectionProps {
  children: ReactNode;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  className?: string;
  id?: string;
}

const variants: Record<AnimationType, Variants> = {
  'fade-up': {
    hidden: { opacity: 0, y: 60 },
    visible: { opacity: 1, y: 0 },
  },
  'fade-down': {
    hidden: { opacity: 0, y: -60 },
    visible: { opacity: 1, y: 0 },
  },
  'slide-left': {
    hidden: { opacity: 0, x: 100 },
    visible: { opacity: 1, x: 0 },
  },
  'slide-right': {
    hidden: { opacity: 0, x: -100 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
  },
  pop: {
    hidden: { opacity: 0, scale: 0.5 },
    visible: {
      opacity: 1,
      scale: 1,
    },
  },
};

export const AnimatedSection = forwardRef<HTMLElement, AnimatedSectionProps>(({
  children,
  animation = 'fade-up',
  delay = 0,
  duration = 0.6,
  className = '',
  id,
}, forwardedRef) => {
  const { ref: inViewRef, isVisible } = useScrollReveal({ delay, threshold: 0.1 });
  const prefersReducedMotion = useReducedMotion();

  // Combine refs
  const setRefs = (element: HTMLElement | null) => {
    (inViewRef as React.MutableRefObject<HTMLElement | null>).current = element;
    if (typeof forwardedRef === 'function') {
      forwardedRef(element);
    } else if (forwardedRef) {
      forwardedRef.current = element;
    }
  };

  return (
    <motion.section
      ref={setRefs}
      id={id}
      className={className}
      initial={prefersReducedMotion ? 'visible' : 'hidden'}
      animate={isVisible || prefersReducedMotion ? 'visible' : 'hidden'}
      variants={prefersReducedMotion ? {} : variants[animation]}
      transition={{
        duration,
        ease: [0.25, 0.1, 0.25, 1],
        type: animation === 'pop' ? 'spring' : 'tween',
        stiffness: animation === 'pop' ? 300 : undefined,
        damping: animation === 'pop' ? 20 : undefined,
      }}
    >
      {children}
    </motion.section>
  );
});

AnimatedSection.displayName = 'AnimatedSection';
