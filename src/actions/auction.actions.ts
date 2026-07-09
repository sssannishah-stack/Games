"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Auction, AuctionBid, Room, PowerCard, Team, TeamPowerCard, EventLog } from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoomOwnership } from "@/lib/authz";
import { assertTeamController } from "@/lib/teamRoles";
import { createCoinTransaction } from "@/actions/coin.actions";
import type { AuctionType, AuctionStage, IAuction } from "@/types/db";

const STAGE_ORDER: AuctionStage[] = ["LIVE", "GOING_ONCE", "GOING_TWICE"];

export interface StartAuctionInput {
  roomId: string;
  powerCardId: string;
  type: AuctionType;
  startingBid: number;
  minIncrement?: number;
}

/** Host opens an auction for one power card. Only one OPEN auction per room. */
export async function startAuction(input: StartAuctionInput): Promise<{ id: string }> {
  const user = await requireUser();
  await assertRoomOwnership(input.roomId, user.id);
  await connectToDatabase();

  const existing = await Auction.findOne({ roomId: input.roomId, status: "OPEN" }).lean();
  if (existing) throw new Error("An auction is already running in this room.");

  const card = await PowerCard.findById(input.powerCardId).select("name").lean<{ name: string }>();
  if (!card) throw new Error("Power card not found.");

  const startingBid = Math.max(0, Math.round(input.startingBid));
  const auction = await Auction.create({
    roomId: input.roomId,
    powerCardId: input.powerCardId,
    type: input.type,
    status: "OPEN",
    stage: "LIVE",
    startingBid,
    minIncrement: Math.max(1, Math.round(input.minIncrement ?? 50)),
    currentBid: 0,
    createdBy: user.id,
  });

  await EventLog.create({
    roomId: input.roomId,
    type: "AUCTION_STARTED",
    metadata: { auctionId: auction._id.toString(), item: card.name, auctionType: input.type, startingBid },
  });

  revalidatePath(`/host/${input.roomId}`);
  return { id: auction._id.toString() };
}

/**
 * A team places a bid. NORMAL bids must beat the current bid by the increment
 * and become the public leader; SECRET/LUCKY bids are one-per-team (upserted)
 * and stay hidden until the host settles. Coins are only charged to the winner
 * at settle — but affordability is checked here so no one bids beyond balance.
 */
export async function placeBid(
  roomId: string,
  teamId: string,
  auctionId: string,
  amount: number,
  participantId?: string
): Promise<void> {
  await connectToDatabase();

  // Only the captain device (or acting captain) may commit team coins to a bid.
  await assertTeamController(teamId, participantId);

  const auction = await Auction.findById(auctionId).lean<IAuction>();
  if (!auction || auction.roomId.toString() !== roomId) throw new Error("Auction not found.");
  if (auction.status !== "OPEN") throw new Error("This auction has closed.");

  const bid = Math.round(amount);
  if (bid < auction.startingBid) throw new Error(`Bid must be at least ${auction.startingBid}.`);

  const team = await Team.findById(teamId).select("coins").lean<{ coins: number }>();
  if (!team) throw new Error("Team not found.");
  if (team.coins < bid) throw new Error("You don't have enough coins for that bid.");

  if (auction.type === "NORMAL") {
    const minNext = Math.max(auction.startingBid, auction.currentBid + auction.minIncrement);
    if (bid < minNext) throw new Error(`Next bid must be at least ${minNext}.`);
    await Auction.findByIdAndUpdate(auctionId, {
      $set: { currentBid: bid, currentBidTeamId: teamId, stage: "LIVE" },
    });
  }

  await AuctionBid.findOneAndUpdate(
    { auctionId, teamId },
    { $set: { amount: bid, roomId } },
    { upsert: true }
  );

  revalidatePath(`/host/${roomId}`);
}

/** Host advances the "going once → going twice" drama. */
export async function advanceAuctionStage(auctionId: string): Promise<void> {
  const user = await requireUser();
  await connectToDatabase();
  const auction = await Auction.findById(auctionId).lean<IAuction>();
  if (!auction) throw new Error("Auction not found.");
  await assertRoomOwnership(auction.roomId.toString(), user.id);
  if (auction.status !== "OPEN") return;

  const nextIndex = Math.min(STAGE_ORDER.indexOf(auction.stage) + 1, STAGE_ORDER.length - 1);
  await Auction.findByIdAndUpdate(auctionId, { $set: { stage: STAGE_ORDER[nextIndex] } });
  revalidatePath(`/host/${auction.roomId.toString()}`);
}

/** Host cancels an auction with no sale. */
export async function cancelAuction(auctionId: string): Promise<void> {
  const user = await requireUser();
  await connectToDatabase();
  const auction = await Auction.findById(auctionId).lean<IAuction>();
  if (!auction) throw new Error("Auction not found.");
  await assertRoomOwnership(auction.roomId.toString(), user.id);

  await Auction.findByIdAndUpdate(auctionId, { $set: { status: "CANCELLED" } });
  await EventLog.create({
    roomId: auction.roomId.toString(),
    type: "AUCTION_CANCELLED",
    metadata: { auctionId },
  });
  revalidatePath(`/host/${auction.roomId.toString()}`);
}

/**
 * Host settles the auction. Winner depends on type: NORMAL → highest public
 * bid; SECRET → highest sealed bid; LUCKY → a random bidder. The winner pays
 * their bid (capped at their balance) and receives the card.
 */
export async function settleAuction(auctionId: string): Promise<void> {
  const user = await requireUser();
  await connectToDatabase();
  const auction = await Auction.findById(auctionId).lean<IAuction>();
  if (!auction) throw new Error("Auction not found.");
  await assertRoomOwnership(auction.roomId.toString(), user.id);
  if (auction.status !== "OPEN") return;

  const roomId = auction.roomId.toString();
  const bids = await AuctionBid.find({ auctionId }).sort({ createdAt: 1 }).lean();

  if (bids.length === 0) {
    await Auction.findByIdAndUpdate(auctionId, { $set: { status: "CANCELLED" } });
    await EventLog.create({ roomId, type: "AUCTION_CANCELLED", metadata: { auctionId, reason: "No bids" } });
    revalidatePath(`/host/${roomId}`);
    return;
  }

  let winner: { teamId: string; amount: number };
  if (auction.type === "LUCKY") {
    const pick = bids[Math.floor(Math.random() * bids.length)];
    winner = { teamId: pick.teamId.toString(), amount: pick.amount };
  } else {
    // NORMAL + SECRET: highest bid wins, earliest on a tie (bids are asc by time).
    const best = bids.reduce((top, b) => (b.amount > top.amount ? b : top), bids[0]);
    winner = { teamId: best.teamId.toString(), amount: best.amount };
  }

  const [card, team] = await Promise.all([
    PowerCard.findById(auction.powerCardId).select("name usesPerTeam").lean<{ name: string; usesPerTeam: number }>(),
    Team.findById(winner.teamId).select("coins name").lean<{ coins: number; name: string }>(),
  ]);

  const charge = Math.min(team?.coins ?? 0, winner.amount);
  if (charge > 0) {
    await createCoinTransaction({
      roomId,
      teamId: winner.teamId,
      amount: -charge,
      type: "CARD_PURCHASE",
      reason: `Won auction: ${card?.name ?? "card"}`,
      createdBy: user.id,
    });
  }
  await TeamPowerCard.findOneAndUpdate(
    { teamId: winner.teamId, powerCardId: auction.powerCardId },
    { $inc: { remainingUses: card?.usesPerTeam || 1 }, $set: { status: "AVAILABLE" } },
    { upsert: true }
  );

  await Auction.findByIdAndUpdate(auctionId, {
    $set: { status: "SOLD", winnerTeamId: winner.teamId, winningBid: charge, stage: "GOING_TWICE" },
  });
  await EventLog.create({
    roomId,
    type: "AUCTION_SOLD",
    metadata: {
      auctionId,
      teamId: winner.teamId,
      item: card?.name ?? "card",
      amount: charge,
      auctionType: auction.type,
    },
  });

  revalidatePath(`/host/${roomId}`);
}
