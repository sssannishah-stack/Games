import type { AchievementType } from "@/types/db";

/**
 * Presentation + reward config for each achievement. Kept separate from the
 * DB enums (types/db.ts) and free of "server-only" so both the host console
 * (client) and the server actions can share one source of truth.
 *
 * `auto: true` achievements are detected from the score ledger and offered to
 * the host as suggestions; `auto: false` ones (timing/judgement calls the
 * system can't see) are granted manually by the host.
 */
export interface AchievementDef {
  label: string;
  emoji: string;
  description: string;
  coinReward: number;
  auto: boolean;
}

export const ACHIEVEMENTS: Record<AchievementType, AchievementDef> = {
  FIRST_BLOOD: {
    label: "First Blood",
    emoji: "🩸",
    description: "First correct answer of the event",
    coinReward: 200,
    auto: true,
  },
  HOT_STREAK: {
    label: "Hot Streak",
    emoji: "🔥",
    description: "3 correct answers in a row",
    coinReward: 300,
    auto: true,
  },
  ON_FIRE: {
    label: "On Fire",
    emoji: "🚀",
    description: "5 correct answers in a row",
    coinReward: 500,
    auto: true,
  },
  COMEBACK_KING: {
    label: "Comeback King",
    emoji: "👑",
    description: "Rose from last place to first",
    coinReward: 500,
    auto: true,
  },
  PERFECT_ROUND: {
    label: "Perfect Round",
    emoji: "💯",
    description: "No wrong answers in a round",
    coinReward: 400,
    auto: false,
  },
  FAST_ANSWER: {
    label: "Fast Answer",
    emoji: "⚡",
    description: "Lightning-quick correct answer",
    coinReward: 150,
    auto: false,
  },
};

/** Achievements the host grants by hand (system can't auto-detect them). */
export const MANUAL_ACHIEVEMENTS = (Object.keys(ACHIEVEMENTS) as AchievementType[]).filter(
  (type) => !ACHIEVEMENTS[type].auto
);
