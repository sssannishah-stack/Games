"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { soundManager, type SoundName } from "@/lib/sound/SoundManager";

/**
 * Returns a stable `play(name)` bound to the user's sound preference + volume.
 * A no-op when sound is disabled or the engine hasn't been unlocked yet by a
 * gesture (see SoundBoot), so it's always safe to call from any effect.
 */
export function useSound() {
  const enabled = useSettingsStore((s) => s.soundEnabled);
  const volume = useSettingsStore((s) => s.soundVolume);

  useEffect(() => {
    soundManager.setVolume(volume);
  }, [volume]);

  return useCallback(
    (name: SoundName, gain = 1) => {
      if (!enabled) return;
      soundManager.play(name, gain);
    },
    [enabled]
  );
}

/**
 * Fires a sound exactly once each time `key` changes to a new truthy value —
 * the standard "play on this event" pattern (correct/wrong, purchase, etc.)
 * without re-firing on unrelated re-renders. Skips the initial mount.
 */
export function useSoundOnChange(name: SoundName, key: unknown, gain = 1) {
  const play = useSound();
  const prev = useRef<unknown>(undefined);
  useEffect(() => {
    if (prev.current === undefined) {
      prev.current = key;
      return;
    }
    if (key !== prev.current) {
      prev.current = key;
      if (key) play(name, gain);
    }
  }, [key, name, gain, play]);
}
