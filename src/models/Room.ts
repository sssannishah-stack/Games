import { Schema, model, models, type Model } from "mongoose";
import { type IRoom, ROOM_STATUSES } from "@/types/db";

const RoomSchema = new Schema<IRoom>(
  {
    competitionId: {
      type: Schema.Types.ObjectId,
      ref: "Competition",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    roomCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    status: {
      type: String,
      enum: [...ROOM_STATUSES],
      default: "DRAFT",
      required: true,
      index: true,
    },
    settings: {
      joinMethod: {
        type: String,
        enum: ["CODE", "QR", "BOTH"],
        default: "BOTH",
        required: true,
      },
      permissions: {
        viewLeaderboard: { type: Boolean, default: true },
        viewTeamScore: { type: Boolean, default: true },
        buyPowers: { type: Boolean, default: true },
        requestLifelines: { type: Boolean, default: true },
      },
    },
    selectedRounds: { type: [Schema.Types.ObjectId], ref: "Round", default: [] },
    powerCardOverrides: { type: [String], default: [] },
    currentSceneId: { type: Schema.Types.ObjectId, ref: "Scene", default: null },
    currentRoundId: { type: Schema.Types.ObjectId, ref: "Round", default: null },
    currentQuestionId: { type: Schema.Types.ObjectId, ref: "Question", default: null },
    liveState: {
      timerStartedAt: { type: Date, default: null },
      timerEndsAt: { type: Date, default: null },
      timerPaused: { type: Boolean, default: false },
      showAnswer: { type: Boolean, default: false },
      storeStatus: { type: String, enum: ["OPEN", "CLOSED"], default: "CLOSED" },
      flashSaleActive: { type: Boolean, default: false },
      flashSalePercent: { type: Number, default: 0 },
      flashSaleEndsAt: { type: Date, default: null },
    },
    onlineDevices: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// roomCode already has a unique index via the field option; keep it explicit
// for the participant-join lookup path.
RoomSchema.index({ roomCode: 1 }, { unique: true });

export const Room: Model<IRoom> = models.Room || model<IRoom>("Room", RoomSchema);
export default Room;
