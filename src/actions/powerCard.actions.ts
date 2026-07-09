"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { PowerCard, Team, PowerCardRequest, TeamPowerCard, Room, Round, EventLog } from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoomOwnership, assertPowerCardOwnership } from "@/lib/authz";
import { assertTeamController } from "@/lib/teamRoles";
import { createCoinTransaction } from "@/actions/coin.actions";
import { DEFAULT_POWER_CARDS } from "@/lib/defaultPowerCards";
import { effectivePrice } from "@/lib/storePricing";
import {
  createPowerCardSchema,
  updatePowerCardSchema,
  type CreatePowerCardInput,
} from "@/validators/powerCard.validator";
import type { IPowerCardRequest } from "@/types/db";

function refreshCatalogPaths() {
  revalidatePath("/admin/power-cards");
  revalidatePath("/admin/rounds");
}

/**
 * Seeds the host's global catalog with the default Power Card set the first
 * time they have none — so a Round Builder's Power Cards tab never opens
 * empty. A no-op for a host who already has any cards (including ones they
 * deleted down to a partial set on purpose).
 */
export async function seedDefaultPowerCards(): Promise<void> {
  const user = await requireUser();
  await connectToDatabase();

  const hasExistingCards = await PowerCard.exists({ ownerId: user.id });
  if (hasExistingCards) return;

  await PowerCard.insertMany(
    DEFAULT_POWER_CARDS.map((card) => ({
      ownerId: user.id,
      name: card.name,
      description: card.description,
      icon: card.icon,
      category: card.category,
      rarity: card.rarity,
      effectType: card.effectType,
      price: card.price,
      stock: null,
      enabled: true,
      requiresApproval: true,
      usesPerTeam: 1,
      priceMode: "FIXED",
    }))
  );
}

/**
 * A round with `powerCardMode: "CUSTOM"` restricts play to its
 * `allowedPowerCards` list. The host can force-enable an otherwise-disallowed
 * card for this room's live event via `Room.powerCardOverrides` — host
 * judgment always wins over a setting decided before the event started.
 * No active round, or a round left on "DEFAULT", means no restriction at all.
 */
async function assertPowerCardAllowedForRoom(
  room: { currentRoundId: unknown; powerCardOverrides: string[] },
  powerCardId: string
): Promise<void> {
  if (!room.currentRoundId) return;
  const round = await Round.findById(room.currentRoundId).select("powerCardMode allowedPowerCards").lean();
  if (!round || round.powerCardMode !== "CUSTOM") return;

  const allowed =
    round.allowedPowerCards.includes(powerCardId) || room.powerCardOverrides.includes(powerCardId);
  if (!allowed) throw new Error("This power card isn't allowed in the current round.");
}

/** Create a power card in the host's global catalog. Card names must be unique per host (case-insensitive). */
export async function createPowerCard(
  input: CreatePowerCardInput
): Promise<{ id: string }> {
  const user = await requireUser();
  const data = createPowerCardSchema.parse(input);

  await connectToDatabase();

  const existing = await PowerCard.findOne({
    ownerId: user.id,
    name: { $regex: `^${data.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  }).select("_id").lean();
  if (existing) throw new Error(`A power card named "${data.name.trim()}" already exists.`);

  const card = await PowerCard.create({ ownerId: user.id, ...data });

  refreshCatalogPaths();
  return { id: card._id.toString() };
}

export interface UpdatePowerCardArgs {
  powerCardId: string;
  changes: Partial<CreatePowerCardInput>;
}

/** Host edits a card — price, stock, enabled state, or any other field. Renaming still enforces per-host name uniqueness. */
export async function updatePowerCard({ powerCardId, changes }: UpdatePowerCardArgs): Promise<void> {
  const user = await requireUser();
  await assertPowerCardOwnership(powerCardId, user.id);
  const data = updatePowerCardSchema.parse(changes);

  await connectToDatabase();

  if (data.name) {
    const existing = await PowerCard.findOne({
      ownerId: user.id,
      _id: { $ne: powerCardId },
      name: { $regex: `^${data.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    }).select("_id").lean();
    if (existing) throw new Error(`A power card named "${data.name.trim()}" already exists.`);
  }

  await PowerCard.findByIdAndUpdate(powerCardId, { $set: data });

  refreshCatalogPaths();
}

export async function deletePowerCard(powerCardId: string): Promise<void> {
  const user = await requireUser();
  await assertPowerCardOwnership(powerCardId, user.id);

  await connectToDatabase();
  await PowerCard.findByIdAndDelete(powerCardId);
  await Promise.all([
    Round.updateMany({ allowedPowerCards: powerCardId }, { $pull: { allowedPowerCards: powerCardId } }),
    TeamPowerCard.deleteMany({ powerCardId }),
    PowerCardRequest.deleteMany({ powerCardId }),
  ]);

  refreshCatalogPaths();
}

export interface AssignmentInput {
  powerCardId: string;
  uses: number;
}

/**
 * Simple Mode: host directly grants the selected cards to every team in a
 * room, no coins involved. Upserts so re-running (e.g. after adding a team)
 * doesn't duplicate grants.
 */
export async function assignPowerCardsToRoom(
  roomId: string,
  assignments: AssignmentInput[]
): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const teams = await Team.find({ roomId }).select("_id").lean();
  if (teams.length === 0) throw new Error("Add teams before assigning power cards.");

  const validAssignments = assignments.filter((a) => a.uses > 0);
  if (validAssignments.length === 0) throw new Error("Choose at least one card with uses > 0.");

  const operations = teams.flatMap((team) =>
    validAssignments.map((a) => ({
      updateOne: {
        filter: { teamId: team._id, powerCardId: a.powerCardId },
        update: { $set: { remainingUses: a.uses, status: "AVAILABLE" as const } },
        upsert: true,
      },
    }))
  );

  await TeamPowerCard.bulkWrite(operations);
  revalidatePath(`/rooms/${roomId}`);
}

/** Host grants one free card to one team — an Economy Mode override, no coins spent. */
export async function giveFreeCard(
  roomId: string,
  teamId: string,
  powerCardId: string
): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const card = await PowerCard.findById(powerCardId).lean();
  if (!card) throw new Error("Power card not found.");

  await TeamPowerCard.findOneAndUpdate(
    { teamId, powerCardId },
    { $inc: { remainingUses: card.usesPerTeam }, $set: { status: "AVAILABLE" } },
    { upsert: true }
  );

  await EventLog.create({
    roomId,
    type: "POWER_CARD_USED",
    metadata: { teamId, powerCardId, source: "HOST_GIFT" },
  });

  revalidatePath(`/rooms/${roomId}`);
}

/**
 * Economy Mode: a team buys a card from the open store. Atomically checks
 * and decrements stock (when limited) to avoid overselling under concurrent
 * purchases, then debits coins and credits the card to the team's inventory.
 */
export async function purchasePowerCard(
  roomId: string,
  teamId: string,
  powerCardId: string,
  participantId?: string
): Promise<void> {
  await connectToDatabase();

  // Only the team's captain (or acting captain) may spend team coins.
  await assertTeamController(teamId, participantId);

  const room = await Room.findById(roomId).lean();
  if (!room) throw new Error("Room not found.");
  if (room.liveState.storeStatus !== "OPEN") throw new Error("The store is closed right now.");
  await assertPowerCardAllowedForRoom(room, powerCardId);

  const card = await PowerCard.findById(powerCardId).lean();
  if (!card) throw new Error("Power card not found.");
  if (!card.enabled) throw new Error("This card is not available.");

  // Charge the live price — a flash sale discounts what the team actually pays.
  const price = effectivePrice(card.price, room.liveState);
  const team = await Team.findById(teamId).lean();
  if (!team) throw new Error("Team not found.");
  if (team.coins < price) throw new Error("Not enough coins for this card.");

  // Atomic stock guard: only decrements if stock is still > 0 (or unlimited).
  const stockFilter =
    card.stock === null ? { _id: powerCardId } : { _id: powerCardId, stock: { $gt: 0 } };
  const stockUpdate = card.stock === null ? {} : { $inc: { stock: -1 } };
  const reserved = await PowerCard.findOneAndUpdate(stockFilter, stockUpdate);
  if (!reserved) throw new Error("Sold out.");

  await createCoinTransaction({
    roomId,
    teamId,
    amount: -price,
    type: "CARD_PURCHASE",
    reason: `Bought ${card.name}`,
  });

  await EventLog.create({
    roomId,
    type: "CARD_PURCHASED",
    metadata: { teamId, powerCardId, price },
  });

  // A Mystery Box is a gamble: instead of landing in the inventory, it rolls a
  // random reward on the spot (bonus coins or a surprise card).
  if (card.effectType === "MYSTERY") {
    await resolveMysteryReward(roomId, teamId, card.ownerId.toString(), price);
  } else {
    await TeamPowerCard.findOneAndUpdate(
      { teamId, powerCardId },
      { $inc: { remainingUses: card.usesPerTeam }, $set: { status: "AVAILABLE" } },
      { upsert: true }
    );
  }

  revalidatePath(`/rooms/${roomId}`);
}

/** Roll a Mystery Box: ~55% bonus coins, ~45% a random surprise power card. */
async function resolveMysteryReward(
  roomId: string,
  teamId: string,
  ownerId: string,
  spent: number
): Promise<void> {
  const coinOutcomes = [Math.round(spent * 0.5), spent, Math.round(spent * 1.5), spent * 2];
  const rollCoins = Math.random() < 0.55;

  if (rollCoins) {
    const amount = coinOutcomes[Math.floor(Math.random() * coinOutcomes.length)] || 100;
    await createCoinTransaction({
      roomId,
      teamId,
      amount,
      type: "HOST_ADJUSTMENT",
      reason: "Mystery Box reward",
    });
    await EventLog.create({
      roomId,
      type: "REWARD_DROP",
      metadata: { teamId, text: `Mystery Box → +${amount} coins`, source: "MYSTERY" },
    });
    return;
  }

  const pool = await PowerCard.find({
    ownerId,
    enabled: true,
    effectType: { $ne: "MYSTERY" },
  })
    .select("_id name usesPerTeam")
    .lean();

  if (pool.length === 0) {
    // No card to grant — fall back to a coin reward so the box always pays out.
    await createCoinTransaction({ roomId, teamId, amount: spent, type: "HOST_ADJUSTMENT", reason: "Mystery Box reward" });
    await EventLog.create({ roomId, type: "REWARD_DROP", metadata: { teamId, text: `Mystery Box → +${spent} coins`, source: "MYSTERY" } });
    return;
  }

  const prize = pool[Math.floor(Math.random() * pool.length)];
  await TeamPowerCard.findOneAndUpdate(
    { teamId, powerCardId: prize._id },
    { $inc: { remainingUses: prize.usesPerTeam || 1 }, $set: { status: "AVAILABLE" } },
    { upsert: true }
  );
  await EventLog.create({
    roomId,
    type: "REWARD_DROP",
    metadata: { teamId, text: `Mystery Box → ${prize.name}`, source: "MYSTERY" },
  });
}

export interface RequestPowerCardInput {
  roomId: string;
  teamId: string;
  powerCardId: string;
  targetTeamId?: string | null;
  participantId?: string;
}

/**
 * A team requests to use an owned power card. If the card doesn't require
 * approval, it activates immediately; otherwise it waits for the host.
 * Only the team's captain device (or acting captain) may request.
 */
export async function requestPowerCard(
  input: RequestPowerCardInput
): Promise<IPowerCardRequest> {
  await connectToDatabase();

  await assertTeamController(input.teamId, input.participantId);

  const room = await Room.findById(input.roomId).lean();
  if (!room) throw new Error("Room not found.");
  await assertPowerCardAllowedForRoom(room, input.powerCardId);

  let owned = await TeamPowerCard.findOne({
    teamId: input.teamId,
    powerCardId: input.powerCardId,
    status: "AVAILABLE",
    remainingUses: { $gt: 0 },
  });

  const card = await PowerCard.findById(input.powerCardId).lean();
  if (!card) throw new Error("Power card not found.");

  const skipApproval = !card.requiresApproval;
  if (!owned) {
    owned = await TeamPowerCard.findOneAndUpdate(
      { teamId: input.teamId, powerCardId: input.powerCardId },
      {
        $set: {
          remainingUses: 1,
          status: skipApproval ? "ACTIVE" : "REQUESTED",
        },
      },
      { upsert: true, new: true }
    );
  }
  if (!owned) throw new Error("Could not prepare this card request.");
  owned.status = skipApproval ? "ACTIVE" : "REQUESTED";
  await owned.save();

  const request = await PowerCardRequest.create({
    roomId: input.roomId,
    teamId: input.teamId,
    powerCardId: input.powerCardId,
    targetTeamId: input.targetTeamId ?? null,
    status: skipApproval ? "ACTIVE" : "REQUESTED",
    approvedBy: null,
  });

  await EventLog.create({
    roomId: input.roomId,
    type: skipApproval ? "POWER_CARD_USED" : "POWER_CARD_REQUESTED",
    metadata: {
      teamId: input.teamId,
      powerCardId: input.powerCardId,
      targetTeamId: input.targetTeamId ?? null,
    },
  });

  revalidatePath(`/rooms/${input.roomId}`);
  return request.toObject() as IPowerCardRequest;
}

/**
 * Host approves (or rejects) a pending request. Approval does not activate
 * the effect yet; the host controls that transition separately.
 */
export async function approvePowerCard(
  requestId: string,
  approvedBy: string,
  approve = true
): Promise<IPowerCardRequest | null> {
  await connectToDatabase();

  const request = await PowerCardRequest.findById(requestId);
  if (!request) throw new Error("Power card request not found.");
  if (request.status !== "REQUESTED") {
    throw new Error(`Request already ${request.status.toLowerCase()}.`);
  }

  if (!approve) {
    request.status = "REJECTED";
    request.approvedBy = approvedBy as unknown as IPowerCardRequest["approvedBy"];
    await TeamPowerCard.findOneAndUpdate(
      { teamId: request.teamId, powerCardId: request.powerCardId, status: "REQUESTED" },
      { status: "AVAILABLE" }
    );
    await request.save();
    revalidatePath(`/rooms/${request.roomId.toString()}`);
    return request.toObject() as IPowerCardRequest;
  }

  const owned = await TeamPowerCard.findOneAndUpdate(
    {
      teamId: request.teamId,
      powerCardId: request.powerCardId,
      status: "REQUESTED",
      remainingUses: { $gt: 0 },
    },
    { status: "APPROVED" }
  );
  if (!owned) throw new Error("Team no longer has a requested copy of this card.");

  request.status = "APPROVED";
  request.approvedBy = approvedBy as unknown as IPowerCardRequest["approvedBy"];
  await request.save();

  revalidatePath(`/rooms/${request.roomId.toString()}`);
  return request.toObject() as IPowerCardRequest;
}

export async function resolvePowerCardRequest(
  requestId: string,
  approve = true
): Promise<IPowerCardRequest | null> {
  const user = await requireUser();
  await connectToDatabase();
  const request = await PowerCardRequest.findById(requestId).select("roomId").lean();
  if (!request) throw new Error("Power card request not found.");
  await assertRoomOwnership(request.roomId.toString(), user.id);
  return approvePowerCard(requestId, user.id, approve);
}

/** Host activates an approved card when the effect should actually begin. */
export async function activatePowerCard(requestId: string): Promise<IPowerCardRequest> {
  await connectToDatabase();

  const request = await PowerCardRequest.findById(requestId);
  if (!request) throw new Error("Power card request not found.");
  if (request.status !== "APPROVED") {
    throw new Error(`Request is ${request.status.toLowerCase()}, not approved.`);
  }

  const owned = await TeamPowerCard.findOneAndUpdate(
    {
      teamId: request.teamId,
      powerCardId: request.powerCardId,
      status: "APPROVED",
      remainingUses: { $gt: 0 },
    },
    { status: "ACTIVE" }
  );
  if (!owned) throw new Error("Team has no approved copy of this card.");

  request.status = "ACTIVE";
  await request.save();

  await EventLog.create({
    roomId: request.roomId,
    type: "POWER_CARD_USED",
    metadata: {
      teamId: request.teamId.toString(),
      powerCardId: request.powerCardId.toString(),
      requestId,
    },
  });

  revalidatePath(`/rooms/${request.roomId.toString()}`);
  return request.toObject() as IPowerCardRequest;
}

export async function hostActivatePowerCard(requestId: string): Promise<IPowerCardRequest> {
  const user = await requireUser();
  await connectToDatabase();
  const request = await PowerCardRequest.findById(requestId).select("roomId").lean();
  if (!request) throw new Error("Power card request not found.");
  await assertRoomOwnership(request.roomId.toString(), user.id);
  return activatePowerCard(requestId);
}

/**
 * Host skips the approve step and activates a still-pending request in one
 * click — useful when a team asks verbally instead of through the app. Host
 * judgment always overrides the normal approval flow.
 */
export async function hostForceActivatePowerCard(requestId: string): Promise<IPowerCardRequest> {
  const user = await requireUser();
  await connectToDatabase();
  const request = await PowerCardRequest.findById(requestId).select("roomId status").lean();
  if (!request) throw new Error("Power card request not found.");
  await assertRoomOwnership(request.roomId.toString(), user.id);

  if (request.status === "REQUESTED") await approvePowerCard(requestId, user.id, true);
  return activatePowerCard(requestId);
}

/** Host marks an active card consumed after the effect has resolved. */
export async function consumePowerCard(requestId: string): Promise<IPowerCardRequest> {
  await connectToDatabase();

  const request = await PowerCardRequest.findById(requestId);
  if (!request) throw new Error("Power card request not found.");
  if (request.status !== "ACTIVE") {
    throw new Error(`Request is ${request.status.toLowerCase()}, not active.`);
  }

  const owned = await TeamPowerCard.findOne({
    teamId: request.teamId,
    powerCardId: request.powerCardId,
    status: "ACTIVE",
    remainingUses: { $gt: 0 },
  });
  if (!owned) throw new Error("Team has no active copy of this card.");

  owned.remainingUses -= 1;
  owned.status = owned.remainingUses <= 0 ? "CONSUMED" : "AVAILABLE";
  await owned.save();

  request.status = "CONSUMED";
  await request.save();

  revalidatePath(`/rooms/${request.roomId.toString()}`);
  return request.toObject() as IPowerCardRequest;
}

export async function hostConsumePowerCard(requestId: string): Promise<IPowerCardRequest> {
  const user = await requireUser();
  await connectToDatabase();
  const request = await PowerCardRequest.findById(requestId).select("roomId").lean();
  if (!request) throw new Error("Power card request not found.");
  await assertRoomOwnership(request.roomId.toString(), user.id);
  return consumePowerCard(requestId);
}

/** Host opens the store so teams can spend coins on cards. */
export async function openStore(roomId: string): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  await Room.findByIdAndUpdate(roomId, { $set: { "liveState.storeStatus": "OPEN" } });
  await EventLog.create({ roomId, type: "STORE_OPENED", metadata: {} });

  revalidatePath(`/rooms/${roomId}`);
}

/** Host closes the store. */
export async function closeStore(roomId: string): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  await Room.findByIdAndUpdate(roomId, { $set: { "liveState.storeStatus": "CLOSED" } });
  await EventLog.create({ roomId, type: "STORE_CLOSED", metadata: {} });

  revalidatePath(`/rooms/${roomId}`);
}

/**
 * Host kicks off a timed flash sale — every card is discounted by `percent`
 * for `minutes`. Also opens the store so teams can actually act on it.
 */
export async function startFlashSale(roomId: string, percent: number, minutes: number): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const pct = Math.min(90, Math.max(5, Math.round(percent)));
  const mins = Math.min(30, Math.max(1, Math.round(minutes)));
  const endsAt = new Date(Date.now() + mins * 60_000);

  await Room.findByIdAndUpdate(roomId, {
    $set: {
      "liveState.storeStatus": "OPEN",
      "liveState.flashSaleActive": true,
      "liveState.flashSalePercent": pct,
      "liveState.flashSaleEndsAt": endsAt,
    },
  });
  await EventLog.create({
    roomId,
    type: "FLASH_SALE_STARTED",
    metadata: { percent: pct, minutes: mins, text: `Flash Sale — ${pct}% off for ${mins} min` },
  });

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/host/${roomId}`);
}

/** Host ends the flash sale early. */
export async function endFlashSale(roomId: string): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  await Room.findByIdAndUpdate(roomId, {
    $set: { "liveState.flashSaleActive": false, "liveState.flashSalePercent": 0, "liveState.flashSaleEndsAt": null },
  });

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/host/${roomId}`);
}

/**
 * Host surprise: every team gets a random coin gift. A single REWARD_DROP event
 * announces it (drives the phone "moment"), plus a coin ledger row per team.
 */
export async function freeRewardDrop(roomId: string): Promise<void> {
  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const teams = await Team.find({ roomId }).select("_id").lean();
  if (teams.length === 0) return;

  const gifts = [200, 300, 500, 750, 1000];
  for (const team of teams) {
    const amount = gifts[Math.floor(Math.random() * gifts.length)];
    await createCoinTransaction({
      roomId,
      teamId: team._id.toString(),
      amount,
      type: "HOST_ADJUSTMENT",
      reason: "Free reward drop 🎁",
      createdBy: user.id,
    });
  }

  await EventLog.create({
    roomId,
    type: "REWARD_DROP",
    metadata: { text: "Free Reward Drop — every team got a gift!", source: "HOST_DROP" },
  });

  revalidatePath(`/rooms/${roomId}`);
  revalidatePath(`/host/${roomId}`);
}

/**
 * Host forces a power card on (or removes the override) for this room's live
 * event, regardless of the current round's `allowedPowerCards` setting.
 * Doesn't touch the round in the library — this is a live-only, this-room-only
 * decision, since the same round may run unmodified in other rooms.
 */
export async function toggleRoomPowerCardOverride(roomId: string, powerCardId: string): Promise<void> {
  const user = await requireUser();
  const room = await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const isOverridden = room.powerCardOverrides.includes(powerCardId);
  await Room.findByIdAndUpdate(roomId, {
    [isOverridden ? "$pull" : "$addToSet"]: { powerCardOverrides: powerCardId },
  });

  revalidatePath(`/host/${roomId}`);
  revalidatePath(`/admin/rooms/${roomId}`);
}

/** Host revokes a team's copy of a power card outright — corrects a mistaken grant or purchase. */
export async function hostRemoveTeamPowerCard(teamId: string, powerCardId: string): Promise<void> {
  const user = await requireUser();
  await connectToDatabase();

  const team = await Team.findById(teamId).select("roomId").lean();
  if (!team) throw new Error("Team not found.");
  await assertRoomOwnership(team.roomId.toString(), user.id);

  await TeamPowerCard.findOneAndDelete({ teamId, powerCardId });
  await EventLog.create({
    roomId: team.roomId,
    type: "POWER_CARD_USED",
    metadata: { teamId, powerCardId, source: "HOST_REMOVED" },
  });

  revalidatePath(`/host/${team.roomId.toString()}`);
  revalidatePath(`/admin/rooms/${team.roomId.toString()}`);
}
