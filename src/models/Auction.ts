import { Schema, model, models, type Model } from "mongoose";
import { type IAuction, AUCTION_TYPES, AUCTION_STATUSES, AUCTION_STAGES } from "@/types/db";

// One live auction of a power card. Only one OPEN auction per room at a time.
const AuctionSchema = new Schema<IAuction>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    powerCardId: { type: Schema.Types.ObjectId, ref: "PowerCard", required: true },
    type: { type: String, enum: [...AUCTION_TYPES], required: true },
    status: { type: String, enum: [...AUCTION_STATUSES], default: "OPEN", required: true, index: true },
    stage: { type: String, enum: [...AUCTION_STAGES], default: "LIVE", required: true },
    startingBid: { type: Number, required: true },
    minIncrement: { type: Number, default: 50 },
    currentBid: { type: Number, default: 0 },
    currentBidTeamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    winnerTeamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    winningBid: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const Auction: Model<IAuction> = models.Auction || model<IAuction>("Auction", AuctionSchema);
export default Auction;
