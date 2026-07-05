import { Schema, model, models, type Model } from "mongoose";
import { type IScene, SCENE_STATUSES, SCENE_TYPES } from "@/types/db";

// The scene engine: the host advances through an ordered list of scenes.
const SceneSchema = new Schema<IScene>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    roundId: { type: Schema.Types.ObjectId, ref: "Round", default: null },
    type: { type: String, enum: [...SCENE_TYPES], required: true },
    order: { type: Number, required: true, default: 0 },
    title: { type: String, required: true, default: "Untitled Scene" },
    isActive: { type: Boolean, default: false },
    status: { type: String, enum: [...SCENE_STATUSES], default: "UPCOMING", required: true },
    // Free-form per-scene payload (banner text, leaderboard config, etc.).
    content: { type: Schema.Types.Mixed, default: {} },
    settings: { type: Schema.Types.Mixed, default: {} },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", default: null },
  },
  { timestamps: true }
);

SceneSchema.index({ roomId: 1, order: 1 });

export const Scene: Model<IScene> = models.Scene || model<IScene>("Scene", SceneSchema);
export default Scene;
