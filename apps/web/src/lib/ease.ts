// Standard ease-in-out as a cubic-bezier tuple. motion/framer accept a
// [x1, y1, x2, y2] tuple wherever an easing value is expected; a plain (mutable)
// tuple type is used so it satisfies motion's `Easing` type (a `readonly`/`as
// const` tuple does not).
export const EASE_IN_OUT: [number, number, number, number] = [0.42, 0, 0.58, 1];

/** Decelerating ease - motion that arrives and settles (panels, reveals). */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Press feedback: quick, slightly springy. Typed loosely so it can be handed to
 * either `motion/react` or `framer-motion` without importing either here.
 */
export const SPRING_PRESS = {
  type: 'spring' as const,
  duration: 0.3,
  bounce: 0.35,
};
