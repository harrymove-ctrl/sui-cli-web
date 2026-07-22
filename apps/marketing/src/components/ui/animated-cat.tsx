'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { motion } from 'framer-motion';

interface AnimatedCatProps {
  className?: string;
  /**
   * Lottie animation URL
   * @default Pink cat animation
   */
  src?: string;
}

/**
 * Animated Cat using Lottie animation
 * Beautiful pink cat mascot from the original demo
 */
export function AnimatedCat({
  className = '',
  src = 'https://lottie.host/8cf4ba71-e5fb-44f3-8134-178c4d389417/0CCsdcgNIP.json',
}: AnimatedCatProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
      className={`flex items-center justify-center ${className}`}
    >
      <DotLottieReact
        src={src}
        loop
        autoplay
        style={{ width: '100%', height: '100%' }}
      />
    </motion.div>
  );
}

export default AnimatedCat;
