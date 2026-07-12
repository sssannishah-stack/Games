"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Room, Competition, Team, PowerCard, TeamPowerCard, EventLog } from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoomOwnership } from "@/lib/authz";
import { createCoinTransaction } from "@/actions/coin.actions";
import { createScoreTransaction } from "@/actions/score.actions";
import { SPIN_SEGMENTS, pickSpinIndex, type SpinKind } from "@/lib/luckySpin";

export interface SpinResult {
  index: number;
  kind: SpinKind;
  label: string;
  emoji: string;
  amount: number;
  /** Which card the CARD segment actually granted — the wheel only says
   *  "Surprise card" generically, so without this neither the host nor the
   *  team has any way to know what landed in their inventory. */
  cardName: string | null;
}

/**
 * The host spins the Lucky Spin wheel for a team. The server picks the outcome
 * (so it can't be tampered with), applies the reward/penalty, logs it, and
 * returns the landed segment so the wheel can animate to match.
 */
export async function luckySpin(roomId: string, teamId: string): Promise<SpinResult> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const index = pickSpinIndex();
  const seg = SPIN_SEGMENTS[index];
  let cardName: string | null = null;

  if (seg.kind === "COINS") {
    await createCoinTransaction({
      roomId,
      teamId,
      amount: seg.amount,
      type: "HOST_ADJUSTMENT",
      reason: "Lucky Spin 🍀",
      createdBy: user.id,
    });
  } else if (seg.kind === "PENALTY") {
    // Only take what the team can afford — never drive coins negative.
    const team = await Team.findById(teamId).select("coins").lean<{ coins: number }>();
    const take = Math.min(team?.coins ?? 0, seg.amount);
    if (take > 0) {
      await createCoinTransaction({
        roomId,
        teamId,
        amount: -take,
        type: "HOST_ADJUSTMENT",
        reason: "Lucky Spin penalty",
        createdBy: user.id,
      });
    }
  } else if (seg.kind === "BONUS") {
    await createScoreTransaction({
      roomId,
      teamId,
      points: seg.amount,
      reason: "BONUS",
      createdBy: user.id,
    });
  } else if (seg.kind === "CARD") {
    cardName = await grantRandomCard(roomId, teamId);
  }

  await EventLog.create({
    roomId,
    type: "LUCKY_SPIN",
    metadata: { teamId, label: seg.label, emoji: seg.emoji, kind: seg.kind, cardName },
  });

  revalidatePath(`/host/${roomId}`);
  return { index, kind: seg.kind, label: seg.label, emoji: seg.emoji, amount: seg.amount, cardName };
}

/** Grant a random non-mystery card from the host's catalog to a team. Returns
 *  its name so the spin result can actually say what was won, instead of the
 *  wheel's generic "Surprise card" label leaving it to guesswork. */
async function grantRandomCard(roomId: string, teamId: string): Promise<string | null> {
  const room = await Room.findById(roomId).select("competitionId").lean<{ competitionId: unknown }>();
  if (!room) return null;
  const competition = await Competition.findById(room.competitionId).select("ownerId").lean<{ ownerId: unknown }>();
  if (!competition) return null;

  const pool = await PowerCard.find({
    ownerId: String(competition.ownerId),
    enabled: true,
    effectType: { $ne: "MYSTERY" },
  })
    .select("_id name usesPerTeam")
    .lean();
  if (pool.length === 0) return null;

  const prize = pool[Math.floor(Math.random() * pool.length)];
  await TeamPowerCard.findOneAndUpdate(
    { teamId, powerCardId: prize._id },
    { $inc: { remainingUses: prize.usesPerTeam || 1 }, $set: { status: "AVAILABLE" } },
    { upsert: true }
  );
  return prize.name;
}
