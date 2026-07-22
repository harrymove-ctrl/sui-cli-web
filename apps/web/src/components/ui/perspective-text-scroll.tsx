import {
  motion,
  useMotionTemplate,
  useScroll,
  useTransform,
} from "framer-motion";
import { useRef } from "react";

interface PerspectiveTextScrollProps {
  children: React.ReactNode;
  className?: string;
  height?: string;
  perspective?: number;
  rotateX?: number;
  translateYRange?: [number, number];
}

export function PerspectiveTextScroll({
  children,
  className = "",
  height = "300vh",
  perspective = 200,
  rotateX = 30,
  translateYRange = [487, 0],
}: PerspectiveTextScrollProps) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
  });

  const yMotionValue = useTransform(scrollYProgress, [0, 1], translateYRange);
  const transform = useMotionTemplate`rotateX(${rotateX}deg) translateY(${yMotionValue}px) translateZ(10px)`;

  return (
    <div
      ref={targetRef}
      className={`relative z-0 w-full ${className}`}
      style={{ height }}
    >
      {/* Scroll indicator */}
      <div className="absolute left-1/2 top-[8%] grid -translate-x-1/2 content-start justify-items-center gap-4 text-center">
        <span className="relative text-xs uppercase tracking-widest text-white/40 after:absolute after:left-1/2 after:top-full after:mt-4 after:h-12 after:w-px after:bg-gradient-to-b after:from-white/40 after:to-transparent after:content-['']">
          scroll down
        </span>
      </div>

      {/* 3D Text container */}
      <div
        className="sticky top-0 mx-auto flex h-screen items-center justify-center overflow-hidden"
        style={{
          transformStyle: "preserve-3d",
          perspective: `${perspective}px`,
        }}
      >
        <motion.div
          style={{
            transformStyle: "preserve-3d",
            transform,
          }}
          className="relative w-full max-w-5xl px-4 text-center"
        >
          {children}

          {/* Bottom fade gradient */}
          <div className="pointer-events-none absolute -bottom-20 left-0 h-[40vh] w-full bg-gradient-to-b from-transparent to-black/90" />
        </motion.div>
      </div>
    </div>
  );
}

// Pre-styled text for the hero
export function HeroScrollText() {
  return (
    <PerspectiveTextScroll
      height="250vh"
      perspective={180}
      rotateX={25}
      translateYRange={[400, -50]}
    >
      <div className="space-y-2 font-mono text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
        <span className="bg-gradient-to-r from-rose-400 via-rose-500 to-pink-500 bg-clip-text text-transparent">
          Your terminal.
        </span>
        <br />
        <span className="text-white/90">
          Your keys.
        </span>
        <br />
        <span className="bg-gradient-to-r from-rose-400 to-rose-600 bg-clip-text text-transparent">
          Your blockchain.
        </span>
        <br />
        <br />
        <span className="text-white/60 text-3xl sm:text-4xl md:text-5xl">
          Transfer SUI instantly
        </span>
        <br />
        <span className="text-white/50 text-2xl sm:text-3xl md:text-4xl">
          Check balances in real-time
        </span>
        <br />
        <span className="text-white/40 text-xl sm:text-2xl md:text-3xl">
          Deploy Move contracts
        </span>
        <br />
        <span className="text-white/30 text-lg sm:text-xl md:text-2xl">
          Manage gas efficiently
        </span>
        <br />
        <span className="text-white/20 text-base sm:text-lg md:text-xl">
          Switch networks seamlessly
        </span>
        <br />
        <span className="text-white/10 text-sm sm:text-base md:text-lg">
          100% local • Zero cloud • Maximum security
        </span>
      </div>
    </PerspectiveTextScroll>
  );
}
