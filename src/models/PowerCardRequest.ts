import { Schema, model, models, type Model } from "mongoose";
import { type IPowerCardRequest, POWER_CARD_REQUEST_STATUSES } from "@/types/db";

// Drives the live approval flow: REQUESTED → APPROVED/REJECTED → ACTIVE → CONSUMED.
const PowerCardRequestSchema = new Schema<IPowerCardRequest>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    powerCardId: { type: Schema.Types.ObjectId, ref: "PowerCard", required: true },
    targetTeamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    status: {
      type: String,
      enum: [...POWER_CARD_REQUEST_STATUSES],
      default: "REQUESTED",
      required: true,
      index: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const PowerCardRequest: Model<IPowerCardRequest> =
  models.PowerCardRequest ||
  model<IPowerCardRequest>("PowerCardRequest", PowerCardRequestSchema);
export default PowerCardRequest;
