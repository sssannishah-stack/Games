"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useMotionEnabled } from "./useMotionEnabled";

const COLORS = ["#6C7BFA", "#3DD68C", "#E8C84A", "#E36A8A", "#5EC9E8", "#F5A93D"];

/**
 * A lightweight, dependency-free confetti burst (transform/opacity only, so it
 * stays on the GPU). Mount it briefly on a celebration; it self-clears. Skips
 * entirely when motion is reduced. `count` scales with the animation level.
 */
export function Confetti({ count = 70 }: { count?: number }) {
  const { enabled, level } = useMotionEnabled();
  const [gone, setGone] = useState(false);
  const n = level === "high" ? count : Math.round(count * 0.6);

  const pieces = useMemo(
    () =>
      Array.from({ length: n }).map((_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 340,
        y: 260 + Math.random() * 260,
        rotate: Math.random() * 640 - 320,
        delay: Math.random() * 0.18,
        duration: 1.6 + Math.random() * 1.1,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    [n]
  );

  useEffect(() => {
    const t = window.setTimeout(() => setGone(true), 3200);
    return () => window.clearTimeout(t);
  }, []);

  if (!enabled || gone) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden flex items-start justify-center">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-[38%] rounded-[2px]"
          style={{ width: p.size, height: p.size * 1.4, background: p.color }}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
          animate={{ opacity: [1, 1, 0], x: p.x, y: p.y, rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.2, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
}
