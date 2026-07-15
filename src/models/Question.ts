import { Schema, model, models, type Model } from "mongoose";
import {
  type IQuestion,
  QUESTION_TYPES,
  QUESTION_DIFFICULTIES,
  RULE_OVERRIDE_MODES,
} from "@/types/db";

const HintSchema = new Schema(
  {
    text: { type: String, required: true },
    penalty: { type: Number, default: 0 },
  },
  { _id: false }
);

const MediaSchema = new Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ["IMAGE", "AUDIO", "VIDEO"], required: true },
    name: { type: String, required: true },
  },
  { _id: false }
);

const QuestionSchema = new Schema<IQuestion>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: [...QUESTION_TYPES], default: "TEXT", required: true },
    question: { type: String, default: "" },
    mediaUrl: { type: String },
    media: { type: MediaSchema, default: null },
    isMCQ: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    answer: { type: String, required: true },
    explanation: { type: String },
    hints: { type: [HintSchema], default: [] },
    hostNotes: { type: String },
    scoringMode: { type: String, enum: [...RULE_OVERRIDE_MODES], default: "INHERIT", required: true },
    timerMode: { type: String, enum: [...RULE_OVERRIDE_MODES], default: "INHERIT", required: true },
    timer: { type: Number, default: 20 },
    positiveMarks: { type: Number, default: 10 },
    negativeMarks: { type: Number, default: 5 },
    bonusMarks: { type: Number, default: 0 },
    coinReward: { type: Number, default: 0 },
    difficulty: {
      type: String,
      enum: [...QUESTION_DIFFICULTIES],
      default: "MEDIUM",
    },
    tags: { type: [String], default: [], index: true },
    groupName: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

export const Question: Model<IQuestion> =
  models.Question || model<IQuestion>("Question", QuestionSchema);
export default Question;
