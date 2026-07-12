"use client";

import { useEffect } from "react";
import { soundManager } from "@/lib/sound/SoundManager";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Unlocks the Web Audio engine on the first real user gesture (browsers block
 * audio until then) and keeps its master volume in sync. Renders nothing —
 * mounted once at the root so every live screen has sound ready by the time
 * it's needed.
 */
export function SoundBoot() {
  const volume = useSettingsStore((s) => s.soundVolume);

  useEffect(() => {
    soundManager.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    const unlock = () => soundManager.unlock();
    const opts: AddEventListenerOptions = { once: true, passive: true };
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  return null;
}
