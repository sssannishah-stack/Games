import { Schema, model, models, type Model } from "mongoose";
import { type IAuctionBid } from "@/types/db";

// One row per team per auction — upserted, so a team's latest bid replaces its
// previous one (matters for SECRET/LUCKY where each team holds a single bid).
const AuctionBidSchema = new Schema<IAuctionBid>(
  {
    auctionId: { type: Schema.Types.ObjectId, ref: "Auction", required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    amount: { type: Number, required: true },
    // Explicitly opted out (or auto-opted-out once the team can no longer
    // afford the next minimum bid) — excluded from winner selection and can't
    // bid again in this auction.
    passed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AuctionBidSchema.index({ auctionId: 1, teamId: 1 }, { unique: true });

export const AuctionBid: Model<IAuctionBid> =
  models.AuctionBid || model<IAuctionBid>("AuctionBid", AuctionBidSchema);
export default AuctionBid;
