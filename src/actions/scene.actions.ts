"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Competition, EventLog, Question, Room, Round, Scene, Team } from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoomOwnership } from "@/lib/authz";
import {
  SCENE_TYPES,
  type IScene,
  type QuestionAssignmentMode,
  type SceneType,
} from "@/types/db";
import {
  buildQuestionTeamAssignments,
  type EffectiveQuestionAssignmentMode,
} from "@/lib/questionAssignment";

export interface SceneInput {
  roomId: string;
  type: SceneType;
  title?: string;
  roundId?: string | null;
  questionId?: string | null;
  content?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

function defaultTitle(type: SceneType) {
  return type.replace(/_/g, " ");
}

async function log(roomId: string, type: "EVENT_STARTED" | "SCENE_CHANGED" | "TIMER_STARTED" | "TIMER_STOPPED" | "ANSWER_REVEALED", metadata: Record<string, unknown> = {}) {
  await EventLog.create({ roomId, type, metadata });
}

function refreshRoom(roomId: string) {
  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath(`/host/${roomId}`);
}

export async function applyQuestionTeamAssignments(roomId: string, competitionId: unknown): Promise<void> {
  const [teams, scenes, competition] = await Promise.all([
    Team.find({ roomId }).sort({ createdAt: 1 }).select("_id").lean(),
    Scene.find({ roomId, questionId: { $ne: null } }).sort({ order: 1 }).lean<IScene[]>(),
    Competition.findById(competitionId).select("settings.scoring.questionAssignment").lean(),
  ]);
  if (scenes.length === 0) return;

  const roundIds = [...new Set(scenes.flatMap((scene) => (scene.roundId ? [scene.roundId.toString()] : [])))];
  const rounds = await Round.find({ _id: { $in: roundIds } })
    .select("questionAssignment questions")
    .lean();
  const roundById = new Map(rounds.map((round) => [round._id.toString(), round]));
  const teamIds = teams.map((team) => team._id.toString());
  const fallbackMode = (competition?.settings?.scoring?.questionAssignment ??
    "ANY_TEAM") as EffectiveQuestionAssignmentMode;
  const operations: Parameters<typeof Scene.bulkWrite>[0] = [];

  for (const roundId of roundIds) {
    const round = roundById.get(roundId);
    if (!round) continue;
    const configuredMode = round.questionAssignment as QuestionAssignmentMode;
    const effectiveMode = (configuredMode === "DEFAULT" ? fallbackMode : configuredMode) as EffectiveQuestionAssignmentMode;
    const assignments = buildQuestionTeamAssignments(
      round.questions.map((questionId) => questionId.toString()),
      teamIds,
      effectiveMode
    );
    const assignmentByQuestion = new Map(assignments.map((assignment) => [assignment.questionId, assignment]));

    for (const scene of scenes.filter((item) => item.roundId?.toString() === roundId)) {
      const questionId = scene.questionId?.toString();
      const assignment = questionId ? assignmentByQuestion.get(questionId) : null;
      operations.push(
        assignment
          ? {
              updateOne: {
                filter: { _id: scene._id, roomId },
                update: {
                  $set: {
                    "settings.assignmentMode": effectiveMode,
                    "settings.assignedTeamId": assignment.teamId,
                    "settings.assignmentSource": assignment.source,
                  },
                  $unset: {
                    "settings.turnStolen": "",
                    "settings.stolenFromTeamId": "",
                  },
                },
              },
            }
          : {
              updateOne: {
                filter: { _id: scene._id, roomId },
                update: {
                  $set: { "settings.assignmentMode": effectiveMode },
                  $unset: {
                    "settings.assignedTeamId": "",
                    "settings.assignmentSource": "",
                    "settings.turnStolen": "",
                    "settings.stolenFromTeamId": "",
                  },
                },
              },
            }
      );
    }
  }

  if (operations.length > 0) await Scene.bulkWrite(operations);
}

export async function createScene(input: SceneInput): Promise<{ id: string }> {
  const user = await requireUser();
  await assertRoomOwnership(input.roomId, user.id);
  if (!SCENE_TYPES.includes(input.type)) throw new Error(`Invalid scene type: ${input.type}`);
  await connectToDatabase();

  const order = await Scene.countDocuments({ roomId: input.roomId });
  const scene = await Scene.create({
    roomId: input.roomId,
    type: input.type,
    title: input.title?.trim() || defaultTitle(input.type),
    roundId: input.roundId ?? null,
    questionId: input.questionId ?? null,
    order,
    status: "UPCOMING",
    isActive: false,
    content: input.content ?? {},
    settings: input.settings ?? {},
  });

  refreshRoom(input.roomId);
  return { id: scene._id.toString() };
}

export async function updateScene(sceneId: string, input: SceneInput): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(input.roomId, user.id);
  if (!SCENE_TYPES.includes(input.type)) throw new Error(`Invalid scene type: ${input.type}`);
  await connectToDatabase();

  await Scene.findOneAndUpdate(
    { _id: sceneId, roomId: input.roomId },
    {
      $set: {
        type: input.type,
        title: input.title?.trim() || defaultTitle(input.type),
        roundId: input.roundId ?? null,
        questionId: input.questionId ?? null,
        content: input.content ?? {},
        settings: input.settings ?? {},
      },
    }
  );
  refreshRoom(input.roomId);
}

export async function deleteScene(sceneId: string, roomId: string): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();
  await Scene.findOneAndDelete({ _id: sceneId, roomId });
  refreshRoom(roomId);
}

export async function duplicateScene(sceneId: string, roomId: string): Promise<{ id: string }> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const source = await Scene.findOne({ _id: sceneId, roomId }).lean<IScene>();
  if (!source) throw new Error("Scene not found.");
  const order = await Scene.countDocuments({ roomId });
  const copy = await Scene.create({
    roomId,
    type: source.type,
    title: `${source.title} Copy`,
    roundId: source.roundId ?? null,
    questionId: source.questionId ?? null,
    order,
    status: "UPCOMING",
    isActive: false,
    content: source.content,
    settings: source.settings,
  });
  refreshRoom(roomId);
  return { id: copy._id.toString() };
}

export async function reorderScenes(roomId: string, sceneIds: string[]): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();
  await Scene.bulkWrite(
    sceneIds.map((sceneId, index) => ({
      updateOne: {
        filter: { _id: sceneId, roomId },
        update: { $set: { order: index } },
      },
    }))
  );
  refreshRoom(roomId);
}

export async function moveScene(
  sceneId: string,
  roomId: string,
  direction: "up" | "down"
): Promise<void> {
  const scenes = await (async () => {
    const user = await requireUser();
    await assertRoomOwnership(roomId, user.id);
    await connectToDatabase();
    return Scene.find({ roomId }).sort({ order: 1 }).lean<IScene[]>();
  })();
  const index = scenes.findIndex((scene) => scene._id.toString() === sceneId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= scenes.length) return;
  const ordered = scenes.map((scene) => scene._id.toString());
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  await reorderScenes(roomId, ordered);
}

export async function generateScenes(roomId: string): Promise<{ count: number }> {
  const user = await requireUser();
  const room = await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const selectedRoundIds = room.selectedRounds.map((id) => id.toString());
  if (selectedRoundIds.length === 0) throw new Error("Select rounds before generating scenes.");

  const roundDocs = await Round.find({ _id: { $in: selectedRoundIds } }).lean();
  const roundById = new Map(roundDocs.map((r) => [r._id.toString(), r]));
  const rounds = selectedRoundIds
    .map((id) => roundById.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (rounds.length === 0) throw new Error("Select rounds before generating scenes.");

  const scenes: Array<{
    roomId: string;
    type: SceneType;
    title: string;
    roundId: string | null;
    questionId: string | null;
    order: number;
    status: "UPCOMING";
    isActive: false;
    content: Record<string, unknown>;
    settings: Record<string, unknown>;
  }> = [];
  let order = 0;

  scenes.push({
    roomId,
    type: "WELCOME",
    title: "Welcome",
    roundId: null,
    questionId: null,
    order: order++,
    status: "UPCOMING",
    isActive: false,
    content: { headline: "Welcome" },
    settings: {},
  });

  for (const round of rounds) {
    scenes.push({
      roomId,
      type: "ROUND_INTRO",
      title: `${round.title} Intro`,
      roundId: round._id.toString(),
      questionId: null,
      order: order++,
      status: "UPCOMING",
      isActive: false,
      content: { title: round.title, rules: round.rules },
      settings: {},
    });

    const questionIds = round.questions.map((id) => id.toString());
    const questionDocs = questionIds.length
      ? await Question.find({ _id: { $in: questionIds } }).lean()
      : [];
    const questionById = new Map(questionDocs.map((q) => [q._id.toString(), q]));
    const questions = questionIds
      .map((id) => questionById.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q));
    for (const question of questions) {
      // A question left on "INHERIT" follows whichever round it's placed
      // under (it may be reused across several rounds with different
      // timers); "CUSTOM" always uses the question's own timer.
      const effectiveTimer = question.timerMode === "CUSTOM" ? question.timer : round.defaultTimer;
      scenes.push({
        roomId,
        type: question.type === "DRAWING" ? "DRAWING" : "QUESTION",
        title: question.question || question.media?.name || "Question",
        roundId: round._id.toString(),
        questionId: question._id.toString(),
        order: order++,
        status: "UPCOMING",
        isActive: false,
        content: { question: question.question, media: question.media },
        settings: { timer: effectiveTimer, showTimer: true, showAnswerButton: true },
      });
      scenes.push({
        roomId,
        type: "ANSWER_REVEAL",
        title: `Answer - ${question.question || "Question"}`,
        roundId: round._id.toString(),
        questionId: question._id.toString(),
        order: order++,
        status: "UPCOMING",
        isActive: false,
        content: { answer: question.answer, explanation: question.explanation },
        settings: {},
      });
    }

    scenes.push({
      roomId,
      type: "LEADERBOARD",
      title: `${round.title} Leaderboard`,
      roundId: round._id.toString(),
      questionId: null,
      order: order++,
      status: "UPCOMING",
      isActive: false,
      content: {},
      settings: { mode: "TOP_3", animation: true },
    });
  }

  scenes.push({
    roomId,
    type: "WINNER",
    title: "Winner",
    roundId: null,
    questionId: null,
    order: order++,
    status: "UPCOMING",
    isActive: false,
    content: {},
    settings: {},
  });

  await Scene.deleteMany({ roomId });
  await Scene.insertMany(scenes);
  await applyQuestionTeamAssignments(roomId, room.competitionId);
  if (room.status === "DRAFT") {
    await Room.findByIdAndUpdate(roomId, { $set: { status: "READY" } });
  }
  refreshRoom(roomId);
  return { count: scenes.length };
}

export const generateScenesForRoom = generateScenes;

export async function publishScene(roomId: string, sceneId: string): Promise<IScene | null> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  await Scene.updateMany({ roomId, status: "LIVE" }, { $set: { status: "COMPLETED", isActive: false } });
  const scene = await Scene.findOneAndUpdate(
    { _id: sceneId, roomId },
    { $set: { status: "LIVE", isActive: true } },
    { new: true }
  ).lean<IScene>();
  if (!scene) return null;

  await Room.findByIdAndUpdate(roomId, {
    $set: {
      status: "LIVE",
      currentSceneId: scene._id,
      currentRoundId: scene.roundId ?? null,
      currentQuestionId: scene.questionId ?? null,
      "liveState.showAnswer": false,
      // Every scene starts with a fresh clock. Without this the previous
      // scene's timer state carried over — the countdown looked stuck/expired
      // and, because it still read as "running", the host's auto-start (and a
      // clean manual Start) were suppressed on the new question.
      "liveState.timerStartedAt": null,
      "liveState.timerEndsAt": null,
      "liveState.timerPaused": false,
    },
  });
  await log(roomId, "SCENE_CHANGED", { sceneId, sceneType: scene.type, title: scene.title });
  refreshRoom(roomId);
  return scene;
}

export const setActiveScene = publishScene;

export async function startEvent(roomId: string): Promise<void> {
  const user = await requireUser();
  const room = await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();
  const first = await Scene.findOne({ roomId }).sort({ order: 1 }).lean<IScene>();
  if (!first) throw new Error("Create scenes before starting the event.");
  await applyQuestionTeamAssignments(roomId, room.competitionId);
  if (room.status !== "TESTING") {
    await Room.findByIdAndUpdate(roomId, { $set: { status: "LIVE" } });
  }
  await publishScene(roomId, first._id.toString());
  await log(roomId, "EVENT_STARTED");
}

export async function stepScene(roomId: string, direction: "next" | "previous"): Promise<void> {
  const user = await requireUser();
  const room = await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();
  const current = room.currentSceneId
    ? await Scene.findOne({ _id: room.currentSceneId, roomId }).lean<IScene>()
    : null;
  const query = current
    ? { roomId, order: direction === "next" ? { $gt: current.order } : { $lt: current.order } }
    : { roomId };
  const scene = await Scene.findOne(query).sort({ order: direction === "next" ? 1 : -1 }).lean<IScene>();
  if (scene) await publishScene(roomId, scene._id.toString());
}

export async function startTimer(roomId: string, seconds: number): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();
  const now = new Date();
  await Room.findByIdAndUpdate(roomId, {
    $set: {
      "liveState.timerStartedAt": now,
      "liveState.timerEndsAt": new Date(now.getTime() + seconds * 1000),
      "liveState.timerPaused": false,
    },
  });
  await log(roomId, "TIMER_STARTED", { seconds });
  refreshRoom(roomId);
}

export async function pauseTimer(roomId: string): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();
  await Room.findByIdAndUpdate(roomId, { $set: { "liveState.timerPaused": true } });
  await log(roomId, "TIMER_STOPPED");
  refreshRoom(roomId);
}

export async function resetTimer(roomId: string): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();
  await Room.findByIdAndUpdate(roomId, {
    $set: {
      "liveState.timerStartedAt": null,
      "liveState.timerEndsAt": null,
      "liveState.timerPaused": false,
    },
  });
  await log(roomId, "TIMER_STOPPED", { reset: true });
  refreshRoom(roomId);
}

export async function revealAnswer(roomId: string): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();
  await Room.findByIdAndUpdate(roomId, { $set: { "liveState.showAnswer": true } });
  await log(roomId, "ANSWER_REVEALED");
  refreshRoom(roomId);
}
