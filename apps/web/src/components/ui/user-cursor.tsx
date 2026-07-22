import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type SpringOptions,
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
import { cn } from '@/lib/utils';

/** Ported from OriginKit's UserCursor (originkit.dev/components/usercursor), stripped of
 * Framer-specific plumbing (RenderTarget/static-canvas handling, prop-control defaults,
 * fixed 200x200 intrinsic sizing swapped for a fill-parent host so it can wrap any panel). */

export interface UserCursorClassNames {
  root?: string;
  cursor?: string;
  arrow?: string;
  label?: string;
  labelText?: string;
}

export interface UserCursorProps {
  /** Label text shown in the trailing pill. Ignored if `label` is provided. */
  name?: string;
  arrow?: ReactNode | ((color: string) => ReactNode);
  label?: ReactNode;
  color?: string;
  textColor?: string;
  size?: number;
  labelTiltStrength?: number;
  showLabel?: boolean;
  offsetX?: number;
  offsetY?: number;
  labelOffsetUseDefault?: boolean;
  labelOffsetX?: number;
  labelOffsetY?: number;
  pressScale?: number;
  classNames?: UserCursorClassNames;
  className?: string;
  style?: CSSProperties;
  /** Wrap real content instead of standing alone as a decorative demo box. */
  children?: ReactNode;
  /** Clip the arrow/label to the host bounds. Turn off when wrapping content that has its
   * own overlays (dropdowns, tooltips, modals) that must be free to render outside the host. */
  clip?: boolean;
  /** Stacking order of the cursor layer. Keep below app modals/dropdowns/toasts. */
  zIndex?: number;
}

const ARROW_SPRING: SpringOptions = { stiffness: 380, damping: 32, mass: 0.6 };
const LABEL_SPRING: SpringOptions = { stiffness: 220, damping: 26, mass: 0.7 };

/**
 * A custom cursor follower that replaces the OS cursor inside its surface. An arrow glyph
 * tracks the pointer with spring physics; a colored label pill trails behind on a laggier
 * spring, rocking with motion and scaling while pressed.
 *
 * The host is a relative container, filling its parent by default, that renders `children`
 * normally underneath the cursor overlay - pass real app content to make it the app's cursor
 * everywhere inside that surface, or omit children to use it as a standalone decorative demo.
 * The cursor shows while the pointer is inside the host and the native cursor is hidden there.
 * The cursor layer is `pointer-events: none` so clicks pass through. Skipped on
 * coarse-pointer (touch) devices.
 */
export function UserCursor({
  name = 'Robert',
  arrow,
  label,
  color = '#FFFFFF',
  textColor = '#000000',
  size = 28,
  labelTiltStrength = 25,
  showLabel = true,
  offsetX = 0,
  offsetY = 0,
  labelOffsetUseDefault = true,
  labelOffsetX = 25,
  labelOffsetY = 12,
  pressScale = 0.92,
  classNames,
  className,
  style,
  children,
  clip = true,
  zIndex = 50,
}: UserCursorProps) {
  const scopeClass = `user-cursor-${useId().replace(/:/g, '')}`;

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(pointer: coarse)');
    const sync = () => setIsTouchDevice(!!mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);

  const resolvedLabelOffset = useMemo(
    () =>
      labelOffsetUseDefault
        ? { x: size * 0.9, y: size * 0.2 + 6 }
        : { x: labelOffsetX, y: labelOffsetY },
    [labelOffsetUseDefault, labelOffsetX, labelOffsetY, size]
  );

  const mouseX = useMotionValue(-9999);
  const mouseY = useMotionValue(-9999);
  const arrowX = useSpring(mouseX, ARROW_SPRING);
  const arrowY = useSpring(mouseY, ARROW_SPRING);
  const labelX = useSpring(mouseX, LABEL_SPRING);
  const labelY = useSpring(mouseY, LABEL_SPRING);

  const scaleMV = useMotionValue(1);
  useEffect(() => {
    const controls = animate(scaleMV, pressed ? pressScale : 1, {
      type: 'spring',
      stiffness: 500,
      damping: 28,
      mass: 0.5,
    });
    return () => controls.stop();
  }, [pressed, pressScale, scaleMV]);

  const labelTiltTarget = useMotionValue(0);
  const labelRotation = useSpring(labelTiltTarget, { stiffness: 200, damping: 24, mass: 0.6 });

  const lastSampleRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    if (isTouchDevice) return;
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const last = lastSampleRef.current;
      let vx = 0;
      let vy = 0;
      if (last) {
        const dt = Math.max(1, now - last.t);
        vx = ((x - last.x) / dt) * 1000;
        vy = ((y - last.y) / dt) * 1000;
      }
      lastSampleRef.current = { x, y, t: now };

      mouseX.set(x + offsetX);
      mouseY.set(y + offsetY);

      const speed = Math.hypot(vx, vy);
      const norm = Math.min(1, speed / 1500);
      const sign = vx === 0 ? 0 : vx > 0 ? 1 : -1;
      labelTiltTarget.set(sign * norm * labelTiltStrength);
    };

    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);
    const onEnter = () => setHovering(true);
    const onLeave = () => {
      setHovering(false);
      lastSampleRef.current = null;
      labelTiltTarget.set(0);
    };

    container.addEventListener('mousemove', onMove);
    container.addEventListener('mousedown', onDown);
    container.addEventListener('mouseup', onUp);
    container.addEventListener('mouseenter', onEnter);
    container.addEventListener('mouseleave', onLeave);

    return () => {
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('mousedown', onDown);
      container.removeEventListener('mouseup', onUp);
      container.removeEventListener('mouseenter', onEnter);
      container.removeEventListener('mouseleave', onLeave);
      setPressed(false);
    };
  }, [isTouchDevice, labelTiltStrength, offsetX, offsetY, mouseX, mouseY, labelTiltTarget]);

  const visible = !isTouchDevice && hovering;

  const labelTranslateX = useTransform(labelX, (v) => v + resolvedLabelOffset.x);
  const labelTranslateY = useTransform(labelY, (v) => v + resolvedLabelOffset.y);

  const arrowContent: ReactNode = useMemo(() => {
    if (typeof arrow === 'function') {
      try {
        return arrow(color);
      } catch {
        return null;
      }
    }
    if (arrow !== undefined && arrow !== null) return arrow;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        fill="none"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <path
          d="M5 3 L23 14 L14 16 L11 24 Z"
          fill={color}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth={0.6}
          strokeLinejoin="round"
        />
      </svg>
    );
  }, [arrow, color, size]);

  const labelContent: ReactNode = useMemo(() => {
    if (label !== undefined && label !== null) return label;
    return (
      <div
        className={classNames?.labelText}
        style={{
          color: textColor,
          fontSize: Math.max(7, size * 0.43),
          lineHeight: 1.1,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          letterSpacing: 0.1,
        }}
      >
        {name}
      </div>
    );
  }, [label, name, textColor, size, classNames?.labelText]);

  if (isTouchDevice) return null;

  return (
    <div
      ref={containerRef}
      className={cn('relative', scopeClass, clip && 'overflow-hidden', classNames?.root, className)}
      style={{ cursor: 'none', ...style }}
    >
      {/* Descendants (buttons, links, tree rows, etc.) commonly set their own `cursor-pointer`/
       * `cursor-default` utility class, which otherwise wins over this host's inline `cursor: none`
       * for that element. Force every descendant back to `none` so the OS cursor never reappears
       * while hovering interactive content inside the scope. */}
      <style>{`.${scopeClass}, .${scopeClass} * { cursor: none !important; }`}</style>
      {children}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex }}>
        {showLabel && (
          <motion.div
            className={classNames?.label}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              x: labelTranslateX,
              y: labelTranslateY,
              rotate: labelRotation,
              scale: scaleMV,
              background: color,
              borderRadius: 999,
              padding: `${size * 0.18}px ${size * 0.36}px`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
              opacity: visible ? 1 : 0,
              transformOrigin: '0% 50%',
              transition: 'opacity 140ms ease',
              willChange: 'transform, opacity',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            {labelContent}
          </motion.div>
        )}

        <motion.div
          className={classNames?.cursor}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            x: arrowX,
            y: arrowY,
            scale: scaleMV,
            width: size,
            height: size,
            opacity: visible ? 1 : 0,
            transformOrigin: '0% 0%',
            transition: 'opacity 140ms ease',
            willChange: 'transform, opacity',
            pointerEvents: 'none',
          }}
        >
          <div className={classNames?.arrow} style={{ width: size, height: size }}>
            {arrowContent}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
