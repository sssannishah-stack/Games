import { z } from "zod";
import { objectId } from "./shared";
import { COMPETITION_STATUSES, STORE_AVAILABILITY_MODES } from "@/types/db";
import { createPowerCardSchema } from "./powerCard.validator";

// A starter power card authored in the create-competition wizard. The
// catalog is global per host, so this is just the base card shape.
export const powerCardDraftSchema = createPowerCardSchema;

const teamDraftSchema = z.object({
  name: z.string().min(1),
  members: z.array(z.string().min(1)).default([]),
});

const roundDraftSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(2000).optional(),
  rules: z.string().max(2000).optional(),
  defaultTimer: z.number().int().min(0).max(600),
  defaultMarks: z.number().int(),
  addQuestionsLater: z.boolean(),
});

export const competitionSettingsSchema = z.object({
  mode: z.enum(["SIMPLE", "ADVANCED"]).default("SIMPLE"),
  room: z.object({
    name: z.string().min(1).default("Main Room"),
    code: z.string().optional(),
    joinMethod: z.enum(["QR", "CODE", "BOTH"]).default("BOTH"),
    participantJoining: z.enum(["ANYONE", "CREATED_MEMBERS"]).default("ANYONE"),
  }),
  permissions: z.object({
    viewLeaderboard: z.boolean().default(true),
    viewTeamScore: z.boolean().default(true),
    viewPowerCards: z.boolean().default(true),
  }),
  scoring: z.object({
    defaultCorrect: z.number().int().default(10),
    defaultWrong: z.number().int().default(-5),
    defaultTimer: z.number().int().min(0).max(600).default(30),
    defaultCoinReward: z.number().int().min(0).default(100),
    defaultPowerCardApprovalRequired: z.boolean().default(true),
    allowNegative: z.boolean().default(true),
    allowBonus: z.boolean().default(true),
    manualScoring: z.boolean().default(true),
    questionAssignment: z
      .enum(["ANY_TEAM", "FIXED_ORDER", "HOST_CHOOSES", "RANDOM_TEAM"])
      .default("ANY_TEAM"),
  }),
  turnRules: z.object({
    enableTeamTurns: z.boolean().default(false),
    allowStealing: z.boolean().default(false),
    allowChallenges: z.boolean().default(false),
  }),
  // The Simple/Economy Mode switch — see CompetitionSettings["economy"] in types/db.ts.
  economy: z.object({
    enabled: z.boolean().default(false),
    startingCoins: z.number().int().min(0).default(5000),
    correctAnswerCoins: z.number().int().min(0).default(100),
    fastAnswerBonusCoins: z.number().int().min(0).default(25),
    roundWinnerCoins: z.number().int().min(0).default(250),
    storeAvailability: z.enum(STORE_AVAILABILITY_MODES).default("BETWEEN_ROUNDS"),
  }),
  setupDraft: z.object({
    teams: z.array(teamDraftSchema).default([]),
    rounds: z.array(roundDraftSchema).default([]),
  }),
});

export const createCompetitionSchema = z.object({
  title: z.string().min(1, "Title is required").max(120),
  description: z.string().max(2000).optional(),
  language: z.string().min(1).default("en"),
  theme: z.string().default("#6C7BFA"),
  ownerId: objectId,
  settings: competitionSettingsSchema,
  // Starter cards for this competition's store/catalog, authored during setup.
  powerCards: z.array(powerCardDraftSchema).default([]),
});

export const updateCompetitionSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  language: z.string().min(1).optional(),
  theme: z.string().optional(),
  status: z.enum(COMPETITION_STATUSES).optional(),
  settings: competitionSettingsSchema.partial().optional(),
});

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;
export type UpdateCompetitionInput = z.infer<typeof updateCompetitionSchema>;
