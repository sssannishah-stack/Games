import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/database/mongodb";
import {
  Auction,
  AuctionBid,
  Competition,
  EventLog,
  Participant,
  PowerCard,
  PowerCardRequest,
  Question,
  Room,
  Round,
  Scene,
  ScoreTransaction,
  Team,
  TeamPowerCard,
} from "@/models";
import { serialize } from "@/lib/serialize";
import { effectivePrice, flashSaleLive } from "@/lib/storePricing";
import { isDeviceConnected, resolveTeamControl } from "@/lib/teamRoles";
import type {
  ICompetition,
  IEventLog,
  IParticipant,
  IPowerCard,
  IPowerCardRequest,
  IQuestion,
  IRoom,
  IRound,
  IScene,
  IScoreTransaction,
  ITeam,
  ITeamPowerCard,
} from "@/types/db";

export const dynamic = "force-dynamic";

function id(value: unknown) {
  return value && typeof value === "object" && "toString" in value ? value.toString() : String(value ?? "");
}

function sceneTitle(scene: IScene | null) {
  if (!scene) return "Waiting for host";
  return scene.title || scene.type.replace(/_/g, " ");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ roomCode: string }> }
) {
  const { roomCode } = await context.params;
  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId");
  const participantId = url.searchParams.get("participantId");

  await connectToDatabase();

  const room = await Room.findOne({ roomCode: roomCode.toUpperCase() }).lean<IRoom>();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  // Heartbeat: this poll *is* the device's "I'm still here" signal. Connected
  // status (and captain-disconnect fallback) derives from lastSeenAt.
  if (participantId && /^[a-f0-9]{24}$/i.test(participantId)) {
    await Participant.updateOne(
      { _id: participantId, roomId: room._id },
      { $set: { lastSeenAt: new Date() } }
    ).catch(() => {});
  }

  const [competition, teams, scenes, latestBroadcast, recentScores, recentEvents] = await Promise.all([
    Competition.findById(room.competitionId).lean<ICompetition>(),
    Team.find({ roomId: room._id }).sort({ score: -1, createdAt: 1 }).lean<ITeam[]>(),
    Scene.find({ roomId: room._id }).sort({ order: 1 }).lean<IScene[]>(),
    EventLog.findOne({ roomId: room._id, type: "BROADCAST_SENT" })
      .sort({ createdAt: -1 })
      .lean<IEventLog>(),
    ScoreTransaction.find({ roomId: room._id }).sort({ createdAt: -1 }).limit(12).lean<IScoreTransaction[]>(),
    EventLog.find({ roomId: room._id }).sort({ createdAt: -1 }).limit(20).lean<IEventLog[]>(),
  ]);

  // Below DRAFT/READY (i.e. before the host has started the event), a room
  // has no meaningful "current" scene yet — falling through to scenes[0]
  // here would leak a preview of the first scene (with full game chrome:
  // rank, leaderboard, powers) to participants sitting in the pre-show
  // lobby. That preview fallback is only valid once the event is actually
  // running, so it stays scoped to non-pre-start statuses.
  const roomHasStarted = room.status !== "DRAFT" && room.status !== "READY";
  const currentScene =
    (room.currentSceneId && scenes.find((scene) => id(scene._id) === id(room.currentSceneId))) ||
    (roomHasStarted && (scenes.find((scene) => scene.isActive) || scenes[0])) ||
    null;

  const [question, round] = await Promise.all([
    currentScene?.questionId ? Question.findById(currentScene.questionId).lean<IQuestion>() : null,
    currentScene?.roundId ? Round.findById(currentScene.roundId).lean<IRound>() : null,
  ]);

  // Display-only "Question N / M" position within the current round — derived
  // entirely from the scene list already fetched above (no extra query, no
  // logic change). Null off a QUESTION/DRAWING scene or before a round starts.
  let questionPosition: { number: number; total: number } | null = null;
  if (currentScene && round && (currentScene.type === "QUESTION" || currentScene.type === "DRAWING")) {
    const roundQuestionScenes = scenes.filter(
      (scene) => id(scene.roundId) === id(round._id) && (scene.type === "QUESTION" || scene.type === "DRAWING")
    );
    const index = roundQuestionScenes.findIndex((scene) => id(scene._id) === id(currentScene._id));
    if (index !== -1) questionPosition = { number: index + 1, total: roundQuestionScenes.length };
  }

  const selectedTeam = teamId ? teams.find((team) => id(team._id) === teamId) ?? null : null;
  const assignedTeamId = typeof currentScene?.settings?.assignedTeamId === "string"
    ? currentScene.settings.assignedTeamId
    : null;
  const assignedTeam = assignedTeamId
    ? teams.find((team) => id(team._id) === assignedTeamId) ?? null
    : null;
  const opponentTeamId =
    typeof currentScene?.settings?.opponentTeamId === "string"
      ? currentScene.settings.opponentTeamId
      : null;
  const opponentTeam = opponentTeamId
    ? teams.find((team) => id(team._id) === opponentTeamId) ?? null
    : null;
  const [catalog, inventory, requests, teamDevices, myAnswerLog] = await Promise.all([
    competition
      ? PowerCard.find({ ownerId: competition.ownerId, enabled: true }).sort({ price: 1 }).lean<IPowerCard[]>()
      : Promise.resolve([]),
    selectedTeam ? TeamPowerCard.find({ teamId: selectedTeam._id }).lean<ITeamPowerCard[]>() : [],
    selectedTeam
      ? PowerCardRequest.find({ roomId: room._id, teamId: selectedTeam._id })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean<IPowerCardRequest[]>()
      : [],
    selectedTeam
      ? Participant.find({ teamId: selectedTeam._id }).sort({ joinedAt: 1 }).lean<IParticipant[]>()
      : Promise.resolve([] as IParticipant[]),
    // The team's own submitted answer for the current question (captain-submit
    // mode). Scoped to *my* team only — never leaked to other teams' phones.
    selectedTeam && room.currentQuestionId
      ? EventLog.findOne({
          roomId: room._id,
          type: "ANSWER_SUBMITTED",
          "metadata.teamId": id(selectedTeam._id),
          "metadata.questionId": id(room.currentQuestionId),
        })
          .sort({ createdAt: -1 })
          .lean<IEventLog>()
      : null,
  ]);

  // My team's MCQ answer state for the live question — finalized pick + result,
  // or a Double Guess retry in progress (with the wrong first pick to lock out).
  // Also the team's judgment on this question directly (not sliced out of the
  // 20-event feed window, which can roll it out of range in a busy room before
  // the host moves on — this backs a persistent "you got it right/wrong"
  // banner that must not silently disappear).
  const [mcqGraded, mcqRetry, judgmentLog, turnJudgmentLog, turnMcqGraded, turnMcqRetry, duelWonLog, allMcqGraded] =
    await Promise.all([
    selectedTeam && room.currentQuestionId
      ? EventLog.findOne({
          roomId: room._id,
          type: "MCQ_GRADED",
          "metadata.teamId": id(selectedTeam._id),
          "metadata.questionId": id(room.currentQuestionId),
        }).lean<IEventLog>()
      : null,
    selectedTeam && room.currentQuestionId
      ? EventLog.findOne({
          roomId: room._id,
          type: "MCQ_RETRY",
          "metadata.teamId": id(selectedTeam._id),
          "metadata.questionId": id(room.currentQuestionId),
        }).lean<IEventLog>()
      : null,
    selectedTeam && room.currentQuestionId
      ? EventLog.findOne({
          roomId: room._id,
          type: { $in: ["SCORE_CHANGED", "POWER_CARD_USED"] },
          "metadata.teamId": id(selectedTeam._id),
          "metadata.questionId": id(room.currentQuestionId),
          "metadata.reason": { $in: ["CORRECT", "WRONG"] },
          "metadata.isUndo": { $ne: true },
        })
          .sort({ createdAt: -1 })
          .lean<IEventLog>()
      : null,
    // Same lookup as judgmentLog above, but for whichever team the current
    // question is assigned to — not just my own team. `turn.assignedTeamId` is
    // already public (every phone sees whose turn it is), so the verdict on
    // that turn should be too: without this, a team watching another team
    // answer had no way to learn the result short of opening the Activity
    // feed by hand — the status card just stayed on "Team X is answering"
    // forever, even after the host had already judged them.
    assignedTeamId && room.currentQuestionId
      ? EventLog.findOne({
          roomId: room._id,
          type: { $in: ["SCORE_CHANGED", "POWER_CARD_USED"] },
          "metadata.teamId": assignedTeamId,
          "metadata.questionId": id(room.currentQuestionId),
          "metadata.reason": { $in: ["CORRECT", "WRONG"] },
          "metadata.isUndo": { $ne: true },
        })
          .sort({ createdAt: -1 })
          .lean<IEventLog>()
      : null,
    // Same lookup as mcqGraded above, but for the assigned team regardless of
    // who's viewing — so an onlooking team can see WHICH option the answering
    // team picked, not just correct/wrong. mcqGraded stays scoped to
    // selectedTeam (used for "can I still answer" gating on my own turn).
    assignedTeamId && room.currentQuestionId
      ? EventLog.findOne({
          roomId: room._id,
          type: "MCQ_GRADED",
          "metadata.teamId": assignedTeamId,
          "metadata.questionId": id(room.currentQuestionId),
        }).lean<IEventLog>()
      : null,
    // A Double Guess retry by the answering team. Public alongside the verdict
    // for the same reason the picked option is: without it, watching teams see
    // only the team's final pick and can't tell they burned a second chance.
    assignedTeamId && room.currentQuestionId
      ? EventLog.findOne({
          roomId: room._id,
          type: "MCQ_RETRY",
          "metadata.teamId": assignedTeamId,
          "metadata.questionId": id(room.currentQuestionId),
        }).lean<IEventLog>()
      : null,
    // Head-to-Head only: has EITHER duellist already answered correctly? The
    // first correct answer takes the question, so this closes the other's
    // answer UI immediately instead of letting them tap into a server error.
    opponentTeamId && room.currentQuestionId
      ? EventLog.findOne({
          roomId: room._id,
          type: "MCQ_GRADED",
          "metadata.questionId": id(room.currentQuestionId),
          "metadata.correct": true,
        }).lean<IEventLog>()
      : null,
    // Every team's MCQ pick on the live question, for the Answer Reveal
    // screen's per-team breakdown — matters most in an open (ANY_TEAM)
    // question where every team answers independently, so there's no single
    // "assigned team" to show. Fetched regardless of showAnswer (cheap,
    // indexed the same as the lookups above); only included in the response
    // once the answer is actually revealed, same gate as `question.answer`.
    room.currentQuestionId
      ? EventLog.find({
          roomId: room._id,
          type: "MCQ_GRADED",
          "metadata.questionId": id(room.currentQuestionId),
        }).lean<IEventLog[]>()
      : [],
  ]);

  // Team device roles: who controls this team right now. The captain while
  // connected; otherwise the connected vice captain acts as temporary captain.
  const nowMs = Date.now();
  const control = resolveTeamControl(teamDevices, nowMs);
  const meDevice = participantId ? teamDevices.find((d) => id(d._id) === participantId) ?? null : null;
  const canControl = Boolean(meDevice && control.actingCaptainId === id(meDevice._id));

  // A round with powerCardMode "CUSTOM" restricts PLAY to its allow-list —
  // plus whatever the host has force-enabled for this room's live event
  // (Room.powerCardOverrides). This is different from Room.powerCardExclusions
  // (the host's own manual "turn this card off entirely" toggle): an
  // exclusion is a deliberate hide, so it still removes the card outright.
  // A round restriction is a per-round rule that changes as rounds change —
  // hiding a team's owned card here made it silently vanish from their deck
  // with no explanation. Now it still shows, sorted to the bottom, disabled
  // with a reason (see `allowedThisRound` below), same treatment as sold-out.
  // Same-named catalog entries (e.g. leftover duplicates from before card
  // names were enforced unique) would otherwise show as repeated tiles in
  // the store — collapse to one card per name, keeping the first (cheapest,
  // since catalog is price-sorted).
  const uniqueCatalog = [...new Map(catalog.map((card) => [card.name, card])).values()];

  const roundIsRestricted = round?.powerCardMode === "CUSTOM";
  const allowedCardIds = new Set([...(round?.allowedPowerCards ?? []), ...(room.powerCardOverrides ?? [])]);
  const excludedCardIds = new Set(room.powerCardExclusions ?? []);
  const isAllowedThisRound = (cardId: string) => !roundIsRestricted || allowedCardIds.has(cardId);
  const visibleCards = uniqueCatalog
    .filter((card) => !excludedCardIds.has(id(card._id)))
    // Allowed cards first (stable within that — catalog is already
    // price-sorted), disallowed ones sink to the bottom of every list.
    .sort((a, b) => Number(isAllowedThisRound(id(b._id))) - Number(isAllowedThisRound(id(a._id))));

  const requestByCard = new Map(requests.map((item) => [id(item.powerCardId), item]));
  const inventoryByCard = new Map(inventory.map((item) => [id(item.powerCardId), item]));
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  // Build a participant-facing activity feed from the audit log. Names are
  // resolved server-side — the phone has no team/catalog maps of its own.
  // `notable` entries also drive the transient "moment" overlays on-device.
  const teamMetaById = new Map(teams.map((t) => [id(t._id), { name: t.name, color: t.color }]));
  const catalogCardById = new Map(catalog.map((c) => [id(c._id), c]));
  const cardNameById = new Map(catalog.map((c) => [id(c._id), c.name]));

  function feedEntry(log: IEventLog) {
    const meta = log.metadata ?? {};
    const teamMeta = teamMetaById.get(id(meta.teamId));
    // Speak to the viewing team in second person for their own actions — "You
    // won the auction" instead of "Team B won the auction" showing up on Team
    // B's own phone reads as someone else's result, not theirs.
    const isMyTeam = Boolean(selectedTeam) && id(meta.teamId) === id(selectedTeam!._id);
    const teamName = isMyTeam ? "You" : teamMeta?.name ?? "A team";
    const teamColor = teamMeta?.color ?? null;
    const cardName = cardNameById.get(id(meta.powerCardId)) ?? "a power card";
    switch (log.type) {
      case "SCORE_CHANGED": {
        if (meta.isUndo || meta.testMode) return null;
        const points = Number(meta.points ?? 0);
        const up = points >= 0;
        return {
          text: `${teamName} ${up ? "+" : ""}${points}`,
          icon: up ? "📈" : "📉",
          tone: up ? "up" : "down",
          teamColor,
          notable: Math.abs(points) >= 20,
        };
      }
      case "POWER_CARD_USED": {
        if (meta.source === "HOST_REMOVED") return null;
        // Full card details ride along so phones can play the card's own
        // activation animation, not a generic toast.
        const usedCard = catalogCardById.get(id(meta.powerCardId));
        return {
          text: `${teamName} activated ${cardName}`,
          icon: "⚡",
          tone: "power",
          teamColor,
          notable: true,
          power: usedCard
            ? {
                name: usedCard.name,
                icon: usedCard.icon,
                effectType: usedCard.effectType,
                rarity: usedCard.rarity,
                teamName,
                teamId: id(meta.teamId),
              }
            : null,
        };
      }
      case "POWER_CARD_REQUESTED":
        return { text: `${teamName} requested ${cardName}`, icon: "✋", tone: "info", teamColor, notable: false };
      case "CARD_PURCHASED":
        return { text: `${teamName} bought ${cardName}`, icon: "🛒", tone: "store", teamColor, notable: false };
      case "COIN_AWARDED":
        return { text: `${teamName} earned coins`, icon: "🪙", tone: "store", teamColor, notable: false };
      case "STORE_OPENED":
        return { text: "Power Store is open", icon: "🏪", tone: "store", teamColor: null, notable: true };
      case "STORE_CLOSED":
        return { text: "Power Store closed", icon: "🏪", tone: "info", teamColor: null, notable: false };
      case "ANSWER_REVEALED":
        return { text: "Answer revealed", icon: "💡", tone: "info", teamColor: null, notable: false };
      case "ACHIEVEMENT_EARNED":
        return {
          text: `${teamName} earned ${String(meta.label ?? "an achievement")}`,
          icon: String(meta.emoji ?? "🏆"),
          tone: "achievement",
          teamColor,
          notable: true,
        };
      case "FLASH_SALE_STARTED":
        return {
          text: String(meta.text ?? "Flash Sale started"),
          icon: "⚡",
          tone: "store",
          teamColor: null,
          notable: true,
        };
      case "REWARD_DROP":
        return {
          text: meta.teamId ? `${teamName}: ${String(meta.text ?? "reward")}` : String(meta.text ?? "Reward drop!"),
          icon: "🎁",
          tone: "achievement",
          teamColor: meta.teamId ? teamColor : null,
          notable: true,
        };
      case "LUCKY_SPIN": {
        const bad = meta.kind === "PENALTY" || meta.kind === "NOTHING";
        const cardName = typeof meta.cardName === "string" ? meta.cardName : null;
        return {
          text: `${teamName}: Lucky Spin — ${String(meta.label ?? "")}${cardName ? `: ${cardName}` : ""}`,
          icon: String(meta.emoji ?? "🍀"),
          tone: bad ? "down" : "achievement",
          teamColor,
          notable: true,
        };
      }
      case "AUCTION_STARTED":
        return {
          text: `Auction started: ${String(meta.item ?? "a power card")}`,
          icon: "🔨",
          tone: "store",
          teamColor: null,
          notable: true,
        };
      case "AUCTION_SOLD":
        return {
          text: `${teamName} won ${String(meta.item ?? "the auction")} for ${Number(meta.amount ?? 0)} coins`,
          icon: "🔨",
          tone: "achievement",
          teamColor,
          notable: true,
        };
      case "AUCTION_CANCELLED":
        return { text: "Auction cancelled", icon: "🔨", tone: "info", teamColor: null, notable: false };
      case "CAPTAIN_CHANGED":
        return {
          text: String(meta.text ?? `${teamName} has a new captain`),
          icon: "👑",
          tone: "info",
          teamColor,
          notable: true,
        };
      // ANSWER_SUBMITTED deliberately has no feed entry — a team's written
      // answer must never appear on other teams' phones.
      default:
        return null;
    }
  }

  const feed = recentEvents
    .map((log) => {
      const entry = feedEntry(log);
      return entry ? { id: id(log._id), type: log.type, createdAt: log.createdAt, ...entry } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .slice(0, 12);

  // Live auction (if one is running). SECRET/LUCKY hide rival bids — the phone
  // only ever learns its own team's bid and how many teams are in.
  const openAuction = await Auction.findOne({ roomId: room._id, status: "OPEN" }).lean();
  let auctionView: Record<string, unknown> | null = null;
  if (openAuction) {
    const [auctionCard, allBids] = await Promise.all([
      PowerCard.findById(openAuction.powerCardId).select("name icon").lean<{ name: string; icon: string }>(),
      AuctionBid.find({ auctionId: openAuction._id }).select("teamId amount passed").lean(),
    ]);
    const myBidRow = selectedTeam ? allBids.find((b) => id(b.teamId) === id(selectedTeam._id)) : null;
    const leader = openAuction.currentBidTeamId
      ? teams.find((t) => id(t._id) === id(openAuction.currentBidTeamId))
      : null;
    const isPublic = openAuction.type === "NORMAL";
    const activeBidders = allBids.filter((b) => !b.passed);
    auctionView = {
      id: id(openAuction._id),
      type: openAuction.type,
      stage: openAuction.stage,
      itemName: auctionCard?.name ?? "Power card",
      itemIcon: auctionCard?.icon ?? "🎴",
      startingBid: openAuction.startingBid,
      minIncrement: openAuction.minIncrement,
      currentBid: isPublic ? openAuction.currentBid : 0,
      leaderName: isPublic ? leader?.name ?? null : null,
      leaderIsMe: isPublic && selectedTeam ? id(openAuction.currentBidTeamId) === id(selectedTeam._id) : false,
      bidderCount: allBids.length,
      // Teams still able to bid — lets a team see "you're the last one in" once
      // everyone else has passed or priced themselves out.
      activeBidderCount: activeBidders.length,
      myBid: myBidRow?.amount ?? null,
      myPassed: myBidRow?.passed ?? false,
    };
  }

  return NextResponse.json(
    serialize({
      serverNow: new Date().toISOString(),
      room: {
        id: id(room._id),
        name: room.name,
        roomCode: room.roomCode,
        status: room.status,
        storeStatus: room.liveState.storeStatus,
        answerMode: room.settings?.answerMode ?? "VERBAL",
        permissions: room.settings?.permissions,
      },
      // This device's team role + whether it currently controls team actions.
      me: meDevice
        ? {
            id: id(meDevice._id),
            name: meDevice.name,
            role: meDevice.role,
            canControl,
            isActingCaptain: canControl && meDevice.role !== "CAPTAIN",
            captainConnected: control.captainConnected,
            captainName: control.captain?.name ?? null,
          }
        : null,
      // My team's own submitted answer for the current question (captain-submit mode).
      myAnswer: myAnswerLog
        ? {
            text: String(myAnswerLog.metadata?.text ?? ""),
            submittedBy: String(myAnswerLog.metadata?.submittedBy ?? ""),
            createdAt: myAnswerLog.createdAt,
          }
        : null,
      // My team's MCQ selection state for the live question.
      myMcq: (() => {
        const isMCQ = Boolean(question?.isMCQ) && currentScene?.type === "QUESTION";
        if (!selectedTeam || !isMCQ) return null;
        const graded = mcqGraded
          ? {
              optionIndex: Number(mcqGraded.metadata?.optionIndex ?? -1),
              correct: Boolean(mcqGraded.metadata?.correct),
              points: Number(mcqGraded.metadata?.points ?? 0),
            }
          : null;
        const retryFirstPick = mcqRetry ? Number(mcqRetry.metadata?.firstPick ?? -1) : null;
        // Answerable only when it's this team's turn (assigned rounds) and the
        // question isn't graded yet or revealed. In Head-to-Head both duellists
        // have a turn, but the first correct answer closes it for the loser.
        const myTurn =
          !assignedTeamId ||
          assignedTeamId === id(selectedTeam._id) ||
          opponentTeamId === id(selectedTeam._id);
        const duelClosed = Boolean(duelWonLog);
        const canAnswer = !graded && !room.liveState?.showAnswer && myTurn && !duelClosed;
        return { graded, retryFirstPick, canAnswer, duelLost: duelClosed && !graded };
      })(),
      // Eligible Copycat targets on an OPEN question (no single assigned
      // team, e.g. ANY_TEAM rounds) — every team answers independently there,
      // so there's no implicit team to ride and the player must pick one.
      // Only teams that haven't answered yet qualify: copying an
      // already-graded team would be a risk-free guaranteed result, not a
      // gamble. Empty on assigned-turn questions, where Copycat auto-targets
      // the assigned team and needs no picker.
      copycatTargets:
        selectedTeam && !assignedTeamId && question?.isMCQ && currentScene?.type === "QUESTION"
          ? teams
              .filter((t) => id(t._id) !== id(selectedTeam._id))
              .filter((t) => !allMcqGraded.some((log) => String(log.metadata?.teamId ?? "") === id(t._id)))
              .map((t) => ({ id: id(t._id), name: t.name, color: t.color }))
          : [],
      // The host's most recent Correct/Wrong call on my team — a dedicated
      // signal (not inferred from the score number moving) so the phone can
      // show a reliable result even when the delta is 0 (Insurance/Shield
      // voided it, or a 0-point bonus mark).
      // Scoped to the LIVE question — once the host moves to the next one this
      // naturally goes back to null (no judgment yet for that question),
      // which is what lets the participant UI show a persistent "you got
      // this one right/wrong" banner without it going stale on the next Q.
      judgment: judgmentLog
        ? {
            id: id(judgmentLog._id),
            reason: judgmentLog.metadata?.reason as "CORRECT" | "WRONG",
            points: Number(judgmentLog.metadata?.points ?? 0),
          }
        : null,
      competition: {
        id: id(room.competitionId),
        title: competition?.title ?? room.name,
      },
      turn: {
        assignedTeamId,
        assignedTeamName: assignedTeam?.name ?? null,
        // Head-to-Head: the second team racing for this same question. Both
        // duellists get isMyTurn, so each sees the answer UI rather than a
        // "wait your turn" screen.
        opponentTeamId,
        opponentTeamName: opponentTeam?.name ?? null,
        isMyTurn: Boolean(
          selectedTeam &&
            (assignedTeamId === id(selectedTeam._id) || opponentTeamId === id(selectedTeam._id))
        ),
        // My team is frozen (an opponent's Freeze) on the live question.
        frozen: Boolean(
          selectedTeam &&
            room.currentQuestionId &&
            selectedTeam.frozenQuestionIds?.includes(id(room.currentQuestionId))
        ),
        // The host's verdict on whoever's turn this is — visible to every team
        // in the room (not just the assigned one), so watching teams see "Team
        // X answered correctly" instead of staying stuck on "Team X is
        // answering" until the host manually advances the scene.
        judgment: turnJudgmentLog
          ? {
              reason: turnJudgmentLog.metadata?.reason as "CORRECT" | "WRONG",
              points: Number(turnJudgmentLog.metadata?.points ?? 0),
              // Which MCQ option the assigned team picked — null for
              // non-MCQ/host-judged questions, where there's no option to show.
              optionIndex: turnMcqGraded ? Number(turnMcqGraded.metadata?.optionIndex ?? -1) : null,
              // The pick they burned a Double Guess on before settling, if any.
              retryOptionIndex: turnMcqRetry ? Number(turnMcqRetry.metadata?.firstPick ?? -1) : null,
            }
          : null,
      },
      // Drawing board context (DRAWING scenes only). Tells this phone whether
      // it holds the pen — the strokes themselves come from the dedicated
      // /drawing poll, not this payload, to keep the 2s poll small.
      drawing:
        currentScene?.type === "DRAWING"
          ? (() => {
              const drawerTeamId = room.liveState?.drawerTeamId
                ? id(room.liveState.drawerTeamId)
                : null;
              const drawerTeam = drawerTeamId ? teams.find((t) => id(t._id) === drawerTeamId) : null;
              const isDrawerTeam = Boolean(selectedTeam && drawerTeamId === id(selectedTeam._id));
              return {
                drawerTeamId,
                drawerTeamName: drawerTeam?.name ?? null,
                isDrawerTeam,
                canDraw: isDrawerTeam && canControl,
              };
            })()
          : null,
      currentScene: currentScene
        ? {
            id: id(currentScene._id),
            type: currentScene.type,
            title: sceneTitle(currentScene),
            content: currentScene.content ?? {},
            settings: currentScene.settings ?? {},
            order: currentScene.order,
          }
        : {
            id: null,
            type: "WAITING",
            title: "Waiting for host",
            content: {},
            settings: {},
            order: 0,
          },
      timer: {
        startedAt: room.liveState.timerStartedAt,
        endsAt: room.liveState.timerEndsAt,
        paused: room.liveState.timerPaused,
        showAnswer: room.liveState.showAnswer,
      },
      round: round
        ? {
            id: id(round._id),
            title: round.title,
            rules: round.rules,
            description: round.description,
            specialMode: round.specialMode ?? "NONE",
            defaultTimer: round.defaultTimer,
            positiveMarks: round.positiveMarks,
            negativeMarks: round.negativeMarks,
            coinReward: round.coinReward ?? 0,
            allowedPowerCards: roundIsRestricted
              ? visibleCards
                  .filter((card) => isAllowedThisRound(id(card._id)))
                  .map((card) => ({ id: id(card._id), name: card.name, icon: card.icon }))
              : null,
          }
        : null,
      // Display-only position within the round (see questionPosition above) —
      // null off a question scene.
      questionPosition,
      question: question
        ? {
            id: id(question._id),
            type: question.type,
            question: question.question,
            media: question.media ?? null,
            // The scene's stamped timer, not the question's own — the scene
            // already resolved round.defaultTimer vs. the question's CUSTOM
            // override at scene-generation time (see effectiveTimers in
            // scene.actions.ts). question.timer is just the DB field's raw
            // value (defaults to 20), which showed as the pre-countdown
            // number even when the round's real timer was 60.
            timer:
              typeof currentScene?.settings?.timer === "number" ? currentScene.settings.timer : question.timer,
            positiveMarks: question.positiveMarks,
            negativeMarks: question.negativeMarks,
            isMCQ: question.isMCQ,
            options: question.options ?? [],
            answer: room.liveState.showAnswer ? question.answer : null,
            // Only send this team the hints it has actually unlocked with the
            // Hint card — others get none, so hint text never leaks early.
            hints: (question.hints ?? []).slice(
              0,
              selectedTeam?.hintsRevealed?.find((h) => h.questionId === id(question._id))?.count ?? 0
            ),
            // Total hint count (not the text) so a team can tell Hint is
            // exhausted/unavailable without spoiling anything for others.
            hintsTotal: question.hints?.length ?? 0,
            // Peek's elimination is public once used — visible to every team,
            // not just whoever spent the card, so the whole room benefits from
            // one team's reveal. Only the assigned team can ever play Peek
            // (powerCardPlayability), so there's at most one peek per question;
            // this naturally still resolves to "my own" when I'm that team.
            peekedOptionIndex:
              assignedTeam?.peeks?.find((p) => p.questionId === id(question._id))?.eliminatedOptionIndex ?? null,
            // Per-team picks for the Answer Reveal screen — who answered what,
            // across every team, not just the assigned/watching one. Held back
            // until the host actually reveals, same as `answer` above, so a
            // question can't be spoiled by peeking at this field mid-answer.
            teamAnswers: room.liveState.showAnswer
              ? allMcqGraded.map((log) => {
                  const teamId = String(log.metadata?.teamId ?? "");
                  const meta = teamMetaById.get(teamId);
                  return {
                    teamId,
                    teamName: meta?.name ?? "Team",
                    teamColor: meta?.color ?? "#6C7BFA",
                    optionIndex: Number(log.metadata?.optionIndex ?? -1),
                    correct: Boolean(log.metadata?.correct),
                  };
                })
              : [],
          }
        : null,
      team: selectedTeam
        ? {
            id: id(selectedTeam._id),
            name: selectedTeam.name,
            color: selectedTeam.color,
            score: selectedTeam.score,
            coins: selectedTeam.coins,
            members: selectedTeam.members ?? [],
            devices: teamDevices.map((d) => ({
              id: id(d._id),
              name: d.name,
              role: d.role,
              connected: isDeviceConnected(d.lastSeenAt, nowMs),
            })),
            rank: sortedTeams.findIndex((team) => id(team._id) === id(selectedTeam._id)) + 1,
            streak: selectedTeam.stats?.streak ?? 0,
            bestStreak: selectedTeam.stats?.bestStreak ?? 0,
          }
        : null,
      leaderboard: sortedTeams.map((team, index) => ({
        id: id(team._id),
        name: team.name,
        color: team.color,
        score: team.score,
        coins: team.coins,
        rank: index + 1,
      })),
      powers: {
        storeOpen: room.liveState.storeStatus === "OPEN",
        economyEnabled: competition?.settings?.economy?.enabled ?? false,
        flashSale: flashSaleLive(room.liveState)
          ? { active: true, percent: room.liveState.flashSalePercent, endsAt: room.liveState.flashSaleEndsAt }
          : { active: false, percent: 0, endsAt: null },
        cards: visibleCards.map((card) => {
          const owned = inventoryByCard.get(id(card._id));
          const request = requestByCard.get(id(card._id));
          const liveRequest =
            request && ["REQUESTED", "APPROVED", "ACTIVE"].includes(request.status)
              ? request
              : null;
          const price = effectivePrice(card.price, room.liveState);
          return {
            id: id(card._id),
            name: card.name,
            description: card.description,
            icon: card.icon,
            effectType: card.effectType,
            category: card.category,
            rarity: card.rarity,
            price,
            basePrice: card.price,
            onSale: price < card.price,
            isMystery: card.effectType === "MYSTERY",
            limited: card.stock !== null,
            stock: card.stock,
            requiresApproval: card.requiresApproval,
            remainingUses: owned?.remainingUses ?? 0,
            requestable:
              Boolean(owned && owned.remainingUses > 0 && owned.status === "AVAILABLE") &&
              !liveRequest,
            status: liveRequest?.status ?? owned?.status ?? "AVAILABLE",
            requestId: liveRequest ? id(liveRequest._id) : null,
            // False when this round's CUSTOM allow-list doesn't include the
            // card — it still shows (sorted to the bottom) rather than
            // disappearing, so an owned card never vanishes without explanation.
            allowedThisRound: isAllowedThisRound(id(card._id)),
          };
        }),
      },
      feed,
      auction: auctionView,
      broadcast: latestBroadcast
        ? {
            id: id(latestBroadcast._id),
            message: String(latestBroadcast.metadata?.message ?? ""),
            createdAt: latestBroadcast.createdAt,
          }
        : null,
      recentScores: recentScores.map((score) => ({
        id: id(score._id),
        teamId: id(score.teamId),
        points: score.points,
        reason: score.reason,
        isUndo: score.isUndo,
        isReverted: score.isReverted ?? false,
        createdAt: score.createdAt,
      })),
    })
  );
}
