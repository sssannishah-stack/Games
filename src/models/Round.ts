import { Schema, model, models, type Model } from "mongoose";
import {
  POWER_CARD_OVERRIDE_MODES,
  QUESTION_ASSIGNMENT_MODES,
  ROUND_TYPES,
  RULE_OVERRIDE_MODES,
  SPECIAL_ROUND_MODES,
  type IRound,
} from "@/types/db";

const RoundSchema = new Schema<IRound>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    rules: { type: String },
    category: { type: String, default: "Custom", index: true },
    roundType: { type: String, enum: [...ROUND_TYPES], default: "GENERAL", required: true },
    specialMode: { type: String, enum: [...SPECIAL_ROUND_MODES], default: "NONE", required: true },
    questions: { type: [Schema.Types.ObjectId], ref: "Question", default: [] },
    scoringMode: { type: String, enum: [...RULE_OVERRIDE_MODES], default: "INHERIT", required: true },
    defaultTimer: { type: Number, default: 20 },
    positiveMarks: { type: Number, default: 10 },
    negativeMarks: { type: Number, default: 5 },
    bonusMarks: { type: Number, default: 0 },
    coinReward: { type: Number, default: 0 },
    questionAssignment: {
      type: String,
      enum: [...QUESTION_ASSIGNMENT_MODES],
      default: "DEFAULT",
      required: true,
    },
    powerCardMode: {
      type: String,
      enum: [...POWER_CARD_OVERRIDE_MODES],
      default: "DEFAULT",
      required: true,
    },
    allowedPowerCards: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const Round: Model<IRound> = models.Round || model<IRound>("Round", RoundSchema);
export default Round;
