"use server";

import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Team, ScoreTransaction, TeamPowerCard, Participant } from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoomOwnership } from "@/lib/authz";
import type { ITeam } from "@/types/db";

export interface CreateTeamArgs {
  roomId: string;
  name: string;
  color?: string;
  members: string[]; // plain names — no login
}

/** Create a competing team + its named roster inside a room. */
export async function createTeam(input: CreateTeamArgs): Promise<{ id: string }> {
  const user = await requireUser();
  await assertRoomOwnership(input.roomId, user.id);

  const name = input.name.trim();
  if (!name) throw new Error("Team name is required.");

  const members = input.members.map((m) => m.trim()).filter(Boolean);

  await connectToDatabase();
  const duplicate = await Team.exists({
    roomId: input.roomId,
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (duplicate) throw new Error("A team with this name already exists.");

  const team = await Team.create({
    roomId: input.roomId,
    name,
    color: input.color,
    members: members.map((m) => ({ name: m })),
    score: 0,
    rank: 0,
    coins: 0,
    stats: { correctAnswers: 0, wrongAnswers: 0, bonusPoints: 0 },
  });

  revalidatePath(`/rooms/${input.roomId}`);
  revalidatePath(`/admin/rooms/${input.roomId}`);
  return { id: team._id.toString() };
}

export async function deleteTeam(teamId: string, roomId: string): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);

  await connectToDatabase();
  await Team.findOneAndDelete({ _id: teamId, roomId });
  await TeamPowerCard.deleteMany({ teamId });
  await Participant.deleteMany({ teamId, roomId });

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/admin/rooms/${roomId}`);
}

export async function updateTeam(input: CreateTeamArgs & { teamId: string }): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(input.roomId, user.id);

  const name = input.name.trim();
  if (!name) throw new Error("Team name is required.");
  const members = input.members.map((m) => m.trim()).filter(Boolean);

  await connectToDatabase();
  const duplicate = await Team.exists({
    _id: { $ne: input.teamId },
    roomId: input.roomId,
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (duplicate) throw new Error("A team with this name already exists.");

  await Team.findOneAndUpdate(
    { _id: input.teamId, roomId: input.roomId },
    {
      $set: {
        name,
        color: input.color,
        members: members.map((member) => ({ name: member })),
      },
    }
  );

  revalidatePath(`/admin/rooms/${input.roomId}`);
  revalidatePath(`/rooms/${input.roomId}`);
}

export async function duplicateTeam(teamId: string, roomId: string): Promise<{ id: string }> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const source = await Team.findOne({ _id: teamId, roomId }).lean<ITeam>();
  if (!source) throw new Error("Team not found.");

  const copy = await Team.create({
    roomId,
    name: `${source.name} Copy`,
    color: source.color,
    members: source.members,
    score: 0,
    rank: 0,
    coins: source.coins,
    stats: { correctAnswers: 0, wrongAnswers: 0, bonusPoints: 0 },
  });

  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath(`/rooms/${roomId}`);
  return { id: copy._id.toString() };
}

export async function addParticipant(input: {
  roomId: string;
  teamId: string;
  name: string;
}): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(input.roomId, user.id);

  const name = input.name.trim();
  if (!name) throw new Error("Participant name is required.");

  await connectToDatabase();
  await Team.findOneAndUpdate(
    { _id: input.teamId, roomId: input.roomId },
    { $push: { members: { name } } }
  );

  revalidatePath(`/admin/rooms/${input.roomId}`);
}

export async function bulkCreateParticipants(input: {
  roomId: string;
  teamId: string;
  names: string[];
}): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(input.roomId, user.id);

  const members = input.names.map((name) => name.trim()).filter(Boolean);
  if (members.length === 0) throw new Error("Add at least one participant name.");

  await connectToDatabase();
  await Team.findOneAndUpdate(
    { _id: input.teamId, roomId: input.roomId },
    { $push: { members: { $each: members.map((name) => ({ name })) } } }
  );

  revalidatePath(`/admin/rooms/${input.roomId}`);
}

export async function removeParticipant(input: {
  roomId: string;
  teamId: string;
  memberIndex: number;
}): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(input.roomId, user.id);
  await connectToDatabase();

  const team = await Team.findOne({ _id: input.teamId, roomId: input.roomId }).lean<ITeam>();
  if (!team) throw new Error("Team not found.");
  const members = [...team.members];
  members.splice(input.memberIndex, 1);

  await Team.findByIdAndUpdate(input.teamId, { $set: { members } });
  revalidatePath(`/admin/rooms/${input.roomId}`);
}

export async function moveParticipant(input: {
  roomId: string;
  fromTeamId: string;
  toTeamId: string;
  memberIndex: number;
}): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(input.roomId, user.id);
  if (input.fromTeamId === input.toTeamId) return;

  await connectToDatabase();
  const [fromTeam, toTeam] = await Promise.all([
    Team.findOne({ _id: input.fromTeamId, roomId: input.roomId }).lean<ITeam>(),
    Team.findOne({ _id: input.toTeamId, roomId: input.roomId }).lean<ITeam>(),
  ]);
  if (!fromTeam || !toTeam) throw new Error("Team not found.");

  const fromMembers = [...fromTeam.members];
  const [member] = fromMembers.splice(input.memberIndex, 1);
  if (!member) throw new Error("Participant not found.");

  await Promise.all([
    Team.findByIdAndUpdate(input.fromTeamId, { $set: { members: fromMembers } }),
    Team.findByIdAndUpdate(input.toTeamId, { $push: { members: member } }),
  ]);

  revalidatePath(`/admin/rooms/${input.roomId}`);
}

export interface LeaderboardEntry {
  teamId: string;
  name: string;
  color?: string;
  score: number;
  rank: number;
}

/**
 * Recompute the leaderboard for a room from the score-transaction ledger
 * (the single source of truth), then persist each team's score + rank.
 */
export async function calculateLeaderboard(roomId: string): Promise<LeaderboardEntry[]> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);

  await connectToDatabase();
  const roomObjectId = new Types.ObjectId(roomId);

  // Sum every transaction per team — undo rows carry negated points, so a
  // plain sum yields the correct current score.
  const totals = await ScoreTransaction.aggregate<{ _id: Types.ObjectId; score: number }>([
    { $match: { roomId: roomObjectId } },
    { $group: { _id: "$teamId", score: { $sum: "$points" } } },
  ]);

  const scoreByTeam = new Map(totals.map((t) => [t._id.toString(), t.score]));

  const teams = await Team.find({ roomId: roomObjectId }).lean<ITeam[]>();

  const ranked: LeaderboardEntry[] = teams
    .map((team) => ({
      teamId: team._id.toString(),
      name: team.name,
      color: team.color,
      score: scoreByTeam.get(team._id.toString()) ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  if (ranked.length > 0) {
    await Team.bulkWrite(
      ranked.map((entry) => ({
        updateOne: {
          filter: { _id: entry.teamId },
          update: { $set: { score: entry.score, rank: entry.rank } },
        },
      }))
    );
  }

  return ranked;
}
