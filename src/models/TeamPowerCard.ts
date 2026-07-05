import { Schema, model, models, type Model } from "mongoose";
import { type ITeamPowerCard, POWER_CARD_STATUSES } from "@/types/db";

// A team's owned copy of a power card (granted directly, or bought from the
// store), tracking remaining uses.
const TeamPowerCardSchema = new Schema<ITeamPowerCard>(
  {
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    powerCardId: { type: Schema.Types.ObjectId, ref: "PowerCard", required: true },
    remainingUses: { type: Number, default: 1 },
    status: {
      type: String,
      enum: [...POWER_CARD_STATUSES],
      default: "AVAILABLE",
      required: true,
    },
  },
  { timestamps: true }
);

TeamPowerCardSchema.index({ teamId: 1, powerCardId: 1 }, { unique: true });

export const TeamPowerCard: Model<ITeamPowerCard> =
  models.TeamPowerCard || model<ITeamPowerCard>("TeamPowerCard", TeamPowerCardSchema);
export default TeamPowerCard;
