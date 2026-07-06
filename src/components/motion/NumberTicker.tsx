"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionEnabled } from "./useMotionEnabled";

interface NumberTickerProps {
  value: number;
  /** Animation length in seconds. */
  duration?: number;
  className?: string;
  /** Thousands separators (on by default). */
  format?: boolean;
}

/**
 * Counts from the previous value up (or down) to the new one with an ease-out
 * curve — used anywhere a number changes (scores, coins, stats). Animates on
 * first mount from 0, and again on every live update. Respects reduced motion.
 */
export function NumberTicker({ value, duration = 0.9, className, format = true }: NumberTickerProps) {
  const { enabled } = useMotionEnabled();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, enabled, duration]);

  return <span className={className}>{format ? display.toLocaleString() : display}</span>;
}
