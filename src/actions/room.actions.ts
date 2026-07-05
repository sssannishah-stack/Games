"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import {
  Room,
  Scene,
  Team,
  Participant,
  Competition,
  Round,
  TeamPowerCard,
  PowerCardRequest,
  CoinTransaction,
  ScoreTransaction,
  EventLog,
} from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertCompetitionOwnership, assertRoomOwnership } from "@/lib/authz";
import { generateRoomCode } from "@/lib/roomCode";
import { grantStartingCoins } from "@/actions/coin.actions";
import {
  createRoomSchema,
  updateRoomSchema,
  liveStateSchema,
  joinRoomSchema,
  type LiveStateInput,
  type JoinRoomInput,
} from "@/validators/room.validator";
import type { IRoom } from "@/types/db";

export interface CreateRoomArgs {
  competitionId: string;
  name: string;
  joinMethod?: "CODE" | "QR" | "BOTH";
  permissions?: {
    viewLeaderboard: boolean;
    viewTeamScore: boolean;
    buyPowers: boolean;
    requestLifelines: boolean;
  };
}

/**
 * Create a room inside a competition owned by the current host, generating a
 * unique room code. Retries a few times on the rare event of a collision.
 */
export async function createRoom(input: CreateRoomArgs): Promise<{ id: string }> {
  const user = await requireUser();
  await assertCompetitionOwnership(input.competitionId, user.id);
  const data = createRoomSchema.parse(input);
  await connectToDatabase();

  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = generateRoomCode();
    try {
      const room = await Room.create({
        competitionId: data.competitionId,
        name: data.name,
        roomCode,
        status: "DRAFT",
        settings: {
          joinMethod: data.joinMethod,
          permissions: data.permissions,
        },
        selectedRounds: [],
        liveState: {
          timerStartedAt: null,
          timerEndsAt: null,
          timerPaused: false,
          showAnswer: false,
        },
        onlineDevices: 0,
      });
      revalidatePath(`/admin/competitions/${input.competitionId}`);
      return { id: room._id.toString() };
    } catch (error) {
      const isDup =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: number }).code === 11000;
      if (!isDup) throw error;
    }
  }

  throw new Error("Could not allocate a unique room code, please try again.");
}

export async function updateRoom(
  roomId: string,
  input: {
    name: string;
    joinMethod: "CODE" | "QR" | "BOTH";
    permissions: {
      viewLeaderboard: boolean;
      viewTeamScore: boolean;
      buyPowers: boolean;
      requestLifelines: boolean;
    };
  }
): Promise<void> {
  const user = await requireUser();
  const room = await assertRoomOwnership(roomId, user.id);
  const data = updateRoomSchema.parse(input);
  await connectToDatabase();

  await Room.findByIdAndUpdate(roomId, {
    $set: {
      name: data.name,
      "settings.joinMethod": data.joinMethod,
      "settings.permissions": data.permissions,
    },
  });

  revalidatePath(`/admin/competitions/${room.competitionId.toString()}`);
  revalidatePath(`/admin/rooms/${roomId}`);
}

export async function duplicateRoom(roomId: string): Promise<{ id: string }> {
  const user = await requireUser();
  const room = await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = generateRoomCode();
    try {
      const copy = await Room.create({
        competitionId: room.competitionId,
        name: `${room.name} Copy`,
        roomCode,
        status: "DRAFT",
        settings: room.settings,
        selectedRounds: room.selectedRounds,
        liveState: {
          timerStartedAt: null,
          timerEndsAt: null,
          timerPaused: false,
          showAnswer: false,
          storeStatus: "CLOSED",
        },
        onlineDevices: 0,
      });
      revalidatePath(`/admin/competitions/${room.competitionId.toString()}`);
      return { id: copy._id.toString() };
    } catch (error) {
      const isDup =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: number }).code === 11000;
      if (!isDup) throw error;
    }
  }

  throw new Error("Could not allocate a unique room code, please try again.");
}

export async function deleteRoom(roomId: string, confirmation: string): Promise<void> {
  if (confirmation !== "DELETE") throw new Error("Type DELETE to confirm.");

  const user = await requireUser();
  const room = await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const teams = await Team.find({ roomId }).select("_id").lean();
  const teamIds = teams.map((team) => team._id);

  // Rounds/Questions are shared library resources — deleting a room only
  // drops its selection of them (via deleting the Room doc itself), it never
  // deletes the library items.
  await Promise.all([
    Scene.deleteMany({ roomId }),
    Participant.deleteMany({ roomId }),
    TeamPowerCard.deleteMany({ teamId: { $in: teamIds } }),
    PowerCardRequest.deleteMany({ roomId }),
    CoinTransaction.deleteMany({ roomId }),
    ScoreTransaction.deleteMany({ roomId }),
    EventLog.deleteMany({ roomId }),
    Team.deleteMany({ _id: { $in: teamIds } }),
    Room.findByIdAndDelete(roomId),
  ]);

  revalidatePath(`/admin/competitions/${room.competitionId.toString()}`);
}

/**
 * Sets the room's ordered round selection wholesale — the caller always
 * sends the full array (same convention as `reorderScenes`). Verifies every
 * round belongs to the same host before accepting the selection.
 */
export async function setRoomSelectedRounds(roomId: string, roundIds: string[]): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  if (roundIds.length > 0) {
    const owned = await Round.find({ _id: { $in: roundIds }, ownerId: user.id }).select("_id").lean();
    if (owned.length !== roundIds.length) {
      throw new Error("One or more selected rounds could not be found.");
    }
  }

  await Room.findByIdAndUpdate(roomId, { $set: { selectedRounds: roundIds } });
  revalidatePath(`/admin/rooms/${roomId}`);
}

/**
 * Patch the room's live state (timer + reveal flags). Merges with the
 * existing state so callers can update a single field.
 */
export async function updateLiveState(
  roomId: string,
  input: LiveStateInput
): Promise<IRoom | null> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  const data = liveStateSchema.parse(input);
  await connectToDatabase();

  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) set[`liveState.${key}`] = value;
  }

  const room = await Room.findByIdAndUpdate(roomId, { $set: set }, { new: true }).lean<IRoom>();
  return room;
}

/**
 * Host flips the room (and its competition) live. Requires at least one
 * team and one generated scene so there is something to run.
 */
export async function startRoomEvent(roomId: string): Promise<void> {
  const user = await requireUser();
  const room = await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const [teams, sceneCount, competition] = await Promise.all([
    Team.find({ roomId }).select("_id").lean(),
    Scene.countDocuments({ roomId }),
    Competition.findById(room.competitionId).lean(),
  ]);
  if (teams.length === 0) throw new Error("Add at least one team before starting the event.");
  if (sceneCount === 0) throw new Error("Generate the scene flow before starting the event.");

  // Economy Mode: fund every team's wallet and open the store up front if
  // the host configured it to always be open. Guarded so restarting an
  // already-live room never grants a second starting bonus.
  const economy = competition?.settings?.economy;
  if (economy?.enabled && room.status !== "LIVE") {
    await grantStartingCoins(
      roomId,
      teams.map((t) => t._id.toString()),
      economy.startingCoins
    );
  }

  await Room.findByIdAndUpdate(roomId, {
    $set: {
      status: "LIVE",
      "liveState.storeStatus": economy?.enabled && economy.storeAvailability === "ALWAYS" ? "OPEN" : "CLOSED",
    },
  });
  await Competition.findByIdAndUpdate(room.competitionId, { $set: { status: "LIVE" } });

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/admin/competitions/${room.competitionId.toString()}`);
}

/**
 * Host test-runs the room flow without funding wallets or writing real score
 * transactions. The host console still works for scenes/timers/broadcasts.
 */
export async function startRoomTestMode(roomId: string): Promise<void> {
  const user = await requireUser();
  const room = await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const [teams, sceneCount] = await Promise.all([
    Team.find({ roomId }).select("_id").lean(),
    Scene.countDocuments({ roomId }),
  ]);
  if (teams.length === 0) throw new Error("Add at least one team before testing the event.");
  if (sceneCount === 0) throw new Error("Generate the scene flow before testing the event.");

  await Room.findByIdAndUpdate(roomId, {
    $set: {
      status: "TESTING",
      "liveState.storeStatus": "CLOSED",
      "liveState.timerStartedAt": null,
      "liveState.timerEndsAt": null,
      "liveState.timerPaused": false,
      "liveState.showAnswer": false,
    },
  });

  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath(`/host/${roomId}`);
  revalidatePath(`/admin/competitions/${room.competitionId.toString()}`);
}

/**
 * Participant joins a room by code + team. No login — just a display name.
 */
export async function joinRoom(input: JoinRoomInput): Promise<{
  id: string;
  name: string;
  teamId: string;
  roomId: string;
}> {
  const data = joinRoomSchema.parse(input);
  await connectToDatabase();

  const room = await Room.findOne({ roomCode: data.roomCode.toUpperCase() }).lean<IRoom>();
  if (!room) throw new Error("Room not found for that code.");

  const participant = await Participant.create({
    name: data.name,
    teamId: data.teamId,
    roomId: room._id,
    joinedAt: new Date(),
  });

  return {
    id: participant._id.toString(),
    name: participant.name,
    teamId: participant.teamId.toString(),
    roomId: participant.roomId.toString(),
  };
}
