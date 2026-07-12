"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { PowerCard, Team, PowerCardRequest, TeamPowerCard, Room, Round, Scene, EventLog, Competition, Question } from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoomOwnership, assertPowerCardOwnership } from "@/lib/authz";
import { assertTeamController } from "@/lib/teamRoles";
import { powerCardPlayability } from "@/lib/powerCardPlay";
import { createCoinTransaction } from "@/actions/coin.actions";
import { DEFAULT_POWER_CARDS } from "@/lib/defaultPowerCards";
import { effectivePrice } from "@/lib/storePricing";
import {
  createPowerCardSchema,
  updatePowerCardSchema,
  type CreatePowerCardInput,
} from "@/validators/powerCard.validator";
import type { IPowerCardRequest, PowerCardRequestStatus } from "@/types/db";

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

  // This runs on every Round Builder / Room Setup page load, which in turn
  // reruns on every router.refresh() after a click — so the steady-state
  // path (a host who already has a reconciled catalog) must cost exactly
  // one cheap read, not an unconditional write every time.
  const existingDefaults = await PowerCard.find({
    ownerId: user.id,
    name: { $in: DEFAULT_POWER_CARDS.map((card) => card.name) },
  })
    .select("name requiresApproval")
    .lean();

  if (existingDefaults.length === 0) {
    const hasExistingCards = await PowerCard.exists({ ownerId: user.id });
    if (hasExistingCards) return; // host kept only custom cards on purpose
  }

  // Upsert one card per (owner, name) rather than a blanket insertMany.
  // insertMany was racy: two concurrent page loads could each see an empty
  // catalog and both insert the whole set — the exact bug that produced 4x
  // duplicate cards. Upsert keyed on the unique (ownerId, name) index is
  // idempotent, so concurrent seeds converge on a single copy per card and
  // this also backfills any cards a host deleted individually.
  const existingNames = new Set(existingDefaults.map((card) => card.name));
  const missing = DEFAULT_POWER_CARDS.filter((card) => !existingNames.has(card.name));
  if (missing.length > 0) {
    await PowerCard.bulkWrite(
      missing.map((card) => ({
        updateOne: {
          // ownerId + name come from the filter on insert — no need to
          // repeat them in $setOnInsert (and doing so mistypes ownerId).
          filter: { ownerId: user.id, name: card.name },
          update: {
            $setOnInsert: {
              description: card.description,
              icon: card.icon,
              category: card.category,
              rarity: card.rarity,
              effectType: card.effectType,
              price: card.price,
              stock: null,
              enabled: true,
              // Instant use: "Use Power" activates immediately — no approval
              // step. Hosts can re-enable approval per card.
              requiresApproval: false,
              usesPerTeam: 1,
              priceMode: "FIXED",
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }

  // Reconcile catalogs seeded back when defaults still required host
  // approval — only write if one of them is actually still stale.
  const needsReconcile = existingDefaults.some((card) => card.requiresApproval);
  if (needsReconcile) {
    await PowerCard.updateMany(
      { ownerId: user.id, name: { $in: DEFAULT_POWER_CARDS.map((card) => card.name) } },
      { $set: { requiresApproval: false } }
    );
  }
}

/**
 * A round with `powerCardMode: "CUSTOM"` restricts play to its
 * `allowedPowerCards` list. The host can force-enable an otherwise-disallowed
 * card for this room's live event via `Room.powerCardOverrides` — host
 * judgment always wins over a setting decided before the event started.
 * No active round, or a round left on "DEFAULT", means no restriction at all.
 */
async function assertPowerCardAllowedForRoom(
  room: { currentRoundId: unknown; powerCardOverrides: string[]; powerCardExclusions: string[] },
  powerCardId: string
): Promise<void> {
  if (room.powerCardExclusions.includes(powerCardId)) {
    throw new Error("This power card has been turned off for this event.");
  }
  if (!room.currentRoundId) return;
  const round = await Round.findById(room.currentRoundId).select("powerCardMode allowedPowerCards").lean();
  if (!round || round.powerCardMode !== "CUSTOM") return;

  const allowed =
    round.allowedPowerCards.includes(powerCardId) || room.powerCardOverrides.includes(powerCardId);
  if (!allowed) throw new Error("This power card isn't allowed in the current round.");
}

async function getEnabledPowerCardForRoom(
  room: { competitionId: unknown },
  powerCardId: string
) {
  const competition = await Competition.findById(room.competitionId).select("ownerId").lean();
  if (!competition) throw new Error("Competition not found.");

  const card = await PowerCard.findOne({
    _id: powerCardId,
    ownerId: competition.ownerId,
    enabled: true,
  }).lean();
  if (!card) throw new Error("This power card is not available in this room.");
  return card;
}

/**
 * Insurance grants negative-mark immunity for the next three questions — the
 * one live when it is used plus the next two, by the room's flow order. We
 * store the covered question ids on the team; giveMarks reads them to
 * auto-void penalties.
 */
async function applyInsuranceCoverage(roomId: string, teamId: string): Promise<void> {
  const room = await Room.findById(roomId).select("currentQuestionId").lean();
  if (!room) return;

  // Distinct question ids in flow order across the room's QUESTION scenes.
  const questionScenes = await Scene.find({ roomId, type: "QUESTION", questionId: { $ne: null } })
    .sort({ order: 1 })
    .select("questionId")
    .lean();
  const order: string[] = [];
  for (const scene of questionScenes) {
    const qid = scene.questionId?.toString();
    if (qid && !order.includes(qid)) order.push(qid);
  }
  if (order.length === 0) return;

  // Start at the live question; if none is active yet, cover from the first.
  const startId = room.currentQuestionId ? room.currentQuestionId.toString() : order[0];
  const startIndex = order.indexOf(startId);
  const window = startIndex >= 0 ? order.slice(startIndex, startIndex + 3) : order.slice(0, 3);
  if (window.length === 0) return;

  await Team.findByIdAndUpdate(teamId, { $addToSet: { insuredQuestionIds: { $each: window } } });
}

/** Push the live countdown forward by `seconds` (Extra Time / Hint). No-op if
 *  no timer is currently set. Extends from whichever is later — the current
 *  end or now — so it always adds real time. */
async function extendRoomTimer(roomId: string, seconds: number): Promise<void> {
  const room = await Room.findById(roomId).select("liveState.timerEndsAt").lean();
  const endsAt = room?.liveState?.timerEndsAt;
  if (!endsAt) return;
  const base = Math.max(new Date(endsAt).getTime(), Date.now());
  await Room.findByIdAndUpdate(roomId, {
    $set: { "liveState.timerEndsAt": new Date(base + seconds * 1000), "liveState.timerPaused": false },
  });
}

/** Reveal the next hint to this team for the live question, and add 10s. */
async function applyHintReveal(roomId: string, teamId: string): Promise<void> {
  const room = await Room.findById(roomId).select("currentQuestionId").lean();
  const questionId = room?.currentQuestionId?.toString();
  if (!questionId) return;

  const bumped = await Team.updateOne(
    { _id: teamId, "hintsRevealed.questionId": questionId },
    { $inc: { "hintsRevealed.$.count": 1 } }
  );
  if (bumped.matchedCount === 0) {
    await Team.updateOne({ _id: teamId }, { $push: { hintsRevealed: { questionId, count: 1 } } });
  }
  await extendRoomTimer(roomId, 10);
}

/**
 * Freeze the active (assigned) team on their NEXT question — the current one
 * plays out normally, but they can play no power cards on the following one.
 * `actingTeamId` is the team casting Freeze; the target is whoever's turn it
 * currently is.
 */
async function applyFreezeEffect(roomId: string, actingTeamId: string): Promise<void> {
  const room = await Room.findById(roomId).select("currentSceneId currentQuestionId").lean();
  if (!room?.currentSceneId) return;
  const scene = await Scene.findById(room.currentSceneId).select("settings").lean();
  const targetTeamId =
    typeof scene?.settings?.assignedTeamId === "string" ? scene.settings.assignedTeamId : null;
  if (!targetTeamId || targetTeamId === actingTeamId.toString()) {
    throw new Error("Freeze needs another team to be on the active question.");
  }

  // Distinct question ids in flow order; freeze the one after the current.
  const questionScenes = await Scene.find({ roomId, type: "QUESTION", questionId: { $ne: null } })
    .sort({ order: 1 })
    .select("questionId")
    .lean();
  const order: string[] = [];
  for (const s of questionScenes) {
    const qid = s.questionId?.toString();
    if (qid && !order.includes(qid)) order.push(qid);
  }
  const currentQid = room.currentQuestionId?.toString();
  const idx = currentQid ? order.indexOf(currentQid) : -1;
  const nextQid = idx >= 0 ? order[idx + 1] : order[0];
  if (!nextQid) throw new Error("There is no next question to freeze.");

  await Team.findByIdAndUpdate(targetTeamId, { $addToSet: { frozenQuestionIds: nextQid } });
}

/**
 * Eliminate one wrong option on the live MCQ question for this team only.
 * Playability already guarantees isMCQ + 3+ options (so one elimination never
 * leaves a single obvious answer) and that this team hasn't peeked already.
 */
async function applyPeekEffect(roomId: string, teamId: string): Promise<void> {
  const room = await Room.findById(roomId).select("currentQuestionId").lean();
  const questionId = room?.currentQuestionId?.toString();
  if (!questionId) return;
  const question = await Question.findById(questionId).select("options answer").lean();
  if (!question) return;

  const wrongIndexes = question.options
    .map((opt, index) => ({ opt, index }))
    .filter(({ opt }) => opt !== question.answer)
    .map(({ index }) => index);
  if (wrongIndexes.length === 0) return;

  const eliminatedOptionIndex = wrongIndexes[Math.floor(Math.random() * wrongIndexes.length)];
  await Team.findByIdAndUpdate(teamId, {
    $push: { peeks: { questionId, eliminatedOptionIndex } },
  });
}

async function applyImmediatePowerEffect(
  roomId: string,
  teamId: string,
  effectType: string
): Promise<void> {
  if (effectType === "INSURANCE") await applyInsuranceCoverage(roomId, teamId);
  if (effectType === "HINT") await applyHintReveal(roomId, teamId);
  if (effectType === "FREEZE") await applyFreezeEffect(roomId, teamId);
  if (effectType === "PEEK") await applyPeekEffect(roomId, teamId);
  // Extra Time can only be played while the clock ticks (see playability),
  // so there's always a timer to extend here.
  if (effectType === "EXTRA_TIME") await extendRoomTimer(roomId, 30);
}

/**
 * Effects that fully resolve the instant they're played — nothing is left
 * for the host to judge or apply later. Without auto-consuming, these sat
 * stuck at status "ACTIVE" forever (never decremented, never playable
 * again), which also made them show up as false "active effects" in the
 * Give Marks panel on later, unrelated questions.
 */
const INSTANT_CONSUME_EFFECTS = new Set([
  "HINT",
  "EXTRA_TIME",
  "INSURANCE",
  "FREEZE",
  "PEEK",
]);

/** Decrement one use of an owned power card, mirroring consumePowerCard's transition. */
async function consumeTeamPowerCardUse(teamPowerCardId: unknown): Promise<void> {
  const owned = await TeamPowerCard.findById(teamPowerCardId);
  if (!owned) return;
  owned.remainingUses -= 1;
  owned.status = owned.remainingUses <= 0 ? "CONSUMED" : "AVAILABLE";
  await owned.save();
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

  const teamIds = teams.map((team) => team._id);
  const defaultCardIds = validAssignments.map((assignment) => assignment.powerCardId);
  await Promise.all([
    TeamPowerCard.deleteMany({
      teamId: { $in: teamIds },
      powerCardId: { $nin: defaultCardIds },
    }),
    TeamPowerCard.bulkWrite(operations),
    Room.findByIdAndUpdate(roomId, {
      $set: {
        powerCardDefaults: validAssignments.map((assignment) => ({
          powerCardId: assignment.powerCardId,
          uses: assignment.uses,
        })),
      },
    }),
  ]);
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

  // A Mystery Box has no "use" step — powerCardPlayability blocks it outright
  // (see comment there), so gifting it into inventory the normal way would
  // strand it: never playable, never openable. Resolve the gamble now instead,
  // exactly like a store purchase does.
  if (card.effectType === "MYSTERY") {
    await resolveMysteryReward(roomId, teamId, card.ownerId.toString(), card.price || 100);
    revalidatePath(`/rooms/${roomId}`);
    return;
  }

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
  if (room.settings?.permissions?.buyPowers === false) {
    throw new Error("Power Store purchases are disabled for participants.");
  }
  await assertPowerCardAllowedForRoom(room, powerCardId);

  const card = await getEnabledPowerCardForRoom(room, powerCardId);

  // Charge the live price — a flash sale discounts what the team actually pays.
  const price = effectivePrice(card.price, room.liveState);
  const team = await Team.findOne({ _id: teamId, roomId }).lean();
  if (!team) throw new Error("Team does not belong to this room.");
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
): Promise<{ id: string; status: PowerCardRequestStatus }> {
  await connectToDatabase();

  await assertTeamController(input.teamId, input.participantId);

  const room = await Room.findById(input.roomId).lean();
  if (!room) throw new Error("Room not found.");
  if (room.settings?.permissions?.requestLifelines === false) {
    throw new Error("Power card use is disabled for participants.");
  }
  const team = await Team.findOne({ _id: input.teamId, roomId: input.roomId })
    .select("frozenQuestionIds hintsRevealed peeks")
    .lean();
  if (!team) throw new Error("Team does not belong to this room.");
  if (input.targetTeamId) {
    const target = await Team.exists({ _id: input.targetTeamId, roomId: input.roomId });
    if (!target) throw new Error("Target team does not belong to this room.");
  }
  await assertPowerCardAllowedForRoom(room, input.powerCardId);

  const card = await getEnabledPowerCardForRoom(room, input.powerCardId);

  // Cards are played in the moment, not from the lobby: only while a question
  // is on screen (Extra Time additionally needs a ticking clock). Server-side
  // so a phone can never bypass it — the UI mirrors the same rulebook.
  const currentScene = room.currentSceneId
    ? await Scene.findById(room.currentSceneId)
        .select("type settings")
        .lean<{ type: string; settings?: Record<string, unknown> }>()
    : null;
  const timerRunning =
    Boolean(room.liveState?.timerEndsAt) &&
    !room.liveState?.timerPaused &&
    new Date(room.liveState.timerEndsAt as unknown as string).getTime() > Date.now();
  const currentQid = room.currentQuestionId?.toString() ?? null;
  const frozen = Boolean(currentQid && team.frozenQuestionIds?.includes(currentQid));
  const currentQuestion = currentQid
    ? await Question.findById(currentQid).select("isMCQ options hints").lean()
    : null;
  const hintsRevealed = currentQid
    ? (team.hintsRevealed?.find((h) => h.questionId === currentQid)?.count ?? 0)
    : 0;
  const alreadyPeeked = Boolean(currentQid && team.peeks?.some((p) => p.questionId === currentQid));
  const playability = powerCardPlayability(card.effectType, {
    sceneType: currentScene?.type ?? null,
    timerRunning,
    assignedTeamId:
      typeof currentScene?.settings?.assignedTeamId === "string"
        ? currentScene.settings.assignedTeamId
        : null,
    actingTeamId: input.teamId,
    frozen,
    hintsTotal: currentQuestion?.hints?.length ?? 0,
    hintsRevealed,
    isMCQ: currentQuestion?.isMCQ ?? false,
    optionsCount: currentQuestion?.options?.length ?? 0,
    alreadyPeeked,
  });
  if (!playability.usable) {
    throw new Error(playability.reason ?? "This card can't be played right now.");
  }

  const skipApproval = !card.requiresApproval;
  const owned = await TeamPowerCard.findOneAndUpdate(
    {
      teamId: input.teamId,
      powerCardId: input.powerCardId,
      status: "AVAILABLE",
      remainingUses: { $gt: 0 },
    },
    { $set: { status: skipApproval ? "ACTIVE" : "REQUESTED" } },
    { new: true }
  );
  if (!owned) {
    throw new Error("Your team does not own an available copy of this card.");
  }

  let instantlyConsumed = false;
  if (skipApproval) {
    try {
      await applyImmediatePowerEffect(input.roomId, input.teamId, card.effectType);
      if (INSTANT_CONSUME_EFFECTS.has(card.effectType)) {
        await consumeTeamPowerCardUse(owned._id);
        instantlyConsumed = true;
      }
    } catch (error) {
      await TeamPowerCard.findByIdAndUpdate(owned._id, { $set: { status: "AVAILABLE" } });
      throw error;
    }
  }

  const assignedTeamId =
    typeof currentScene?.settings?.assignedTeamId === "string"
      ? currentScene.settings.assignedTeamId
      : null;
  const effectiveTargetTeamId =
    card.effectType === "FREEZE" ? assignedTeamId : input.targetTeamId ?? null;

  const request = await PowerCardRequest.create({
    roomId: input.roomId,
    teamId: input.teamId,
    powerCardId: input.powerCardId,
    targetTeamId: effectiveTargetTeamId,
    status: instantlyConsumed ? "CONSUMED" : skipApproval ? "ACTIVE" : "REQUESTED",
    approvedBy: null,
  });

  await EventLog.create({
    roomId: input.roomId,
    type: skipApproval ? "POWER_CARD_USED" : "POWER_CARD_REQUESTED",
    metadata: {
      teamId: input.teamId,
      powerCardId: input.powerCardId,
      targetTeamId: effectiveTargetTeamId,
    },
  });

  revalidatePath(`/rooms/${input.roomId}`);
  return { id: request._id.toString(), status: request.status };
}

/**
 * Host approves (or rejects) a pending request. Approval does not activate
 * the effect yet; the host controls that transition separately.
 */
async function approvePowerCard(
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
async function activatePowerCard(requestId: string): Promise<IPowerCardRequest> {
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

  const card = await PowerCard.findById(request.powerCardId).select("effectType").lean();
  if (!card) {
    await TeamPowerCard.findByIdAndUpdate(owned._id, { $set: { status: "AVAILABLE" } });
    request.status = "REJECTED";
    await request.save();
    throw new Error("Power card not found.");
  }
  try {
    await applyImmediatePowerEffect(request.roomId.toString(), request.teamId.toString(), card.effectType);
    if (INSTANT_CONSUME_EFFECTS.has(card.effectType)) {
      await consumeTeamPowerCardUse(owned._id);
    }
  } catch (error) {
    // Another team may have stolen the turn while this request was waiting
    // for approval. Cancel cleanly instead of leaving the card stuck ACTIVE.
    await TeamPowerCard.findByIdAndUpdate(owned._id, { $set: { status: "AVAILABLE" } });
    request.status = "REJECTED";
    await request.save();
    throw error;
  }

  request.status = INSTANT_CONSUME_EFFECTS.has(card.effectType) ? "CONSUMED" : "ACTIVE";
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
async function consumePowerCard(requestId: string): Promise<IPowerCardRequest> {
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

  const room = await Room.findById(roomId).select("settings.permissions.buyPowers").lean();
  if (room?.settings?.permissions?.buyPowers === false) {
    throw new Error('Enable "Use store" in Room Settings before opening the Power Store.');
  }

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
    // Re-enabling a card should clear any earlier exclusion of the same card.
    ...(isOverridden ? {} : { $pull: { powerCardExclusions: powerCardId } }),
  });

  revalidatePath(`/host/${roomId}`);
  revalidatePath(`/admin/rooms/${roomId}`);
}

/**
 * Host force-disables a power card for this room's live event, even though
 * the round would otherwise allow it (restricted or not). The mirror image
 * of `toggleRoomPowerCardOverride` — lets the host shrink the round's card
 * count mid-event (e.g. picked 3 in the library, wants only 2 live) without
 * editing the round itself.
 */
export async function toggleRoomPowerCardExclusion(roomId: string, powerCardId: string): Promise<void> {
  const user = await requireUser();
  const room = await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  const isExcluded = room.powerCardExclusions.includes(powerCardId);
  await Room.findByIdAndUpdate(roomId, {
    [isExcluded ? "$pull" : "$addToSet"]: { powerCardExclusions: powerCardId },
    // Excluding a card should clear any earlier force-on override of the same card.
    ...(isExcluded ? {} : { $pull: { powerCardOverrides: powerCardId } }),
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
