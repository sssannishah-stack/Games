import "server-only";
import { connectToDatabase } from "@/lib/database/mongodb";
import { PowerCard, TeamPowerCard, CoinTransaction, PowerCardRequest, Team } from "@/models";
import { serialize } from "@/lib/serialize";
import type {
  PowerCardCategory,
  PowerCardRarity,
  PowerCardEffectType,
  PowerCardStatus,
  PriceMode,
  CoinTransactionType,
  PowerCardRequestStatus,
} from "@/types/db";

export interface PowerCardRecord {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  icon: string;
  category: PowerCardCategory;
  rarity: PowerCardRarity;
  effectType: PowerCardEffectType;
  price: number;
  stock: number | null;
  enabled: boolean;
  requiresApproval: boolean;
  usesPerTeam: number;
  priceMode: PriceMode;
}

/** The host's full power card catalog — global, shared across every competition/room they run. */
export async function getPowerCardsByOwner(ownerId: string): Promise<PowerCardRecord[]> {
  await connectToDatabase();
  const cards = await PowerCard.find({ ownerId }).sort({ category: 1, price: 1 }).lean();
  const uniqueCards = [...new Map(cards.map((card) => [`${card.name}:${card.effectType}`, card])).values()];
  return uniqueCards.map((c) =>
    serialize<PowerCardRecord>({
      id: c._id.toString(),
      ownerId: c.ownerId.toString(),
      name: c.name,
      description: c.description,
      icon: c.icon,
      category: c.category,
      rarity: c.rarity,
      effectType: c.effectType,
      price: c.price,
      stock: c.stock,
      enabled: c.enabled,
      requiresApproval: c.requiresApproval,
      usesPerTeam: c.usesPerTeam,
      priceMode: c.priceMode,
    })
  );
}

export interface TeamPowerCardRecord {
  teamId: string;
  powerCardId: string;
  remainingUses: number;
  status: PowerCardStatus;
}

/** Every team's owned power-card copies, for the teams in a room. */
export async function getTeamPowerCardsByRoom(
  teamIds: string[]
): Promise<TeamPowerCardRecord[]> {
  if (teamIds.length === 0) return [];
  await connectToDatabase();
  const owned = await TeamPowerCard.find({ teamId: { $in: teamIds } }).lean();
  return owned.map((o) =>
    serialize<TeamPowerCardRecord>({
      teamId: o.teamId.toString(),
      powerCardId: o.powerCardId.toString(),
      remainingUses: o.remainingUses,
      status: o.status,
    })
  );
}

export interface CoinTransactionRecord {
  id: string;
  teamId: string;
  amount: number;
  type: CoinTransactionType;
  reason?: string;
  createdAt: string;
}

/** Recent coin transactions for the teams in a room — the purchase/adjustment ledger. */
export async function getCoinTransactionsByRoom(roomId: string): Promise<CoinTransactionRecord[]> {
  await connectToDatabase();
  const transactions = await CoinTransaction.find({ roomId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return transactions.map((t) =>
    serialize<CoinTransactionRecord>({
      id: t._id.toString(),
      teamId: t.teamId.toString(),
      amount: t.amount,
      type: t.type,
      reason: t.reason,
      createdAt: t.createdAt,
    })
  );
}

export interface PowerCardRequestRecord {
  id: string;
  roomId: string;
  teamId: string;
  teamName: string;
  teamColor?: string;
  powerCardId: string;
  powerCardName: string;
  powerCardIcon: string;
  status: PowerCardRequestStatus;
  createdAt: string;
}

export async function getPowerCardRequestsByRoom(roomId: string): Promise<PowerCardRequestRecord[]> {
  await connectToDatabase();
  const requests = await PowerCardRequest.find({ roomId }).sort({ createdAt: -1 }).limit(25).lean();
  if (requests.length === 0) return [];

  const teamIds = [...new Set(requests.map((request) => request.teamId.toString()))];
  const cardIds = [...new Set(requests.map((request) => request.powerCardId.toString()))];
  const [teams, cards] = await Promise.all([
    Team.find({ _id: { $in: teamIds } }).select("name color").lean(),
    PowerCard.find({ _id: { $in: cardIds } }).select("name icon").lean(),
  ]);
  const teamMap = new Map(teams.map((team) => [team._id.toString(), team]));
  const cardMap = new Map(cards.map((card) => [card._id.toString(), card]));

  return requests.map((request) => {
    const team = teamMap.get(request.teamId.toString());
    const card = cardMap.get(request.powerCardId.toString());
    return serialize<PowerCardRequestRecord>({
      id: request._id.toString(),
      roomId: request.roomId.toString(),
      teamId: request.teamId.toString(),
      teamName: team?.name ?? "Team",
      teamColor: team?.color,
      powerCardId: request.powerCardId.toString(),
      powerCardName: card?.name ?? "Power card",
      powerCardIcon: card?.icon ?? "*",
      status: request.status,
      createdAt: request.createdAt,
    });
  });
}
