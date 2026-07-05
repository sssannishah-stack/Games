import { z } from "zod";
import { QUESTION_TYPES, QUESTION_DIFFICULTIES, RULE_OVERRIDE_MODES } from "@/types/db";

export const questionHintSchema = z.object({
  text: z.string().min(1),
  penalty: z.number().min(0).default(0),
});

export const questionMediaSchema = z.object({
  url: z.string().url(),
  type: z.enum(["IMAGE", "AUDIO", "VIDEO"]),
  name: z.string().min(1),
});

const baseQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES).default("TEXT"),
  question: z.string().default(""),
  mediaUrl: z.string().url().optional(),
  media: questionMediaSchema.nullable().optional(),
  isMCQ: z.boolean().default(false),
  options: z.array(z.string()).default([]),
  answer: z.string().min(1, "Answer is required"),
  explanation: z.string().optional(),
  hints: z.array(questionHintSchema).default([]),
  hostNotes: z.string().optional(),
  scoringMode: z.enum(RULE_OVERRIDE_MODES).default("INHERIT"),
  timerMode: z.enum(RULE_OVERRIDE_MODES).default("INHERIT"),
  timer: z.number().int().min(1).max(600).default(20),
  positiveMarks: z.number().int().default(10),
  negativeMarks: z.number().int().default(5),
  bonusMarks: z.number().int().default(0),
  coinReward: z.number().int().min(0).default(0),
  difficulty: z.enum(QUESTION_DIFFICULTIES).default("MEDIUM"),
  tags: z.array(z.string().trim().min(1).max(40)).default([]),
});

// `.partial()` isn't available on a schema wrapped in `.refine()` (Zod v4
// throws at module-load time if you try), so the update schema is built from
// the unrefined base object — partial updates don't need the "must have text
// or media" invariant re-checked on every field-level patch.
export const updateQuestionSchema = baseQuestionSchema.partial();

export const createQuestionSchema = baseQuestionSchema
  .refine((data) => data.question.trim().length > 0 || data.media?.url || data.mediaUrl, {
    message: "Question text or media is required.",
    path: ["question"],
  })
  .refine(
    (data) => data.type !== "TEXT_IMAGE" || (data.question.trim().length > 0 && (data.media?.url || data.mediaUrl)),
    {
      message: "TEXT + IMAGE questions need both question text and an uploaded image.",
      path: ["media"],
    }
  );

/** Pre-parse shape — defaulted fields are optional, since Zod fills them in. */
export type CreateQuestionInput = z.input<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.input<typeof updateQuestionSchema>;
