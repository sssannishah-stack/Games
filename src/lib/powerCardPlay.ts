/**
 * When can a power card actually be PLAYED? One pure rulebook shared by the
 * server gate (requestPowerCard) and the participant UI, so the disabled
 * button and the server rejection always agree.
 *
 * Viewing/flipping a card is always allowed — these rules only gate the
 * moment of use. The baseline: cards are played while a question is on
 * screen, not on Welcome/Leaderboard/Winner. Effects with extra needs (Extra
 * Time without a running clock is meaningless) add their own condition.
 */

const PLAYABLE_SCENES = new Set(["QUESTION", "DRAWING"]);

export interface PowerPlayContext {
  /** The scene currently on every phone (e.g. "WELCOME", "QUESTION"). */
  sceneType: string | null;
  /** True while the countdown is actually ticking (started and not paused). */
  timerRunning: boolean;
  /** Team whose question/turn is currently active, when the round assigns one. */
  assignedTeamId?: string | null;
  /** Team attempting to play the card. */
  actingTeamId?: string | null;
  /** The acting team is frozen on this question (opponent's Freeze) — no cards. */
  frozen?: boolean;
  /** How many hints this question has authored, and how many this team has revealed so far. */
  hintsTotal?: number;
  hintsRevealed?: number;
  /** Whether the live question is multiple-choice, and how many options it has. */
  isMCQ?: boolean;
  optionsCount?: number;
  /** This team has already Peeked (eliminated a wrong option) on the live question. */
  alreadyPeeked?: boolean;
}

export interface PowerPlayability {
  usable: boolean;
  /** Participant-facing explanation when not usable. */
  reason: string | null;
}

export function powerCardPlayability(
  effectType: string | null | undefined,
  ctx: PowerPlayContext
): PowerPlayability {
  if (!ctx.sceneType || !PLAYABLE_SCENES.has(ctx.sceneType)) {
    return { usable: false, reason: "Cards can be played while a question is live." };
  }
  if (ctx.frozen) {
    return { usable: false, reason: "Your team is frozen this question — no power cards." };
  }
  if (effectType === "MYSTERY") {
    return { usable: false, reason: "Mystery Box opens automatically when it is purchased." };
  }
  // Freeze is an attack card — played by another team against whoever's
  // turn it currently is, not on your own turn.
  const isAttack = effectType === "FREEZE";
  if (!ctx.assignedTeamId) {
    if (isAttack) {
      return { usable: false, reason: "This card needs a question assigned to another team." };
    }
  } else if (ctx.actingTeamId === ctx.assignedTeamId) {
    if (isAttack) {
      return { usable: false, reason: "It is your turn — attack cards target other teams." };
    }
  } else if (!isAttack) {
    return { usable: false, reason: "Only the active team can use this card. You may play Freeze." };
  }
  if (effectType === "EXTRA_TIME" && !ctx.timerRunning) {
    return { usable: false, reason: "Extra Time needs the timer to be running." };
  }
  if (effectType === "HINT") {
    if (!ctx.hintsTotal) {
      return { usable: false, reason: "This question has no hints." };
    }
    if ((ctx.hintsRevealed ?? 0) >= ctx.hintsTotal) {
      return { usable: false, reason: "All hints for this question are already revealed." };
    }
  }
  if (effectType === "PEEK") {
    if (!ctx.isMCQ || (ctx.optionsCount ?? 0) < 3) {
      return { usable: false, reason: "Peek needs a multiple-choice question with 3+ options." };
    }
    if (ctx.alreadyPeeked) {
      return { usable: false, reason: "You already peeked this question." };
    }
  }
  return { usable: true, reason: null };
}
