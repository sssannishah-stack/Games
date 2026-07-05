import { Schema, model, models, type Model } from "mongoose";
import { type IScoreTransaction, SCORE_REASONS } from "@/types/db";

/**
 * Append-only ledger of point changes. A team's `score` is derived from the
 * sum of its non-undone transactions — never mutated in isolation. An "undo"
 * is itself a transaction (isUndo=true) so the full history is preserved.
 */
const ScoreTransactionSchema = new Schema<IScoreTransaction>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    participantId: { type: Schema.Types.ObjectId, ref: "Participant", default: null },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", default: null },
    points: { type: Number, required: true },
    reason: { type: String, enum: [...SCORE_REASONS], required: true },
    isUndo: { type: Boolean, default: false },
    isReverted: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ScoreTransaction: Model<IScoreTransaction> =
  models.ScoreTransaction ||
  model<IScoreTransaction>("ScoreTransaction", ScoreTransactionSchema);
export default ScoreTransaction;
