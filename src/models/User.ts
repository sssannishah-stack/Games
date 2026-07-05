import { Schema, model, models, type Model } from "mongoose";
import { type IUser, USER_ROLES } from "@/types/db";

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    image: { type: String },
    role: { type: String, enum: [...USER_ROLES], default: "HOST", required: true },
  },
  { timestamps: true }
);

export const User: Model<IUser> = models.User || model<IUser>("User", UserSchema);
export default User;
