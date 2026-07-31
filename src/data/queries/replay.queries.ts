import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/database/mongodb";
import { EventLog, ScoreTransaction, CoinTransaction, PowerCardRequest, Auction, AuctionBid } from "@/models";
import { serialize } from "@/lib/serialize";
import type { EventLogType, ScoreReason, CoinTransactionType, PowerCardRequestStatus, AuctionType, AuctionStatus } from "@/types/db";

/**
 * Competition Replay's event-sourced data — everything needed to reconstruct
 * "what did the room look like at time T" purely from the append-only
 * ledgers, fetched once and shipped to the client for local scrubbing (no
 * per-frame server round-trip). Reference data that doesn't change over the
 * course of the event (room/teams/rounds/questions/scenes/power-card catalog)
 * is fetched separately via the existing query functions already used by the
 * room dashboard — this file only covers the historical/event-sourced side.
 */

function oid(id: string) {
  return new Types.ObjectId(id);
}

/* ─────────────────── events ─────────────────── */

export interface ReplayEvent {
  id: string;
  type: EventLogType;
  metadata: Record<string, unknown>;
  text: string;
  createdAt: string;
}

export async function getReplayEvents(roomId: string): Promise<ReplayEvent[]> {
  await connectToDatabase();
  const logs = await EventLog.find({ roomId }).sort({ createdAt: 1 }).lean();
  return logs.map((log) =>
    serialize<ReplayEvent>({
      id: log._id.toString(),
      type: log.type,
      metadata: (log.metadata ?? {}) as Record<string, unknown>,
      text: formatEventText(log.type, (log.metadata ?? {}) as Record<string, unknown>),
      createdAt: new Date(log.createdAt).toISOString(),
    })
  );
}

/**
 * A label-only formatter (no name resolution — that needs the team/card
 * reference data the caller already has). Callers that want "Team A +10"
 * instead of a raw teamId should resolve `metadata.teamId`/`metadata.powerCardId`
 * themselves against the teams/cards they already fetched; this just covers
 * the parts of the label that don't need a lookup.
 */
function formatEventText(type: EventLogType, m: Record<string, unknown>): string {
  switch (type) {
    case "EVENT_STARTED":
    case "COMPETITION_STARTED":
      return "Competition started";
    case "SCENE_CHANGED":
      return String(m.title ?? m.sceneType ?? "Scene changed");
    case "TIMER_STARTED":
      return "Timer started";
    case "TIMER_STOPPED":
      return m.reset ? "Timer reset" : "Timer paused";
    case "TIMER_CHANGED":
      return "Timer adjusted";
    case "QUESTION_OPENED":
      return "Question opened";
    case "ANSWER_REVEALED":
      return "Answer revealed";
    case "SCORE_CHANGED": {
      const points = Number(m.points ?? 0);
      return `${m.isUndo ? "Undo — " : ""}${points >= 0 ? "+" : ""}${points} (${m.reason ?? ""})`;
    }
    case "POWER_CARD_REQUESTED":
      return "Power card requested";
    case "POWER_CARD_USED":
      return m.source === "HOST_REMOVED" ? "Power card removed" : m.source === "HOST_GIFT" ? "Power card gifted" : "Power card used";
    case "CARD_PURCHASED":
      return "Bought a power card";
    case "STORE_OPENED":
      return "Store opened";
    case "STORE_CLOSED":
      return "Store closed";
    case "FLASH_SALE_STARTED":
      return String(m.text ?? "Flash sale started");
    case "COIN_AWARDED":
      return `Received ${Number(m.amount ?? 0)} coins`;
    case "ACHIEVEMENT_EARNED":
      return `Earned ${String(m.label ?? "an achievement")}`;
    case "REWARD_DROP":
      return String(m.text ?? "Reward drop");
    case "LUCKY_SPIN":
      return `Lucky Spin — ${String(m.label ?? "")}`;
    case "AUCTION_STARTED":
      return `Auction started: ${String(m.item ?? "a card")}`;
    case "AUCTION_SOLD":
      return `Sold for ${Number(m.amount ?? 0)}`;
    case "AUCTION_CANCELLED":
      return "Auction cancelled";
    case "BROADCAST_SENT":
      return `Broadcast: "${String(m.message ?? "")}"`;
    case "CAPTAIN_CHANGED":
      return String(m.text ?? "Captain changed");
    case "PARTICIPANT_REMOVED":
      return String(m.text ?? "A participant was removed");
    case "ANSWER_SUBMITTED":
      return "Answer submitted";
    case "MCQ_RETRY":
      return "Retried (Double Guess)";
    case "MCQ_GRADED":
      return `Auto-graded — ${String(m.reason ?? "")}`;
    default:
      return String(type).replace(/_/g, " ").toLowerCase();
  }
}

/* ─────────────────── score & coin history ─────────────────── */

export interface ReplayScoreEntry {
  teamId: string;
  questionId: string | null;
  points: number;
  reason: ScoreReason;
  isUndo: boolean;
  isReverted: boolean;
  createdAt: string;
}

export async function getReplayScoreHistory(roomId: string): Promise<ReplayScoreEntry[]> {
  await connectToDatabase();
  const rows = await ScoreTransaction.find({ roomId }).sort({ createdAt: 1 }).lean();
  return rows.map((r) =>
    serialize<ReplayScoreEntry>({
      teamId: r.teamId.toString(),
      questionId: r.questionId ? r.questionId.toString() : null,
      points: r.points,
      reason: r.reason,
      isUndo: r.isUndo ?? false,
      isReverted: r.isReverted ?? false,
      createdAt: new Date(r.createdAt).toISOString(),
    })
  );
}

export interface ReplayCoinEntry {
  teamId: string;
  amount: number;
  type: CoinTransactionType;
  createdAt: string;
}

export async function getReplayCoinHistory(roomId: string): Promise<ReplayCoinEntry[]> {
  await connectToDatabase();
  const rows = await CoinTransaction.find({ roomId }).sort({ createdAt: 1 }).lean();
  return rows.map((r) =>
    serialize<ReplayCoinEntry>({
      teamId: r.teamId.toString(),
      amount: r.amount,
      type: r.type,
      createdAt: new Date(r.createdAt).toISOString(),
    })
  );
}

/* ─────────────────── power card request history ─────────────────── */

export interface ReplayPowerCardRequestEntry {
  teamId: string;
  powerCardId: string;
  status: PowerCardRequestStatus;
  createdAt: string;
}

export async function getReplayPowerCardHistory(roomId: string): Promise<ReplayPowerCardRequestEntry[]> {
  await connectToDatabase();
  const rows = await PowerCardRequest.find({ roomId }).sort({ createdAt: 1 }).lean();
  return rows.map((r) =>
    serialize<ReplayPowerCardRequestEntry>({
      teamId: r.teamId.toString(),
      powerCardId: r.powerCardId.toString(),
      status: r.status,
      createdAt: new Date(r.createdAt).toISOString(),
    })
  );
}

/* ─────────────────── auctions ─────────────────── */

export interface ReplayAuctionBid {
  teamId: string;
  amount: number;
}

export interface ReplayAuction {
  id: string;
  powerCardId: string;
  type: AuctionType;
  status: AuctionStatus;
  startingBid: number;
  winnerTeamId: string | null;
  winningBid: number;
  bids: ReplayAuctionBid[];
  createdAt: string;
  resolvedAt: string;
}

/**
 * NOTE: `AuctionBid` is upserted per {auctionId, teamId} — only each team's
 * FINAL bid survives, there is no row-by-row bid-war history. Replay shows
 * these final standings at the moment of sale, not a fabricated sequence.
 */
export async function getReplayAuctions(roomId: string): Promise<ReplayAuction[]> {
  await connectToDatabase();
  const roomObjectId = oid(roomId);
  const auctions = await Auction.find({ roomId: roomObjectId }).sort({ createdAt: 1 }).lean();
  if (auctions.length === 0) return [];

  const auctionIds = auctions.map((a) => a._id);
  const bids = await AuctionBid.find({ auctionId: { $in: auctionIds } }).lean();
  const bidsByAuction = new Map<string, ReplayAuctionBid[]>();
  for (const bid of bids) {
    const key = bid.auctionId.toString();
    const list = bidsByAuction.get(key) ?? [];
    list.push({ teamId: bid.teamId.toString(), amount: bid.amount });
    bidsByAuction.set(key, list);
  }

  return auctions.map((a) =>
    serialize<ReplayAuction>({
      id: a._id.toString(),
      powerCardId: a.powerCardId.toString(),
      type: a.type,
      status: a.status,
      startingBid: a.startingBid,
      winnerTeamId: a.winnerTeamId ? a.winnerTeamId.toString() : null,
      winningBid: a.winningBid,
      bids: (bidsByAuction.get(a._id.toString()) ?? []).sort((x, y) => y.amount - x.amount),
      createdAt: new Date(a.createdAt).toISOString(),
      resolvedAt: new Date(a.updatedAt).toISOString(),
    })
  );
}
