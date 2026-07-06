import "server-only";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Auction, AuctionBid, PowerCard } from "@/models";
import { serialize } from "@/lib/serialize";
import type { AuctionType, AuctionStage } from "@/types/db";

export interface AuctionBidView {
  teamId: string;
  amount: number;
}

export interface ActiveAuction {
  id: string;
  type: AuctionType;
  stage: AuctionStage;
  itemName: string;
  itemIcon: string;
  startingBid: number;
  minIncrement: number;
  currentBid: number;
  currentBidTeamId: string | null;
  /** Sealed for SECRET/LUCKY on the phone, but the host always sees them. */
  bids: AuctionBidView[];
}

/** The room's currently-OPEN auction (host view — sees all bids), or null. */
export async function getActiveAuction(roomId: string): Promise<ActiveAuction | null> {
  await connectToDatabase();
  const auction = await Auction.findOne({ roomId, status: "OPEN" }).lean();
  if (!auction) return null;

  const [card, bids] = await Promise.all([
    PowerCard.findById(auction.powerCardId).select("name icon").lean<{ name: string; icon: string }>(),
    AuctionBid.find({ auctionId: auction._id }).sort({ amount: -1, createdAt: 1 }).lean(),
  ]);

  return serialize<ActiveAuction>({
    id: auction._id.toString(),
    type: auction.type,
    stage: auction.stage,
    itemName: card?.name ?? "Power card",
    itemIcon: card?.icon ?? "🎴",
    startingBid: auction.startingBid,
    minIncrement: auction.minIncrement,
    currentBid: auction.currentBid,
    currentBidTeamId: auction.currentBidTeamId ? auction.currentBidTeamId.toString() : null,
    bids: bids.map((b) => ({ teamId: b.teamId.toString(), amount: b.amount })),
  });
}
