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

  const currentScene =
    (room.currentSceneId && scenes.find((scene) => id(scene._id) === id(room.currentSceneId))) ||
    scenes.find((scene) => scene.isActive) ||
    scenes[0] ||
    null;

  const [question, round] = await Promise.all([
    currentScene?.questionId ? Question.findById(currentScene.questionId).lean<IQuestion>() : null,
    currentScene?.roundId ? Round.findById(currentScene.roundId).lean<IRound>() : null,
  ]);

  const selectedTeam = teamId ? teams.find((team) => id(team._id) === teamId) ?? null : null;
  const assignedTeamId = typeof currentScene?.settings?.assignedTeamId === "string"
    ? currentScene.settings.assignedTeamId
    : null;
  const assignedTeam = assignedTeamId
    ? teams.find((team) => id(team._id) === assignedTeamId) ?? null
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

  // Team device roles: who controls this team right now. The captain while
  // connected; otherwise the connected vice captain acts as temporary captain.
  const nowMs = Date.now();
  const control = resolveTeamControl(teamDevices, nowMs);
  const meDevice = participantId ? teamDevices.find((d) => id(d._id) === participantId) ?? null : null;
  const canControl = Boolean(meDevice && control.actingCaptainId === id(meDevice._id));

  // A round with powerCardMode "CUSTOM" restricts play to its allow-list —
  // plus whatever the host has force-enabled for this room's live event
  // (Room.powerCardOverrides). Participants must never see a card that
  // isn't actually usable right now (mirrors the same check the server
  // enforces in requestPowerCard/purchasePowerCard).
  // Same-named catalog entries (e.g. leftover duplicates from before card
  // names were enforced unique) would otherwise show as repeated tiles in
  // the store — collapse to one card per name, keeping the first (cheapest,
  // since catalog is price-sorted).
  const uniqueCatalog = [...new Map(catalog.map((card) => [card.name, card])).values()];

  const roundIsRestricted = round?.powerCardMode === "CUSTOM";
  const allowedCardIds = new Set([...(round?.allowedPowerCards ?? []), ...(room.powerCardOverrides ?? [])]);
  const excludedCardIds = new Set(room.powerCardExclusions ?? []);
  const visibleCards = uniqueCatalog
    .filter((card) => (roundIsRestricted ? allowedCardIds.has(id(card._id)) : true))
    .filter((card) => !excludedCardIds.has(id(card._id)));

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
    const teamName = teamMeta?.name ?? "A team";
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
        return {
          text: `${teamName}: Lucky Spin — ${String(meta.label ?? "")}`,
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
      AuctionBid.find({ auctionId: openAuction._id }).select("teamId amount").lean(),
    ]);
    const myBid = selectedTeam
      ? allBids.find((b) => id(b.teamId) === id(selectedTeam._id))?.amount ?? null
      : null;
    const leader = openAuction.currentBidTeamId
      ? teams.find((t) => id(t._id) === id(openAuction.currentBidTeamId))
      : null;
    const isPublic = openAuction.type === "NORMAL";
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
      myBid,
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
      competition: {
        id: id(room.competitionId),
        title: competition?.title ?? room.name,
      },
      turn: {
        assignedTeamId,
        assignedTeamName: assignedTeam?.name ?? null,
        isMyTurn: Boolean(selectedTeam && assignedTeamId === id(selectedTeam._id)),
        // My team is frozen (an opponent's Freeze) on the live question.
        frozen: Boolean(
          selectedTeam &&
            room.currentQuestionId &&
            selectedTeam.frozenQuestionIds?.includes(id(room.currentQuestionId))
        ),
      },
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
              ? visibleCards.map((card) => ({ id: id(card._id), name: card.name, icon: card.icon }))
              : null,
          }
        : null,
      question: question
        ? {
            id: id(question._id),
            type: question.type,
            question: question.question,
            media: question.media ?? null,
            timer: question.timer,
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
            // This team's own Peek result, if they used it on this question —
            // the index of one wrong option, to strike through client-side.
            peekedOptionIndex:
              selectedTeam?.peeks?.find((p) => p.questionId === id(question._id))?.eliminatedOptionIndex ?? null,
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
