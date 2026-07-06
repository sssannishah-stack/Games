"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useMotionEnabled } from "./useMotionEnabled";
import { cn } from "@/lib/utils";
import type { PointerEvent, ReactNode } from "react";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Accent color for the hover glow (e.g. a rarity color). */
  glow?: string;
  /** Max tilt in degrees. */
  max?: number;
}

/**
 * 3D pointer-tilt card with a light-sweep shine and a colored hover glow — the
 * "this feels special" treatment for power cards. Pure transform/opacity, so it
 * stays on the GPU. Collapses to a plain container when motion is reduced.
 */
export function TiltCard({ children, className, glow = "#6C7BFA", max = 9 }: TiltCardProps) {
  const { enabled } = useMotionEnabled();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 220, damping: 18 };
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), spring);
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), spring);

  if (!enabled) {
    return <div className={cn("transition-shadow hover:shadow-[0_14px_38px_rgba(0,0,0,.3)]", className)}>{children}</div>;
  }

  function handleMove(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  }
  function reset() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <div className="[perspective:1000px]">
      <motion.div
        onPointerMove={handleMove}
        onPointerLeave={reset}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        whileHover={{ scale: 1.025, boxShadow: `0 18px 44px color-mix(in oklab, ${glow} 32%, transparent)` }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className={cn("group relative transform-gpu overflow-hidden", className)}
      >
        {children}
        <span className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute inset-y-0 -left-1/3 w-1/3 -translate-x-[120%] bg-[linear-gradient(105deg,transparent,color-mix(in_oklab,var(--color-line)_16%,transparent),transparent)] group-hover:animate-[encShine_0.9s_ease]" />
        </span>
      </motion.div>
    </div>
  );
}
