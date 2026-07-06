import { Schema, model, models, type Model } from "mongoose";
import { type ITeamAchievement, ACHIEVEMENT_TYPES, ACHIEVEMENT_STATUSES } from "@/types/db";

// A per-team achievement. Auto-detected ones start SUGGESTED and wait for the
// host to award or dismiss; manual ones are created already AWARDED.
const TeamAchievementSchema = new Schema<ITeamAchievement>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    type: { type: String, enum: [...ACHIEVEMENT_TYPES], required: true },
    status: {
      type: String,
      enum: [...ACHIEVEMENT_STATUSES],
      default: "SUGGESTED",
      required: true,
      index: true,
    },
    coinReward: { type: Number, default: 0 },
    awardedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// One auto achievement of each type per team (First Blood, streaks, comeback
// don't repeat). Manual repeatables (Fast Answer, Perfect Round) are created
// with a per-award suffix in metadata rather than relying on this guard.
TeamAchievementSchema.index({ roomId: 1, teamId: 1, type: 1 });

export const TeamAchievement: Model<ITeamAchievement> =
  models.TeamAchievement || model<ITeamAchievement>("TeamAchievement", TeamAchievementSchema);
export default TeamAchievement;
