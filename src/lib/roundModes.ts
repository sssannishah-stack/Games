import type { SpecialRoundMode } from "@/types/db";

/**
 * Presentation + host-guidance config for special round modes (pure, shared by
 * the round builder, host console and participant screens). Scoring stays
 * manual — these only frame the round and prompt the host.
 */
export interface RoundModeDef {
  label: string;
  emoji: string;
  description: string;
  color: string;
  /** Difficulty ladder shown as quick-mark buttons in RISK rounds. */
  riskTiers?: { label: string; points: number }[];
}

export const ROUND_MODES: Record<SpecialRoundMode, RoundModeDef> = {
  NONE: {
    label: "Standard",
    emoji: "",
    description: "A normal round.",
    color: "#8EA0B8",
  },
  SPEED: {
    label: "Speed Round",
    emoji: "⚡",
    description: "Short timer, higher rewards — answer fast.",
    color: "#5EC9E8",
  },
  RISK: {
    label: "Risk Round",
    emoji: "🎯",
    description: "Teams pick a difficulty for bigger points.",
    color: "#E8A33D",
    riskTiers: [
      { label: "Easy", points: 10 },
      { label: "Medium", points: 25 },
      { label: "Hard", points: 50 },
    ],
  },
  SURVIVAL: {
    label: "Survival Round",
    emoji: "💀",
    description: "Wrong answers cost a life — play it safe.",
    color: "#FF6B6B",
  },
  BONUS: {
    label: "Bonus Round",
    emoji: "🎁",
    description: "Rewards only — no penalties this round.",
    color: "#3DD68C",
  },
};
