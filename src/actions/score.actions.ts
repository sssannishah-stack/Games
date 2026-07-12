"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/database/mongodb";
import { ScoreTransaction, Team, EventLog, Room, Round, TeamPowerCard, PowerCard, PowerCardRequest, Scene, Question, Competition } from "@/models";
import { createCoinTransaction } from "@/actions/coin.actions";
import { detectAchievements } from "@/lib/detectAchievements";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoomOwnership } from "@/lib/authz";
import { assertTeamController } from "@/lib/teamRoles";
import { type ScoreReason, type IScoreTransaction } from "@/types/db";

export interface CreateScoreTransactionInput {
  roomId: string;
  teamId: string;
  points: number;
  reason: ScoreReason;
  participantId?: string | null;
  questionId?: string | null;
  isUndo?: boolean;
  createdBy?: string | null;
  /**
   * Economy Mode only: coins to award alongside this score change (e.g. the
   * competition's "correct answer" coin rule). The caller computes this from
   * already-loaded competition settings — this action never looks up
   * economy config itself, to avoid an extra database round trip on every
   * single score event.
   */
  coinsAwarded?: number;
}

/**
 * Recompute a team's consecutive-correct streak straight from the ledger, so
 * it stays correct through undos (an undone answer is flagged and excluded).
 * The streak is the number of trailing CORRECTs since the team's last WRONG.
 */
async function recalculateTeamStreak(roomId: string, teamId: string) {
  const answers = await ScoreTransaction.find({
    roomId,
    teamId,
    reason: { $in: ["CORRECT", "WRONG"] },
    isUndo: { $ne: true },
    isReverted: { $ne: true },
  })
    .sort({ createdAt: 1 })
    .select("reason")
    .lean<{ reason: ScoreReason }[]>();

  let streak = 0;
  for (const answer of answers) {
    streak = answer.reason === "CORRECT" ? streak + 1 : 0;
  }

  const team = await Team.findById(teamId).select("stats.bestStreak").lean<{ stats?: { bestStreak?: number } }>();
  const bestStreak = Math.max(team?.stats?.bestStreak ?? 0, streak);
  await Team.findByIdAndUpdate(teamId, {
    $set: { "stats.streak": streak, "stats.bestStreak": bestStreak },
  });
}

async function recalculateRoomScores(roomId: string) {
  const roomObjectId = new Types.ObjectId(roomId);
  const totals = await ScoreTransaction.aggregate<{ _id: unknown; score: number }>([
    {
      $match: {
        roomId: roomObjectId,
        isUndo: { $ne: true },
        isReverted: { $ne: true },
      },
    },
    { $group: { _id: "$teamId", score: { $sum: "$points" } } },
  ]);
  const scoreMap = new Map(totals.map((total) => [String(total._id), total.score]));
  const teams = await Team.find({ roomId }).select("_id name rank").lean();
  const oldRankById = new Map(teams.map((team) => [team._id.toString(), team.rank ?? 0]));
  const ranked = teams
    .map((team) => ({
      id: team._id.toString(),
      score: scoreMap.get(team._id.toString()) ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  await Team.bulkWrite(
    ranked.map((team, index) => ({
      updateOne: {
        filter: { _id: team.id },
        // Snapshot the prior rank before overwriting so comeback detection can
        // see "was last, now first".
        update: { $set: { score: team.score, rank: index + 1, previousRank: oldRankById.get(team.id) ?? 0 } },
      },
    }))
  );
}

/**
 * Append a score transaction to the ledger and reflect it on the team's
 * derived score + stats. The team score is never mutated in isolation —
 * it is always the running total of its transactions.
 */
export async function createScoreTransaction(
  input: CreateScoreTransactionInput
): Promise<IScoreTransaction> {
  if (!Number.isFinite(input.points)) throw new Error("points must be a number.");
  await connectToDatabase();

  const transaction = await ScoreTransaction.create({
    roomId: input.roomId,
    teamId: input.teamId,
    participantId: input.participantId ?? null,
    questionId: input.questionId ?? null,
    points: input.points,
    reason: input.reason,
    isUndo: input.isUndo ?? false,
    isReverted: false,
    createdBy: input.createdBy ?? null,
  });

  const statsInc: Record<string, number> = {};
  if (!input.isUndo) {
    if (input.reason === "CORRECT") statsInc["stats.correctAnswers"] = 1;
    else if (input.reason === "WRONG") statsInc["stats.wrongAnswers"] = 1;
    else if (input.reason === "BONUS") statsInc["stats.bonusPoints"] = input.points;
  }

  if (Object.keys(statsInc).length > 0) {
    await Team.findByIdAndUpdate(input.teamId, { $inc: statsInc });
  }
  // Any CORRECT/WRONG change (including an undo, which carries the original
  // reason) can shift the streak — recompute it from the ledger.
  if (input.reason === "CORRECT" || input.reason === "WRONG") {
    await recalculateTeamStreak(input.roomId, input.teamId);
  }
  await recalculateRoomScores(input.roomId);

  await EventLog.create({
    roomId: input.roomId,
    type: "SCORE_CHANGED",
    metadata: {
      teamId: input.teamId,
      questionId: input.questionId ?? null,
      points: input.points,
      reason: input.reason,
      isUndo: input.isUndo ?? false,
      isReverted: false,
    },
  });

  if (input.coinsAwarded && !input.isUndo) {
    await createCoinTransaction({
      roomId: input.roomId,
      teamId: input.teamId,
      amount: input.coinsAwarded,
      type: "QUESTION_REWARD",
      reason: `Reward for ${input.reason.toLowerCase()} answer`,
      createdBy: input.createdBy ?? null,
    });
  }

  return transaction.toObject() as IScoreTransaction;
}

/** Decrement one use of an owned power card, same transition consumePowerCard uses. */
async function consumeTeamPowerCardUse(teamPowerCardId: unknown): Promise<void> {
  const owned = await TeamPowerCard.findById(teamPowerCardId);
  if (!owned) return;
  owned.remainingUses -= 1;
  owned.status = owned.remainingUses <= 0 ? "CONSUMED" : "AVAILABLE";
  await owned.save();
}

/**
 * Apply a mark through the power-card modifiers (Insurance void, Shield,
 * Double Points, Gamble) and write it to the ledger + stats. The host's
 * manual giveMarks and MCQ auto-grading both funnel through here so the
 * modifiers behave identically. The caller must have already authorized and
 * connected; this does not touch the timer or bonus-round validation.
 */
async function resolveAndApplyMark(input: {
  roomId: string;
  teamId: string;
  points: number;
  reason: ScoreReason;
  questionId: string | null;
  participantId?: string | null;
  createdBy?: string | null;
  isTest: boolean;
  coinsAwarded?: number;
}): Promise<{ finalPoints: number; blocked: boolean }> {
  let points = input.points;
  const questionId = input.questionId;

  if (points < 0 && questionId) {
    // Insurance: a covered team takes no negative marks on an insured
    // question at all — no transaction, as if it never happened.
    const team = await Team.findById(input.teamId).select("insuredQuestionIds").lean();
    if (team?.insuredQuestionIds?.includes(questionId)) {
      await EventLog.create({
        roomId: input.roomId,
        type: "POWER_CARD_USED",
        metadata: {
          teamId: input.teamId,
          questionId,
          source: "INSURANCE_BLOCK",
          blockedPoints: points,
          reason: input.reason,
          points: 0,
          text: "Insurance blocked a negative mark",
        },
      });
      return { finalPoints: 0, blocked: true };
    }
  }

  // Shield / Double Points / Gamble: auto-applied from whichever this team
  // currently has ACTIVE, then consumed — same reliability guarantee as
  // Insurance, whether the mark came from the host or an MCQ auto-grade.
  let consumed: { id: unknown; powerCardId: string; effectType: string } | null = null;
  if (questionId && points !== 0 && (input.reason === "CORRECT" || input.reason === "WRONG" || input.reason === "BONUS")) {
    const owned = await TeamPowerCard.find({ teamId: input.teamId, status: "ACTIVE" })
      .select("_id powerCardId")
      .lean();
    if (owned.length > 0) {
      const cards = await PowerCard.find({ _id: { $in: owned.map((o) => o.powerCardId) } })
        .select("_id effectType")
        .lean();
      const effectByCardId = new Map(cards.map((c) => [c._id.toString(), c.effectType]));
      const findActive = (effectType: string) =>
        owned.find((o) => effectByCardId.get(o.powerCardId.toString()) === effectType);

      if (points < 0) {
        const shield = findActive("BLOCK_NEGATIVE");
        const gamble = findActive("GAMBLE");
        if (shield) {
          points = 0;
          consumed = { id: shield._id, powerCardId: shield.powerCardId.toString(), effectType: "BLOCK_NEGATIVE" };
        } else if (gamble) {
          points *= 2;
          consumed = { id: gamble._id, powerCardId: gamble.powerCardId.toString(), effectType: "GAMBLE" };
        }
      } else {
        const gamble = findActive("GAMBLE");
        const double = findActive("DOUBLE_SCORE");
        if (gamble) {
          points *= 2;
          consumed = { id: gamble._id, powerCardId: gamble.powerCardId.toString(), effectType: "GAMBLE" };
        } else if (double) {
          points *= 2;
          consumed = { id: double._id, powerCardId: double.powerCardId.toString(), effectType: "DOUBLE_SCORE" };
        }
      }
    }
  }

  if (consumed && !input.isTest) {
    await consumeTeamPowerCardUse(consumed.id);
    await PowerCardRequest.updateMany(
      { teamId: input.teamId, powerCardId: consumed.powerCardId, status: "ACTIVE" },
      { $set: { status: "CONSUMED" } }
    );
    await EventLog.create({
      roomId: input.roomId,
      type: "POWER_CARD_USED",
      metadata: {
        teamId: input.teamId,
        source: "AUTO_APPLIED",
        effectType: consumed.effectType,
        text: `${consumed.effectType === "BLOCK_NEGATIVE" ? "Shield" : consumed.effectType === "GAMBLE" ? "Gamble" : "Double Points"} applied automatically`,
      },
    });
  }

  if (input.isTest) {
    await EventLog.create({
      roomId: input.roomId,
      type: "SCORE_CHANGED",
      metadata: { teamId: input.teamId, questionId, points, reason: input.reason, testMode: true },
    });
    return { finalPoints: points, blocked: false };
  }

  await createScoreTransaction({
    roomId: input.roomId,
    teamId: input.teamId,
    points,
    reason: input.reason,
    participantId: input.participantId ?? null,
    questionId: input.questionId ?? null,
    createdBy: input.createdBy ?? null,
    coinsAwarded: input.coinsAwarded,
  });
  await detectAchievements(input.roomId);
  return { finalPoints: points, blocked: false };
}

export async function giveMarks(input: {
  roomId: string;
  teamId: string;
  points: number;
  reason: ScoreReason;
  participantId?: string | null;
  questionId?: string | null;
}): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(input.roomId, user.id);
  await connectToDatabase();
  const room = await Room.findById(input.roomId).select("status currentRoundId currentQuestionId").lean();
  if (input.points < 0 && room?.currentRoundId) {
    const currentRound = await Round.findById(room.currentRoundId).select("specialMode").lean();
    if (currentRound?.specialMode === "BONUS") {
      throw new Error("Bonus rounds do not allow negative marks.");
    }
  }

  const isTest = room?.status === "TESTING";
  const questionId = room?.currentQuestionId?.toString() ?? input.questionId ?? null;

  // A whole-team Correct/Wrong verdict is a one-shot judgment on a question —
  // tapping Wrong right after Correct (or vice versa) used to just stack a
  // second transaction on top instead of replacing the first, so the team's
  // score silently drifted by both amounts. Block a second verdict on the
  // same question until the host explicitly Undoes the first one. Per-member
  // scoring (a specific participantId) is unaffected — that's intentionally
  // independent per member.
  if (!isTest && !input.participantId && questionId && (input.reason === "CORRECT" || input.reason === "WRONG")) {
    const alreadyJudged = await ScoreTransaction.exists({
      roomId: input.roomId,
      teamId: input.teamId,
      questionId,
      participantId: null,
      reason: { $in: ["CORRECT", "WRONG"] },
      isUndo: { $ne: true },
      isReverted: { $ne: true },
    });
    if (alreadyJudged) {
      throw new Error("This team has already been marked for this question. Undo it first to re-judge.");
    }
  }

  // A Correct/Wrong call is the host judging the live question — stop the
  // clock the instant that happens so the phones get a clean result signal.
  if (!isTest && (input.reason === "CORRECT" || input.reason === "WRONG")) {
    await Room.findByIdAndUpdate(input.roomId, { $set: { "liveState.timerPaused": true } });
  }

  await resolveAndApplyMark({
    roomId: input.roomId,
    teamId: input.teamId,
    points: input.points,
    reason: input.reason,
    questionId,
    participantId: input.participantId,
    createdBy: user.id,
    isTest,
  });

  revalidatePath(`/host/${input.roomId}`);
  revalidatePath(`/admin/rooms/${input.roomId}`);
}

/**
 * A team's captain selects an option on a live multiple-choice question. It's
 * auto-graded against the stored answer and marks land immediately (respecting
 * Shield/Insurance/Bonus/Double/Gamble, same as a host mark). Double Guess
 * grants a single retry on a wrong pick; Peek's ruled-out option can't be
 * chosen. Only the team whose turn it is (when the round assigns turns) may
 * answer, and each team answers at most once.
 */
export async function submitMcqAnswer(input: {
  roomId: string;
  teamId: string;
  participantId: string;
  optionIndex: number;
}): Promise<{ result: "CORRECT" | "WRONG" | "RETRY"; points: number }> {
  await connectToDatabase();
  await assertTeamController(input.teamId, input.participantId);

  const room = await Room.findById(input.roomId)
    .select("status currentSceneId currentRoundId currentQuestionId competitionId liveState.showAnswer settings.permissions.requestLifelines")
    .lean();
  if (!room?.currentQuestionId || !room.currentSceneId) throw new Error("No question is live.");
  if (room.liveState?.showAnswer) throw new Error("The answer has already been revealed.");

  const scene = await Scene.findById(room.currentSceneId).select("type settings").lean();
  if (!scene || scene.type !== "QUESTION") throw new Error("Answers can only be submitted on a live question.");

  const questionId = room.currentQuestionId.toString();
  const question = await Question.findById(questionId)
    .select("isMCQ options answer positiveMarks negativeMarks coinReward")
    .lean();
  if (!question?.isMCQ) throw new Error("This is not a multiple-choice question.");
  if (input.optionIndex < 0 || input.optionIndex >= question.options.length) {
    throw new Error("That option does not exist.");
  }

  // Turn gate: if the round assigns a team to this question, only that team answers.
  const assignedTeamId = typeof scene.settings?.assignedTeamId === "string" ? scene.settings.assignedTeamId : null;
  if (assignedTeamId && assignedTeamId !== input.teamId) {
    throw new Error("It is not your team's turn to answer.");
  }

  // One graded answer per team per question.
  const alreadyGraded = await EventLog.exists({
    roomId: room._id,
    type: "MCQ_GRADED",
    "metadata.teamId": input.teamId,
    "metadata.questionId": questionId,
  });
  if (alreadyGraded) throw new Error("Your team has already answered this question.");

  const team = await Team.findById(input.teamId).select("peeks").lean();
  const peekedIndex = team?.peeks?.find((p) => p.questionId === questionId)?.eliminatedOptionIndex;
  if (peekedIndex === input.optionIndex) throw new Error("That option was ruled out by Peek.");

  // A prior wrong pick this question (Double Guess retry in progress).
  const retryLog = await EventLog.findOne({
    roomId: room._id,
    type: "MCQ_RETRY",
    "metadata.teamId": input.teamId,
    "metadata.questionId": questionId,
  }).lean();
  const firstWrongPick = retryLog ? Number(retryLog.metadata?.firstPick ?? -1) : -1;
  if (firstWrongPick === input.optionIndex) throw new Error("You already tried that option — pick another.");

  const correct = question.options[input.optionIndex] === question.answer;
  const isTest = room.status === "TESTING";

  const round = room.currentRoundId
    ? await Round.findById(room.currentRoundId).select("positiveMarks negativeMarks coinReward specialMode").lean()
    : null;
  const isBonus = round?.specialMode === "BONUS";

  // Double Guess: on a wrong first pick, if the team has an active Second
  // Chance and hasn't retried yet, consume it and let them pick again.
  if (!correct && !retryLog) {
    const owned = await TeamPowerCard.find({ teamId: input.teamId, status: "ACTIVE" }).select("_id powerCardId").lean();
    if (owned.length > 0) {
      const cards = await PowerCard.find({ _id: { $in: owned.map((o) => o.powerCardId) } })
        .select("_id effectType")
        .lean();
      const dgCardId = new Set(cards.filter((c) => c.effectType === "SECOND_CHANCE").map((c) => c._id.toString()));
      const dg = owned.find((o) => dgCardId.has(o.powerCardId.toString()));
      if (dg) {
        await consumeTeamPowerCardUse(dg._id);
        await PowerCardRequest.updateMany(
          { teamId: input.teamId, powerCardId: dg.powerCardId, status: "ACTIVE" },
          { $set: { status: "CONSUMED" } }
        );
        await EventLog.create({
          roomId: room._id,
          type: "MCQ_RETRY",
          metadata: { teamId: input.teamId, questionId, firstPick: input.optionIndex },
        });
        revalidatePath(`/host/${input.roomId}`);
        return { result: "RETRY", points: 0 };
      }
    }
  }

  // Finalize. Coins only pay out on a correct answer, and only in Economy Mode.
  const positive = round?.positiveMarks ?? question.positiveMarks ?? 10;
  const negative = Math.abs(round?.negativeMarks ?? question.negativeMarks ?? 5);
  const rawPoints = correct ? positive : isBonus ? 0 : -negative;

  let coins = 0;
  if (correct) {
    const competition = await Competition.findById(room.competitionId).select("settings.economy.enabled").lean();
    if (competition?.settings?.economy?.enabled) coins = round?.coinReward ?? question.coinReward ?? 0;
  }

  if (!isTest && assignedTeamId) {
    // A single assigned answerer just resolved this question — stop the clock.
    await Room.findByIdAndUpdate(input.roomId, { $set: { "liveState.timerPaused": true } });
  }

  const { finalPoints } = await resolveAndApplyMark({
    roomId: input.roomId,
    teamId: input.teamId,
    points: rawPoints,
    reason: correct ? "CORRECT" : "WRONG",
    questionId,
    participantId: input.participantId,
    createdBy: null,
    isTest,
    coinsAwarded: coins > 0 ? coins : undefined,
  });

  await EventLog.create({
    roomId: room._id,
    type: "MCQ_GRADED",
    metadata: { teamId: input.teamId, questionId, optionIndex: input.optionIndex, correct, points: finalPoints },
  });

  revalidatePath(`/host/${input.roomId}`);
  revalidatePath(`/admin/rooms/${input.roomId}`);
  return { result: correct ? "CORRECT" : "WRONG", points: finalPoints };
}

/**
 * Undo a prior transaction by appending its inverse (history is preserved).
 */
export async function undoScoreTransaction(
  transactionId: string,
  createdBy?: string | null
): Promise<IScoreTransaction> {
  await connectToDatabase();

  const original = await ScoreTransaction.findById(transactionId).lean<IScoreTransaction>();
  if (!original) throw new Error("Transaction not found.");
  if (original.isUndo || original.isReverted) throw new Error("Transaction already reverted.");

  await ScoreTransaction.findByIdAndUpdate(transactionId, { $set: { isReverted: true } });

  return createScoreTransaction({
    roomId: original.roomId.toString(),
    teamId: original.teamId.toString(),
    participantId: original.participantId?.toString() ?? null,
    questionId: original.questionId?.toString() ?? null,
    points: -original.points,
    reason: original.reason,
    isUndo: true,
    createdBy: createdBy ?? null,
  });
}

export async function hostUndoScoreTransaction(transactionId: string): Promise<void> {
  const user = await requireUser();
  await connectToDatabase();
  const transaction = await ScoreTransaction.findById(transactionId).lean<IScoreTransaction>();
  if (!transaction) throw new Error("Transaction not found.");
  await assertRoomOwnership(transaction.roomId.toString(), user.id);
  await undoScoreTransaction(transactionId, user.id);
  revalidatePath(`/host/${transaction.roomId.toString()}`);
  revalidatePath(`/admin/rooms/${transaction.roomId.toString()}`);
}
