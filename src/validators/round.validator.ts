import { z } from "zod";
import { objectId } from "./shared";
import {
  ROUND_TYPES,
  RULE_OVERRIDE_MODES,
  QUESTION_ASSIGNMENT_MODES,
  POWER_CARD_OVERRIDE_MODES,
  SPECIAL_ROUND_MODES,
} from "@/types/db";

export const createRoundSchema = z.object({
  title: z.string().min(1, "Round title is required").max(120),
  description: z.string().max(500).optional(),
  rules: z.string().max(2000).optional(),
  category: z.string().trim().min(1).max(60).default("Custom"),
  roundType: z.enum(ROUND_TYPES).default("GENERAL"),
  specialMode: z.enum(SPECIAL_ROUND_MODES).default("NONE"),
  scoringMode: z.enum(RULE_OVERRIDE_MODES).default("INHERIT"),
  defaultTimer: z.number().int().min(1).max(600).default(20),
  positiveMarks: z.number().int().default(10),
  negativeMarks: z.number().int().default(5),
  bonusMarks: z.number().int().default(0),
  coinReward: z.number().int().min(0).default(0),
  questionAssignment: z.enum(QUESTION_ASSIGNMENT_MODES).default("DEFAULT"),
  powerCardMode: z.enum(POWER_CARD_OVERRIDE_MODES).default("DEFAULT"),
  allowedPowerCards: z.array(objectId).default([]),
});

export const updateRoundSchema = createRoundSchema.partial();

/** Pre-parse shape — defaulted fields are optional, since Zod fills them in. */
export type CreateRoundInput = z.input<typeof createRoundSchema>;
export type UpdateRoundInput = z.input<typeof updateRoundSchema>;
