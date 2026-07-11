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
  TeamAchievement,
  Auction,
  AuctionBid,
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
import type { AnswerMode, IRoom, ParticipantRole } from "@/types/db";
import { assertTeamController } from "@/lib/teamRoles";
import {
  ensureRoomDefaultPowerCardsForTeams,
  resetRoomPowerCardsToDefaults,
} from "@/lib/starterPowerCards";

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
    answerMode?: AnswerMode;
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
      ...(data.answerMode ? { "settings.answerMode": data.answerMode } : {}),
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
        powerCardDefaults: room.powerCardDefaults ?? [],
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

  await ensureRoomDefaultPowerCardsForTeams(
    teams.map((team) => team._id.toString()),
    roomId,
    user.id
  );

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
 * Clears one live run while preserving room setup: selected rounds,
 * questions, and generated scenes. With `removeTeams`, also deletes every
 * team and their rosters entirely — for handing the room to a brand new
 * group rather than replaying the same teams from zero.
 */
export async function resetRoom(
  roomId: string,
  confirmation: string,
  removeTeams = false
): Promise<void> {
  if (confirmation !== "RESET") throw new Error("Type RESET to confirm.");

  const user = await requireUser();
  const room = await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const [teams, sceneCount] = await Promise.all([
    Team.find({ roomId }).select("_id").lean(),
    Scene.countDocuments({ roomId }),
  ]);
  const teamIds = teams.map((team) => team._id.toString());

  await Promise.all([
    ScoreTransaction.deleteMany({ roomId }),
    CoinTransaction.deleteMany({ roomId }),
    PowerCardRequest.deleteMany({ roomId }),
    EventLog.deleteMany({ roomId }),
    TeamAchievement.deleteMany({ roomId }),
    AuctionBid.deleteMany({ roomId }),
    Auction.deleteMany({ roomId }),
    removeTeams
      ? Promise.all([
          TeamPowerCard.deleteMany({ teamId: { $in: teamIds } }),
          Participant.deleteMany({ roomId }),
          Team.deleteMany({ roomId }),
        ])
      : Team.updateMany(
          { roomId },
          {
            $set: {
              score: 0,
              rank: 0,
              previousRank: 0,
              coins: 0,
              stats: {
                correctAnswers: 0,
                wrongAnswers: 0,
                bonusPoints: 0,
                streak: 0,
                bestStreak: 0,
              },
            },
          }
        ),
    Scene.updateMany(
      { roomId },
      { $set: { status: "UPCOMING", isActive: false } }
    ),
    Room.findByIdAndUpdate(roomId, {
      $set: {
        status: sceneCount > 0 ? "READY" : "DRAFT",
        currentSceneId: null,
        currentRoundId: null,
        currentQuestionId: null,
        powerCardOverrides: [],
        powerCardExclusions: [],
        onlineDevices: 0,
        "liveState.timerStartedAt": null,
        "liveState.timerEndsAt": null,
        "liveState.timerPaused": false,
        "liveState.showAnswer": false,
        "liveState.storeStatus": "CLOSED",
        "liveState.flashSaleActive": false,
        "liveState.flashSalePercent": 0,
        "liveState.flashSaleEndsAt": null,
      },
    }),
  ]);

  // A fresh group creates their own teams and gets starter cards as they
  // join — nothing to restore to defaults yet.
  if (!removeTeams) {
    await resetRoomPowerCardsToDefaults(teamIds, roomId, user.id);
  }

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
  role: ParticipantRole;
}> {
  const data = joinRoomSchema.parse(input);
  await connectToDatabase();

  const room = await Room.findOne({ roomCode: data.roomCode.toUpperCase() }).lean<IRoom>();
  if (!room) throw new Error("Room not found for that code.");

  // Rejoin: the same name on the same team is the same phone coming back
  // (page refresh, dropped connection). Reuse the participant so their team
  // device role survives the reconnect instead of stacking duplicate rows.
  const existing = await Participant.findOne({
    roomId: room._id,
    teamId: data.teamId,
    name: { $regex: `^${data.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (existing) {
    existing.lastSeenAt = new Date();
    await existing.save();
    return {
      id: existing._id.toString(),
      name: existing.name,
      teamId: existing.teamId.toString(),
      roomId: existing.roomId.toString(),
      role: existing.role,
    };
  }

  // First phone of a team becomes CAPTAIN, second VICE_CAPTAIN, rest MEMBER.
  const teammates = await Participant.find({ teamId: data.teamId }).select("role").lean();
  const hasCaptain = teammates.some((p) => p.role === "CAPTAIN");
  const hasViceCaptain = teammates.some((p) => p.role === "VICE_CAPTAIN");
  const role: ParticipantRole = !hasCaptain ? "CAPTAIN" : !hasViceCaptain ? "VICE_CAPTAIN" : "MEMBER";

  const participant = await Participant.create({
    name: data.name,
    teamId: data.teamId,
    roomId: room._id,
    role,
    lastSeenAt: new Date(),
    joinedAt: new Date(),
  });

  return {
    id: participant._id.toString(),
    name: participant.name,
    teamId: participant.teamId.toString(),
    roomId: participant.roomId.toString(),
    role: participant.role,
  };
}

/**
 * Captain-submit answer mode: the team captain's phone submits a written
 * answer for the current question. This is a written record for the host —
 * the host still judges and awards marks manually (nothing is auto-graded).
 * Rejected unless the room's answerMode is CAPTAIN_SUBMIT and the submitting
 * device is the team's captain (or acting captain).
 */
export async function submitTeamAnswer(input: {
  roomId: string;
  teamId: string;
  participantId: string;
  text: string;
}): Promise<void> {
  await connectToDatabase();

  const text = input.text.trim().slice(0, 300);
  if (!text) throw new Error("Type an answer first.");

  const room = await Room.findById(input.roomId).lean<IRoom>();
  if (!room) throw new Error("Room not found.");
  if (room.settings?.answerMode !== "CAPTAIN_SUBMIT") {
    throw new Error("This room uses verbal answers — speak up!");
  }
  if (!room.currentQuestionId) throw new Error("No question is open right now.");

  const submitter = await assertTeamController(input.teamId, input.participantId);

  await EventLog.create({
    roomId: input.roomId,
    type: "ANSWER_SUBMITTED",
    metadata: {
      teamId: input.teamId,
      participantId: input.participantId,
      questionId: room.currentQuestionId.toString(),
      text,
      submittedBy: submitter.name,
    },
  });
}
