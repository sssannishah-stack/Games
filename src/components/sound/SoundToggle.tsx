"use client";

import { soundManager } from "@/lib/sound/SoundManager";
import { useSettingsStore } from "@/stores/settingsStore";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/**
 * Small speaker toggle for the live screens. Turning sound on also unlocks the
 * engine (it's a gesture) and plays a tiny confirmation blip so the user hears
 * that it worked.
 */
export function SoundToggle({ className }: { className?: string }) {
  const enabled = useSettingsStore((s) => s.soundEnabled);
  const setEnabled = useSettingsStore((s) => s.setSoundEnabled);

  return (
    <button
      type="button"
      onClick={() => {
        const next = !enabled;
        setEnabled(next);
        if (next) {
          soundManager.unlock();
          soundManager.play("tap");
        }
      }}
      aria-label={enabled ? "Mute sound" : "Unmute sound"}
      title={enabled ? "Sound on" : "Sound off"}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border transition cursor-pointer",
        enabled
          ? "border-accent/35 bg-accent/[.12] text-accent"
          : "border-line/[.12] bg-line/[.05] text-mute-2",
        className
      )}
    >
      <Icon name={enabled ? "volume-2" : "volume-x"} size={15} />
    </button>
  );
}
