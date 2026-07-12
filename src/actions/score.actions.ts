"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/database/mongodb";
import { ScoreTransaction, Team, EventLog, Room, Round, TeamPowerCard, PowerCard, PowerCardRequest } from "@/models";
import { createCoinTransaction } from "@/actions/coin.actions";
import { detectAchievements } from "@/lib/detectAchievements";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoomOwnership } from "@/lib/authz";
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
  if (input.points < 0) {
    if (room?.currentRoundId) {
      const currentRound = await Round.findById(room.currentRoundId).select("specialMode").lean();
      if (currentRound?.specialMode === "BONUS") {
        throw new Error("Bonus rounds do not allow negative marks.");
      }
    }
  }

  const questionId = room?.currentQuestionId?.toString();
  const isTest = room?.status === "TESTING";
  let points = input.points;

  if (points < 0 && questionId) {
    // Insurance: a covered team takes no negative marks on an insured
    // question at all — no transaction, as if it never happened. Enforced
    // server-side so it can never be forgotten or typed around.
    const team = await Team.findById(input.teamId).select("insuredQuestionIds").lean();
    if (team?.insuredQuestionIds?.includes(questionId)) {
      await EventLog.create({
        roomId: input.roomId,
        type: "POWER_CARD_USED",
        metadata: {
          teamId: input.teamId,
          source: "INSURANCE_BLOCK",
          blockedPoints: points,
          text: "Insurance blocked a negative mark",
        },
      });
      revalidatePath(`/host/${input.roomId}`);
      revalidatePath(`/admin/rooms/${input.roomId}`);
      return;
    }
  }

  // Shield / Double Points / Gamble: auto-applied from whichever this team
  // currently has ACTIVE — same reliability guarantee as Insurance, instead
  // of relying on the host to notice and manually double/zero the number
  // before submitting (easy to forget, and the quick Mark Answer buttons
  // have no UI to do it at all).
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

  if (consumed && !isTest) {
    await consumeTeamPowerCardUse(consumed.id);
    // Keep the matching request's status in sync too, so the Power Requests
    // panel's "Mark Consumed" button doesn't linger on a card that was just
    // auto-consumed here (it would otherwise error — no ACTIVE copy left).
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

  if (isTest) {
    await EventLog.create({
      roomId: input.roomId,
      type: "SCORE_CHANGED",
      metadata: {
        teamId: input.teamId,
        points,
        reason: input.reason,
        testMode: true,
      },
    });
    revalidatePath(`/host/${input.roomId}`);
    return;
  }

  await createScoreTransaction({
    ...input,
    points,
    createdBy: user.id,
  });

  // Ranks + streaks are now up to date — surface any newly-earned achievements
  // to the host as suggestions (they decide whether to grant the reward).
  await detectAchievements(input.roomId);

  revalidatePath(`/host/${input.roomId}`);
  revalidatePath(`/admin/rooms/${input.roomId}`);
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
