import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/database/mongodb";
import {
  Competition,
  EventLog,
  PowerCard,
  PowerCardRequest,
  Question,
  Room,
  Round,
  Scene,
  ScoreTransaction,
  Team,
  TeamPowerCard,
} from "@/models";
import { serialize } from "@/lib/serialize";
import type {
  ICompetition,
  IEventLog,
  IPowerCard,
  IPowerCardRequest,
  IQuestion,
  IRoom,
  IRound,
  IScene,
  IScoreTransaction,
  ITeam,
  ITeamPowerCard,
} from "@/types/db";

export const dynamic = "force-dynamic";

function id(value: unknown) {
  return value && typeof value === "object" && "toString" in value ? value.toString() : String(value ?? "");
}

function sceneTitle(scene: IScene | null) {
  if (!scene) return "Waiting for host";
  return scene.title || scene.type.replace(/_/g, " ");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await context.params;
  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId");

  await connectToDatabase();

  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() }).lean<IRoom>();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const [competition, teams, scenes, latestBroadcast, recentScores] = await Promise.all([
    Competition.findById(room.competitionId).lean<ICompetition>(),
    Team.find({ roomId: room._id }).sort({ score: -1, createdAt: 1 }).lean<ITeam[]>(),
    Scene.find({ roomId: room._id }).sort({ order: 1 }).lean<IScene[]>(),
    EventLog.findOne({ roomId: room._id, type: "BROADCAST_SENT" })
      .sort({ createdAt: -1 })
      .lean<IEventLog>(),
    ScoreTransaction.find({ roomId: room._id }).sort({ createdAt: -1 }).limit(12).lean<IScoreTransaction[]>(),
  ]);

  const currentScene =
    (room.currentSceneId && scenes.find((scene) => id(scene._id) === id(room.currentSceneId))) ||
    scenes.find((scene) => scene.isActive) ||
    scenes[0] ||
    null;

  const [question, round] = await Promise.all([
    currentScene?.questionId ? Question.findById(currentScene.questionId).lean<IQuestion>() : null,
    currentScene?.roundId ? Round.findById(currentScene.roundId).lean<IRound>() : null,
  ]);

  const selectedTeam = teamId ? teams.find((team) => id(team._id) === teamId) ?? null : null;
  const [catalog, inventory, requests] = await Promise.all([
    competition
      ? PowerCard.find({ ownerId: competition.ownerId, enabled: true }).sort({ price: 1 }).lean<IPowerCard[]>()
      : Promise.resolve([]),
    selectedTeam ? TeamPowerCard.find({ teamId: selectedTeam._id }).lean<ITeamPowerCard[]>() : [],
    selectedTeam
      ? PowerCardRequest.find({ roomId: room._id, teamId: selectedTeam._id })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean<IPowerCardRequest[]>()
      : [],
  ]);

  // A round with powerCardMode "CUSTOM" restricts play to its allow-list —
  // plus whatever the host has force-enabled for this room's live event
  // (Room.powerCardOverrides). Participants must never see a card that
  // isn't actually usable right now (mirrors the same check the server
  // enforces in requestPowerCard/purchasePowerCard).
  const roundIsRestricted = round?.powerCardMode === "CUSTOM";
  const allowedCardIds = new Set([...(round?.allowedPowerCards ?? []), ...(room.powerCardOverrides ?? [])]);
  const visibleCards = roundIsRestricted ? catalog.filter((card) => allowedCardIds.has(id(card._id))) : catalog;

  const requestByCard = new Map(requests.map((item) => [id(item.powerCardId), item]));
  const inventoryByCard = new Map(inventory.map((item) => [id(item.powerCardId), item]));
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return NextResponse.json(
    serialize({
      serverNow: new Date().toISOString(),
      room: {
        id: id(room._id),
        name: room.name,
        roomCode: room.roomCode,
        status: room.status,
        storeStatus: room.liveState.storeStatus,
        permissions: room.settings?.permissions,
      },
      competition: {
        id: id(room.competitionId),
        title: competition?.title ?? room.name,
      },
      currentScene: currentScene
        ? {
            id: id(currentScene._id),
            type: currentScene.type,
            title: sceneTitle(currentScene),
            content: currentScene.content ?? {},
            settings: currentScene.settings ?? {},
            order: currentScene.order,
          }
        : {
            id: null,
            type: "WAITING",
            title: "Waiting for host",
            content: {},
            settings: {},
            order: 0,
          },
      timer: {
        startedAt: room.liveState.timerStartedAt,
        endsAt: room.liveState.timerEndsAt,
        paused: room.liveState.timerPaused,
        showAnswer: room.liveState.showAnswer,
      },
      round: round
        ? {
            id: id(round._id),
            title: round.title,
            rules: round.rules,
            description: round.description,
            defaultTimer: round.defaultTimer,
            positiveMarks: round.positiveMarks,
            negativeMarks: round.negativeMarks,
            allowedPowerCards: roundIsRestricted
              ? visibleCards.map((card) => ({ id: id(card._id), name: card.name, icon: card.icon }))
              : null,
          }
        : null,
      question: question
        ? {
            id: id(question._id),
            type: question.type,
            question: question.question,
            media: question.media ?? null,
            timer: question.timer,
            positiveMarks: question.positiveMarks,
            negativeMarks: question.negativeMarks,
            answer: room.liveState.showAnswer ? question.answer : null,
            hints: question.hints ?? [],
          }
        : null,
      team: selectedTeam
        ? {
            id: id(selectedTeam._id),
            name: selectedTeam.name,
            color: selectedTeam.color,
            score: selectedTeam.score,
            coins: selectedTeam.coins,
            members: selectedTeam.members ?? [],
            rank: sortedTeams.findIndex((team) => id(team._id) === id(selectedTeam._id)) + 1,
          }
        : null,
      leaderboard: sortedTeams.map((team, index) => ({
        id: id(team._id),
        name: team.name,
        color: team.color,
        score: team.score,
        coins: team.coins,
        rank: index + 1,
      })),
      powers: {
        storeOpen: room.liveState.storeStatus === "OPEN",
        economyEnabled: competition?.settings?.economy?.enabled ?? false,
        cards: visibleCards.map((card) => {
          const owned = inventoryByCard.get(id(card._id));
          const request = requestByCard.get(id(card._id));
          return {
            id: id(card._id),
            name: card.name,
            description: card.description,
            icon: card.icon,
            price: card.price,
            stock: card.stock,
            requiresApproval: card.requiresApproval,
            remainingUses: owned?.remainingUses ?? 0,
            requestable: true,
            status: request?.status ?? owned?.status ?? "AVAILABLE",
            requestId: request ? id(request._id) : null,
          };
        }),
      },
      broadcast: latestBroadcast
        ? {
            id: id(latestBroadcast._id),
            message: String(latestBroadcast.metadata?.message ?? ""),
            createdAt: latestBroadcast.createdAt,
          }
        : null,
      recentScores: recentScores.map((score) => ({
        id: id(score._id),
        teamId: id(score.teamId),
        points: score.points,
        reason: score.reason,
        isUndo: score.isUndo,
        isReverted: score.isReverted ?? false,
        createdAt: score.createdAt,
      })),
    })
  );
}
