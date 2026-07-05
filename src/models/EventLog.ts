import { Schema, model, models, type Model } from "mongoose";
import { type IEventLog, EVENT_LOG_TYPES } from "@/types/db";

// Immutable audit trail of everything that happens in a room.
const EventLogSchema = new Schema<IEventLog>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    type: { type: String, enum: [...EVENT_LOG_TYPES], required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const EventLog: Model<IEventLog> =
  models.EventLog || model<IEventLog>("EventLog", EventLogSchema);
export default EventLog;
