"use client";

import { Icon } from "@/components/ui/Icon";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

/** Sun/moon icon button that flips the whole app between the dark and bright themes. */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useSettingsStore();

  return (
    <button
      type="button"
      onClick={() => setMode(mode === "dark" ? "bright" : "dark")}
      aria-label={mode === "dark" ? "Switch to bright theme" : "Switch to dark theme"}
      className={cn(
        "rounded-xl bg-line/[.05] border border-line/[.09] text-mute-2 flex items-center justify-center cursor-pointer hover:bg-line/[.09] hover:text-ink-2 transition-colors",
        className
      )}
    >
      <Icon name={mode === "dark" ? "sun" : "moon"} size={16} />
    </button>
  );
}
