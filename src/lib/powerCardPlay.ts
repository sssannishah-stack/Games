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

/**
 * Cards you play while it is SOMEONE ELSE's turn — they act on the team
 * currently answering. Everything else is a card you play on your own turn.
 */
const OFF_TURN_EFFECTS = new Set(["FREEZE", "TIME_DRAIN", "COPYCAT"]);

export interface PowerPlayContext {
  /** The scene currently on every phone (e.g. "WELCOME", "QUESTION"). */
  sceneType: string | null;
  /** True while the countdown is actually ticking (started and not paused). */
  timerRunning: boolean;
  /** Team whose question/turn is currently active, when the round assigns one. */
  assignedTeamId?: string | null;
  /** Head-to-Head: the second team racing for the same question. Both count as "on turn". */
  opponentTeamId?: string | null;
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
  /** Teams in the room other than the acting one — Pass the Question needs a recipient. */
  otherTeamCount?: number;
  /** The live question was already handed over once (blocks pass ping-pong). */
  alreadyPassed?: boolean;
  /** This team is already copying someone on the live question. */
  alreadyCopying?: boolean;
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
  // Cards played AGAINST whoever's turn it is, rather than on your own turn:
  // Freeze and Time Drain hit the answering team, Copycat rides their result.
  const isAttack = OFF_TURN_EFFECTS.has(effectType ?? "");
  // In Head-to-Head both duellists are "on turn" — each may use their own help
  // cards, and neither can attack the other mid-duel.
  const isOnTurn =
    ctx.actingTeamId === ctx.assignedTeamId ||
    (Boolean(ctx.opponentTeamId) && ctx.actingTeamId === ctx.opponentTeamId);
  if (!ctx.assignedTeamId) {
    if (isAttack) {
      return { usable: false, reason: "This card needs a question assigned to another team." };
    }
  } else if (isOnTurn) {
    if (isAttack) {
      return { usable: false, reason: "It is your turn — this card targets the team that's answering." };
    }
  } else if (!isAttack) {
    return {
      usable: false,
      reason: "Only the active team can use this card. You may play Freeze, Time Drain or Copycat.",
    };
  }
  if ((effectType === "EXTRA_TIME" || effectType === "TIME_DRAIN") && !ctx.timerRunning) {
    return {
      usable: false,
      reason: `${effectType === "EXTRA_TIME" ? "Extra Time" : "Time Drain"} needs the timer to be running.`,
    };
  }
  if (effectType === "PASS_QUESTION") {
    // Passing needs somebody to pass to, and a question that hasn't already
    // been handed over — otherwise it could ping-pong between two teams.
    if ((ctx.otherTeamCount ?? 0) < 1) {
      return { usable: false, reason: "There's no other team to pass this question to." };
    }
    if (ctx.alreadyPassed) {
      return { usable: false, reason: "This question has already been passed once." };
    }
  }
  if (effectType === "COPYCAT" && ctx.alreadyCopying) {
    return { usable: false, reason: "You're already copying this question." };
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
