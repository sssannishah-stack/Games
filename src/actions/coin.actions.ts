"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { CoinTransaction, Team, EventLog } from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoomOwnership } from "@/lib/authz";
import type { CoinTransactionType, ICoinTransaction } from "@/types/db";

export interface CreateCoinTransactionInput {
  roomId: string;
  teamId: string;
  amount: number;
  type: CoinTransactionType;
  reason?: string;
  createdBy?: string | null;
}

/**
 * Append a coin transaction to the ledger and reflect it on the team's
 * derived coin balance. Coins are never mutated in isolation — always the
 * running total of these transactions, exactly like the score ledger.
 */
export async function createCoinTransaction(
  input: CreateCoinTransactionInput
): Promise<ICoinTransaction> {
  if (!Number.isFinite(input.amount)) throw new Error("amount must be a number.");
  await connectToDatabase();

  const transaction = await CoinTransaction.create({
    roomId: input.roomId,
    teamId: input.teamId,
    amount: input.amount,
    type: input.type,
    reason: input.reason,
    createdBy: input.createdBy ?? null,
  });

  await Team.findByIdAndUpdate(input.teamId, { $inc: { coins: input.amount } });

  await EventLog.create({
    roomId: input.roomId,
    type: "COIN_AWARDED",
    metadata: { teamId: input.teamId, amount: input.amount, type: input.type },
  });

  return transaction.toObject() as ICoinTransaction;
}

/** Host manually adds or removes coins from a team (Economy Mode override). */
export async function giveCoins(
  roomId: string,
  teamId: string,
  amount: number,
  reason?: string
): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  if (!Number.isFinite(amount) || amount === 0) throw new Error("Enter a non-zero amount.");

  await createCoinTransaction({
    roomId,
    teamId,
    amount,
    type: "HOST_ADJUSTMENT",
    reason,
    createdBy: user.id,
  });

  revalidatePath(`/rooms/${roomId}`);
}

/**
 * Grant every team in a room their starting coin balance. Called once when
 * the host starts a room whose competition has Economy Mode enabled.
 */
export async function grantStartingCoins(
  roomId: string,
  teamIds: string[],
  startingCoins: number
): Promise<void> {
  if (startingCoins <= 0) return;
  await connectToDatabase();

  for (const teamId of teamIds) {
    await createCoinTransaction({
      roomId,
      teamId,
      amount: startingCoins,
      type: "STARTING_BONUS",
      reason: "Starting balance",
      createdBy: null,
    });
  }
}
