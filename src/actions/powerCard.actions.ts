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
    $set: {
      "liveState.timerEndsAt": new Date(base + seconds * 1000),
      "liveState.timerPaused": false,
      "liveState.timerRemainingMs": null,
    },
  });
}

/**
 * Time Drain: cut `seconds` off the live countdown. Floored so the answering
 * team always keeps a few seconds to actually respond — a card that could
 * instantly zero the clock would be a "you lose your turn" button, which is
 * not what it's sold as.
 */
const TIME_DRAIN_FLOOR_MS = 5000;
async function drainRoomTimer(roomId: string, seconds: number): Promise<void> {
  const room = await Room.findById(roomId).select("liveState.timerEndsAt").lean();
  const endsAt = room?.liveState?.timerEndsAt;
  if (!endsAt) throw new Error("Time Drain needs a running clock.");
  const now = Date.now();
  const drained = new Date(endsAt).getTime() - seconds * 1000;
  await Room.findByIdAndUpdate(roomId, {
    $set: {
      "liveState.timerEndsAt": new Date(Math.max(drained, now + TIME_DRAIN_FLOOR_MS)),
      "liveState.timerPaused": false,
      "liveState.timerRemainingMs": null,
    },
  });
}

/**
 * Pass the Question: hand the live question to another team by re-stamping the
 * scene's assigned team, and remember who passed it. A wrong answer by the
 * recipient bounces the penalty back to the passer (see resolveAndApplyMark).
 */
async function applyPassQuestionEffect(
  roomId: string,
  actingTeamId: string,
  targetTeamId: string | null | undefined
): Promise<void> {
  const room = await Room.findById(roomId).select("currentSceneId currentQuestionId").lean();
  if (!room?.currentSceneId || !room.currentQuestionId) throw new Error("No question is live.");
  const questionId = room.currentQuestionId.toString();

  const scene = await Scene.findById(room.currentSceneId).select("settings").lean();
  const assignedTeamId =
    typeof scene?.settings?.assignedTeamId === "string" ? scene.settings.assignedTeamId : null;
  if (assignedTeamId !== actingTeamId) throw new Error("You can only pass your own question.");

  // Pick the recipient: the caller's choice, else the next team in the room.
  let recipientId = targetTeamId ?? null;
  if (!recipientId) {
    const others = await Team.find({ roomId, _id: { $ne: actingTeamId } })
      .sort({ createdAt: 1 })
      .select("_id")
      .lean();
    recipientId = others[0]?._id.toString() ?? null;
  }
  if (!recipientId || recipientId === actingTeamId) {
    throw new Error("There's no other team to pass this question to.");
  }
  const recipient = await Team.findOne({ _id: recipientId, roomId }).select("_id passedToMe").lean();
  if (!recipient) throw new Error("That team isn't in this room.");
  if (recipient.passedToMe?.some((p) => p.questionId === questionId)) {
    throw new Error("This question has already been passed once.");
  }

  await Scene.findByIdAndUpdate(room.currentSceneId, {
    $set: { "settings.assignedTeamId": recipientId, "settings.assignmentSource": "PASSED" },
  });
  await Team.findByIdAndUpdate(recipientId, {
    $addToSet: { passedToMe: { questionId, fromTeamId: actingTeamId } },
  });
}

/**
 * Copycat: ride another team's result on the live question. Recorded on the
 * copier; resolveAndApplyMark mirrors the mark when the target is judged.
 *
 * Two question shapes need two different targeting rules:
 *  - Assigned-turn question (one team answers): the target is that team,
 *    resolved automatically — there's nothing to choose.
 *  - Open question (every team answers independently, e.g. ANY_TEAM rounds):
 *    there's no single implicit target, so the caller must pick one. The
 *    chosen team must not have answered yet — copying an already-graded
 *    team would be a risk-free guaranteed result, not a gamble.
 */
async function applyCopycatEffect(
  roomId: string,
  actingTeamId: string,
  targetTeamId?: string | null
): Promise<void> {
  const room = await Room.findById(roomId).select("currentSceneId currentQuestionId").lean();
  if (!room?.currentSceneId || !room.currentQuestionId) throw new Error("No question is live.");
  const questionId = room.currentQuestionId.toString();

  const alreadyAnswered = await EventLog.exists({
    roomId,
    type: "MCQ_GRADED",
    "metadata.teamId": actingTeamId,
    "metadata.questionId": questionId,
  });
  if (alreadyAnswered) throw new Error("You've already answered this question yourself.");

  const scene = await Scene.findById(room.currentSceneId).select("settings").lean();
  const assignedTeamId =
    typeof scene?.settings?.assignedTeamId === "string" ? scene.settings.assignedTeamId : null;

  let resolvedTargetId: string;
  if (assignedTeamId) {
    if (assignedTeamId === actingTeamId) throw new Error("Copycat needs another team to be answering.");
    resolvedTargetId = assignedTeamId;
  } else {
    if (!targetTeamId) throw new Error("Pick a team to copy.");
    if (targetTeamId === actingTeamId) throw new Error("You can't copy your own team.");
    const target = await Team.findOne({ _id: targetTeamId, roomId }).select("_id").lean();
    if (!target) throw new Error("That team isn't in this room.");
    const targetAnswered = await EventLog.exists({
      roomId,
      type: "MCQ_GRADED",
      "metadata.teamId": targetTeamId,
      "metadata.questionId": questionId,
    });
    if (targetAnswered) throw new Error("That team has already answered — pick a team that hasn't yet.");
    resolvedTargetId = targetTeamId;
  }

  await Team.findByIdAndUpdate(actingTeamId, {
    $addToSet: { copycats: { questionId, ofTeamId: resolvedTargetId } },
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
 * Freeze the active (assigned) team on their NEXT TURN — the current question
 * plays out normally, but they can play no power cards on the next question
 * that is actually assigned to them.
 *
 * This deliberately targets their next *assigned* question, not simply the
 * next question in flow order. Questions rotate between teams
 * (buildQuestionTeamAssignments hands question i to team i % teamCount), so
 * "the next question" almost always belongs to somebody else — freezing it
 * cost the target nothing, since a team can only play attack cards on a
 * question that isn't theirs anyway. Aiming at their real next turn is what
 * makes the card do what its name says.
 *
 * `actingTeamId` is the team casting Freeze; the target is whoever's turn it
 * currently is.
 */
async function applyFreezeEffect(roomId: string, actingTeamId: string): Promise<void> {
  const room = await Room.findById(roomId).select("currentSceneId currentQuestionId").lean();
  if (!room?.currentSceneId) return;
  const scene = await Scene.findById(room.currentSceneId).select("settings order").lean();
  const targetTeamId =
    typeof scene?.settings?.assignedTeamId === "string" ? scene.settings.assignedTeamId : null;
  if (!targetTeamId || targetTeamId === actingTeamId.toString()) {
    throw new Error("Freeze needs another team to be on the active question.");
  }

  // Compare on scene order rather than position in a question-id list so this
  // still works when the live scene is a DRAWING one (not in the query below).
  const currentOrder = Number(scene?.order ?? -1);
  const questionScenes = await Scene.find({ roomId, type: "QUESTION", questionId: { $ne: null } })
    .sort({ order: 1 })
    .select("questionId settings order")
    .lean();

  const nextOwnTurn = questionScenes.find(
    (s) =>
      Number(s.order) > currentOrder &&
      typeof s.settings?.assignedTeamId === "string" &&
      s.settings.assignedTeamId === targetTeamId
  );
  // Fail loudly rather than burning the card on a no-op — requestPowerCard
  // restores the card to AVAILABLE when this throws.
  if (!nextOwnTurn?.questionId) {
    throw new Error("That team has no upcoming question left to freeze.");
  }

  await Team.findByIdAndUpdate(targetTeamId, {
    $addToSet: { frozenQuestionIds: nextOwnTurn.questionId.toString() },
  });
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
  effectType: string,
  targetTeamId?: string | null
): Promise<void> {
  if (effectType === "INSURANCE") await applyInsuranceCoverage(roomId, teamId);
  if (effectType === "HINT") await applyHintReveal(roomId, teamId);
  if (effectType === "FREEZE") await applyFreezeEffect(roomId, teamId);
  if (effectType === "PEEK") await applyPeekEffect(roomId, teamId);
  // Extra Time can only be played while the clock ticks (see playability),
  // so there's always a timer to extend here.
  if (effectType === "EXTRA_TIME") await extendRoomTimer(roomId, 30);
  if (effectType === "TIME_DRAIN") await drainRoomTimer(roomId, 15);
  if (effectType === "PASS_QUESTION") await applyPassQuestionEffect(roomId, teamId, targetTeamId);
  if (effectType === "COPYCAT") await applyCopycatEffect(roomId, teamId, targetTeamId);
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
  "TIME_DRAIN",
  // Both of these fully resolve at play time — the pass reassigns the scene
  // immediately, and Copycat's mirror is recorded on the team right away. The
  // later score effect is read from that record, not from an ACTIVE card.
  "PASS_QUESTION",
  "COPYCAT",
]);

/**
 * Effects that stay ACTIVE, unconsumed, waiting to auto-apply on this team's
 * NEXT scored mark (see resolveAndApplyMark in score.actions.ts) rather than
 * resolving the instant they're played. These get pinned to the question
 * that was live when they were played, so a later unrelated mark (a host
 * fixing an earlier question, say) can't burn them by accident.
 */
const PINNED_ACTIVE_EFFECTS = new Set(["GAMBLE", "BLOCK_NEGATIVE", "DOUBLE_SCORE"]);

/** Decrement one use of an owned power card, mirroring consumePowerCard's transition. */
async function consumeTeamPowerCardUse(teamPowerCardId: unknown): Promise<void> {
  const owned = await TeamPowerCard.findById(teamPowerCardId);
  if (!owned) return;
  owned.remainingUses -= 1;
  owned.status = owned.remainingUses <= 0 ? "CONSUMED" : "AVAILABLE";
  // Drop the question pin — see the twin helper in score.actions.ts.
  owned.questionId = null;
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
  participantId?: string,
  quantity = 1
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
  // Mystery is a one-at-a-time gamble (each purchase rolls its own reward) —
  // bulk quantity only applies to ordinary cards.
  const qty = card.effectType === "MYSTERY" ? 1 : Math.max(1, Math.round(quantity));

  // Charge the live price — a flash sale discounts what the team actually pays.
  const unitPrice = effectivePrice(card.price, room.liveState);
  const totalPrice = unitPrice * qty;
  const team = await Team.findOne({ _id: teamId, roomId }).lean();
  if (!team) throw new Error("Team does not belong to this room.");
  if (team.coins < totalPrice) throw new Error("Not enough coins for that many.");

  // Atomic stock guard: only decrements if enough stock remains (or unlimited).
  const stockFilter =
    card.stock === null ? { _id: powerCardId } : { _id: powerCardId, stock: { $gte: qty } };
  const stockUpdate = card.stock === null ? {} : { $inc: { stock: -qty } };
  const reserved = await PowerCard.findOneAndUpdate(stockFilter, stockUpdate);
  if (!reserved) {
    throw new Error(
      card.stock !== null && card.stock > 0 ? `Only ${card.stock} left in stock.` : "Sold out."
    );
  }

  await createCoinTransaction({
    roomId,
    teamId,
    amount: -totalPrice,
    type: "CARD_PURCHASE",
    reason: qty > 1 ? `Bought ${qty}x ${card.name}` : `Bought ${card.name}`,
  });

  await EventLog.create({
    roomId,
    type: "CARD_PURCHASED",
    metadata: { teamId, powerCardId, price: totalPrice, quantity: qty },
  });

  // A Mystery Box is a gamble: instead of landing in the inventory, it rolls a
  // random reward on the spot (bonus coins or a surprise card).
  if (card.effectType === "MYSTERY") {
    await resolveMysteryReward(roomId, teamId, card.ownerId.toString(), totalPrice);
  } else {
    await TeamPowerCard.findOneAndUpdate(
      { teamId, powerCardId },
      { $inc: { remainingUses: card.usesPerTeam * qty }, $set: { status: "AVAILABLE" } },
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

/**
 * The extra playability facts only Pass the Question / Copycat need. Kept
 * behind an effect-type check so the common cards don't pay for two extra
 * queries on every single play.
 */
async function resolvePassCopyContext(
  roomId: string,
  teamId: string,
  currentQid: string | null,
  effectType: string,
  assignedTeamId: string | null,
  copycats?: Array<{ questionId: string; ofTeamId: string }>
): Promise<{ otherTeamCount: number; alreadyPassed: boolean; alreadyCopying: boolean; hasCopycatTarget: boolean }> {
  if (effectType === "PASS_QUESTION") {
    const [otherTeamCount, passed] = await Promise.all([
      Team.countDocuments({ roomId, _id: { $ne: teamId } }),
      currentQid ? Team.exists({ roomId, "passedToMe.questionId": currentQid }) : null,
    ]);
    return { otherTeamCount, alreadyPassed: Boolean(passed), alreadyCopying: false, hasCopycatTarget: false };
  }
  if (effectType === "COPYCAT") {
    const alreadyCopying = Boolean(currentQid && copycats?.some((c) => c.questionId === currentQid));
    // Assigned-turn question: the target is implicit (whoever's turn it is).
    // Open question: only usable if some OTHER team hasn't answered yet —
    // copying an already-graded team would be a risk-free guaranteed result.
    let hasCopycatTarget = Boolean(assignedTeamId);
    if (!assignedTeamId && currentQid && !alreadyCopying) {
      const [otherTeams, answeredIds] = await Promise.all([
        Team.find({ roomId, _id: { $ne: teamId } }).select("_id").lean(),
        EventLog.distinct("metadata.teamId", { roomId, type: "MCQ_GRADED", "metadata.questionId": currentQid }),
      ]);
      const answered = new Set(answeredIds.map(String));
      hasCopycatTarget = otherTeams.some((t) => !answered.has(t._id.toString()));
    }
    return { otherTeamCount: 0, alreadyPassed: false, alreadyCopying, hasCopycatTarget };
  }
  return { otherTeamCount: 0, alreadyPassed: false, alreadyCopying: false, hasCopycatTarget: false };
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
    .select("frozenQuestionIds hintsRevealed peeks copycats")
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
  const assignedTeamId =
    typeof currentScene?.settings?.assignedTeamId === "string" ? currentScene.settings.assignedTeamId : null;
  const passCtx = await resolvePassCopyContext(
    input.roomId,
    input.teamId,
    currentQid,
    card.effectType,
    assignedTeamId,
    team.copycats
  );
  const playability = powerCardPlayability(card.effectType, {
    sceneType: currentScene?.type ?? null,
    ...passCtx,
    timerRunning,
    assignedTeamId,
    opponentTeamId:
      typeof currentScene?.settings?.opponentTeamId === "string"
        ? currentScene.settings.opponentTeamId
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
    {
      $set: {
        status: skipApproval ? "ACTIVE" : "REQUESTED",
        questionId: skipApproval && PINNED_ACTIVE_EFFECTS.has(card.effectType) ? currentQid : null,
      },
    },
    { new: true }
  );
  if (!owned) {
    throw new Error("Your team does not own an available copy of this card.");
  }

  let instantlyConsumed = false;
  if (skipApproval) {
    try {
      await applyImmediatePowerEffect(input.roomId, input.teamId, card.effectType, input.targetTeamId);
      if (INSTANT_CONSUME_EFFECTS.has(card.effectType)) {
        await consumeTeamPowerCardUse(owned._id);
        instantlyConsumed = true;
      }
    } catch (error) {
      await TeamPowerCard.findByIdAndUpdate(owned._id, { $set: { status: "AVAILABLE", questionId: null } });
      throw error;
    }
  }

  // Freeze always targets the assigned team; Copycat does too when there IS
  // one (assigned-turn question) — only an open question's explicit pick
  // needs input.targetTeamId at all. Keeps the event feed's "used X on Y"
  // line accurate to what actually got recorded, not just what the client sent.
  const effectiveTargetTeamId =
    card.effectType === "FREEZE" || (card.effectType === "COPYCAT" && assignedTeamId)
      ? assignedTeamId
      : input.targetTeamId ?? null;

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
      { $set: { status: "AVAILABLE", questionId: null } }
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
    await TeamPowerCard.findByIdAndUpdate(owned._id, { $set: { status: "AVAILABLE", questionId: null } });
    request.status = "REJECTED";
    await request.save();
    throw new Error("Power card not found.");
  }
  // Pin waiting modifiers to whatever question is live at activation — that's
  // the question the host just green-lit the card for.
  if (PINNED_ACTIVE_EFFECTS.has(card.effectType)) {
    const activeRoom = await Room.findById(request.roomId).select("currentQuestionId").lean();
    await TeamPowerCard.findByIdAndUpdate(owned._id, {
      $set: { questionId: activeRoom?.currentQuestionId?.toString() ?? null },
    });
  }
  try {
    await applyImmediatePowerEffect(
      request.roomId.toString(),
      request.teamId.toString(),
      card.effectType,
      request.targetTeamId?.toString() ?? null
    );
    if (INSTANT_CONSUME_EFFECTS.has(card.effectType)) {
      await consumeTeamPowerCardUse(owned._id);
    }
  } catch (error) {
    // Another team may have stolen the turn while this request was waiting
    // for approval. Cancel cleanly instead of leaving the card stuck ACTIVE.
    await TeamPowerCard.findByIdAndUpdate(owned._id, { $set: { status: "AVAILABLE", questionId: null } });
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

/**
 * Host plays a card a team already OWNS, on the team's behalf — for when a team
 * answers/asks out loud instead of tapping the app (the normal case in this
 * host-directed product), or a captain's phone is offline. Same effect and
 * consume as the team playing it themselves (Insurance/Hint/Freeze/Peek/Extra
 * Time resolve now; Shield/Double/Gamble/Second Chance arm as ACTIVE for the
 * next mark) — the only difference is host authorization and that approval is
 * implicit. Enforces the exact same playability rulebook the participant does,
 * so a host-play can never land a card in an invalid state (e.g. Extra Time
 * with no clock, Peek on a non-MCQ, or a card the round doesn't allow).
 */
export async function hostPlayTeamPowerCard(
  roomId: string,
  teamId: string,
  powerCardId: string,
  /** Who to hand the question to — Pass the Question only. */
  targetTeamId?: string | null
): Promise<{ status: PowerCardRequestStatus }> {
  const user = await requireUser();
  await connectToDatabase();
  await assertRoomOwnership(roomId, user.id);

  const room = await Room.findById(roomId).lean();
  if (!room) throw new Error("Room not found.");
  const team = await Team.findOne({ _id: teamId, roomId })
    .select("frozenQuestionIds hintsRevealed peeks copycats")
    .lean();
  if (!team) throw new Error("Team does not belong to this room.");
  await assertPowerCardAllowedForRoom(room, powerCardId);
  const card = await getEnabledPowerCardForRoom(room, powerCardId);

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
  const assignedTeamId =
    typeof currentScene?.settings?.assignedTeamId === "string" ? currentScene.settings.assignedTeamId : null;
  const opponentTeamId =
    typeof currentScene?.settings?.opponentTeamId === "string" ? currentScene.settings.opponentTeamId : null;
  const passCtx = await resolvePassCopyContext(
    roomId,
    teamId,
    currentQid,
    card.effectType,
    assignedTeamId,
    team.copycats
  );

  const playability = powerCardPlayability(card.effectType, {
    sceneType: currentScene?.type ?? null,
    ...passCtx,
    timerRunning,
    assignedTeamId,
    opponentTeamId,
    actingTeamId: teamId,
    frozen,
    hintsTotal: currentQuestion?.hints?.length ?? 0,
    hintsRevealed,
    isMCQ: currentQuestion?.isMCQ ?? false,
    optionsCount: currentQuestion?.options?.length ?? 0,
    alreadyPeeked,
  });
  if (!playability.usable) throw new Error(playability.reason ?? "This card can't be played right now.");

  const owned = await TeamPowerCard.findOneAndUpdate(
    { teamId, powerCardId, status: "AVAILABLE", remainingUses: { $gt: 0 } },
    {
      $set: {
        status: "ACTIVE",
        questionId: PINNED_ACTIVE_EFFECTS.has(card.effectType) ? currentQid : null,
      },
    },
    { new: true }
  );
  if (!owned) throw new Error("This team doesn't own an available copy of that card.");

  let instantlyConsumed = false;
  try {
    await applyImmediatePowerEffect(roomId, teamId, card.effectType, targetTeamId);
    if (INSTANT_CONSUME_EFFECTS.has(card.effectType)) {
      await consumeTeamPowerCardUse(owned._id);
      instantlyConsumed = true;
    }
  } catch (error) {
    await TeamPowerCard.findByIdAndUpdate(owned._id, { $set: { status: "AVAILABLE", questionId: null } });
    throw error;
  }

  const effectiveTargetTeamId =
    card.effectType === "FREEZE" || (card.effectType === "COPYCAT" && assignedTeamId)
      ? assignedTeamId
      : targetTeamId ?? null;
  const request = await PowerCardRequest.create({
    roomId,
    teamId,
    powerCardId,
    targetTeamId: effectiveTargetTeamId,
    status: instantlyConsumed ? "CONSUMED" : "ACTIVE",
    approvedBy: user.id as unknown as IPowerCardRequest["approvedBy"],
  });

  await EventLog.create({
    roomId,
    type: "POWER_CARD_USED",
    metadata: { teamId, powerCardId, targetTeamId: effectiveTargetTeamId, source: "HOST_PLAYED" },
  });

  revalidatePath(`/host/${roomId}`);
  revalidatePath(`/admin/rooms/${roomId}`);
  return { status: request.status };
}
