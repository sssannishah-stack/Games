/**
 * One shared color language for scene/step types, used by both the host
 * console's Event Flow list and the room setup dashboard's Event Flow tab so
 * WELCOME / QUESTION / ANSWER etc. are distinguishable at a glance.
 *
 * Design intent: NOT a deck of colored cards. Every row sits on the same calm
 * neutral surface (`row`); type identity is carried by a compact color chip
 * (`badge`), a colored caption (`label`), and a slim accent edge (`bar`).
 * Color accents, not color blocks.
 */
import type { SceneType } from "@/types/db";

export interface SceneVisual {
  marker: string;
  row: string;
  badge: string;
  bar: string;
  label: string;
}

/** All rows share this neutral surface so the list reads as one calm flow. */
const NEUTRAL_ROW = "border-line/[.09] bg-line/[.025]";

const SCENE_VISUAL: Partial<Record<SceneType, SceneVisual>> = {
  WELCOME:       { marker: "WELCOME", row: NEUTRAL_ROW, badge: "bg-violet-400/15 text-violet-200 border border-violet-400/25", bar: "bg-violet-400/70", label: "text-violet-200/90" },
  ROUND_OVERVIEW:{ marker: "MAP",     row: NEUTRAL_ROW, badge: "bg-violet-400/15 text-violet-200 border border-violet-400/25", bar: "bg-violet-400/70", label: "text-violet-200/90" },
  ROUND_INTRO:   { marker: "ROUND",   row: NEUTRAL_ROW, badge: "bg-info/15 text-info border border-info/25",                 bar: "bg-info/70",       label: "text-info/90" },
  QUESTION:      { marker: "Q",       row: NEUTRAL_ROW, badge: "bg-accent/15 text-accent border border-accent/30",           bar: "bg-accent/80",     label: "text-accent/90" },
  DRAWING:       { marker: "DRAW",    row: NEUTRAL_ROW, badge: "bg-pink/15 text-pink border border-pink/30",                 bar: "bg-pink/75",       label: "text-pink/90" },
  HINT:          { marker: "HINT",    row: NEUTRAL_ROW, badge: "bg-warn/15 text-warn border border-warn/25",                 bar: "bg-warn/70",       label: "text-warn/90" },
  ANSWER_REVEAL: { marker: "A",       row: NEUTRAL_ROW, badge: "bg-success/15 text-success border border-success/30",        bar: "bg-success/80",    label: "text-success/90" },
  LEADERBOARD:   { marker: "RANK",    row: NEUTRAL_ROW, badge: "bg-amber/15 text-amber border border-amber/30",             bar: "bg-amber/75",      label: "text-amber/90" },
  ROUND_COMPLETE:{ marker: "DONE",    row: NEUTRAL_ROW, badge: "bg-success/15 text-success border border-success/30",       bar: "bg-success/80",    label: "text-success/90" },
  RULES:         { marker: "RULES",   row: NEUTRAL_ROW, badge: "bg-info/12 text-info border border-info/20",                bar: "bg-info/55",       label: "text-info/80" },
  WAITING:       { marker: "WAIT",    row: NEUTRAL_ROW, badge: "bg-line/[.08] text-mute-2 border border-line/[.12]",        bar: "bg-line/[.25]",    label: "text-mute-2" },
  BREAK:         { marker: "BREAK",   row: NEUTRAL_ROW, badge: "bg-line/[.08] text-mute-2 border border-line/[.12]",        bar: "bg-line/[.25]",    label: "text-mute-2" },
  BROADCAST:     { marker: "SAY",     row: NEUTRAL_ROW, badge: "bg-info/15 text-info border border-info/25",                bar: "bg-info/70",       label: "text-info/90" },
  WINNER:        { marker: "WIN",     row: NEUTRAL_ROW, badge: "bg-warn/18 text-warn border border-warn/35",                bar: "bg-warn/85",       label: "text-warn" },
};

export function sceneVisual(type: SceneType): SceneVisual {
  return (
    SCENE_VISUAL[type] ?? {
      marker: type.replace(/_/g, " "),
      row: NEUTRAL_ROW,
      badge: "bg-line/[.07] text-mute-2 border border-line/[.12]",
      bar: "bg-line/[.25]",
      label: "text-mute-2",
    }
  );
}
