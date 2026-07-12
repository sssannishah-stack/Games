import { Schema, model, models, type Model } from "mongoose";
import { type IDrawingStroke, DRAWING_STROKE_KINDS } from "@/types/db";

/**
 * Append-only strokes for the live drawing board. Never mutated — a "clear" is
 * itself a row (kind: "CLEAR"), so the board's whole history replays
 * deterministically from the ledger, matching the rest of Encore's model.
 */
const DrawingStrokeSchema = new Schema<IDrawingStroke>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    seq: { type: Number, required: true },
    kind: { type: String, enum: [...DRAWING_STROKE_KINDS], default: "STROKE", required: true },
    color: { type: String, default: "#e6e1d5" },
    width: { type: Number, default: 4 },
    erase: { type: Boolean, default: false },
    points: { type: [Number], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The board polls "give me everything after seq N for this question" — this
// index makes that lookup, and the per-room max-seq lookup, cheap.
DrawingStrokeSchema.index({ roomId: 1, questionId: 1, seq: 1 });

export const DrawingStroke: Model<IDrawingStroke> =
  models.DrawingStroke || model<IDrawingStroke>("DrawingStroke", DrawingStrokeSchema);
export default DrawingStroke;
