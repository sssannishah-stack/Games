import { z } from "zod";
import { objectId } from "./shared";
import { ROOM_STATUSES } from "@/types/db";

export const createRoomSchema = z.object({
  competitionId: objectId,
  name: z.string().min(1, "Room name is required").max(80),
  // Optional — a code is auto-generated when omitted.
  roomCode: z
    .string()
    .min(4)
    .max(12)
    .regex(/^[A-Za-z0-9-]+$/, "Room code may only contain letters, numbers and dashes")
    .optional(),
  joinMethod: z.enum(["CODE", "QR", "BOTH"]).default("BOTH"),
  permissions: z
    .object({
      viewLeaderboard: z.boolean().default(true),
      viewTeamScore: z.boolean().default(true),
      buyPowers: z.boolean().default(true),
      requestLifelines: z.boolean().default(true),
    })
    .default({
      viewLeaderboard: true,
      viewTeamScore: true,
      buyPowers: true,
      requestLifelines: true,
    }),
});

export const liveStateSchema = z.object({
  timerStartedAt: z.coerce.date().nullable().optional(),
  timerEndsAt: z.coerce.date().nullable().optional(),
  timerPaused: z.boolean().optional(),
  showAnswer: z.boolean().optional(),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1, "Room name is required").max(80).optional(),
  joinMethod: z.enum(["CODE", "QR", "BOTH"]).optional(),
  answerMode: z.enum(["VERBAL", "CAPTAIN_SUBMIT"]).optional(),
  permissions: z
    .object({
      viewLeaderboard: z.boolean().optional(),
      viewTeamScore: z.boolean().optional(),
      buyPowers: z.boolean().optional(),
      requestLifelines: z.boolean().optional(),
    })
    .optional(),
  status: z.enum(ROOM_STATUSES).optional(),
  currentSceneId: objectId.nullable().optional(),
  currentRoundId: objectId.nullable().optional(),
  currentQuestionId: objectId.nullable().optional(),
  liveState: liveStateSchema.optional(),
  onlineDevices: z.number().int().min(0).optional(),
});

export const joinRoomSchema = z.object({
  roomCode: z.string().min(4).max(12),
  teamId: objectId,
  name: z.string().min(1, "Name is required").max(60),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type LiveStateInput = z.infer<typeof liveStateSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
