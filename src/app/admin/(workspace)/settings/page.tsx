"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SystemStates } from "@/components/states/SystemStates";
import { useSettingsStore, ACCENT_OPTIONS, THEME_MODES, MOTION_LEVELS } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

const MODE_META = {
  dark: { label: "Dark", icon: "moon", blurb: "Deep, focused control-room look" },
  bright: { label: "Bright", icon: "sun", blurb: "Light, vivid and eye-catching" },
} as const;

const MOTION_META = {
  minimal: { label: "Minimal", blurb: "Barely any motion" },
  normal: { label: "Normal", blurb: "Smooth, premium feel" },
  high: { label: "High", blurb: "Full game-show energy" },
} as const;

export default function AdminSettingsPage() {
  const { accent, radius, mode, motionLevel, setAccent, setRadius, setMode, setMotionLevel } = useSettingsStore();

  return (
    <>
      <Header title="Settings" subtitle="Workspace theme and host preferences" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl p-5 flex flex-col gap-5">
          <SectionLabel>THEME</SectionLabel>

          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-ink-3">Appearance</span>
            <div className="grid grid-cols-2 gap-2.5">
              {THEME_MODES.map((option) => {
                const meta = MODE_META[option];
                const active = mode === option;
                return (
                  <button
                    key={option}
                    onClick={() => setMode(option)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-[12px] border px-3.5 py-3 text-left cursor-pointer transition",
                      active
                        ? "border-accent/60 bg-accent/[.12]"
                        : "border-line/[.09] bg-line/[.03] hover:bg-line/[.06]"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon
                        name={meta.icon}
                        size={15}
                        className={active ? "text-accent" : "text-mute-2"}
                      />
                      <span className={cn("text-[13px] font-semibold", active ? "text-ink" : "text-ink-3")}>
                        {meta.label}
                      </span>
                    </span>
                    <span className="text-[11px] text-mute-2 leading-snug">{meta.blurb}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-ink-3">Accent color</span>
            <div className="flex gap-2.5">
              {ACCENT_OPTIONS.map((color) => (
                <button
                  key={color}
                  onClick={() => setAccent(color)}
                  className={cn(
                    "w-9 h-9 rounded-[10px] cursor-pointer transition",
                    accent === color ? "ring-2 ring-ink ring-offset-2 ring-offset-card" : "hover:scale-105"
                  )}
                  style={{ background: color }}
                  aria-label={color}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between">
              <span className="text-xs font-semibold text-ink-3">Corner radius</span>
              <span className="font-mono font-semibold text-[11px] text-ink">{radius}px</span>
            </div>
            <input
              type="range"
              min={12}
              max={26}
              step={2}
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="w-full accent-[var(--color-accent)] cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-ink-3">Animations</span>
            <div className="grid grid-cols-3 gap-2">
              {MOTION_LEVELS.map((level) => {
                const active = motionLevel === level;
                return (
                  <button
                    key={level}
                    onClick={() => setMotionLevel(level)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-[11px] border px-3 py-2.5 text-left cursor-pointer transition",
                      active
                        ? "border-accent/60 bg-accent/[.12]"
                        : "border-line/[.09] bg-line/[.03] hover:bg-line/[.06]"
                    )}
                  >
                    <span className={cn("text-[12.5px] font-semibold", active ? "text-ink" : "text-ink-3")}>
                      {MOTION_META[level].label}
                    </span>
                    <span className="text-[10.5px] text-mute-2 leading-snug">{MOTION_META[level].blurb}</span>
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] text-mute-2">
              &quot;Minimal&quot; also respects your device&apos;s reduce-motion setting.
            </span>
          </div>
        </Card>

        <Card className="rounded-2xl p-5 flex flex-col gap-4">
          <SectionLabel>PREFERENCES</SectionLabel>
          {[
            { label: "Confetti on winner reveal", on: true },
            { label: "Tick sound in last 5 seconds", on: true },
            { label: "Show keyboard hints on controls", on: false },
          ].map((pref) => (
            <div key={pref.label} className="flex items-center justify-between">
              <span className="text-[13px] text-ink-3">{pref.label}</span>
              <div className={cn("w-[34px] h-5 rounded-full relative transition-colors", pref.on ? "bg-accent" : "bg-line/15")}>
                <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", pref.on ? "right-0.5" : "left-0.5")} />
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div className="flex items-baseline gap-3 mt-2">
        <span className="font-mono font-semibold text-[11px] tracking-[.16em] text-dim-2">
          SYSTEM STATES
        </span>
        <span className="text-xs text-faint">empty - loading - error - toasts</span>
      </div>
      <SystemStates />
    </>
  );
}
