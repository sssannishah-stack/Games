import "server-only";

import { PowerCard, Room, TeamPowerCard } from "@/models";

/**
 * The small, predictable hand every team receives automatically.
 * These are intentionally low-impact HELP cards and activate immediately;
 * the round allow-list remains the host's live permission boundary.
 */
export const STARTER_POWER_CARD_NAMES = ["Hint", "Extra Time"] as const;

export async function ensureStarterPowerCardsForTeams(
  teamIds: string[],
  ownerId: string
): Promise<void> {
  if (teamIds.length === 0) return;

  const starterCards = await PowerCard.find({
    ownerId,
    enabled: true,
    name: { $in: STARTER_POWER_CARD_NAMES },
  })
    .select("_id name")
    .lean();

  const cardByName = new Map(starterCards.map((card) => [card.name, card]));
  const orderedCards = STARTER_POWER_CARD_NAMES.map((name) => cardByName.get(name)).filter(
    (card): card is NonNullable<typeof card> => Boolean(card)
  );
  if (orderedCards.length === 0) return;

  // Starter cards never need a second host click. The round configuration is
  // already the host's permission: disallowed cards are hidden and rejected.
  await PowerCard.updateMany(
    { _id: { $in: orderedCards.map((card) => card._id) } },
    { $set: { requiresApproval: false } }
  );

  await TeamPowerCard.bulkWrite(
    teamIds.flatMap((teamId) =>
      orderedCards.map((card) => ({
        updateOne: {
          filter: { teamId, powerCardId: card._id },
          update: {
            $setOnInsert: {
              remainingUses: 1,
              status: "AVAILABLE" as const,
            },
          },
          upsert: true,
        },
      }))
    )
  );
}

async function roomDefaults(roomId: string, ownerId: string) {
  const room = await Room.findById(roomId).select("powerCardDefaults").lean();
  const defaults = room?.powerCardDefaults ?? [];
  if (defaults.length === 0) return [];
  const cardIds = defaults.map((item) => item.powerCardId);
  const cards = await PowerCard.find({ _id: { $in: cardIds }, ownerId, enabled: true })
    .select("_id")
    .lean();
  const validIds = new Set(cards.map((card) => card._id.toString()));
  return defaults.filter((item) => validIds.has(item.powerCardId) && item.uses > 0);
}

/** Ensures a new/existing team has the room's configured baseline inventory. */
export async function ensureRoomDefaultPowerCardsForTeams(
  teamIds: string[],
  roomId: string,
  ownerId: string
): Promise<void> {
  if (teamIds.length === 0) return;
  const defaults = await roomDefaults(roomId, ownerId);
  if (defaults.length === 0) {
    await ensureStarterPowerCardsForTeams(teamIds, ownerId);
    return;
  }

  await TeamPowerCard.bulkWrite(
    teamIds.flatMap((teamId) =>
      defaults.map((item) => ({
        updateOne: {
          filter: { teamId, powerCardId: item.powerCardId },
          update: {
            $setOnInsert: { remainingUses: item.uses, status: "AVAILABLE" as const },
          },
          upsert: true,
        },
      }))
    )
  );
}

/** Deletes live/purchased inventory and restores the exact room baseline. */
export async function resetRoomPowerCardsToDefaults(
  teamIds: string[],
  roomId: string,
  ownerId: string
): Promise<void> {
  await TeamPowerCard.deleteMany({ teamId: { $in: teamIds } });
  await ensureRoomDefaultPowerCardsForTeams(teamIds, roomId, ownerId);
}
