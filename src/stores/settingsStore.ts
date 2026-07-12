import { create } from "zustand";
import { persist } from "zustand/middleware";

/* Theme props mirror the design's exported controls (accent + radius). */

export const ACCENT_OPTIONS = ["#6C7BFA", "#2FBFA7", "#E8A33D", "#E36A8A"] as const;
export const THEME_MODES = ["dark", "bright"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export const MOTION_LEVELS = ["minimal", "normal", "high"] as const;
export type MotionLevel = (typeof MOTION_LEVELS)[number];

interface SettingsState {
  accent: string;
  radius: number; // px, 12–26
  mode: ThemeMode;
  /** Global animation intensity. "minimal" also honours prefers-reduced-motion. */
  motionLevel: MotionLevel;
  /** Master switch for the synthesized sound effects across live screens. */
  soundEnabled: boolean;
  /** 0–1 master volume for sound effects. */
  soundVolume: number;
  setAccent: (accent: string) => void;
  setRadius: (radius: number) => void;
  setMode: (mode: ThemeMode) => void;
  setMotionLevel: (motionLevel: MotionLevel) => void;
  setSoundEnabled: (soundEnabled: boolean) => void;
  setSoundVolume: (soundVolume: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      accent: "#6C7BFA",
      radius: 18,
      mode: "dark",
      motionLevel: "normal",
      soundEnabled: true,
      soundVolume: 0.6,
      setAccent: (accent) => set({ accent }),
      setRadius: (radius) => set({ radius }),
      setMode: (mode) => set({ mode }),
      setMotionLevel: (motionLevel) => set({ motionLevel }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setSoundVolume: (soundVolume) => set({ soundVolume: Math.min(1, Math.max(0, soundVolume)) }),
    }),
    { name: "encore-settings" }
  )
);
