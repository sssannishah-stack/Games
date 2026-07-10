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
  /** A Steal Chance has already transferred this question once. */
  turnStolen?: boolean;
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
  if (effectType === "MYSTERY") {
    return { usable: false, reason: "Mystery Box opens automatically when it is purchased." };
  }
  const isSteal = effectType === "STEAL";
  if (!ctx.assignedTeamId) {
    if (isSteal) {
      return { usable: false, reason: "Steal Chance needs a question assigned to another team." };
    }
  } else if (ctx.actingTeamId === ctx.assignedTeamId) {
    if (isSteal) {
      return { usable: false, reason: "It is already your turn — Steal Chance is for other teams." };
    }
  } else if (!isSteal) {
    return { usable: false, reason: "Only the active team can use this card. You may only play Steal Chance." };
  } else if (ctx.turnStolen) {
    return { usable: false, reason: "Steal Chance has already been used for this question." };
  }
  if (effectType === "EXTRA_TIME" && !ctx.timerRunning) {
    return { usable: false, reason: "Extra Time needs the timer to be running." };
  }
  return { usable: true, reason: null };
}
