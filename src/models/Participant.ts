import { Schema, model, models, type Model } from "mongoose";
import { type IParticipant } from "@/types/db";

// No login — a participant is just a display name attached to a team + room.
const ParticipantSchema = new Schema<IParticipant>(
  {
    name: { type: String, required: true, trim: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const Participant: Model<IParticipant> =
  models.Participant || model<IParticipant>("Participant", ParticipantSchema);
export default Participant;
