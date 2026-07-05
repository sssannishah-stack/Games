import { Schema, model, models, type Model } from "mongoose";
import { type ICompetition, COMPETITION_STATUSES } from "@/types/db";

const CompetitionSettingsSchema = new Schema(
  {
    mode: { type: String, enum: ["SIMPLE", "ADVANCED"], default: "SIMPLE" },
    room: {
      name: { type: String, default: "Main Room" },
      code: { type: String },
      joinMethod: { type: String, enum: ["QR", "CODE", "BOTH"], default: "BOTH" },
      participantJoining: {
        type: String,
        enum: ["ANYONE", "CREATED_MEMBERS"],
        default: "ANYONE",
      },
    },
    permissions: {
      viewLeaderboard: { type: Boolean, default: true },
      viewTeamScore: { type: Boolean, default: true },
      viewPowerCards: { type: Boolean, default: true },
    },
    scoring: {
      defaultCorrect: { type: Number, default: 10 },
      defaultWrong: { type: Number, default: -5 },
      defaultTimer: { type: Number, default: 30 },
      defaultCoinReward: { type: Number, default: 100 },
      defaultPowerCardApprovalRequired: { type: Boolean, default: true },
      allowNegative: { type: Boolean, default: true },
      allowBonus: { type: Boolean, default: true },
      manualScoring: { type: Boolean, default: true },
      questionAssignment: {
        type: String,
        enum: ["ANY_TEAM", "FIXED_ORDER", "HOST_CHOOSES", "RANDOM_TEAM"],
        default: "ANY_TEAM",
      },
    },
    turnRules: {
      enableTeamTurns: { type: Boolean, default: false },
      allowStealing: { type: Boolean, default: false },
      allowChallenges: { type: Boolean, default: false },
    },
    economy: {
      enabled: { type: Boolean, default: false },
      startingCoins: { type: Number, default: 5000 },
      correctAnswerCoins: { type: Number, default: 100 },
      fastAnswerBonusCoins: { type: Number, default: 25 },
      roundWinnerCoins: { type: Number, default: 250 },
      storeAvailability: {
        type: String,
        enum: ["ALWAYS", "BEFORE_COMPETITION", "BETWEEN_ROUNDS", "HOST_MANUAL"],
        default: "BETWEEN_ROUNDS",
      },
    },
    setupDraft: {
      teams: { type: [Schema.Types.Mixed], default: [] },
      rounds: { type: [Schema.Types.Mixed], default: [] },
    },
  },
  { _id: false }
);

const CompetitionSchema = new Schema<ICompetition>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    language: { type: String, default: "en" },
    theme: { type: String, default: "#6C7BFA" },
    status: {
      type: String,
      enum: [...COMPETITION_STATUSES],
      default: "DRAFT",
      required: true,
      index: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    settings: { type: CompetitionSettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const Competition: Model<ICompetition> =
  models.Competition || model<ICompetition>("Competition", CompetitionSchema);
export default Competition;
