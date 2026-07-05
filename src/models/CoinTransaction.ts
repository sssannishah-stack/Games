import { Schema, model, models, type Model } from "mongoose";
import { type ICoinTransaction, COIN_TRANSACTION_TYPES } from "@/types/db";

/**
 * Append-only coin ledger, mirroring ScoreTransaction. A team's coin balance
 * is never mutated in isolation — it is always the running total of these,
 * so purchases, refunds and host adjustments are always auditable.
 */
const CoinTransactionSchema = new Schema<ICoinTransaction>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: [...COIN_TRANSACTION_TYPES], required: true },
    reason: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const CoinTransaction: Model<ICoinTransaction> =
  models.CoinTransaction || model<ICoinTransaction>("CoinTransaction", CoinTransactionSchema);
export default CoinTransaction;
