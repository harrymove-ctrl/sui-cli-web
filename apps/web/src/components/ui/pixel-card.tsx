import { useEffect, useRef, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/** Ported from OriginKit's PixelCard (originkit.dev/components/pixelcard), stripped of
 * Framer-specific plumbing (RenderTarget, canvas/export render modes, prop-control defaults). */

class Pixel {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  color: string;
  speed: number;
  size: number;
  minSize: number;
  maxSizeInteger: number;
  maxSize: number;
  delay: number;
  counter: number;
  counterStep: number;
  isIdle: boolean;
  isReverse: boolean;
  isShimmer: boolean;
  growStart: number | null;
  shrinkStart: number | null;
  shrinkFrom: number;

  constructor(
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    speed: number,
    delay: number,
    maxPx: number
  ) {
    this.ctx = context;
    this.x = x;
    this.y = y;
    this.color = color;
    this.speed = this.getRandomValue(0.1, 0.9) * speed;
    this.size = 0;
    const factor = maxPx / 2;
    this.minSize = 0.5 * factor;
    this.maxSizeInteger = maxPx;
    this.maxSize = this.getRandomValue(this.minSize, maxPx);
    this.delay = delay;
    this.counter = 0;
    this.counterStep = Math.random() * 4 + (canvas.width + canvas.height) * 0.01;
    this.isIdle = false;
    this.isReverse = false;
    this.isShimmer = false;
    this.growStart = null;
    this.shrinkStart = null;
    this.shrinkFrom = 0;
  }

  getRandomValue(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  draw() {
    const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
    this.ctx.fillStyle = this.color;
    this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
  }

  appear(now: number, durationMs: number, easeFn: (t: number) => number) {
    this.isIdle = false;
    this.shrinkStart = null;
    if (this.counter <= this.delay) {
      this.counter += this.counterStep;
      return;
    }
    if (!this.isShimmer) {
      if (this.growStart === null) this.growStart = now;
      const p = durationMs > 0 ? Math.min(1, (now - this.growStart) / durationMs) : 1;
      this.size = easeFn(p) * this.maxSize;
      if (p >= 1) this.isShimmer = true;
    }
    if (this.isShimmer) {
      this.shimmer();
    }
    this.draw();
  }

  disappear(now: number, durationMs: number, easeFn: (t: number) => number) {
    this.isShimmer = false;
    this.counter = 0;
    this.growStart = null;
    if (this.size <= 0) {
      this.isIdle = true;
      this.shrinkStart = null;
      return;
    }
    if (this.shrinkStart === null) {
      this.shrinkStart = now;
      this.shrinkFrom = this.size;
    }
    const p = durationMs > 0 ? Math.min(1, (now - this.shrinkStart) / durationMs) : 1;
    this.size = this.shrinkFrom * (1 - easeFn(p));
    if (p >= 1) this.size = 0;
    this.draw();
  }

  shimmer() {
    if (this.size >= this.maxSize) {
      this.isReverse = true;
    } else if (this.size <= this.minSize) {
      this.isReverse = false;
    }
    this.size += this.isReverse ? -this.speed : this.speed;
  }
}

function getEffectiveSpeed(value: number, reducedMotion: boolean) {
  const max = 100;
  const throttle = 0.002;
  if (value <= 0 || reducedMotion) return 0;
  if (value >= max) return max * throttle;
  return value * throttle;
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const fx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const dfx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = fx(t) - x;
      const d = dfx(t);
      if (Math.abs(e) < 1e-5 || d === 0) break;
      t -= e / d;
    }
    return ((ay * t + by) * t + cy) * t;
  };
}

const EASE_OUT = cubicBezier(0, 0, 0.58, 1);
const DEFAULT_COLORS = ['#4da2ff', '#003f87', '#002355'];

export interface PixelCardProps {
  colors?: string[];
  gap?: number;
  pixelSize?: number;
  speed?: number;
  appearFrom?: 'middle' | 'top' | 'bottom' | 'left' | 'right';
  durationMs?: number;
  backgroundColor?: string;
  /** Runs the appear+shimmer loop on mount instead of waiting for hover — for ambient/background use. */
  autoPlay?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function PixelCard({
  colors = DEFAULT_COLORS,
  gap = 8,
  pixelSize = 2,
  speed = 60,
  appearFrom = 'middle',
  durationMs = 1200,
  backgroundColor = 'transparent',
  autoPlay = false,
  className,
  style,
}: PixelCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<Pixel[]>([]);
  const animationRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const timePreviousRef = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const reducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ).current;

  useEffect(() => {
    const initPixels = () => {
      const el = canvasRef.current;
      const container = containerRef.current;
      if (!el || !container) return;

      const width = Math.floor(el.clientWidth || container.clientWidth || 0);
      const height = Math.floor(el.clientHeight || container.clientHeight || 0);
      const ctx = el.getContext('2d');
      if (!ctx || width === 0 || height === 0) return;

      el.width = width;
      el.height = height;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;

      const step = Math.max(1, Math.round(gap));
      const pxs: Pixel[] = [];
      let idx = 0;
      for (let x = 0; x < width; x += step) {
        for (let y = 0; y < height; y += step) {
          const color = colors[idx % colors.length];
          idx++;
          let delay: number;
          if (reducedMotion) {
            delay = 0;
          } else if (appearFrom === 'top') {
            delay = y;
          } else if (appearFrom === 'bottom') {
            delay = height - y;
          } else if (appearFrom === 'left') {
            delay = x;
          } else if (appearFrom === 'right') {
            delay = width - x;
          } else {
            const dx = x - width / 2;
            const dy = y - height / 2;
            delay = Math.sqrt(dx * dx + dy * dy);
          }
          pxs.push(
            new Pixel(
              el,
              ctx,
              x,
              y,
              color,
              getEffectiveSpeed(speed, reducedMotion),
              delay,
              Math.max(0.1, pixelSize)
            )
          );
        }
      }
      pixelsRef.current = pxs;
    };

    const doAnimate = (fnName: 'appear' | 'disappear') => {
      animationRef.current = requestAnimationFrame(() => doAnimate(fnName));
      const timeNow = performance.now();
      const timePassed = timeNow - timePreviousRef.current;
      const timeInterval = 1000 / 60;
      if (timePassed < timeInterval) return;
      timePreviousRef.current = timeNow - (timePassed % timeInterval);

      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx || !canvasRef.current) return;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      let allIdle = true;
      for (const pixel of pixelsRef.current) {
        pixel[fnName](timeNow, durationMs, EASE_OUT);
        if (!pixel.isIdle) allIdle = false;
      }
      if (allIdle && fnName === 'disappear') {
        cancelAnimationFrame(animationRef.current as number);
      }
    };

    const handleAnimation = (name: 'appear' | 'disappear') => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      animationRef.current = requestAnimationFrame(() => doAnimate(name));
    };

    initPixels();
    if (autoPlay) handleAnimation('appear');

    const container = containerRef.current;
    const onEnter = () => handleAnimation('appear');
    const onLeave = () => handleAnimation('disappear');
    if (!autoPlay) {
      container?.addEventListener('mouseenter', onEnter);
      container?.addEventListener('mouseleave', onLeave);
    }

    const observer = new ResizeObserver(() => {
      initPixels();
      if (autoPlay) handleAnimation('appear');
    });
    if (container) observer.observe(container);

    return () => {
      observer.disconnect();
      container?.removeEventListener('mouseenter', onEnter);
      container?.removeEventListener('mouseleave', onLeave);
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gap, pixelSize, speed, JSON.stringify(colors), appearFrom, autoPlay, durationMs]);

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
      style={{ background: backgroundColor, ...style }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
