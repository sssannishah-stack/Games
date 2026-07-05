/* ── Core domain types for the Live Competition OS.
   These mirror the shapes MongoDB will eventually persist;
   for now the /data/mock files satisfy them for preview only. ── */

export type TeamStatus = "ready" | "requesting" | "active_power_card" | "offline" | "idle";

export interface TeamMember {
  id: string;
  name: string;
  initial: string;
  gradient: string; // avatar gradient css
  isCaptain?: boolean;
}

export interface Team {
  id: string;
  name: string;
  color: string; // hex swatch color
  score: number;
  rank: number;
  previousRank?: number;
  status: TeamStatus;
  statusDetail?: string; // "at mic", "power card requested", "extra time active"...
  members: TeamMember[];
  mentor?: string;
  streak?: number;
  accuracy?: number; // 0–100
  progress?: number; // leaderboard bar 0–100
}

export type PowerCardId =
  | "shield"
  | "freeze"
  | "hint"
  | "double"
  | "extra-time"
  | "mystery";

export type PowerCardState = "available" | "requested" | "approved" | "active" | "consumed";

export interface PowerCard {
  id: PowerCardId;
  name: string;
  description: string;
  icon: string; // lucide icon name (kebab)
  color: string;
  count: number;
  state: PowerCardState;
  usedOn?: string; // "Scene 07"
}

export interface ApprovalRequest {
  id: string;
  powerCard: PowerCardId;
  fromTeamId: string;
  targetTeamId?: string;
  secondsAgo: number;
}

export type QuestionType =
  | "Prompt"
  | "Audio"
  | "Image"
  | "Rapid Fire"
  | "Zoom"
  | "Drawing";

export interface QuestionOption {
  key: string; // A/B/C/D
  label: string;
  correct?: boolean;
}

export interface Question {
  id: string;
  emoji: string;
  title: string;
  subtitle: string; // "edited 2h ago · हिंदी + English"
  type: QuestionType;
  marks: string; // "+10 / −5"
  usedIn: string;
  options?: QuestionOption[];
  active?: boolean;
}

export type SceneStatus = "done" | "on-air" | "up-next" | "pending" | "optional";

export interface Scene {
  id: string;
  index: string; // "07"
  title: string;
  meta?: string; // "manual · 3:00"
  icon?: string; // lucide icon name
  emoji?: string;
  status: SceneStatus;
  onAirElapsed?: string;
}

export interface SceneGroup {
  id: string;
  label: string; // "ROUND 2 · EMOJI QUIZ"
  summary?: string; // "3/8" | "done" | "4 done"
  summaryTone?: "done" | "count";
  expanded?: boolean;
  scenes: Scene[];
}

export interface Competition {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  date: string;
  meta: string;
  status: "Live" | "Draft" | "Idea" | "Done";
}

export interface ScoreEvent {
  id: string;
  delta: number;
  reason: string;
  by: string;
  at: string;
}

export interface TimelineEvent {
  id: string;
  time: string;
  text: string;
  bold?: string; // leading bold fragment (team name)
}

export interface Guess {
  id: string;
  teamId: string;
  text: string;
  detail: string; // "Mango · 0:12"
  exact?: boolean;
  typing?: boolean;
}

export interface QuestionAccuracy {
  label: string; // Q1…
  correct: number;
  total: number;
}

export interface TeamPerformance {
  teamId: string;
  percent: number;
}

export interface AnalyticsHighlight {
  icon: string;
  iconColor: string;
  label: string;
  title: string;
  detail: string;
  barPercent: number;
  barColor: string;
}
