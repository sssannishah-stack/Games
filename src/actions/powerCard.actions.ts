"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { PowerCard, Team, PowerCardRequest, TeamPowerCard, Room, Round, EventLog } from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoomOwnership, assertPowerCardOwnership } from "@/lib/authz";
import { createCoinTransaction } from "@/actions/coin.actions";
import { DEFAULT_POWER_CARDS } from "@/lib/defaultPowerCards";
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

/** Create a power card in the host's global catalog. */
export async function createPowerCard(
  input: CreatePowerCardInput
): Promise<{ id: string }> {
  const user = await requireUser();
  const data = createPowerCardSchema.parse(input);

  await connectToDatabase();
  const card = await PowerCard.create({ ownerId: user.id, ...data });

  refreshCatalogPaths();
  return { id: card._id.toString() };
}

export interface UpdatePowerCardArgs {
  powerCardId: string;
  changes: Partial<CreatePowerCardInput>;
}

/** Host edits a card — price, stock, enabled state, or any other field. */
export async function updatePowerCard({ powerCardId, changes }: UpdatePowerCardArgs): Promise<void> {
  const user = await requireUser();
  await assertPowerCardOwnership(powerCardId, user.id);
  const data = updatePowerCardSchema.parse(changes);

  await connectToDatabase();
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
  powerCardId: string
): Promise<void> {
  await connectToDatabase();

  const room = await Room.findById(roomId).lean();
  if (!room) throw new Error("Room not found.");
  if (room.liveState.storeStatus !== "OPEN") throw new Error("The store is closed right now.");
  await assertPowerCardAllowedForRoom(room, powerCardId);

  const card = await PowerCard.findById(powerCardId).lean();
  if (!card) throw new Error("Power card not found.");
  if (!card.enabled) throw new Error("This card is not available.");

  const team = await Team.findById(teamId).lean();
  if (!team) throw new Error("Team not found.");
  if (team.coins < card.price) throw new Error("Not enough coins for this card.");

  // Atomic stock guard: only decrements if stock is still > 0 (or unlimited).
  const stockFilter =
    card.stock === null ? { _id: powerCardId } : { _id: powerCardId, stock: { $gt: 0 } };
  const stockUpdate = card.stock === null ? {} : { $inc: { stock: -1 } };
  const reserved = await PowerCard.findOneAndUpdate(stockFilter, stockUpdate);
  if (!reserved) throw new Error("Sold out.");

  await createCoinTransaction({
    roomId,
    teamId,
    amount: -card.price,
    type: "CARD_PURCHASE",
    reason: `Bought ${card.name}`,
  });

  await TeamPowerCard.findOneAndUpdate(
    { teamId, powerCardId },
    { $inc: { remainingUses: card.usesPerTeam }, $set: { status: "AVAILABLE" } },
    { upsert: true }
  );

  await EventLog.create({
    roomId,
    type: "CARD_PURCHASED",
    metadata: { teamId, powerCardId, price: card.price },
  });

  revalidatePath(`/rooms/${roomId}`);
}

export interface RequestPowerCardInput {
  roomId: string;
  teamId: string;
  powerCardId: string;
  targetTeamId?: string | null;
}

/**
 * A team requests to use an owned power card. If the card doesn't require
 * approval, it activates immediately; otherwise it waits for the host.
 */
export async function requestPowerCard(
  input: RequestPowerCardInput
): Promise<IPowerCardRequest> {
  await connectToDatabase();

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
