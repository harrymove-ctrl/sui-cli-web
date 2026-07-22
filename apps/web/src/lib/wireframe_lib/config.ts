/**
 * Feature flags.
 *
 * Toggle template-level capabilities here. Each flag is consumed at the
 * component or provider level; flipping a flag to `false` should fully
 * remove the corresponding behavior (no listeners, no instantiation, no
 * library code paths) so the template degrades cleanly.
 */
export const features = {
  /**
   * Smooth-scroll powered by Lenis. When `false` the page falls back to
   * native CSS `scroll-behavior: smooth` and no Lenis instance is
   * created. Automatically disabled when the user prefers reduced
   * motion regardless of this value.
   */
  smoothScroll: true,
} as const;
