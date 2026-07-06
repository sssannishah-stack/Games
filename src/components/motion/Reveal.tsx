"use client";

import { motion } from "framer-motion";
import { useMotionEnabled } from "./useMotionEnabled";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Position in a list — drives the staggered entrance delay. */
  index?: number;
  /** Add a subtle lift + shadow on hover (for cards). */
  hover?: boolean;
  /** Per-item stagger step in seconds. */
  stagger?: number;
}

/**
 * Fade + rise entrance, optionally staggered by `index` and with a hover lift.
 * The one primitive behind dashboard cards, list items and stat tiles — no
 * duplicated animation configs. Falls back to a plain div when motion is off.
 */
export function Reveal({ children, className, index = 0, hover, stagger = 0.055 }: RevealProps) {
  const { enabled } = useMotionEnabled();

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * stagger, 0.5), duration: 0.42, ease: [0.2, 0.9, 0.3, 1] }}
      whileHover={hover ? { y: -3 } : undefined}
    >
      {children}
    </motion.div>
  );
}
