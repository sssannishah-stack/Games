import "server-only";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Room, Team, Round, Scene, Competition } from "@/models";
import { serialize } from "@/lib/serialize";
import type { RoomSettings, RoomStatus, StoreStatus } from "@/types/db";

function normalizeRoomStatus(status: string): RoomStatus {
  if (status === "WAITING") return "DRAFT";
  if (status === "PAUSED") return "TESTING";
  if (status === "FINISHED") return "COMPLETED";
  return status as RoomStatus;
}

export interface RoomSummary {
  id: string;
  competitionId: string;
  name: string;
  roomCode: string;
  status: RoomStatus;
  settings: RoomSettings;
  createdAt: string;
  teamCount: number;
  participantCount: number;
  roundCount: number;
  questionCount: number;
  sceneCount: number;
}

export interface RoomDetail extends RoomSummary {
  competitionTitle: string;
  onlineDevices: number;
  storeStatus: StoreStatus;
  economyEnabled: boolean;
  startingCoins: number;
  storeAvailability: string;
  /** Ordered library Round ids selected to run in this room. */
  selectedRounds: string[];
  /** Power card ids the host has force-enabled for this room's live event. */
  powerCardOverrides: string[];
  /** Power card ids the host has force-disabled for this room's live event. */
  powerCardExclusions: string[];
  /** Inventory restored when the host resets this room. */
  powerCardDefaults: Array<{ powerCardId: string; uses: number }>;
  currentSceneId: string | null;
  currentRoundId: string | null;
  currentQuestionId: string | null;
  liveState: {
    timerStartedAt: string | null;
    timerEndsAt: string | null;
    timerPaused: boolean;
    showAnswer: boolean;
    flashSaleActive: boolean;
    flashSaleEndsAt: string | null;
  };
}

/** All rooms belonging to a competition, with quick setup-progress counts. */
export async function getRoomsByCompetition(competitionId: string): Promise<RoomSummary[]> {
  await connectToDatabase();

  const rooms = await Room.find({ competitionId }).sort({ createdAt: 1 }).lean();
  if (rooms.length === 0) return [];

  const roomIds = rooms.map((r) => r._id);
  const [teamCounts, memberCounts, sceneCounts] = await Promise.all([
    Team.aggregate<{ _id: string; count: number }>([
      { $match: { roomId: { $in: roomIds } } },
      { $group: { _id: "$roomId", count: { $sum: 1 } } },
    ]),
    Team.aggregate<{ _id: string; count: number }>([
      { $match: { roomId: { $in: roomIds } } },
      { $project: { roomId: 1, count: { $size: "$members" } } },
      { $group: { _id: "$roomId", count: { $sum: "$count" } } },
    ]),
    Scene.aggregate<{ _id: string; count: number }>([
      { $match: { roomId: { $in: roomIds } } },
      { $group: { _id: "$roomId", count: { $sum: 1 } } },
    ]),
  ]);
  const teamMap = new Map(teamCounts.map((t) => [t._id.toString(), t.count]));
  const participantMap = new Map(memberCounts.map((p) => [p._id.toString(), p.count]));
  const sceneMap = new Map(sceneCounts.map((s) => [s._id.toString(), s.count]));

  const selectedRoundIdsByRoom = new Map(
    rooms.map((room) => [room._id.toString(), (room.selectedRounds ?? []).map((id) => id.toString())])
  );
  const allSelectedRoundIds = [...new Set([...selectedRoundIdsByRoom.values()].flat())];
  const rounds = allSelectedRoundIds.length
    ? await Round.find({ _id: { $in: allSelectedRoundIds } }).select("questions").lean()
    : [];
  const questionCountByRound = new Map(rounds.map((r) => [r._id.toString(), (r.questions ?? []).length]));

  return rooms.map((room) =>
    {
      const selectedRoundIds = selectedRoundIdsByRoom.get(room._id.toString()) ?? [];
      return serialize<RoomSummary>({
      id: room._id.toString(),
      competitionId: room.competitionId.toString(),
      name: room.name,
      roomCode: room.roomCode,
      status: normalizeRoomStatus(room.status),
      settings: room.settings ?? {
        joinMethod: "BOTH",
        permissions: {
          viewLeaderboard: true,
          viewTeamScore: true,
          buyPowers: true,
          requestLifelines: true,
        },
      },
      createdAt: room.createdAt,
      teamCount: teamMap.get(room._id.toString()) ?? 0,
      participantCount: participantMap.get(room._id.toString()) ?? 0,
      roundCount: selectedRoundIds.length,
      questionCount: selectedRoundIds.reduce(
        (sum, id) => sum + (questionCountByRound.get(id.toString()) ?? 0),
        0
      ),
      sceneCount: sceneMap.get(room._id.toString()) ?? 0,
      });
    }
  );
}

/** A single room, verified to belong to a competition owned by ownerId. */
export async function getRoomById(
  roomId: string,
  ownerId: string
): Promise<RoomDetail | null> {
  await connectToDatabase();

  const room = await Room.findById(roomId).lean();
  if (!room) return null;

  const selectedRoundIds = (room.selectedRounds ?? []).map((id) => id.toString());

  // The ownership check and the counts are independent of each other — only
  // the ownership *result* gates the return, so run them all together
  // instead of waiting on ownership before counting.
  const [competition, teams, rounds, sceneCount] = await Promise.all([
    Competition.findOne({ _id: room.competitionId, ownerId }).lean(),
    Team.find({ roomId: room._id }).select("_id members").lean(),
    selectedRoundIds.length
      ? Round.find({ _id: { $in: selectedRoundIds } }).select("questions").lean()
      : Promise.resolve([]),
    Scene.countDocuments({ roomId: room._id }),
  ]);
  if (!competition) return null;
  const participantCount = teams.reduce((sum, team) => sum + (team.members?.length ?? 0), 0);
  const questionCount = rounds.reduce((sum, round) => sum + (round.questions ?? []).length, 0);

  return serialize<RoomDetail>({
    id: room._id.toString(),
    competitionId: room.competitionId.toString(),
    competitionTitle: competition.title,
    name: room.name,
    roomCode: room.roomCode,
    status: normalizeRoomStatus(room.status),
    settings: room.settings ?? {
      joinMethod: "BOTH",
      permissions: {
        viewLeaderboard: true,
        viewTeamScore: true,
        buyPowers: true,
        requestLifelines: true,
      },
    },
    createdAt: room.createdAt,
    onlineDevices: room.onlineDevices,
    storeStatus: room.liveState?.storeStatus ?? "CLOSED",
    startingCoins: competition.settings?.economy?.startingCoins ?? 0,
    storeAvailability: competition.settings?.economy?.storeAvailability ?? "HOST_MANUAL",
    selectedRounds: selectedRoundIds,
    powerCardOverrides: room.powerCardOverrides ?? [],
    powerCardExclusions: room.powerCardExclusions ?? [],
    powerCardDefaults: room.powerCardDefaults ?? [],
    currentSceneId: room.currentSceneId ? room.currentSceneId.toString() : null,
    currentRoundId: room.currentRoundId ? room.currentRoundId.toString() : null,
    currentQuestionId: room.currentQuestionId ? room.currentQuestionId.toString() : null,
    liveState: {
      timerStartedAt: room.liveState?.timerStartedAt ? room.liveState.timerStartedAt.toISOString() : null,
      timerEndsAt: room.liveState?.timerEndsAt ? room.liveState.timerEndsAt.toISOString() : null,
      timerPaused: room.liveState?.timerPaused ?? false,
      showAnswer: room.liveState?.showAnswer ?? false,
      flashSaleActive: room.liveState?.flashSaleActive ?? false,
      flashSaleEndsAt: room.liveState?.flashSaleEndsAt ? room.liveState.flashSaleEndsAt.toISOString() : null,
    },
    economyEnabled: competition.settings?.economy?.enabled ?? false,
    teamCount: teams.length,
    participantCount,
    roundCount: selectedRoundIds.length,
    questionCount,
    sceneCount,
  });
}

export interface PublicRoomInfo {
  id: string;
  name: string;
  status: RoomStatus;
  roomCode: string;
}

/** Public lookup by room code — used by the participant join page (no auth). */
export async function getRoomByCode(roomCode: string): Promise<PublicRoomInfo | null> {
  await connectToDatabase();
  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() }).lean();
  if (!room) return null;
  return serialize<PublicRoomInfo>({
    id: room._id.toString(),
    name: room.name,
    status: normalizeRoomStatus(room.status),
    roomCode: room.roomCode,
  });
}
