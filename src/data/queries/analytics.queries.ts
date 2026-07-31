import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/database/mongodb";
import {
  Room,
  Team,
  Round,
  Scene,
  Question,
  ScoreTransaction,
  CoinTransaction,
  EventLog,
  TeamPowerCard,
  PowerCardRequest,
  PowerCard,
} from "@/models";
import { serialize } from "@/lib/serialize";
import type { CoinTransactionType, EventLogType, ScoreReason } from "@/types/db";

/**
 * The Competition Analytics Center's data layer — every query here is
 * UNCAPPED (unlike the "last 50 rows" queries in score.queries.ts /
 * powerCard.queries.ts / eventLog.queries.ts used for live feeds), because a
 * single room's full history (a handful of rounds x teams x questions) is
 * small enough to aggregate in full for reporting.
 *
 * ScoreTransaction has no `roundId` field — round attribution is recovered by
 * joining through Scene (roomId + questionId -> roundId), which is what lets
 * "round breakdown" work retroactively on rooms that already have history,
 * with no schema migration/backfill.
 */

function oid(id: string) {
  return new Types.ObjectId(id);
}

/* ─────────────────── shared helpers ─────────────────── */

interface TeamMeta {
  id: string;
  name: string;
  color: string | null;
}

async function getTeamMetas(roomId: string): Promise<TeamMeta[]> {
  const teams = await Team.find({ roomId }).select("name color").sort({ createdAt: 1 }).lean();
  return teams.map((t) => ({ id: t._id.toString(), name: t.name, color: t.color ?? null }));
}

/** questionId -> roundId, built once from this room's current scene list. */
async function getQuestionToRoundMap(roomId: string): Promise<Map<string, string | null>> {
  const scenes = await Scene.find({ roomId, questionId: { $ne: null } })
    .select("questionId roundId")
    .lean();
  const map = new Map<string, string | null>();
  for (const s of scenes) {
    if (s.questionId) map.set(s.questionId.toString(), s.roundId ? s.roundId.toString() : null);
  }
  return map;
}

/**
 * Chronological {time, roundId} checkpoints built from SCENE_CHANGED events —
 * used to infer "which round was live" for events that don't carry a
 * questionId of their own (e.g. a power card request/use only has a
 * timestamp). Best-effort by nature: the live show is sequential and
 * host-stepped, so "the round live at time T" is a sound approximation.
 */
async function getRoundTimeline(roomId: string): Promise<{ at: number; roundId: string | null }[]> {
  const [logs, scenes] = await Promise.all([
    EventLog.find({ roomId, type: "SCENE_CHANGED" }).select("createdAt metadata").sort({ createdAt: 1 }).lean(),
    Scene.find({ roomId }).select("roundId").lean(),
  ]);
  const sceneRoundById = new Map(scenes.map((s) => [s._id.toString(), s.roundId ? s.roundId.toString() : null]));
  return logs.map((log) => ({
    at: new Date(log.createdAt).getTime(),
    roundId: sceneRoundById.get(String((log.metadata as Record<string, unknown> | undefined)?.sceneId ?? "")) ?? null,
  }));
}

function roundAtTime(timeline: { at: number; roundId: string | null }[], t: number): string | null {
  let found: string | null = null;
  for (const checkpoint of timeline) {
    if (checkpoint.at > t) break;
    found = checkpoint.roundId;
  }
  return found;
}

/* ─────────────────── 1. Overview ─────────────────── */

export interface OverviewRow {
  teamId: string;
  name: string;
  color: string | null;
  rank: number;
  score: number;
  coins: number;
  powerCardsRemaining: number;
  correctAnswers: number;
  wrongAnswers: number;
  streak: number;
  bestStreak: number;
  lastActionPoints: number | null;
  lastActionAt: string | null;
}

export async function getOverviewRows(roomId: string): Promise<OverviewRow[]> {
  await connectToDatabase();
  const roomObjectId = oid(roomId);

  const [teams, cardTotals, lastActions] = await Promise.all([
    Team.find({ roomId }).lean(),
    TeamPowerCard.aggregate<{ _id: Types.ObjectId; remaining: number }>([
      { $match: { status: "AVAILABLE" } },
      { $lookup: { from: "teams", localField: "teamId", foreignField: "_id", as: "team" } },
      { $unwind: "$team" },
      { $match: { "team.roomId": roomObjectId } },
      { $group: { _id: "$teamId", remaining: { $sum: "$remainingUses" } } },
    ]),
    ScoreTransaction.aggregate<{ _id: Types.ObjectId; points: number; createdAt: Date }>([
      { $match: { roomId: roomObjectId, isReverted: { $ne: true } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$teamId", points: { $first: "$points" }, createdAt: { $first: "$createdAt" } } },
    ]),
  ]);

  const remainingByTeam = new Map(cardTotals.map((c) => [c._id.toString(), c.remaining]));
  const lastActionByTeam = new Map(lastActions.map((a) => [a._id.toString(), a]));

  return teams
    .map((team) => {
      const id = team._id.toString();
      const last = lastActionByTeam.get(id);
      return {
        teamId: id,
        name: team.name,
        color: team.color ?? null,
        rank: team.rank ?? 0,
        score: team.score ?? 0,
        coins: team.coins ?? 0,
        powerCardsRemaining: remainingByTeam.get(id) ?? 0,
        correctAnswers: team.stats?.correctAnswers ?? 0,
        wrongAnswers: team.stats?.wrongAnswers ?? 0,
        streak: team.stats?.streak ?? 0,
        bestStreak: team.stats?.bestStreak ?? 0,
        lastActionPoints: last?.points ?? null,
        lastActionAt: last?.createdAt ? new Date(last.createdAt).toISOString() : null,
      };
    })
    .sort((a, b) => (a.rank || 999) - (b.rank || 999))
    .map((row) => serialize<OverviewRow>(row));
}

/* ─────────────────── 2. Round breakdown ─────────────────── */

export interface RoundBreakdownQuestionRow {
  questionId: string;
  questionText: string;
  teamId: string;
  points: number;
  reason: ScoreReason;
  createdAt: string;
}

export interface RoundBreakdownRound {
  roundId: string;
  title: string;
  order: number;
}

export interface RoundBreakdown {
  rounds: RoundBreakdownRound[];
  teams: TeamMeta[];
  /** matrix[roundId][teamId] = points scored by that team in that round. */
  matrix: Record<string, Record<string, number>>;
  /** totals[teamId] = sum across all rounds. */
  totals: Record<string, number>;
  /** detail[roundId] = every scoring transaction in that round, question-resolved. */
  detail: Record<string, RoundBreakdownQuestionRow[]>;
}

export async function getRoundBreakdown(roomId: string): Promise<RoundBreakdown> {
  await connectToDatabase();
  const roomObjectId = oid(roomId);

  const [room, teams, questionToRound, transactions] = await Promise.all([
    Room.findById(roomId).select("selectedRounds").lean(),
    getTeamMetas(roomId),
    getQuestionToRoundMap(roomId),
    ScoreTransaction.find({ roomId: roomObjectId, isReverted: { $ne: true }, questionId: { $ne: null } })
      .select("teamId questionId points reason createdAt")
      .lean(),
  ]);

  // Prefer room.selectedRounds for ordering, but don't rely on it exclusively
  // — it can drift from what the scenes/history actually reference (e.g. a
  // round deselected after scenes were generated, or an older room from
  // before this field was kept in sync). Any round that transactions
  // actually resolved to (via the Scene join) is included even if it's no
  // longer in the room's current selection, so real history never vanishes.
  const selectedRoundIds = (room?.selectedRounds ?? []).map((id) => id.toString());
  const roundIdsWithData = new Set(
    [...questionToRound.values()].filter((id): id is string => Boolean(id))
  );
  const extraRoundIds = [...roundIdsWithData].filter((id) => !selectedRoundIds.includes(id));
  const roundIds = [...selectedRoundIds, ...extraRoundIds];

  const roundsRaw = roundIds.length
    ? await Round.find({ _id: { $in: roundIds } }).select("title").lean()
    : [];
  const roundTitleById = new Map(roundsRaw.map((r) => [r._id.toString(), r.title]));
  const rounds: RoundBreakdownRound[] = roundIds
    .filter((id) => roundTitleById.has(id)) // drop ids whose Round doc no longer exists
    .map((id, index) => ({
      roundId: id,
      title: roundTitleById.get(id) ?? "Round",
      order: index,
    }));

  const questionIds = [...new Set(transactions.map((t) => t.questionId!.toString()))];
  const questions = questionIds.length
    ? await Question.find({ _id: { $in: questionIds } }).select("question").lean()
    : [];
  const questionTextById = new Map(questions.map((q) => [q._id.toString(), q.question || "Untitled question"]));

  const matrix: Record<string, Record<string, number>> = {};
  const totals: Record<string, number> = {};
  const detail: Record<string, RoundBreakdownQuestionRow[]> = {};
  for (const r of rounds) {
    matrix[r.roundId] = {};
    detail[r.roundId] = [];
  }

  for (const tx of transactions) {
    const qId = tx.questionId!.toString();
    const roundId = questionToRound.get(qId);
    if (!roundId || !matrix[roundId]) continue; // question no longer tied to a round in this room (e.g. scenes regenerated)
    const teamId = tx.teamId.toString();
    matrix[roundId][teamId] = (matrix[roundId][teamId] ?? 0) + tx.points;
    totals[teamId] = (totals[teamId] ?? 0) + tx.points;
    detail[roundId].push({
      questionId: qId,
      questionText: questionTextById.get(qId) ?? "Untitled question",
      teamId,
      points: tx.points,
      reason: tx.reason,
      createdAt: new Date(tx.createdAt).toISOString(),
    });
  }
  for (const roundId of Object.keys(detail)) {
    detail[roundId].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return serialize<RoundBreakdown>({ rounds, teams, matrix, totals, detail });
}

/* ─────────────────── 3. Timeline ─────────────────── */

export interface TimelineEntry {
  id: string;
  type: EventLogType;
  teamName: string | null;
  teamColor: string | null;
  text: string;
  createdAt: string;
}

const TIMELINE_CAP = 500;

export async function getTimeline(roomId: string): Promise<TimelineEntry[]> {
  await connectToDatabase();
  const logs = await EventLog.find({ roomId }).sort({ createdAt: 1 }).limit(TIMELINE_CAP).lean();
  if (logs.length === 0) return [];

  const [teams, cards] = await Promise.all([
    Team.find({ roomId }).select("name color").lean(),
    PowerCard.find({}).select("name").lean(),
  ]);
  const teamById = new Map(teams.map((t) => [t._id.toString(), t]));
  const cardById = new Map(cards.map((c) => [c._id.toString(), c.name]));

  function teamName(id: unknown): string | null {
    return id ? teamById.get(String(id))?.name ?? "A team" : null;
  }
  function teamColor(id: unknown): string | null {
    return id ? teamById.get(String(id))?.color ?? null : null;
  }
  function cardName(id: unknown): string {
    return cardById.get(String(id)) ?? "a power card";
  }

  return logs.map((log) => {
    const m = (log.metadata ?? {}) as Record<string, unknown>;
    let text: string;
    switch (log.type) {
      case "EVENT_STARTED":
      case "COMPETITION_STARTED":
        text = "Event started";
        break;
      case "SCENE_CHANGED":
        text = `Scene changed — ${String(m.title ?? m.sceneType ?? "next scene")}`;
        break;
      case "TIMER_STARTED":
        text = "Timer started";
        break;
      case "TIMER_STOPPED":
        text = m.reset ? "Timer reset" : "Timer paused";
        break;
      case "QUESTION_OPENED":
        text = "Question opened";
        break;
      case "ANSWER_REVEALED":
        text = "Answer revealed";
        break;
      case "SCORE_CHANGED": {
        const points = Number(m.points ?? 0);
        text = `${m.isUndo ? "Undo — " : ""}${teamName(m.teamId)} ${points >= 0 ? "+" : ""}${points} (${m.reason ?? ""})`;
        break;
      }
      case "POWER_CARD_REQUESTED":
        text = `${teamName(m.teamId)} requested ${cardName(m.powerCardId)}`;
        break;
      case "POWER_CARD_USED":
        text = m.source === "HOST_REMOVED"
          ? `${teamName(m.teamId)}'s ${cardName(m.powerCardId)} removed`
          : `${teamName(m.teamId)} used ${cardName(m.powerCardId)}`;
        break;
      case "TIMER_CHANGED":
        text = "Timer adjusted";
        break;
      case "BROADCAST_SENT":
        text = `Broadcast: "${String(m.message ?? "")}"`;
        break;
      case "COIN_AWARDED":
        text = `${teamName(m.teamId)} received ${Number(m.amount ?? 0) || ""} coins`;
        break;
      case "CARD_PURCHASED":
        text = `${teamName(m.teamId)} bought ${cardName(m.powerCardId)}`;
        break;
      case "STORE_OPENED":
        text = "Power Store opened";
        break;
      case "STORE_CLOSED":
        text = "Power Store closed";
        break;
      case "ACHIEVEMENT_EARNED":
        text = `${teamName(m.teamId)} earned ${String(m.label ?? "an achievement")}`;
        break;
      case "FLASH_SALE_STARTED":
        text = String(m.text ?? "Flash Sale started");
        break;
      case "REWARD_DROP":
        text = m.teamId ? `${teamName(m.teamId)}: ${String(m.text ?? "reward")}` : String(m.text ?? "Free reward drop");
        break;
      case "LUCKY_SPIN":
        text = `${teamName(m.teamId)}: Lucky Spin — ${String(m.label ?? "")}`;
        break;
      case "AUCTION_STARTED":
        text = `Auction started: ${String(m.item ?? "a card")}`;
        break;
      case "AUCTION_SOLD":
        text = `${teamName(m.teamId)} won ${String(m.item ?? "the auction")} for ${Number(m.amount ?? 0)}`;
        break;
      case "AUCTION_CANCELLED":
        text = "Auction cancelled";
        break;
      case "CAPTAIN_CHANGED":
        text = String(m.text ?? `${teamName(m.teamId)} captain changed`);
        break;
      case "PARTICIPANT_REMOVED":
        text = String(m.text ?? "A participant was removed");
        break;
      case "ANSWER_SUBMITTED":
        text = `${teamName(m.teamId)} submitted an answer`;
        break;
      case "MCQ_RETRY":
        text = `${teamName(m.teamId)} retried (Double Guess)`;
        break;
      case "MCQ_GRADED":
        text = `${teamName(m.teamId)} auto-graded — ${String(m.reason ?? "")}`;
        break;
      default:
        text = String(log.type).replace(/_/g, " ").toLowerCase();
    }
    return serialize<TimelineEntry>({
      id: log._id.toString(),
      type: log.type,
      teamName: teamName(m.teamId),
      teamColor: teamColor(m.teamId),
      text,
      createdAt: new Date(log.createdAt).toISOString(),
    });
  });
}

/* ─────────────────── 4. Economy ─────────────────── */

export interface EconomyRow {
  teamId: string;
  name: string;
  color: string | null;
  current: number;
  byType: Partial<Record<CoinTransactionType, number>>;
  earned: number;
  spent: number;
}

export async function getEconomyBreakdown(roomId: string): Promise<EconomyRow[]> {
  await connectToDatabase();
  const roomObjectId = oid(roomId);

  const [teams, totals] = await Promise.all([
    Team.find({ roomId }).select("name color coins").lean(),
    CoinTransaction.aggregate<{ _id: { teamId: Types.ObjectId; type: CoinTransactionType }; sum: number }>([
      { $match: { roomId: roomObjectId } },
      { $group: { _id: { teamId: "$teamId", type: "$type" }, sum: { $sum: "$amount" } } },
    ]),
  ]);

  const byTeam = new Map<string, Partial<Record<CoinTransactionType, number>>>();
  for (const row of totals) {
    const teamId = row._id.teamId.toString();
    const bucket = byTeam.get(teamId) ?? {};
    bucket[row._id.type] = (bucket[row._id.type] ?? 0) + row.sum;
    byTeam.set(teamId, bucket);
  }

  return teams.map((team) => {
    const id = team._id.toString();
    const byType = byTeam.get(id) ?? {};
    const earned = (byType.STARTING_BONUS ?? 0) + (byType.QUESTION_REWARD ?? 0) + Math.max(0, byType.HOST_ADJUSTMENT ?? 0) + Math.max(0, byType.REFUND ?? 0);
    const spent = Math.abs(Math.min(0, byType.CARD_PURCHASE ?? 0)) + Math.abs(Math.min(0, byType.HOST_ADJUSTMENT ?? 0));
    return serialize<EconomyRow>({
      teamId: id,
      name: team.name,
      color: team.color ?? null,
      current: team.coins ?? 0,
      byType,
      earned,
      spent,
    });
  });
}

/* ─────────────────── 5. Power card usage ─────────────────── */

export interface PowerCardUsageEvent {
  status: string;
  roundTitle: string | null;
  at: string;
}

export interface PowerCardUsageRow {
  teamId: string;
  teamName: string;
  powerCardId: string;
  powerCardName: string;
  powerCardIcon: string;
  owned: number;
  used: number;
  remaining: number;
  purchased: boolean;
  events: PowerCardUsageEvent[];
}

export async function getPowerCardUsage(roomId: string): Promise<PowerCardUsageRow[]> {
  await connectToDatabase();
  const roomObjectId = oid(roomId);

  const teams = await Team.find({ roomId }).select("name").lean();
  const teamIds = teams.map((t) => t._id.toString());
  if (teamIds.length === 0) return [];

  const [owned, requests, purchases, roundTimeline, roundsRaw] = await Promise.all([
    TeamPowerCard.find({ teamId: { $in: teamIds.map(oid) } }).lean(),
    PowerCardRequest.find({ roomId: roomObjectId, status: "CONSUMED" }).select("teamId powerCardId createdAt status").lean(),
    CoinTransaction.find({ roomId: roomObjectId, type: "CARD_PURCHASE" }).select("teamId").lean(),
    getRoundTimeline(roomId),
    Round.find({}).select("title").lean(),
  ]);

  const roundTitleById = new Map(roundsRaw.map((r) => [r._id.toString(), r.title]));
  const teamNameById = new Map(teams.map((t) => [t._id.toString(), t.name]));
  const cardIds = [...new Set(owned.map((o) => o.powerCardId.toString()))];
  const cards = cardIds.length ? await PowerCard.find({ _id: { $in: cardIds } }).select("name icon").lean() : [];
  const cardById = new Map(cards.map((c) => [c._id.toString(), c]));

  // "Purchased" is inferred: a team with any CARD_PURCHASE coin transaction is
  // assumed to have bought (at least some of) their copies, vs. host-granted.
  // Acquisition method isn't stored per-copy on TeamPowerCard, so this is a
  // team-level heuristic, not a guarantee for every individual copy.
  const purchasedTeamIds = new Set(purchases.map((p) => p.teamId.toString()));

  const usedByTeamCard = new Map<string, { count: number; events: PowerCardUsageEvent[] }>();
  for (const req of requests) {
    const key = `${req.teamId.toString()}:${req.powerCardId.toString()}`;
    const entry = usedByTeamCard.get(key) ?? { count: 0, events: [] };
    entry.count += 1;
    const roundId = roundAtTime(roundTimeline, new Date(req.createdAt).getTime());
    entry.events.push({
      status: req.status,
      roundTitle: roundId ? roundTitleById.get(roundId) ?? null : null,
      at: new Date(req.createdAt).toISOString(),
    });
    usedByTeamCard.set(key, entry);
  }

  return owned
    .map((o) => {
      const teamId = o.teamId.toString();
      const cardId = o.powerCardId.toString();
      const card = cardById.get(cardId);
      const usage = usedByTeamCard.get(`${teamId}:${cardId}`);
      return serialize<PowerCardUsageRow>({
        teamId,
        teamName: teamNameById.get(teamId) ?? "Team",
        powerCardId: cardId,
        powerCardName: card?.name ?? "Power card",
        powerCardIcon: card?.icon ?? "sparkles",
        owned: o.remainingUses + (usage?.count ?? 0),
        used: usage?.count ?? 0,
        remaining: o.remainingUses,
        purchased: purchasedTeamIds.has(teamId),
        events: usage?.events ?? [],
      });
    })
    .filter((row) => row.owned > 0 || row.used > 0);
}

/* ─────────────────── 6. Statistics ─────────────────── */

export interface CompetitionStatistics {
  questionsAsked: number;
  roundsCompleted: number;
  correctAnswers: number;
  wrongAnswers: number;
  hintsUsed: number;
  powerCardsUsed: number;
  storePurchases: number;
  auctionsSold: number;
  coinsCirculated: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}

export async function getCompetitionStatistics(roomId: string): Promise<CompetitionStatistics> {
  await connectToDatabase();
  const roomObjectId = oid(roomId);

  const [
    questionScenesCompleted,
    roundIntroScenesCompleted,
    scoreTotals,
    teams,
    hintsAgg,
    powerCardsUsedCount,
    storePurchasesCount,
    auctionsSoldCount,
    coinsAgg,
  ] = await Promise.all([
    Scene.countDocuments({ roomId: roomObjectId, type: { $in: ["QUESTION", "DRAWING"] }, status: "COMPLETED" }),
    Scene.countDocuments({ roomId: roomObjectId, type: "ROUND_COMPLETE" }),
    ScoreTransaction.aggregate<{ _id: ScoreReason; count: number }>([
      { $match: { roomId: roomObjectId, isReverted: { $ne: true }, isUndo: { $ne: true } } },
      { $group: { _id: "$reason", count: { $sum: 1 } } },
    ]),
    Team.find({ roomId }).select("score hintsRevealed").lean(),
    Team.aggregate<{ total: number }>([
      { $match: { roomId: roomObjectId } },
      { $unwind: { path: "$hintsRevealed", preserveNullAndEmptyArrays: true } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$hintsRevealed.count", 0] } } } },
    ]),
    PowerCardRequest.countDocuments({ roomId: roomObjectId, status: "CONSUMED" }),
    CoinTransaction.countDocuments({ roomId: roomObjectId, type: "CARD_PURCHASE" }),
    EventLog.countDocuments({ roomId: roomObjectId, type: "AUCTION_SOLD" }),
    CoinTransaction.aggregate<{ total: number }>([
      { $match: { roomId: roomObjectId } },
      { $group: { _id: null, total: { $sum: { $abs: "$amount" } } } },
    ]),
  ]);

  const reasonCounts = new Map(scoreTotals.map((r) => [r._id, r.count]));
  const scores = teams.map((t) => t.score ?? 0);

  return {
    questionsAsked: questionScenesCompleted,
    roundsCompleted: roundIntroScenesCompleted,
    correctAnswers: reasonCounts.get("CORRECT") ?? 0,
    wrongAnswers: reasonCounts.get("WRONG") ?? 0,
    hintsUsed: hintsAgg[0]?.total ?? 0,
    powerCardsUsed: powerCardsUsedCount,
    storePurchases: storePurchasesCount,
    auctionsSold: auctionsSoldCount,
    coinsCirculated: coinsAgg[0]?.total ?? 0,
    averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    highestScore: scores.length ? Math.max(...scores) : 0,
    lowestScore: scores.length ? Math.min(...scores) : 0,
  };
}
