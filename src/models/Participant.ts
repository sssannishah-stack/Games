import { Schema, model, models, type Model } from "mongoose";
import { type IParticipant, PARTICIPANT_ROLES } from "@/types/db";

// No login — a participant is just a display name attached to a team + room.
// Each participant is one connected phone; its `role` decides whether the
// device can control team actions (see ParticipantRole in types/db).
const ParticipantSchema = new Schema<IParticipant>(
  {
    name: { type: String, required: true, trim: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    role: { type: String, enum: [...PARTICIPANT_ROLES], default: "MEMBER", required: true },
    lastSeenAt: { type: Date, default: Date.now },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const Participant: Model<IParticipant> =
  models.Participant || model<IParticipant>("Participant", ParticipantSchema);
export default Participant;
