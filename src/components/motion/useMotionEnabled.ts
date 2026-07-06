"use client";

import { useReducedMotion } from "framer-motion";
import { useSettingsStore } from "@/stores/settingsStore";
import type { MotionLevel } from "@/stores/settingsStore";

export interface MotionState {
  /** Whether decorative motion should run at all. */
  enabled: boolean;
  /** The user's chosen intensity — "high" unlocks the extra celebratory effects. */
  level: MotionLevel;
}

/**
 * Single source of truth for whether animations run. Combines the OS
 * prefers-reduced-motion signal with the in-app animation level so every
 * motion primitive behaves consistently.
 */
export function useMotionEnabled(): MotionState {
  const systemReduced = useReducedMotion();
  const level = useSettingsStore((s) => s.motionLevel);
  const enabled = level !== "minimal" && !systemReduced;
  return { enabled, level };
}
