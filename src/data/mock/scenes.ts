import type { SceneGroup, Scene } from "@/types";

/* Preview-only mock data — replaced by MongoDB later. */

export const mockSceneGroups: SceneGroup[] = [
  {
    id: "opening",
    label: "OPENING",
    summary: "4 done",
    summaryTone: "done",
    scenes: [],
  },
  {
    id: "round1",
    label: "ROUND 1 · ANTAKSHARI",
    summary: "done",
    summaryTone: "done",
    scenes: [],
  },
  {
    id: "round2",
    label: "ROUND 2 · EMOJI QUIZ",
    summary: "3/8",
    summaryTone: "count",
    expanded: true,
    scenes: [
      { id: "sc05", index: "05", title: "Round intro", status: "done" },
      { id: "sc06", index: "06", title: "Question 2", status: "done" },
      { id: "sc07", index: "07", title: "Question 3", status: "on-air", onAirElapsed: "0:48" },
      { id: "sc08", index: "08", title: "Question 4", status: "up-next" },
      { id: "schint", index: "", title: "Hint scene", icon: "lightbulb", status: "optional", meta: "optional" },
      { id: "sc09", index: "09", title: "Spin wheel", icon: "ferris-wheel", status: "pending" },
      { id: "sc10", index: "10", title: "Leaderboard", icon: "crown", status: "pending" },
      { id: "sc11", index: "11", title: "Tea break", icon: "coffee", status: "pending" },
    ],
  },
  {
    id: "round3",
    label: "ROUND 3 · CHARADES",
    summary: "6",
    summaryTone: "count",
    scenes: [],
  },
  {
    id: "finale",
    label: "FINALE",
    summary: "3",
    summaryTone: "count",
    scenes: [],
  },
];

/* Builder rail — flat list with section headers */
export const builderSections: { label: string; scenes: Scene[] }[] = [
  {
    label: "OPENING",
    scenes: [
      { id: "b01", index: "01", title: "Welcome", meta: "5:00", icon: "hand", status: "pending" },
      { id: "b02", index: "02", title: "Rules", meta: "3:00", icon: "scroll-text", status: "pending" },
    ],
  },
  {
    label: "ROUND 2 · EMOJI QUIZ",
    scenes: [
      { id: "b06", index: "06", title: "Round intro", meta: "1:00", emoji: "🎬", status: "pending" },
      { id: "b07", index: "07", title: "Question 3", meta: "manual · 3:00", emoji: "🍿", status: "on-air" },
      { id: "b08", index: "08", title: "Question 4", meta: "manual · 3:00", emoji: "😀", status: "pending" },
      { id: "b09", index: "09", title: "Spin wheel", meta: "reward · 2:00", icon: "ferris-wheel", status: "pending" },
      { id: "b10", index: "10", title: "Leaderboard", meta: "2:00", icon: "crown", status: "pending" },
      { id: "b11", index: "11", title: "Tea break", meta: "10:00 · sponsor", icon: "coffee", status: "pending" },
    ],
  },
];

export const runOfShow: Scene[] = [
  { id: "r05", index: "05", title: "Q1 — done", meta: "2:40", status: "done" },
  { id: "r06", index: "06", title: "Q2 — done", meta: "3:05", status: "done" },
  { id: "r07", index: "07", title: "Question 3", status: "on-air", onAirElapsed: "0:48 elapsed" },
  { id: "r08", index: "08", title: "Question 4", status: "up-next" },
  { id: "r09", index: "09", title: "Spin wheel", meta: "2:00", icon: "ferris-wheel", status: "pending" },
  { id: "r10", index: "10", title: "Leaderboard", meta: "2:00", icon: "crown", status: "pending" },
  { id: "r11", index: "11", title: "Tea break", meta: "10:00", icon: "coffee", status: "pending" },
  { id: "r12", index: "12", title: "Round 3 · Charades", meta: "18:00", icon: "mic-vocal", status: "pending" },
];
