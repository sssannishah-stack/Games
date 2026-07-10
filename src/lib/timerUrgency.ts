/**
 * Timer color ladder shared by the participant screen and the host console:
 * green while there's plenty of time, amber in the middle stretch, red once
 * it's nearly out — with a pulse in the final seconds so the last moments
 * actually feel urgent instead of just ticking numbers.
 */
export type TimerUrgency = "idle" | "safe" | "warning" | "critical";

export function timerUrgency(secondsLeft: number | null, totalSeconds: number): TimerUrgency {
  if (secondsLeft === null) return "idle";
  const total = totalSeconds > 0 ? totalSeconds : 30;
  const fraction = secondsLeft / total;
  if (fraction > 0.5) return "safe";
  if (fraction > 0.2) return "warning";
  return "critical";
}

export const TIMER_URGENCY_RING: Record<TimerUrgency, string> = {
  idle: "border-accent/35",
  safe: "border-success/60",
  warning: "border-warn/65",
  critical: "border-danger/70",
};

export const TIMER_URGENCY_TEXT: Record<TimerUrgency, string> = {
  idle: "text-ink",
  safe: "text-success",
  warning: "text-warn",
  critical: "text-danger-soft",
};

export const TIMER_URGENCY_GLOW: Record<TimerUrgency, string> = {
  idle: "transparent",
  safe: "rgba(61,214,140,.22)",
  warning: "rgba(232,163,61,.28)",
  critical: "rgba(255,90,90,.35)",
};
