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
    // Questions this team is protected from negative marks on — set when an
    // Insurance card is activated, covering the question it was used on plus
    // the next two (by the room's flow order).
    insuredQuestionIds: { type: [String], default: [] },
    // How many hints this team has unlocked per question (Hint card). The
    // live feed sends this team only that many of the question's hints.
    hintsRevealed: {
      type: [
        new Schema(
          { questionId: { type: String, required: true }, count: { type: Number, default: 1 } },
          { _id: false }
        ),
      ],
      default: [],
    },
    // Questions this team is frozen on — set when an opponent plays Freeze,
    // covering the team's next question. While frozen, it can play no power
    // cards on that question.
    frozenQuestionIds: { type: [String], default: [] },
    // One eliminated wrong-option index per question this team has Peeked.
    peeks: {
      type: [
        new Schema(
          { questionId: { type: String, required: true }, eliminatedOptionIndex: { type: Number, required: true } },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const Team: Model<ITeam> = models.Team || model<ITeam>("Team", TeamSchema);
export default Team;
