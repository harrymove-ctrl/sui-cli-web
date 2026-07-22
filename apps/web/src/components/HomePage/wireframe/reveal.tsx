
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/lib/wireframe_lib/motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function Reveal({
  children,
  className,
  delay = 0,
}: RevealProps): ReactNode {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
      // Keep a backed compositor layer so it isn't allocated mid-reveal, which
      // can flash white for a frame on some GPUs (notably macOS Chrome).
      style={{ backfaceVisibility: "hidden", willChange: "opacity, transform" }}
    >
      {children}
    </motion.div>
  );
}
