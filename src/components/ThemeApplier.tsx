"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

/* Pushes the live accent + radius + theme mode into CSS variables/attributes
   so the whole app re-themes, exactly like the design's exported theme props. */
export function ThemeApplier() {
  const { accent, radius, mode, motionLevel } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-accent", accent);
    root.style.setProperty("--radius-frame", `${radius}px`);
    root.setAttribute("data-theme", mode);
    root.setAttribute("data-motion", motionLevel);
  }, [accent, radius, mode, motionLevel]);

  return null;
}
