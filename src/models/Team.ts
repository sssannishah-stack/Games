import { Schema, model, models, type Model } from "mongoose";
import { type ITeam } from "@/types/db";

const TeamMemberSchema = new Schema(
  { name: { type: String, required: true, trim: true } },
  { _id: false }
);

const TeamSchema = new Schema<ITeam>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    name: { type: String, required: true, trim: true },
    color: { type: String },
    // Host-authored roster — names only, no login. Distinct from Participant,
    // which records who actually connected live (a subset of this roster).
    members: { type: [TeamMemberSchema], default: [] },
    // Score decides the winner; coins buy power cards. Never mixed.
    score: { type: Number, default: 0 },
    rank: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    stats: {
      correctAnswers: { type: Number, default: 0 },
      wrongAnswers: { type: Number, default: 0 },
      bonusPoints: { type: Number, default: 0 },
      streak: { type: Number, default: 0 },
      bestStreak: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const Team: Model<ITeam> = models.Team || model<ITeam>("Team", TeamSchema);
export default Team;
