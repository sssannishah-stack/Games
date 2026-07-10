"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import {
  Competition,
  Room,
  Team,
  Participant,
  Scene,
  TeamPowerCard,
  PowerCardRequest,
  CoinTransaction,
  ScoreTransaction,
  EventLog,
} from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertCompetitionOwnership, assertRoomOwnership } from "@/lib/authz";
import { grantStartingCoins } from "@/actions/coin.actions";
import {
  createCompetitionSchema,
  updateCompetitionSchema,
} from "@/validators/competition.validator";
import type { CreatePowerCardInput } from "@/validators/powerCard.validator";
import type { CompetitionSettings, CompetitionStatus } from "@/types/db";

export interface CreateCompetitionArgs {
  title: string;
  description?: string;
  language: string;
  theme: string;
  settings: CompetitionSettings;
  /** Deprecated for V1 competition creation; rooms/power cards are configured after creation. */
  powerCards: CreatePowerCardInput[];
}

/**
 * Create a competition owned by the current host. V1 competitions are only
 * event containers; rooms, teams, rounds, scenes, and power cards are set up
 * after creation from the competition and room dashboards.
 */
export async function createCompetition(
  input: CreateCompetitionArgs
): Promise<{ id: string }> {
  const user = await requireUser();
  const data = createCompetitionSchema.parse({ ...input, ownerId: user.id });
  await connectToDatabase();

  const competition = await Competition.create({
    title: data.title,
    description: data.description,
    language: data.language,
    theme: data.theme,
    ownerId: data.ownerId,
    status: "DRAFT",
    settings: data.settings,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/competitions");
  return { id: competition._id.toString() };
}

export async function updateCompetitionStatus(
  competitionId: string,
  status: CompetitionStatus
): Promise<void> {
  const user = await requireUser();
  await assertCompetitionOwnership(competitionId, user.id);
  updateCompetitionSchema.parse({ status });

  await connectToDatabase();
  await Competition.findByIdAndUpdate(competitionId, { $set: { status } });

  revalidatePath(`/admin/competitions/${competitionId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/competitions");
}

export async function updateCompetition(
  competitionId: string,
  input: {
    title: string;
    description?: string;
    language: string;
    theme: string;
  }
): Promise<void> {
  const user = await requireUser();
  await assertCompetitionOwnership(competitionId, user.id);
  const data = updateCompetitionSchema.parse(input);

  await connectToDatabase();
  await Competition.findByIdAndUpdate(competitionId, {
    $set: {
      title: data.title,
      description: data.description,
      language: data.language,
      theme: data.theme,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/competitions");
  revalidatePath(`/admin/competitions/${competitionId}`);
}

/**
 * Flip a competition between Simple and Economy mode after creation — the
 * mode was previously locked at creation time. Economy mode turns on coins +
 * the power store; Simple mode means the host hands out cards directly.
 *
 * Called from a room's settings, but the flag lives on the parent competition
 * (so it applies to all its rooms). When switching *to* Economy, teams in the
 * given room that still have 0 coins are granted the starting balance so the
 * store is immediately usable — idempotent, so toggling repeatedly never
 * double-grants.
 */
export async function setRoomEconomyMode(roomId: string, enabled: boolean): Promise<void> {
  const user = await requireUser();
  const room = await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const competition = await Competition.findById(room.competitionId).lean();
  if (!competition) throw new Error("Competition not found.");

  await Competition.findByIdAndUpdate(room.competitionId, {
    $set: {
      "settings.mode": enabled ? "ADVANCED" : "SIMPLE",
      "settings.economy.enabled": enabled,
    },
  });

  if (enabled) {
    const startingCoins = competition.settings?.economy?.startingCoins ?? 0;
    if (startingCoins > 0) {
      const teams = await Team.find({ roomId, coins: { $lte: 0 } }).select("_id").lean();
      if (teams.length > 0) {
        await grantStartingCoins(roomId, teams.map((team) => team._id.toString()), startingCoins);
      }
    }
  } else {
    // Leaving Economy: close any open store so a stale store panel doesn't linger.
    await Room.updateMany(
      { competitionId: room.competitionId },
      { $set: { "liveState.storeStatus": "CLOSED" } }
    );
  }

  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath(`/host/${roomId}`);
  revalidatePath(`/admin/competitions/${room.competitionId.toString()}`);
}

export async function duplicateCompetition(competitionId: string): Promise<{ id: string }> {
  const user = await requireUser();
  const competition = await assertCompetitionOwnership(competitionId, user.id);

  await connectToDatabase();
  const copy = await Competition.create({
    title: `${competition.title} Copy`,
    description: competition.description,
    language: competition.language,
    theme: competition.theme,
    ownerId: user.id,
    status: "DRAFT",
    settings: competition.settings,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/competitions");
  return { id: copy._id.toString() };
}

export async function deleteCompetition(
  competitionId: string,
  confirmation: string
): Promise<void> {
  if (confirmation !== "DELETE") throw new Error("Type DELETE to confirm.");

  const user = await requireUser();
  await assertCompetitionOwnership(competitionId, user.id);
  await connectToDatabase();

  const rooms = await Room.find({ competitionId }).select("_id").lean();
  const roomIds = rooms.map((room) => room._id);
  const teams = await Team.find({ roomId: { $in: roomIds } }).select("_id").lean();
  const teamIds = teams.map((team) => team._id);

  await Promise.all([
    Scene.deleteMany({ roomId: { $in: roomIds } }),
    Participant.deleteMany({ roomId: { $in: roomIds } }),
    TeamPowerCard.deleteMany({ teamId: { $in: teamIds } }),
    PowerCardRequest.deleteMany({ roomId: { $in: roomIds } }),
    CoinTransaction.deleteMany({ roomId: { $in: roomIds } }),
    ScoreTransaction.deleteMany({ roomId: { $in: roomIds } }),
    EventLog.deleteMany({ roomId: { $in: roomIds } }),
    Team.deleteMany({ _id: { $in: teamIds } }),
    Room.deleteMany({ _id: { $in: roomIds } }),
    Competition.findByIdAndDelete(competitionId),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/competitions");
}
