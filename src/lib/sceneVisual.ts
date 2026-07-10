/**
 * One shared color language for scene/step types, used by both the host
 * console's Event Flow list and the room setup dashboard's Event Flow tab so
 * WELCOME / QUESTION / ANSWER etc. are distinguishable at a glance instead of
 * looking like identical gray rows.
 *
 * `bar` is a bold left-edge strip (the most legible signal on the dark theme),
 * `row` tints the whole card, `badge` styles a type chip, and `label` colors
 * the type caption.
 */
import type { SceneType } from "@/types/db";

export interface SceneVisual {
  marker: string;
  row: string;
  badge: string;
  bar: string;
  label: string;
}

const SCENE_VISUAL: Partial<Record<SceneType, SceneVisual>> = {
  WELCOME: { marker: "WELCOME", row: "border-violet-400/40 bg-violet-400/[.13]", badge: "bg-violet-400/25 text-violet-100", bar: "bg-violet-400", label: "text-violet-200" },
  ROUND_INTRO: { marker: "ROUND", row: "border-info/45 bg-info/[.14]", badge: "bg-info/25 text-info", bar: "bg-info", label: "text-info" },
  QUESTION: { marker: "Q", row: "border-accent/50 bg-accent/[.15]", badge: "bg-accent/30 text-accent", bar: "bg-accent", label: "text-accent" },
  DRAWING: { marker: "DRAW", row: "border-pink/50 bg-pink/[.15]", badge: "bg-pink/30 text-pink", bar: "bg-pink", label: "text-pink" },
  HINT: { marker: "HINT", row: "border-warn/45 bg-warn/[.13]", badge: "bg-warn/25 text-warn", bar: "bg-warn", label: "text-warn" },
  ANSWER_REVEAL: { marker: "A", row: "border-success/50 bg-success/[.15]", badge: "bg-success/30 text-success", bar: "bg-success", label: "text-success" },
  LEADERBOARD: { marker: "RANK", row: "border-amber/50 bg-amber/[.15]", badge: "bg-amber/30 text-amber", bar: "bg-amber", label: "text-amber" },
  RULES: { marker: "RULES", row: "border-info/40 bg-info/[.1]", badge: "bg-info/20 text-info", bar: "bg-info/70", label: "text-info" },
  WAITING: { marker: "WAIT", row: "border-line/[.14] bg-line/[.06]", badge: "bg-line/[.1] text-mute-2", bar: "bg-line/[.3]", label: "text-mute-2" },
  BREAK: { marker: "BREAK", row: "border-line/[.14] bg-line/[.06]", badge: "bg-line/[.1] text-mute-2", bar: "bg-line/[.3]", label: "text-mute-2" },
  BROADCAST: { marker: "SAY", row: "border-info/45 bg-info/[.14]", badge: "bg-info/25 text-info", bar: "bg-info", label: "text-info" },
  WINNER: { marker: "WIN", row: "border-warn/55 bg-warn/[.16]", badge: "bg-warn/30 text-warn", bar: "bg-warn", label: "text-warn" },
};

export function sceneVisual(type: SceneType): SceneVisual {
  return (
    SCENE_VISUAL[type] ?? {
      marker: type.replace(/_/g, " "),
      row: "border-line/[.08] bg-line/[.03]",
      badge: "bg-line/[.07] text-mute-2",
      bar: "bg-line/[.3]",
      label: "text-mute-2",
    }
  );
}
