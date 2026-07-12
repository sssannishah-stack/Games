"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateScenes,
  pauseTimer,
  publishScene,
  reorderScenes,
  resetTimer,
  revealAnswer,
  startEvent,
  startTimer,
  stepScene,
} from "@/actions/scene.actions";
import { sendBroadcast } from "@/actions/broadcast.actions";
import { resetRoom } from "@/actions/room.actions";
import { RoomResetModal } from "@/components/room/RoomResetModal";
import {
  closeStore,
  endFlashSale,
  freeRewardDrop,
  giveFreeCard,
  hostActivatePowerCard,
  hostConsumePowerCard,
  hostForceActivatePowerCard,
  hostRemoveTeamPowerCard,
  openStore,
  resolvePowerCardRequest,
  startFlashSale,
  toggleRoomPowerCardOverride,
  toggleRoomPowerCardExclusion,
} from "@/actions/powerCard.actions";
import { giveCoins } from "@/actions/coin.actions";
import { setTeamDeviceRole } from "@/actions/team.actions";
import { giveMarks, hostUndoScoreTransaction } from "@/actions/score.actions";
import { setDrawer } from "@/actions/drawing.actions";
import { LiveDrawBoard } from "@/components/draw/LiveDrawBoard";
import { useSound } from "@/lib/sound/useSound";
import { SoundToggle } from "@/components/sound/SoundToggle";
import { awardAchievement, dismissAchievement, giveManualAchievement } from "@/actions/achievement.actions";
import { luckySpin, type SpinResult } from "@/actions/surprise.actions";
import {
  startAuction,
  advanceAuctionStage,
  settleAuction,
  cancelAuction,
} from "@/actions/auction.actions";
import { ACHIEVEMENTS, MANUAL_ACHIEVEMENTS } from "@/lib/achievements";
import { SPIN_SEGMENTS } from "@/lib/luckySpin";
import { ROUND_MODES } from "@/lib/roundModes";
import { timerUrgency, TIMER_URGENCY_TEXT } from "@/lib/timerUrgency";
import { sceneVisual } from "@/lib/sceneVisual";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import type { RoomDetail } from "@/data/queries/room.queries";
import type { SceneRecord } from "@/data/queries/scene.queries";
import type { QuestionRecord } from "@/data/queries/question.queries";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { EventLogRecord } from "@/data/queries/eventLog.queries";
import type {
  PowerCardRequestRecord,
  PowerCardRecord,
  TeamPowerCardRecord,
} from "@/data/queries/powerCard.queries";
import type { ParticipantRecord } from "@/data/queries/participant.queries";
import type { ScoreTransactionRecord } from "@/data/queries/score.queries";
import type { AchievementRecord } from "@/data/queries/achievement.queries";
import type { ActiveAuction } from "@/data/queries/auction.queries";
import type { ScoreReason, PowerCardEffectType, AchievementType, AuctionType, SpecialRoundMode } from "@/types/db";

interface ActiveEffect {
  name: string;
  icon: string;
  effectType: PowerCardEffectType;
}

const SCORE_VALUES = [50, 20, 10, 5, 0, -5, -10];
const SCORE_REASONS: ScoreReason[] = ["CORRECT", "WRONG", "BONUS", "PENALTY", "MANUAL"];
const STATUS_BADGE: Record<RoomDetail["status"], BadgeProps["variant"]> = {
  DRAFT: "plain",
  TESTING: "warn",
  READY: "accent",
  LIVE: "live",
  COMPLETED: "success",
};
const STATUS_LABEL: Record<RoomDetail["status"], string> = {
  DRAFT: "DRAFT",
  TESTING: "TESTING",
  READY: "READY",
  LIVE: "LIVE",
  COMPLETED: "COMPLETED",
};

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const LOG_VISUAL: Record<string, { icon: string; color: string }> = {
  SCORE_CHANGED: { icon: "trending-up", color: "text-success" },
  POWER_CARD_USED: { icon: "zap", color: "text-accent" },
  POWER_CARD_REQUESTED: { icon: "hand", color: "text-info" },
  CARD_PURCHASED: { icon: "shopping-cart", color: "text-warn" },
  COIN_AWARDED: { icon: "coins", color: "text-warn" },
  STORE_OPENED: { icon: "store", color: "text-warn" },
  STORE_CLOSED: { icon: "store", color: "text-mute-2" },
  ACHIEVEMENT_EARNED: { icon: "award", color: "text-warn" },
  FLASH_SALE_STARTED: { icon: "zap", color: "text-warn" },
  REWARD_DROP: { icon: "gift", color: "text-warn" },
  LUCKY_SPIN: { icon: "disc-3", color: "text-accent" },
  AUCTION_STARTED: { icon: "gavel", color: "text-warn" },
  AUCTION_SOLD: { icon: "gavel", color: "text-success" },
  AUCTION_CANCELLED: { icon: "gavel", color: "text-mute-2" },
  BROADCAST_SENT: { icon: "megaphone", color: "text-accent" },
  ANSWER_REVEALED: { icon: "lightbulb", color: "text-warn" },
  SCENE_CHANGED: { icon: "clapperboard", color: "text-mute-2" },
  TIMER_STARTED: { icon: "play", color: "text-mute-2" },
  TIMER_STOPPED: { icon: "pause", color: "text-mute-2" },
  EVENT_STARTED: { icon: "flag", color: "text-success" },
  COMPETITION_STARTED: { icon: "flag", color: "text-success" },
};

type LogFilter = "ALL" | "POWER" | "STORE" | "AUCTION" | "SCORE" | "BROADCAST" | "GENERAL";

/** Which filter bucket a log type falls under (for the Event Log filters). */
const LOG_CATEGORY: Record<string, Exclude<LogFilter, "ALL">> = {
  POWER_CARD_REQUESTED: "POWER",
  POWER_CARD_USED: "POWER",
  CARD_PURCHASED: "STORE",
  STORE_OPENED: "STORE",
  STORE_CLOSED: "STORE",
  FLASH_SALE_STARTED: "STORE",
  REWARD_DROP: "STORE",
  AUCTION_STARTED: "AUCTION",
  AUCTION_SOLD: "AUCTION",
  AUCTION_CANCELLED: "AUCTION",
  SCORE_CHANGED: "SCORE",
  ACHIEVEMENT_EARNED: "SCORE",
  COIN_AWARDED: "SCORE",
  LUCKY_SPIN: "SCORE",
  BROADCAST_SENT: "BROADCAST",
};
function logCategory(type: string): Exclude<LogFilter, "ALL"> {
  return LOG_CATEGORY[type] ?? "GENERAL";
}
const LOG_FILTERS: LogFilter[] = ["ALL", "SCORE", "POWER", "STORE", "AUCTION", "BROADCAST", "GENERAL"];

/** One-tap announcements for the Broadcast composer. */
const BROADCAST_TEMPLATES: { label: string; message: string }[] = [
  { label: "Round Starting", message: "The next round is starting — get ready!" },
  { label: "Store Open", message: "The Power Store is now OPEN. Spend your coins!" },
  { label: "Maintain Silence", message: "Please maintain silence during the question." },
  { label: "Tea Break", message: "Short break — back in 10 minutes." },
  { label: "Final Round", message: "This is the FINAL round. Give it everything!" },
];

/**
 * A collapsible module for the right-hand Quick Controls rail — a titled,
 * self-managing accordion so the host can fold away what they don't need and
 * keep the panel scroll-free. Purely presentational; all controls live inside.
 */
function Module({
  title,
  icon,
  accent = "#6C7BFA",
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: string;
  accent?: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-line/[.08] bg-line/[.03] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 cursor-pointer hover:bg-line/[.03]"
      >
        <Icon name={icon} size={14} style={{ color: accent }} className="shrink-0" />
        <span className="text-[12px] font-bold tracking-[.06em] text-ink-2 uppercase">{title}</span>
        {badge}
        <Icon name={open ? "chevron-up" : "chevron-down"} size={14} className="ml-auto text-dim shrink-0" />
      </button>
      {open && <div className="px-3.5 pb-3.5 pt-0.5 flex flex-col gap-2.5">{children}</div>}
    </section>
  );
}

/** A compact label/value chip for the LIVE STATUS dashboard. */
function StatChip({
  label,
  value,
  tone = "#8EA0B8",
  pulse,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-line/[.08] bg-line/[.03] px-2.5 py-2">
      <span className="flex items-center gap-1 text-[8.5px] font-bold tracking-[.14em] text-mute-2">
        {pulse && <span className="w-1.5 h-1.5 rounded-full animate-enc-pulse" style={{ background: tone }} />}
        {label}
      </span>
      <span className="text-[13px] font-black tabular-nums" style={{ color: tone }}>
        {value}
      </span>
    </div>
  );
}

interface HostConsoleProps {
  room: RoomDetail;
  scenes: SceneRecord[];
  rounds: RoundRecord[];
  questions: QuestionRecord[];
  teams: TeamRecord[];
  logs: EventLogRecord[];
  powerRequests: PowerCardRequestRecord[];
  scoreHistory: ScoreTransactionRecord[];
  cards: PowerCardRecord[];
  ownedCards: TeamPowerCardRecord[];
  participants: ParticipantRecord[];
  achievements: AchievementRecord[];
  auction: ActiveAuction | null;
}

export function HostConsole({
  room,
  scenes,
  rounds,
  questions,
  teams,
  logs,
  powerRequests,
  scoreHistory,
  cards,
  ownedCards,
  participants,
  achievements,
  auction,
}: HostConsoleProps) {
  const router = useRouter();
  const play = useSound();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [broadcast, setBroadcast] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [teamCoinAmount, setTeamCoinAmount] = useState(100);
  const [teamCardId, setTeamCardId] = useState(cards[0]?.id ?? "");
  const [scoringOpen, setScoringOpen] = useState(false);
  const [scoringTeamId, setScoringTeamId] = useState(teams[0]?.id ?? "");
  const [scoringSeed, setScoringSeed] = useState(10);
  // Coins awarded for a CORRECT answer via the quick Mark Answer buttons.
  // Seeded from the live round's coin reward, editable per round by the host.
  const [answerCoins, setAnswerCoins] = useState(0);
  const [manualAchTeamId, setManualAchTeamId] = useState(teams[0]?.id ?? "");
  const [manualAchType, setManualAchType] = useState<AchievementType>(MANUAL_ACHIEVEMENTS[0]);
  const [spinOpen, setSpinOpen] = useState(false);
  const [surpriseTeamId, setSurpriseTeamId] = useState(teams[0]?.id ?? "");
  const [bonusTarget, setBonusTarget] = useState("__ALL__");
  const [bonusAmount, setBonusAmount] = useState(200);
  const [auctionType, setAuctionType] = useState<AuctionType>("NORMAL");
  const [auctionCardId, setAuctionCardId] = useState(cards[0]?.id ?? "");
  const [auctionStartBid, setAuctionStartBid] = useState(500);
  const [scoreFloat, setScoreFloat] = useState<{ id: number; points: number; team: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  // Control-room chrome: the rare-tools drawer, the center preview tab, and
  // which round groups are collapsed in the flow rail + the log filter.
  const [eventActionsOpen, setEventActionsOpen] = useState(false);
  const [centerTab, setCenterTab] = useState<"QUESTION" | "ANSWER" | "HINTS" | "MEDIA" | "NOTES">("QUESTION");
  const [collapsedRounds, setCollapsedRounds] = useState<Set<string>>(new Set());
  const [logFilter, setLogFilter] = useState<LogFilter>("ALL");
  // Auto-start the timer whenever a question scene goes live, so the host
  // doesn't have to hit Start on every question. Persisted so it survives the
  // router.refresh() that follows each action.
  const [autoStartTimer, setAutoStartTimer] = useState(false);
  useEffect(() => {
    setAutoStartTimer(window.localStorage.getItem("enc-host-autostart-timer") === "1");
  }, []);
  function toggleAutoStart(next: boolean) {
    setAutoStartTimer(next);
    window.localStorage.setItem("enc-host-autostart-timer", next ? "1" : "0");
  }

  const current = scenes.find((scene) => scene.id === room.currentSceneId) ?? scenes[0] ?? null;
  const question = current?.questionId ? questions.find((item) => item.id === current.questionId) : null;
  const round = current?.roundId ? rounds.find((item) => item.id === current.roundId) : null;
  const overrideSet = new Set(room.powerCardOverrides);
  const exclusionSet = new Set(room.powerCardExclusions);
  const roundIsRestricted = round?.powerCardMode === "CUSTOM";

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const assignedTeamId = typeof current?.settings?.assignedTeamId === "string"
    ? current.settings.assignedTeamId
    : null;
  const assignedTeam = assignedTeamId ? teamById.get(assignedTeamId) ?? null : null;
  const assignmentSource = typeof current?.settings?.assignmentSource === "string"
    ? current.settings.assignmentSource
    : null;
  // Has the assigned team already gotten a whole-team Correct/Wrong verdict
  // on this question? Tapping the other button afterward used to just stack
  // a second mark on top — block it here too (server also enforces this).
  const alreadyJudgedTransaction =
    assignedTeamId && question
      ? scoreHistory.find(
          (entry) =>
            entry.teamId === assignedTeamId &&
            entry.questionId === question.id &&
            !entry.participantId &&
            (entry.reason === "CORRECT" || entry.reason === "WRONG") &&
            !entry.isUndo &&
            !entry.isReverted
        )
      : undefined;
  const ownedByTeam = new Map<string, TeamPowerCardRecord[]>();
  for (const owned of ownedCards) {
    const list = ownedByTeam.get(owned.teamId) ?? [];
    list.push(owned);
    ownedByTeam.set(owned.teamId, list);
  }

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  // The host console only refreshed on its OWN actions — anything a
  // participant does (play Extra Time, buy from the store, submit an MCQ
  // answer) updated the database but never reached this screen until the
  // host happened to click something themselves. Poll for it instead, same
  // idea as the participant phone's live fetch loop.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!pending) router.refresh();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [pending, router]);

  useEffect(() => {
    if (!scoreFloat) return;
    const t = window.setTimeout(() => setScoreFloat(null), 1500);
    return () => window.clearTimeout(t);
  }, [scoreFloat]);

  const secondsLeft = useMemo(() => {
    if (!room.liveState.timerEndsAt || room.liveState.timerPaused) return null;
    return Math.max(0, Math.ceil((new Date(room.liveState.timerEndsAt).getTime() - now) / 1000));
  }, [room.liveState.timerEndsAt, room.liveState.timerPaused, now]);

  const timerRunning = Boolean(room.liveState.timerStartedAt) && !room.liveState.timerPaused;
  const timerDisplay =
    secondsLeft !== null ? formatClock(secondsLeft) : room.liveState.timerPaused ? "PAUSED" : "--:--";

  const liveStatus: "WAITING" | "TIMER_RUNNING" | "ANSWER_REVEALED" = room.liveState.showAnswer
    ? "ANSWER_REVEALED"
    : timerRunning
      ? "TIMER_RUNNING"
      : "WAITING";

  // When the live round changes, reseed the quick-mark coin amount from that
  // round's configured coin reward (host can still override per question).
  useEffect(() => {
    setAnswerCoins(round?.coinReward ?? 0);
  }, [round?.id, round?.coinReward]);

  // Auto-start: the moment a fresh question/drawing scene becomes live (and
  // the option is on), kick off its timer. Tracked per-scene so it fires once
  // per scene — the host can still Pause without it immediately restarting.
  const autoStartedSceneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoStartTimer || !current) {
      if (!current) autoStartedSceneRef.current = null;
      return;
    }
    const timed = current.type === "QUESTION" || current.type === "DRAWING";
    if (!timed) return;
    if (autoStartedSceneRef.current === current.id) return;
    autoStartedSceneRef.current = current.id;
    if (!timerRunning) {
      action(() => startTimer(room.id, Number(current.settings?.timer ?? 30)).then(() => undefined));
    }
    // room.currentSceneId drives `current`; re-run only when the live scene
    // changes or the option is toggled — not on every timer tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.currentSceneId, autoStartTimer]);

  const questionIndex = round && question ? round.questionIds.indexOf(question.id) + 1 : null;
  const connectedCount = room.onlineDevices || participants.length;
  // Live-status dashboard figures — captains actually connected, and how many
  // power requests are still waiting on the host.
  const captainsConnected = participants.filter(
    (p) => p.role === "CAPTAIN" && p.connected
  ).length;
  const pendingRequestCount = powerRequests.filter((r) => r.status === "REQUESTED").length;
  const storeOpen = room.storeStatus === "OPEN";
  // Where the host is in the flow — 112 steps is too many to track by memory.
  const stepIndex = current ? scenes.findIndex((scene) => scene.id === current.id) + 1 : 0;
  const stepFraction = scenes.length > 0 && stepIndex > 0 ? stepIndex / scenes.length : 0;

  const setupChecklist = [
    { label: "Teams", ready: teams.length > 0 },
    { label: "Rounds", ready: rounds.length > 0 },
    { label: "Questions", ready: questions.length > 0 },
    { label: "Scenes", ready: scenes.length > 0 },
  ];
  const canGenerateScenes = rounds.length > 0 && questions.length > 0;

  type FlowGroup = { key: string; label: string; scenes: SceneRecord[] };
  const flowGroups = useMemo(() => {
    const groups: FlowGroup[] = [];
    for (const scene of scenes) {
      const key = scene.roundId ?? "_";
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.scenes.push(scene);
      } else {
        const label = scene.roundId
          ? (rounds.find((r) => r.id === scene.roundId)?.title ?? "Round")
          : scene.type === "WELCOME"
            ? "Intro"
            : scene.type === "WINNER"
              ? "Finale"
              : "General";
        groups.push({ key, label, scenes: [scene] });
      }
    }
    return groups;
  }, [scenes, rounds]);


  function formatLog(log: EventLogRecord): string {
    const metadata = log.metadata ?? {};
    const teamName = (id: unknown) => teamById.get(String(id))?.name ?? "Team";
    const cardName = (id: unknown) => cardById.get(String(id))?.name ?? "a card";
    switch (log.type) {
      case "SCENE_CHANGED":
        return `Scene changed to ${String(metadata.title ?? metadata.sceneType ?? "").trim() || "next scene"}`;
      case "SCORE_CHANGED": {
        const points = Number(metadata.points ?? 0);
        const prefix = metadata.isUndo ? "Undo — " : "";
        return `${prefix}${teamName(metadata.teamId)} ${points >= 0 ? "+" : ""}${points}`;
      }
      case "TIMER_STARTED":
        return "Timer started";
      case "TIMER_STOPPED":
        return metadata.reset ? "Timer reset" : "Timer paused";
      case "POWER_CARD_REQUESTED":
        return `${teamName(metadata.teamId)} requested ${cardName(metadata.powerCardId)}`;
      case "POWER_CARD_USED":
        return metadata.source === "HOST_REMOVED"
          ? `${teamName(metadata.teamId)}'s ${cardName(metadata.powerCardId)} removed`
          : `${teamName(metadata.teamId)} used ${cardName(metadata.powerCardId)}`;
      case "CARD_PURCHASED":
        return `${teamName(metadata.teamId)} bought ${cardName(metadata.powerCardId)}`;
      case "COIN_AWARDED":
        return `${teamName(metadata.teamId)} received coins`;
      case "STORE_OPENED":
        return "Power Store opened";
      case "STORE_CLOSED":
        return "Power Store closed";
      case "FLASH_SALE_STARTED":
        return String(metadata.text ?? "Flash Sale started");
      case "REWARD_DROP":
        return metadata.teamId
          ? `${teamName(metadata.teamId)}: ${String(metadata.text ?? "reward")}`
          : String(metadata.text ?? "Free reward drop");
      case "LUCKY_SPIN":
        return `${teamName(metadata.teamId)}: Lucky Spin — ${String(metadata.label ?? "")}`;
      case "AUCTION_STARTED":
        return `Auction started: ${String(metadata.item ?? "a card")}`;
      case "AUCTION_SOLD":
        return `${teamName(metadata.teamId)} won ${String(metadata.item ?? "the auction")} for ${Number(metadata.amount ?? 0)}`;
      case "AUCTION_CANCELLED":
        return "Auction cancelled";
      case "BROADCAST_SENT":
        return `Broadcast: "${String(metadata.message ?? "")}"`;
      case "ANSWER_REVEALED":
        return "Answer revealed";
      case "ACHIEVEMENT_EARNED":
        return `${teamName(metadata.teamId)} earned ${String(metadata.label ?? "an achievement")}`;
      case "EVENT_STARTED":
      case "COMPETITION_STARTED":
        return "Event started";
      default:
        return log.type.replace(/_/g, " ").toLowerCase();
    }
  }

  function action(run: () => Promise<void>) {
    startTransition(async () => {
      try {
        setFeedback(null);
        await run();
        router.refresh();
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : "Action failed.");
      }
    });
  }

  function openScoring(teamId: string, seed: number) {
    setScoringTeamId(teamId);
    setScoringSeed(seed);
    setScoringOpen(true);
  }

  // One-tap correct/wrong for the current question. Awards the round's
  // marks to the given team (the assigned team by default) with the right
  // reason, and floats the delta — same path as the Give Marks panel, just
  // without the modal. Negative marks on an insured team are voided, and
  // Shield/Double Points/Gamble are auto-applied, server-side (see
  // giveMarks) — mirror that same adjustment here so the floating number
  // matches what actually lands instead of the pre-multiplier base marks.
  function quickMark(teamId: string, correct: boolean) {
    if (!teamId) return;
    const magnitude = correct
      ? Math.abs(round?.positiveMarks ?? 10)
      : Math.abs(round?.negativeMarks ?? 5);
    // The BASE marks — this is what's actually sent to the server. giveMarks
    // applies Shield/Double/Gamble itself; sending an already-adjusted value
    // here would double-apply the multiplier server-side.
    const points = correct ? magnitude : -magnitude;

    // Preview-only: mirror the server's adjustment so the floating number
    // shown to the host matches what will actually land, not the raw base.
    let previewPoints = points;
    const activeEffectTypes = new Set(
      (ownedByTeam.get(teamId) ?? [])
        .filter((o) => o.status === "ACTIVE")
        .map((o) => cardById.get(o.powerCardId)?.effectType)
    );
    if (previewPoints < 0) {
      if (activeEffectTypes.has("BLOCK_NEGATIVE")) previewPoints = 0;
      else if (activeEffectTypes.has("GAMBLE")) previewPoints *= 2;
    } else if (activeEffectTypes.has("GAMBLE") || activeEffectTypes.has("DOUBLE_SCORE")) {
      previewPoints *= 2;
    }

    if (previewPoints !== 0) {
      setScoreFloat({ id: Date.now(), points: previewPoints, team: teamById.get(teamId)?.name ?? "Team" });
    }
    play(correct ? "correct" : "wrong");
    action(async () => {
      await giveMarks({
        roomId: room.id,
        teamId,
        points,
        reason: correct ? "CORRECT" : "WRONG",
        participantId: null,
        questionId: question?.id ?? null,
      });
      // Economy Mode: a correct answer also pays out coins (wrong pays 0).
      if (correct && room.economyEnabled && answerCoins > 0) {
        await giveCoins(room.id, teamId, answerCoins, "Correct answer");
      }
    });
  }

  // Preset one-tap adjustment for the current team — a fast manual delta
  // (reason MANUAL so it never collides with the CORRECT/WRONG "already
  // judged" guard). The Correct/Wrong buttons remain the way to *judge* an
  // answer; these are for quick bonuses/penalties without opening the modal.
  function quickPoints(points: number) {
    const teamId = assignedTeamId ?? teams[0]?.id;
    if (!teamId || points === 0) return;
    setScoreFloat({ id: Date.now(), points, team: teamById.get(teamId)?.name ?? "Team" });
    play(points >= 0 ? "correct" : "wrong");
    action(() =>
      giveMarks({
        roomId: room.id,
        teamId,
        points,
        reason: "MANUAL",
        participantId: null,
        questionId: question?.id ?? null,
      })
    );
  }

  function toggleTimer() {
    action(() =>
      timerRunning ? pauseTimer(room.id) : startTimer(room.id, Number(current?.settings?.timer ?? 30))
    );
  }

  function addTime(seconds: number) {
    const next = Math.max(1, (secondsLeft ?? Number(current?.settings?.timer ?? 30)) + seconds);
    action(() => startTimer(room.id, next));
  }

  function jumpToLeaderboard() {
    const currentOrder = current?.order ?? -1;
    const target =
      scenes.find((scene) => scene.type === "LEADERBOARD" && scene.order >= currentOrder) ??
      scenes.find((scene) => scene.type === "LEADERBOARD");
    if (target) action(() => publishScene(room.id, target.id).then(() => undefined));
  }

  function moveScene(sceneId: string, direction: "up" | "down") {
    const index = scenes.findIndex((scene) => scene.id === sceneId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= scenes.length) return;
    const nextOrder = scenes.map((scene) => scene.id);
    [nextOrder[index], nextOrder[target]] = [nextOrder[target], nextOrder[index]];
    action(() => reorderScenes(room.id, nextOrder));
  }

  function sendCurrentBroadcast() {
    action(async () => {
      if (!broadcast.trim()) return;
      await sendBroadcast(room.id, broadcast);
      setBroadcast("");
    });
  }

  function sendTemplate(message: string) {
    action(() => sendBroadcast(room.id, message).then(() => undefined));
  }

  // Emergency Stop — instantly freeze the room by pausing the live timer. A
  // safe, reversible "hold everything" (the destructive Reset lives in the
  // drawer's Emergency Actions).
  function emergencyStop() {
    if (timerRunning) action(() => pauseTimer(room.id));
  }

  function undoLastScore() {
    const last = scoreHistory.find((entry) => !entry.isUndo && !entry.isReverted);
    if (last) action(() => hostUndoScoreTransaction(last.id));
  }
  const canUndo = scoreHistory.some((entry) => !entry.isUndo && !entry.isReverted);

  return (
    // Host console is an intentionally dark, OBS-style control room. Pin it to
    // the dark ramp so it stays legible even when the app is in the bright theme
    // (its surfaces/text tokens assume a dark backdrop). See globals.css.
    <div data-theme="dark" className="h-screen bg-shell text-ink-2 flex flex-col overflow-hidden">
      {/* TOP BAR */}
      <div className="relative min-h-16 border-b border-line/[.07] px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 flex-wrap shrink-0">
        {/* Flow progress — a thin fill along the bottom edge of the bar. */}
        {scenes.length > 0 && (
          <span
            aria-hidden
            className="absolute left-0 bottom-0 h-[2px] bg-accent/70 transition-[width] duration-500"
            style={{ width: `${stepFraction * 100}%` }}
          />
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-mono text-mute-2 tracking-[.1em] truncate">
            {room.competitionTitle}
          </span>
          <span className="text-sm font-bold text-ink truncate">{room.name}</span>
        </div>
        <span className="font-mono text-[11px] text-mute-2 bg-line/[.05] border border-line/[.08] rounded-md px-2 py-1 shrink-0">
          CODE: {room.roomCode}
        </span>
        <Badge variant={STATUS_BADGE[room.status]} size="sm" className="shrink-0">
          {room.status === "LIVE" && <span className="w-1.5 h-1.5 rounded-full bg-live animate-enc-pulse" />}
          {STATUS_LABEL[room.status]}
        </Badge>
        <span className="hidden sm:flex items-center gap-1.5 text-[12px] text-mute-2 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${connectedCount > 0 ? "bg-success animate-enc-pulse" : "bg-line/[.3]"}`} />
          <Icon name="users" size={13} />
          {connectedCount} Connected
        </span>
        {stepIndex > 0 && (
          <span className="ml-auto hidden md:inline font-mono text-[11px] text-mute-2 bg-line/[.05] border border-line/[.08] rounded-md px-2 py-1 shrink-0">
            STEP {stepIndex}/{scenes.length}
          </span>
        )}
        <span
          className={`${stepIndex > 0 ? "" : "ml-auto "}font-mono text-lg sm:text-xl font-black tabular-nums shrink-0 transition-colors duration-500 ${
            TIMER_URGENCY_TEXT[timerUrgency(secondsLeft, Number(current?.settings?.timer ?? 30))]
          }`}
        >
          {timerDisplay}
        </span>
        <SoundToggle className="shrink-0" />
        {/* Reset Room moved to the Event Actions drawer's Emergency section so a
            destructive control never sits one stray tap away in the top bar. */}
        {/* Once the room is LIVE the button used to linger as a dead, disabled
            "Live" pill — the status badge already says LIVE, so just hide it. */}
        {room.status !== "LIVE" && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => action(() => startEvent(room.id))}
            disabled={pending || scenes.length === 0}
            className="shrink-0"
          >
            {room.status === "TESTING" ? "Start Test" : "Start Event"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_360px] flex-1 min-h-0 overflow-y-auto xl:overflow-hidden">
        {/* LEFT PANEL — EVENT FLOW */}
        <aside className="hidden lg:flex flex-col border-r border-line/[.07] min-h-0">
          <div className="px-4 py-3 flex items-center gap-2 text-[11px] font-mono font-semibold tracking-[.12em] text-label">
            EVENT FLOW
            {scenes.length > 0 && <span className="text-dim-2">· {scenes.length}</span>}
            {room.currentSceneId && (
              <button
                onClick={() =>
                  document
                    .getElementById("host-live-scene")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                className="ml-auto rounded-md border border-line/[.1] bg-line/[.05] px-2 py-1 text-[9.5px] font-sans font-bold tracking-[.04em] text-ink-3 hover:text-ink cursor-pointer"
              >
                ⦿ LIVE
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-3">
            {flowGroups.length === 0 ? (
              <span className="text-[12px] text-mute-2 px-1">No scenes yet.</span>
            ) : (
              flowGroups.map((group) => {
                const groupHasLive = group.scenes.some((s) => s.id === room.currentSceneId);
                const groupDone = group.scenes.every((s) => s.status === "COMPLETED");
                const collapsed = collapsedRounds.has(group.key);
                return (
                <div key={group.key} className="flex flex-col gap-1.5">
                  <button
                    onClick={() =>
                      setCollapsedRounds((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.key)) next.delete(group.key);
                        else next.add(group.key);
                        return next;
                      })
                    }
                    className="flex items-center gap-1.5 px-1 cursor-pointer text-left"
                  >
                    <Icon name={collapsed ? "chevron-right" : "chevron-down"} size={12} className="text-dim shrink-0" />
                    <span className="text-[10px] font-mono font-semibold tracking-[.1em] text-dim-2 uppercase truncate">
                      {group.label}
                    </span>
                    {groupHasLive && <span className="w-1.5 h-1.5 rounded-full bg-info animate-enc-pulse shrink-0" />}
                    {!groupHasLive && groupDone && <span className="text-[9px] text-success shrink-0">✓</span>}
                  </button>
                  {group.scenes.map((scene, index) => {
                    const isLive = scene.id === room.currentSceneId;
                    // Collapsed rounds hide their scenes — but the live scene is
                    // always kept visible (the host must never lose sight of it).
                    if (collapsed && !isLive) return null;
                    const done = scene.status === "COMPLETED";
                    const moveUpDisabled = scene.order === 0 || index === 0;
                    const moveDownDisabled = scene.order === scenes.length - 1 || index === group.scenes.length - 1;
                    const visual = sceneVisual(scene.type);
                    const sceneRound = scene.roundId ? rounds.find((item) => item.id === scene.roundId) : null;
                    const sceneQuestionIndex = sceneRound && scene.questionId
                      ? sceneRound.questionIds.indexOf(scene.questionId) + 1
                      : 0;
                    const marker = sceneQuestionIndex > 0 && (scene.type === "QUESTION" || scene.type === "ANSWER_REVEAL")
                      ? `${visual.marker}${sceneQuestionIndex}`
                      : visual.marker;
                    const sceneAssignedTeamId = typeof scene.settings?.assignedTeamId === "string"
                      ? scene.settings.assignedTeamId
                      : null;
                    const sceneAssignedTeam = sceneAssignedTeamId ? teamById.get(sceneAssignedTeamId) : null;
                    // Status-based row treatment: completed = green, current =
                    // blue, upcoming = grey.
                    const rowClass = isLive
                      ? "border-info/60 bg-info/[.12] ring-1 ring-info/25"
                      : done
                        ? "border-success/25 bg-success/[.05] hover:brightness-125"
                        : "border-line/[.08] bg-line/[.02] hover:brightness-125";
                    const statusDot = isLive ? "bg-info animate-enc-pulse" : done ? "bg-success" : "bg-line/[.3]";
                    return (
                      <div
                        key={scene.id}
                        id={isLive ? "host-live-scene" : undefined}
                        className={`relative overflow-hidden rounded-xl border pl-3 pr-2 py-2 flex items-center gap-2 ${rowClass}`}
                      >
                        {/* Left edge: scene-type color cue. */}
                        <span className={`absolute left-0 inset-y-0 w-1 ${visual.bar}`} aria-hidden />
                        <button
                          onClick={() => action(() => publishScene(room.id, scene.id).then(() => undefined))}
                          className="min-w-0 flex-1 flex items-center gap-2 text-left cursor-pointer"
                        >
                          <span className={`min-w-9 rounded-md px-1.5 py-1 text-[9px] font-mono font-black text-center shrink-0 ${visual.badge}`}>
                            {marker}
                          </span>
                          <span className="flex flex-col min-w-0">
                            <span className={`text-[12.5px] font-semibold truncate ${isLive ? "text-ink" : "text-ink-2"}`}>{scene.title}</span>
                            <span className="flex items-center gap-1 text-[10px]">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
                              <span className={`font-bold ${isLive ? "text-info" : done ? "text-success" : "text-mute-2"}`}>
                                {isLive ? "LIVE" : done ? "DONE" : "NEXT"}
                              </span>
                              <span className="text-mute-2">· {scene.type.replace(/_/g, " ")}</span>
                              {sceneAssignedTeam ? <span className="text-ink-3 truncate"> · 👥 {sceneAssignedTeam.name}</span> : ""}
                            </span>
                          </span>
                        </button>
                        {/* Reorder is edit-mode only — locked once the room is
                            LIVE so a stray tap can't shuffle the run-of-show. */}
                        {room.status !== "LIVE" && (
                          <span className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveScene(scene.id, "up")}
                              disabled={moveUpDisabled || pending}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-mute hover:bg-line/[.08] disabled:text-dim disabled:opacity-40 disabled:hover:bg-transparent"
                              aria-label={`Move ${scene.title} up`}
                            >
                              <Icon name="chevron-up" size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveScene(scene.id, "down")}
                              disabled={moveDownDisabled || pending}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-mute hover:bg-line/[.08] disabled:text-dim disabled:opacity-40 disabled:hover:bg-transparent"
                              aria-label={`Move ${scene.title} down`}
                            >
                              <Icon name="chevron-down" size={12} />
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                );
              })
            )}
          </div>
        </aside>

        {/* CENTER PANEL — LIVE PREVIEW */}
        <main className="min-h-0 flex flex-col">
          <div className="px-4 py-3 border-b border-line/[.07] flex items-center gap-2 text-[11px] font-mono font-semibold tracking-[.12em] text-label">
            LIVE PREVIEW
            {scenes.length > 0 && (
              <span
                className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[.06em] normal-case font-sans ${
                  liveStatus === "ANSWER_REVEALED"
                    ? "text-success bg-success/10 border border-success/25"
                    : liveStatus === "TIMER_RUNNING"
                      ? "text-accent bg-accent/10 border border-accent/25"
                      : "text-mute-2 bg-line/[.05] border border-line/[.08]"
                }`}
              >
                {liveStatus === "ANSWER_REVEALED"
                  ? "Answer Revealed"
                  : liveStatus === "TIMER_RUNNING"
                    ? "Timer Running"
                    : "Timer Idle"}
              </span>
            )}
          </div>
          {scenes.length > 0 && (
            <div className="lg:hidden border-b border-line/[.07] px-3 py-2 overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {scenes.map((scene) => (
                  (() => {
                    const visual = sceneVisual(scene.type);
                    return (
                      <button
                        key={scene.id}
                        onClick={() => action(() => publishScene(room.id, scene.id).then(() => undefined))}
                        className={`rounded-lg border px-3 py-2 text-left min-w-[148px] ${
                          scene.id === room.currentSceneId
                            ? "border-white/55 bg-white/[.11]"
                            : visual.row
                        }`}
                      >
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-mono font-black ${visual.badge}`}>
                          {visual.marker}
                        </span>
                        <span className="block mt-1 text-[12px] font-semibold text-ink-2 truncate">{scene.title}</span>
                      </button>
                    );
                  })()
                ))}
              </div>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col items-center gap-4">
            {scenes.length === 0 ? (
              <SetupRequiredCard
                checklist={setupChecklist}
                canGenerate={canGenerateScenes}
                pending={pending}
                onGenerate={() => action(() => generateScenes(room.id).then(() => undefined))}
              />
            ) : (
              <>
                <div className="relative overflow-hidden w-full max-w-[720px] rounded-[28px] border border-line/[.09] bg-[rgba(18,20,27,.82)] p-8 flex flex-col items-center text-center gap-4">
                  <span
                    aria-hidden
                    className="absolute inset-x-10 top-0 h-px"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(108,123,250,.6), transparent)" }}
                  />
                  <div className="flex items-center gap-2">
                    {/* Broadcast-style "now playing" bug — a live dot + the scene
                        currently on every screen in the room. */}
                    <span className="flex items-center gap-1.5 rounded-full bg-danger/15 border border-danger/30 px-2.5 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-danger animate-enc-pulse" />
                      <span className="text-[9px] font-black tracking-[.16em] text-danger-soft">ON AIR</span>
                    </span>
                    <span className="text-[11px] font-semibold text-accent bg-accent/15 rounded-full px-3 py-1">
                      {current?.type ?? "NO SCENE"}
                    </span>
                    {stepIndex > 0 && (
                      <span className="text-[10px] font-mono text-mute-2 bg-line/[.05] border border-line/[.08] rounded-full px-2.5 py-1">
                        {stepIndex} / {scenes.length}
                      </span>
                    )}
                  </div>
                  {round && <span className="text-[12px] text-mute-2">{round.title}</span>}
                  {question && assignedTeam && (
                    <div className="flex items-center gap-2 rounded-xl border border-accent/35 bg-accent/[.1] px-4 py-2">
                      <span className="text-[10px] font-mono font-semibold tracking-[.1em] text-accent">ASSIGNED TEAM</span>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: assignedTeam.color ?? "#6C7BFA" }} />
                      <span className="text-sm font-black text-ink">{assignedTeam.name}</span>
                      {assignmentSource === "RANDOM_REMAINDER" && <span className="text-[10px] text-mute-2">random remainder</span>}
                    </div>
                  )}
                  <div className="text-4xl font-bold text-ink leading-tight">
                    {question?.question || current?.title || "—"}
                  </div>
                  {question?.media?.url && (
                    <div className="rounded-xl border border-line/[.08] bg-line/[.04] p-3 w-full max-w-[420px]">
                      {question.media.type === "IMAGE" && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={question.media.url} alt={question.media.name} className="w-full max-h-52 object-cover rounded-lg" />
                      )}
                      {question.media.type === "AUDIO" && <audio controls src={question.media.url} className="w-full" />}
                      {question.media.type === "VIDEO" && (
                        <video controls src={question.media.url} className="w-full max-h-52 rounded-lg" />
                      )}
                    </div>
                  )}
                  {current?.type === "DRAWING" && (
                    <div className="w-full max-w-[440px]">
                      <LiveDrawBoard
                        roomId={room.id}
                        roomCode={room.roomCode}
                        canDraw={!room.liveState.drawerTeamId}
                        identity={{}}
                      />
                      {room.liveState.drawerTeamId && (
                        <span className="mt-2 block text-[11px] text-mute-2">
                          {teams.find((t) => t.id === room.liveState.drawerTeamId)?.name ?? "A team"} is drawing —
                          reclaim the pen below to draw yourself.
                        </span>
                      )}
                    </div>
                  )}
                  {current?.type !== "LEADERBOARD" && current?.type !== "WINNER" && (() => {
                    const urg = timerUrgency(secondsLeft, Number(current?.settings?.timer ?? 30));
                    // Breathe while running; beat faster as it runs down.
                    const breath =
                      !timerRunning || urg === "idle"
                        ? ""
                        : urg === "critical"
                          ? "animate-[encBreath_0.6s_ease-in-out_infinite]"
                          : urg === "warning"
                            ? "animate-[encBreath_0.95s_ease-in-out_infinite]"
                            : "animate-[encBreath_1.6s_ease-in-out_infinite]";
                    return (
                      <span
                        className={`inline-block font-mono text-3xl font-black tabular-nums transition-colors duration-500 ${TIMER_URGENCY_TEXT[urg]} ${breath}`}
                      >
                        {timerDisplay}
                      </span>
                    );
                  })()}

                  {/* Leaderboard / winner scenes have no question — mirror what
                      participants see so the host isn't looking at a blank card. */}
                  {(current?.type === "LEADERBOARD" || current?.type === "WINNER") && teams.length > 0 && (
                    <div className="w-full max-w-[460px] flex flex-col gap-2 mt-1">
                      {[...teams]
                        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
                        .map((team, index) => {
                          const isWinner = index === 0;
                          const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : null;
                          return (
                            <div
                              key={team.id}
                              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                                isWinner && current?.type === "WINNER"
                                  ? "border-warn/45 bg-warn/[.1]"
                                  : "border-line/[.08] bg-line/[.03]"
                              }`}
                            >
                              <span className="w-7 text-center font-mono text-[15px] font-black text-ink-3">
                                {medal ?? index + 1}
                              </span>
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: team.color ?? "#6C7BFA" }} />
                              <span className="text-[15px] font-bold text-ink truncate flex-1 text-left">{team.name}</span>
                              <span className="font-mono text-[18px] font-black text-ink tabular-nums">{team.score}</span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {question && (() => {
                  // Tabbed detail below the preview — Question / Answer / Hints
                  // / Media / Host Notes — instead of one long stacked card, so
                  // the host jumps straight to what they need mid-question.
                  const tabs: { id: typeof centerTab; label: string; show: boolean }[] = [
                    { id: "QUESTION", label: "Question", show: true },
                    { id: "ANSWER", label: "Answer", show: true },
                    { id: "HINTS", label: `Hints${question.hints.length ? ` · ${question.hints.length}` : ""}`, show: question.hints.length > 0 },
                    { id: "MEDIA", label: "Media", show: Boolean(question.media?.url) },
                    { id: "NOTES", label: "Host Notes", show: Boolean(question.hostNotes) },
                  ];
                  const visible = tabs.filter((t) => t.show);
                  const activeTab = visible.some((t) => t.id === centerTab) ? centerTab : "QUESTION";
                  return (
                    <div className="w-full max-w-[720px] rounded-2xl border border-line/[.09] bg-[rgba(18,20,27,.6)] overflow-hidden text-left">
                      <div className="flex gap-1 border-b border-line/[.07] px-2 pt-2 overflow-x-auto">
                        {visible.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setCenterTab(t.id)}
                            className={`shrink-0 rounded-t-lg px-3 py-2 text-[11.5px] font-bold whitespace-nowrap transition cursor-pointer ${
                              activeTab === t.id ? "bg-line/[.08] text-ink" : "text-mute-2 hover:text-ink-3"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <div className="p-4">
                        {activeTab === "QUESTION" && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-mono font-semibold tracking-[.12em] text-mute-2">
                              {questionIndex ? `QUESTION ${questionIndex}` : "QUESTION"} · {question.type}
                            </span>
                            <span className="text-[15px] font-semibold text-ink leading-snug">{question.question}</span>
                          </div>
                        )}
                        {activeTab === "ANSWER" && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-mono font-semibold tracking-[.12em] text-warn">
                              ANSWER — HOST ONLY, HIDDEN FROM PARTICIPANTS
                            </span>
                            <span className="text-lg font-bold text-ink">{question.answer}</span>
                          </div>
                        )}
                        {activeTab === "HINTS" && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-mono font-semibold tracking-[.12em] text-label">HINTS</span>
                            {question.hints.map((hint, i) => (
                              <span key={i} className="text-[12.5px] text-ink-3 bg-line/[.04] rounded-lg px-2.5 py-1.5">
                                Hint {i + 1}: {hint.text} <span className="text-mute-2">(−{hint.penalty})</span>
                              </span>
                            ))}
                          </div>
                        )}
                        {activeTab === "MEDIA" && question.media?.url && (
                          <div className="rounded-xl border border-line/[.08] bg-line/[.04] p-2">
                            {question.media.type === "IMAGE" && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={question.media.url} alt={question.media.name} className="w-full max-h-72 object-contain rounded-lg" />
                            )}
                            {question.media.type === "AUDIO" && <audio controls src={question.media.url} className="w-full" />}
                            {question.media.type === "VIDEO" && (
                              <video controls src={question.media.url} className="w-full max-h-72 rounded-lg" />
                            )}
                          </div>
                        )}
                        {activeTab === "NOTES" && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-mono font-semibold tracking-[.12em] text-dim-2">HOST NOTES</span>
                            <span className="text-[13px] text-mute-2 leading-relaxed">{question.hostNotes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </main>

        {/* RIGHT PANEL — CONTROL CENTER */}
        <aside className="flex flex-col border-t xl:border-t-0 xl:border-l border-line/[.07] min-h-[620px] xl:min-h-0">
          <div className="flex items-center gap-2 px-4 py-3 text-[11px] font-mono font-semibold tracking-[.12em] text-label border-b border-line/[.06]">
            <Icon name="sliders-horizontal" size={13} className="text-accent" />
            QUICK CONTROLS
            <span className="ml-auto flex items-center gap-1 text-[9px] font-bold tracking-[.14em] text-mute-2">
              <span className={`w-1.5 h-1.5 rounded-full ${timerRunning ? "bg-success animate-enc-pulse" : "bg-line/[.3]"}`} />
              {timerRunning ? "TIMER LIVE" : "IDLE"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
            {/* LIVE STATUS — the always-on competition-health dashboard: one
                glance tells the host the whole room's state. */}
            <section className="rounded-2xl border border-accent/25 bg-accent/[.05] p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="flex items-center gap-1.5 rounded-full bg-danger/15 border border-danger/30 px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger animate-enc-pulse" />
                  <span className="text-[9px] font-black tracking-[.14em] text-danger-soft">
                    {room.status === "LIVE" ? "LIVE" : room.status}
                  </span>
                </span>
                {round && <span className="text-[11px] text-mute-2 truncate">{round.title}</span>}
                {pendingRequestCount > 0 && (
                  <span className="ml-auto flex items-center gap-1 rounded-full bg-warn/15 border border-warn/30 px-2 py-0.5 text-[10px] font-bold text-warn">
                    {pendingRequestCount} pending
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <StatChip label="CONNECTED" value={`${connectedCount}`} tone="#3DD68C" pulse={connectedCount > 0} />
                <StatChip label="CAPTAINS" value={`${captainsConnected}/${teams.length}`} tone="#5EC9E8" />
                <StatChip label="REQUESTS" value={`${pendingRequestCount}`} tone={pendingRequestCount > 0 ? "#E8A33D" : "#8EA0B8"} />
                <StatChip label="STORE" value={storeOpen ? "Open" : "Closed"} tone={storeOpen ? "#3DD68C" : "#8EA0B8"} />
                <StatChip label="AUCTION" value={auction ? "Live" : "Idle"} tone={auction ? "#E8A33D" : "#8EA0B8"} />
                <StatChip label="QUESTION" value={questionIndex ? `#${questionIndex}` : "—"} tone="#6C7BFA" />
              </div>
              {assignedTeam && (
                <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-accent/25 bg-accent/[.06] px-2.5 py-1.5">
                  <span className="text-[9px] font-bold tracking-[.12em] text-accent">CURRENT TEAM</span>
                  <span className="w-2 h-2 rounded-full" style={{ background: assignedTeam.color ?? "#6C7BFA" }} />
                  <span className="text-[12px] font-bold text-ink truncate">{assignedTeam.name}</span>
                </div>
              )}
            </section>
            {feedback && (
              <span className="rounded-xl border border-danger/30 bg-danger/[.08] px-3 py-2 text-[12px] font-semibold text-danger-soft">
                {feedback}
              </span>
            )}
            {/* CURRENT QUESTION */}
            <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-4 flex flex-col gap-2">
              <span className="text-sm font-bold text-ink-2">Current Question</span>
              {question ? (
                <>
                  <span className="text-[12px] text-mute-2">
                    {questionIndex ? `Q${questionIndex}` : "Question"} · {question.type}
                  </span>
                  {assignedTeam && (
                    <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/[.08] px-2.5 py-2">
                      <span className="text-[10px] font-semibold text-accent">ASSIGNED TO</span>
                      <span className="w-2 h-2 rounded-full" style={{ background: assignedTeam.color ?? "#6C7BFA" }} />
                      <span className="text-[12px] font-bold text-ink">{assignedTeam.name}</span>
                    </div>
                  )}
                  <span className="text-[12px] text-mute-2">
                    Answer: <b className="text-ink-2">{question.answer}</b>
                  </span>
                  {question.hints.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold tracking-[.1em] text-label">HINTS</span>
                      {question.hints.map((hint, i) => (
                        <span key={i} className="text-[11.5px] text-ink-3 bg-line/[.04] rounded-lg px-2 py-1">
                          Hint {i + 1}: {hint.text} (-{hint.penalty})
                        </span>
                      ))}
                    </div>
                  )}

                  {current?.type === "DRAWING" && (
                    <div className="flex flex-col gap-1.5 rounded-xl border border-accent/20 bg-accent/[.05] p-2.5 mt-0.5">
                      <span className="text-[10px] font-semibold tracking-[.1em] text-label">WHO DRAWS</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => action(() => setDrawer(room.id, null))}
                          disabled={pending}
                          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                            !room.liveState.drawerTeamId ? "bg-accent text-white" : "bg-line/[.06] text-mute-2 hover:bg-line/[.1]"
                          }`}
                        >
                          🎨 Host draws
                        </button>
                        {teams.map((team) => (
                          <button
                            key={team.id}
                            onClick={() => action(() => setDrawer(room.id, team.id))}
                            disabled={pending}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                              room.liveState.drawerTeamId === team.id
                                ? "bg-accent text-white"
                                : "bg-line/[.06] text-mute-2 hover:bg-line/[.1]"
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ background: team.color ?? "#6C7BFA" }} />
                            {team.name}
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] text-mute-2">
                        Assigning a team hands its captain the pen and clears the board.
                      </span>
                    </div>
                  )}

                  {question.isMCQ ? (
                    /* MCQ auto-grades the instant the team taps an option — no
                       manual marking (that would double-count the score). */
                    <div className="flex items-center gap-2 rounded-xl border border-info/25 bg-info/[.06] px-3 py-2.5 mt-0.5">
                      <span className="text-[15px]">🅰️</span>
                      <span className="text-[11.5px] text-ink-3">
                        Multiple choice — auto-scored when the team taps their answer.
                      </span>
                    </div>
                  ) : (
                  /* One-tap scoring for this question's team. */
                  <div className="flex flex-col gap-1.5 rounded-xl border border-line/[.1] bg-line/[.03] p-2.5 mt-0.5">
                    <span className="text-[10px] font-semibold tracking-[.1em] text-label">
                      MARK ANSWER{assignedTeam ? ` · ${assignedTeam.name}` : ""}
                    </span>
                    {room.economyEnabled && (
                      <label className="flex items-center gap-2 text-[11px] text-ink-3">
                        <Icon name="coins" size={12} className="text-warn shrink-0" />
                        <span className="shrink-0">Coins if correct</span>
                        <input
                          type="number"
                          min={0}
                          value={answerCoins}
                          onChange={(e) => setAnswerCoins(Math.max(0, Number(e.target.value) || 0))}
                          className="ml-auto w-24 bg-line/[.05] border border-line/[.1] rounded-lg px-2 py-1 text-[12px] text-ink outline-none focus:border-warn/50"
                        />
                      </label>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="success"
                        size="sm"
                        disabled={pending || teams.length === 0 || Boolean(alreadyJudgedTransaction)}
                        onClick={() =>
                          assignedTeamId
                            ? quickMark(assignedTeamId, true)
                            : openScoring(teams[0]?.id ?? "", Math.abs(round?.positiveMarks ?? 10))
                        }
                        className="justify-center"
                      >
                        ✓ Correct +{Math.abs(round?.positiveMarks ?? 10)}
                        {room.economyEnabled && answerCoins > 0 ? ` · ${answerCoins}🪙` : ""}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={pending || teams.length === 0 || round?.specialMode === "BONUS" || Boolean(alreadyJudgedTransaction)}
                        onClick={() =>
                          assignedTeamId
                            ? quickMark(assignedTeamId, false)
                            : openScoring(teams[0]?.id ?? "", -Math.abs(round?.negativeMarks ?? 5))
                        }
                        className="justify-center"
                      >
                        ✗ Wrong −{Math.abs(round?.negativeMarks ?? 5)}
                      </Button>
                    </div>
                    {!assignedTeam && (
                      <span className="text-[10.5px] text-mute-2">
                        No team assigned — you&apos;ll pick the team next.
                      </span>
                    )}
                    {alreadyJudgedTransaction && (
                      <div className="flex items-center gap-2 text-[10.5px] text-mute-2">
                        <span>
                          Already marked {alreadyJudgedTransaction.reason === "CORRECT" ? "✓ Correct" : "✗ Wrong"}.
                        </span>
                        <button
                          onClick={() => action(() => hostUndoScoreTransaction(alreadyJudgedTransaction.id))}
                          disabled={pending}
                          className="ml-auto font-semibold text-accent hover:underline cursor-pointer"
                        >
                          Undo to re-judge
                        </button>
                      </div>
                    )}
                    {/* Preset quick adjustments to the current team — one tap,
                        no modal. Custom opens the full Give Marks dialog. */}
                    <div className="flex flex-col gap-1 pt-1 mt-0.5 border-t border-line/[.06]">
                      <span className="text-[9px] font-semibold tracking-[.1em] text-dim-2">QUICK POINTS</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[5, 10, 20, -5, -10].map((v) => (
                          <button
                            key={v}
                            onClick={() => quickPoints(v)}
                            disabled={pending || teams.length === 0}
                            className={`min-w-11 rounded-lg border px-2 py-1.5 text-[12px] font-black tabular-nums cursor-pointer disabled:opacity-40 ${
                              v > 0
                                ? "border-success/30 bg-success/[.08] text-success hover:bg-success/[.14]"
                                : "border-danger/30 bg-danger/[.08] text-danger-soft hover:bg-danger/[.14]"
                            }`}
                          >
                            {v > 0 ? `+${v}` : v}
                          </button>
                        ))}
                        <button
                          onClick={() => openScoring(assignedTeamId ?? teams[0]?.id ?? "", 10)}
                          disabled={pending || teams.length === 0}
                          className="rounded-lg border border-line/[.12] bg-line/[.05] px-2.5 py-1.5 text-[12px] font-bold text-ink-3 hover:bg-line/[.1] cursor-pointer disabled:opacity-40"
                        >
                          Custom
                        </button>
                      </div>
                    </div>
                  </div>
                  )}

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
            play("reveal");
            action(() => revealAnswer(room.id));
          }}
                    disabled={pending || timerRunning}
                    title={timerRunning ? "Stop the timer before revealing the answer." : undefined}
                    className="mt-1"
                  >
                    Reveal Answer
                  </Button>
                  {timerRunning && (
                    <span className="text-[10.5px] text-mute-2">Stop the timer to reveal the answer.</span>
                  )}
                  <SubmittedAnswers logs={logs} questionId={question.id} teamById={teamById} />
                </>
              ) : (
                <span className="text-[12px] text-mute-2">No question active.</span>
              )}
            </section>

            {/* TIMER — the readout shifts green -> amber -> red as it runs
                down, same ladder as every participant phone. */}
            <Module title="Timer" icon="timer" accent="#3DD68C" badge={<span className="ml-1.5 font-mono text-[11px] font-black tabular-nums text-ink-3">{timerDisplay}</span>}>
              <span
                className={`font-mono text-3xl font-black text-center tabular-nums transition-colors duration-500 ${TIMER_URGENCY_TEXT[timerUrgency(secondsLeft, Number(current?.settings?.timer ?? 30))]} ${
                  secondsLeft !== null && secondsLeft <= 5 && timerRunning ? "animate-enc-pulse" : ""
                }`}
              >
                {timerDisplay}
              </span>
              {(() => {
                const total = Number(current?.settings?.timer ?? 30) || 30;
                const fraction = secondsLeft === null ? 0 : Math.max(0, Math.min(1, secondsLeft / total));
                const urgency = timerUrgency(secondsLeft, total);
                const barColor: Record<typeof urgency, string> = {
                  idle: "var(--color-accent)",
                  safe: "#3DD68C",
                  warning: "#E8A33D",
                  critical: "#FF5A5A",
                };
                return (
                  <div className="h-1.5 rounded-full bg-line/[.08] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width,background-color] duration-500 ease-linear"
                      style={{ width: `${fraction * 100}%`, background: barColor[urgency] }}
                    />
                  </div>
                );
              })()}
              <div className="grid grid-cols-3 gap-2">
                <Button variant="primary" onClick={() => action(() => startTimer(room.id, Number(current?.settings?.timer ?? 30)))} disabled={pending} className="justify-center">
                  Start
                </Button>
                <Button variant="subtle" onClick={() => action(() => pauseTimer(room.id))} disabled={pending} className="justify-center">
                  Pause
                </Button>
                <Button variant="subtle" onClick={() => action(() => resetTimer(room.id))} disabled={pending} className="justify-center">
                  Reset
                </Button>
                <Button variant="subtle" onClick={() => addTime(-10)} disabled={pending} className="justify-center">
                  −10 sec
                </Button>
                <Button variant="subtle" onClick={() => addTime(10)} disabled={pending} className="col-span-2 justify-center">
                  +10 sec
                </Button>
              </div>
              <label className="flex items-center gap-2 pt-1 text-[12px] text-ink-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoStartTimer}
                  onChange={(e) => toggleAutoStart(e.target.checked)}
                  className="accent-[var(--color-accent)]"
                />
                Auto-start timer on each question
              </label>
            </Module>

            {/* TEAMS */}
            <Module title="Teams" icon="users" accent="#6C7BFA" badge={<span className="ml-1.5 text-[10px] text-dim-2">{teams.length}</span>}>
              {(() => {
                const rankOrder = [...teams].sort((a, b) => b.score - a.score).map((t) => t.id);
                return teams.map((team) => {
                const owned = ownedByTeam.get(team.id) ?? [];
                const cardsLeft = owned.reduce((sum, o) => sum + (o.remainingUses ?? 0), 0);
                const expanded = expandedTeamId === team.id;
                const maxScore = Math.max(...teams.map((t) => t.score));
                const isLeader = maxScore > 0 && team.score === maxScore;
                const rank = rankOrder.indexOf(team.id) + 1;
                const teamDevices = participants.filter((p) => p.teamId === team.id);
                const captain = teamDevices.find((p) => p.role === "CAPTAIN");
                const captainOffline = Boolean(captain && !captain.connected);
                const anyConnected = teamDevices.some((p) => p.connected);
                const isTurn = assignedTeamId === team.id;
                return (
                  <div
                    key={team.id}
                    className={`rounded-xl border bg-elev overflow-hidden ${
                      isTurn ? "border-accent/45 ring-1 ring-accent/20" : captainOffline ? "border-danger/35" : "border-line/[.07]"
                    }`}
                  >
                    <button
                      onClick={() => setExpandedTeamId(expanded ? null : team.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
                    >
                      <span className="font-mono text-[10px] font-black text-dim-2 w-4 shrink-0">#{rank}</span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: team.color ?? "#6C7BFA" }} />
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${anyConnected ? "bg-success" : "bg-line/[.3]"}`} title={anyConnected ? "Connected" : "No devices connected"} />
                      <span className="text-[12.5px] font-semibold text-ink-2 truncate">
                        {team.name}
                        {isLeader && <span className="ml-1" title="Current leader">👑</span>}
                        {isTurn && <span className="ml-1 text-[9px] font-black text-accent">· TURN</span>}
                      </span>
                      {captainOffline && (
                        <span className="shrink-0 text-[9px] font-bold text-danger-soft" title="Captain disconnected">⚠ CAP</span>
                      )}
                      <span className="ml-auto flex items-center gap-2 text-[11px] font-mono shrink-0">
                        {cardsLeft > 0 && (
                          <span className="flex items-center gap-0.5 text-accent" title="Power cards remaining">
                            <Icon name="zap" size={10} />
                            {cardsLeft}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-warn">
                          <Icon name="coins" size={11} />
                          {team.coins}
                        </span>
                        <span className="font-bold text-ink">{team.score}</span>
                      </span>
                      <Icon name={expanded ? "chevron-up" : "chevron-down"} size={13} className="text-dim shrink-0" />
                    </button>
                    {expanded && (
                      <div className="border-t border-line/[.06] p-3 flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-1.5">
                          <Button variant="success" size="sm" onClick={() => openScoring(team.id, 10)}>
                            Give Points
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => openScoring(team.id, -10)}>
                            Remove Points
                          </Button>
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            value={teamCoinAmount}
                            onChange={(e) => setTeamCoinAmount(Number(e.target.value))}
                            className="w-20 bg-line/[.05] border border-line/[.1] rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none"
                          />
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() => action(() => giveCoins(room.id, team.id, teamCoinAmount))}
                            disabled={pending}
                            className="flex-1 justify-center"
                          >
                            Give Coins
                          </Button>
                        </div>
                        {cards.length > 0 && (
                          <div className="flex gap-1.5">
                            <select
                              value={teamCardId}
                              onChange={(e) => setTeamCardId(e.target.value)}
                              className="flex-1 bg-line/[.05] border border-line/[.1] rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none"
                            >
                              {cards.map((c) => (
                                <option key={c.id} value={c.id} className="bg-[#151821]">
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="subtle"
                              size="sm"
                              onClick={() => action(() => giveFreeCard(room.id, team.id, teamCardId || cards[0].id))}
                              disabled={pending}
                            >
                              Give Card
                            </Button>
                          </div>
                        )}
                        {owned.length > 0 && (
                          <div className="flex flex-col gap-1 mt-1">
                            <span className="text-[10px] font-semibold text-dim-2 tracking-[.1em]">OWNED CARDS</span>
                            {owned.map((o) => (
                              <div key={o.powerCardId} className="flex items-center gap-2 text-[11.5px] text-ink-3">
                                <span className="truncate flex-1">
                                  {cardById.get(o.powerCardId)?.name ?? "Card"} · {o.status}
                                </span>
                                <button
                                  onClick={() => action(() => hostRemoveTeamPowerCard(team.id, o.powerCardId))}
                                  disabled={pending}
                                  className="text-danger-soft hover:text-danger text-[10.5px] font-semibold cursor-pointer shrink-0"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <TeamDevicesPanel
                          roomId={room.id}
                          devices={participants.filter((p) => p.teamId === team.id)}
                          pending={pending}
                          action={action}
                        />
                      </div>
                    )}
                  </div>
                );
                });
              })()}
            </Module>


            {/* ACTIVE EVENTS — live status at a glance; the actual controls
                live in the Event Actions drawer to keep this rail scroll-free. */}
            <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-3.5 flex flex-col gap-2.5">
              <span className="text-[12px] font-bold tracking-[.06em] text-ink-2 uppercase">Active Events</span>
              <div className="grid grid-cols-2 gap-1.5">
                <span className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10.5px] font-semibold ${storeOpen ? "border-success/30 bg-success/[.08] text-success" : "border-line/[.08] bg-line/[.02] text-mute-2"}`}>🛒 Store · {storeOpen ? "Open" : "Closed"}</span>
                <span className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10.5px] font-semibold ${auction ? "border-warn/30 bg-warn/[.08] text-warn" : "border-line/[.08] bg-line/[.02] text-mute-2"}`}>🔨 Auction · {auction ? "Live" : "Idle"}</span>
                <span className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10.5px] font-semibold ${room.liveState.flashSaleActive ? "border-warn/30 bg-warn/[.08] text-warn" : "border-line/[.08] bg-line/[.02] text-mute-2"}`}>⚡ Sale · {room.liveState.flashSaleActive ? "On" : "Off"}</span>
                <span className="flex items-center gap-1 rounded-lg border border-line/[.08] bg-line/[.02] px-2 py-1.5 text-[10.5px] font-semibold text-mute-2">🎁 Rewards</span>
              </div>
              <Button variant="primary" onClick={() => setEventActionsOpen(true)} disabled={pending}>
                <Icon name="wand-sparkles" size={14} />
                Open Event Actions
              </Button>
            </section>

            {/* POWER REQUESTS */}
            <Module
              title="Power Requests"
              icon="hand"
              accent="#5EC9E8"
              badge={
                pendingRequestCount > 0 ? (
                  <span className="ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-warn text-black text-[10px] font-black flex items-center justify-center">
                    {pendingRequestCount}
                  </span>
                ) : undefined
              }
            >
              {powerRequests.length === 0 ? (
                <span className="text-[12px] text-mute-2">No requests yet.</span>
              ) : (
                powerRequests.slice(0, 6).map((request) => {
                  const ageS = Math.max(0, Math.floor((now - new Date(request.createdAt).getTime()) / 1000));
                  const ago = ageS < 60 ? `${ageS}s ago` : `${Math.floor(ageS / 60)}m ago`;
                  const owned = ownedByTeam.get(request.teamId)?.find((o) => o.powerCardId === request.powerCardId);
                  return (
                  <div
                    key={request.id}
                    className={`rounded-xl border p-3 flex flex-col gap-2 animate-[encRise_.3s_ease] ${
                      request.status === "REQUESTED" ? "border-warn/30 bg-warn/[.05]" : "border-line/[.08] bg-line/[.035]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg shrink-0">{request.powerCardIcon}</span>
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-[12px] font-bold text-ink-2 truncate">{request.powerCardName}</span>
                        <span className="flex items-center gap-1 text-[10.5px] text-mute-2 truncate">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: request.teamColor ?? "#6C7BFA" }} />
                          {request.teamName}
                          {owned ? ` · ${owned.remainingUses} left` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 flex flex-col items-end">
                        <span className="text-[9px] font-bold tracking-[.08em] text-dim-2">{request.status}</span>
                        <span className="text-[9.5px] text-mute-2 tabular-nums">{ago}</span>
                      </span>
                    </div>
                    {request.status === "REQUESTED" && (
                      <div className="grid grid-cols-3 gap-1.5">
                        <Button variant="primary" size="sm" onClick={() => action(() => resolvePowerCardRequest(request.id, true).then(() => undefined))} disabled={pending} className="justify-center">
                          Approve
                        </Button>
                        <Button variant="subtle" size="sm" onClick={() => action(() => resolvePowerCardRequest(request.id, false).then(() => undefined))} disabled={pending} className="justify-center">
                          Reject
                        </Button>
                        <Button variant="success" size="sm" onClick={() => action(() => hostForceActivatePowerCard(request.id).then(() => undefined))} disabled={pending} className="justify-center" title="Override — approve and activate now">
                          Override
                        </Button>
                      </div>
                    )}
                    {request.status === "APPROVED" && (
                      <Button variant="primary" size="sm" onClick={() => action(() => hostActivatePowerCard(request.id).then(() => undefined))} disabled={pending}>
                        Activate
                      </Button>
                    )}
                    {request.status === "ACTIVE" && (
                      <Button variant="subtle" size="sm" onClick={() => action(() => hostConsumePowerCard(request.id).then(() => undefined))} disabled={pending}>
                        Mark Consumed
                      </Button>
                    )}
                  </div>
                  );
                })
              )}
            </Module>


            {/* EVENT LOG — a filterable timeline: timestamp + category-tinted
                entry, newest first. */}
            <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-4 flex flex-col gap-2">
              <span className="text-sm font-bold text-ink-2">Event Log</span>
              <div className="flex flex-wrap gap-1">
                {LOG_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setLogFilter(f)}
                    className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold tracking-[.04em] cursor-pointer transition ${
                      logFilter === f ? "bg-accent text-white" : "bg-line/[.06] text-mute-2 hover:text-ink-3"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {(() => {
                const filtered = logs.filter((log) => logFilter === "ALL" || logCategory(log.type) === logFilter);
                if (filtered.length === 0) {
                  return <span className="text-[12px] text-mute-2">No matching actions.</span>;
                }
                const CAT_TINT: Record<Exclude<LogFilter, "ALL">, string> = {
                  SCORE: "text-success",
                  POWER: "text-accent",
                  STORE: "text-warn",
                  AUCTION: "text-warn",
                  BROADCAST: "text-info",
                  GENERAL: "text-mute-2",
                };
                return filtered.slice(0, 16).map((log) => {
                  const visual = LOG_VISUAL[log.type] ?? { icon: "circle", color: "text-mute-2" };
                  const cat = logCategory(log.type);
                  const time = new Date(log.createdAt);
                  const hhmm = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
                  return (
                    <div key={log.id} className="flex items-center gap-2 text-[11.5px] border-b border-line/[.06] pb-1">
                      <span className="font-mono text-[9.5px] text-dim-2 tabular-nums shrink-0 w-8">{hhmm}</span>
                      <Icon name={visual.icon} size={12} className={`${visual.color} shrink-0`} />
                      <span className={`truncate ${CAT_TINT[cat]}`}>{formatLog(log)}</span>
                    </div>
                  );
                });
              })()}
            </section>
          </div>
        </aside>
      </div>

      {/* BOTTOM COMMAND BAR — the host's fixed command center. The ten actions
          they repeat all night, sized large and evenly so nothing is hunted
          for; rare tools live behind Event Actions. */}
      <div className="h-[68px] border-t border-line/[.08] bg-[rgba(8,9,12,.96)] px-2.5 flex items-center gap-1.5 shrink-0">
        <Button variant="subtle" onClick={() => action(() => stepScene(room.id, "previous"))} disabled={pending} className="flex-1 min-w-0 justify-center h-12">
          <Icon name="skip-back" size={15} />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <Button variant="primary" onClick={() => action(() => stepScene(room.id, "next"))} disabled={pending} className="flex-[1.3] min-w-0 justify-center h-12 text-[15px]">
          <span className="hidden sm:inline">Next</span>
          <Icon name="skip-forward" size={16} />
        </Button>
        <Button variant={timerRunning ? "danger" : "success"} onClick={toggleTimer} disabled={pending} className="flex-1 min-w-0 justify-center h-12">
          <Icon name={timerRunning ? "pause" : "play"} size={15} />
          <span className="hidden md:inline">{timerRunning ? "Pause" : "Start"}</span>
        </Button>
        <Button
          variant="subtle"
          onClick={() => {
            play("reveal");
            action(() => revealAnswer(room.id));
          }}
          disabled={pending || timerRunning}
          title={timerRunning ? "Stop the timer before revealing the answer." : undefined}
          className="flex-1 min-w-0 justify-center h-12"
        >
          <Icon name="eye" size={15} />
          <span className="hidden lg:inline">Reveal</span>
        </Button>
        <Button
          variant="subtle"
          onClick={() => openScoring(assignedTeamId ?? teams[0]?.id ?? "", 10)}
          disabled={pending || teams.length === 0}
          className="flex-1 min-w-0 justify-center h-12"
        >
          <Icon name="plus-circle" size={15} />
          <span className="hidden lg:inline">Give Marks</span>
        </Button>
        <Button
          variant="subtle"
          onClick={jumpToLeaderboard}
          disabled={pending || !scenes.some((scene) => scene.type === "LEADERBOARD")}
          className="flex-1 min-w-0 justify-center h-12"
        >
          <Icon name="trophy" size={15} />
          <span className="hidden lg:inline">Leaderboard</span>
        </Button>
        <Button
          variant="subtle"
          onClick={() => setEventActionsOpen(true)}
          disabled={pending}
          className="flex-1 min-w-0 justify-center h-12"
        >
          <Icon name="wand-sparkles" size={15} />
          <span className="hidden lg:inline">Events</span>
        </Button>
        <Button
          variant="plain"
          onClick={undoLastScore}
          disabled={pending || !canUndo}
          className="flex-1 min-w-0 justify-center h-12"
        >
          <Icon name="undo-2" size={15} />
          <span className="hidden lg:inline">Undo</span>
        </Button>
        <Button
          variant="danger"
          onClick={emergencyStop}
          disabled={pending || !timerRunning}
          title="Freeze the room — pauses the live timer"
          className="flex-1 min-w-0 justify-center h-12"
        >
          <Icon name="octagon-x" size={15} />
          <span className="hidden lg:inline">Stop</span>
        </Button>
      </div>

      {/* EVENT ACTIONS DRAWER — the rare tools (store, auction, lucky spin,
          rewards, broadcast, round access, emergency), off-canvas until the
          host summons them so the live rail stays scroll-free. */}
      {eventActionsOpen && (
        <div className="fixed inset-0 z-[70] flex justify-end" data-theme="dark">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={() => setEventActionsOpen(false)} />
          <div className="relative w-full max-w-[400px] h-full bg-shell border-l border-line/[.1] flex flex-col shadow-[0_0_60px_rgba(0,0,0,.6)] animate-[encSlideInRight_.25s_ease]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-line/[.08] shrink-0">
              <Icon name="wand-sparkles" size={15} className="text-accent" />
              <span className="text-[13px] font-bold text-ink">Event Actions</span>
              <button onClick={() => setEventActionsOpen(false)} className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-mute-2 hover:bg-line/[.08] cursor-pointer">
                <Icon name="x" size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {/* SURPRISE PANEL */}
            <section className="rounded-2xl border border-accent/25 bg-accent/[.05] p-4 flex flex-col gap-2.5">
              <span className="flex items-center gap-1.5 text-sm font-bold text-ink-2">
                <Icon name="wand-sparkles" size={15} className="text-accent" />
                Surprise Panel
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="primary" size="sm" onClick={() => setSpinOpen(true)} disabled={pending || !teams.length}>
                  <Icon name="disc-3" size={14} />
                  Lucky Spin
                </Button>
                <Button variant="subtle" size="sm" onClick={() => action(() => freeRewardDrop(room.id))} disabled={pending || !teams.length}>
                  <Icon name="gift" size={14} />
                  Random Gift
                </Button>
              </div>
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-line/[.06]">
                <span className="text-[11px] font-semibold tracking-[.08em] text-label">GIVE BONUS COINS</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={bonusTarget}
                    onChange={(e) => setBonusTarget(e.target.value)}
                    className="bg-line/[.04] border border-line/[.1] rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none"
                  >
                    <option value="__ALL__" className="bg-surface">🌐 All teams</option>
                    <option value="__RANDOM__" className="bg-surface">🎲 Random team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id} className="bg-surface">
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(Number(e.target.value))}
                    className="bg-line/[.04] border border-line/[.1] rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none"
                  />
                </div>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() =>
                    bonusTarget &&
                    bonusAmount !== 0 &&
                    action(async () => {
                      if (bonusTarget === "__ALL__") {
                        await Promise.all(teams.map((team) => giveCoins(room.id, team.id, bonusAmount, "Bonus")));
                        return;
                      }
                      const targetTeamId =
                        bonusTarget === "__RANDOM__"
                          ? teams[Math.floor(Math.random() * teams.length)]?.id
                          : bonusTarget;
                      if (targetTeamId) await giveCoins(room.id, targetTeamId, bonusAmount, "Bonus");
                    })
                  }
                  disabled={pending || !bonusTarget || !teams.length}
                >
                  <Icon name="coins" size={14} />
                  Give +{bonusAmount} coins
                </Button>
              </div>
            </section>

            {/* AUCTION */}
            <section className="rounded-2xl border border-warn/25 bg-warn/[.05] p-4 flex flex-col gap-2.5">
              <span className="flex items-center gap-1.5 text-sm font-bold text-ink-2">
                <Icon name="gavel" size={15} className="text-warn" />
                Auction
              </span>
              {auction ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{auction.itemIcon}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-bold text-ink truncate">{auction.itemName}</span>
                      <span className="text-[11px] text-mute-2">
                        {auction.type} · {auction.type === "NORMAL"
                          ? auction.currentBid > 0
                            ? `high ${auction.currentBid}`
                            : `from ${auction.startingBid}`
                          : `${auction.bids.length} bids`}
                        {auction.stage !== "LIVE" && ` · ${auction.stage.replace("_", " ").toLowerCase()}`}
                      </span>
                    </div>
                  </div>

                  {auction.bids.length > 0 && (
                    <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                      {[...auction.bids]
                        .sort((a, b) => b.amount - a.amount)
                        .map((b) => (
                          <div key={b.teamId} className="flex items-center gap-2 text-[12px]">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: teamById.get(b.teamId)?.color ?? "#6C7BFA" }} />
                            <span className="text-ink-3 truncate">{teamById.get(b.teamId)?.name ?? "Team"}</span>
                            <span className="ml-auto font-mono font-semibold text-ink">{b.amount}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-1.5">
                    <Button variant="subtle" size="sm" onClick={() => action(() => advanceAuctionStage(auction.id))} disabled={pending}>
                      {auction.stage === "LIVE" ? "Going once" : auction.stage === "GOING_ONCE" ? "Going twice" : "Final call"}
                    </Button>
                    <Button variant="success" size="sm" onClick={() => action(() => settleAuction(auction.id))} disabled={pending}>
                      Sell
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => action(() => cancelAuction(auction.id))} disabled={pending}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["NORMAL", "SECRET", "LUCKY"] as AuctionType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setAuctionType(t)}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold cursor-pointer ${
                          auctionType === t ? "border-warn/50 bg-warn/[.14] text-ink" : "border-line/[.09] bg-line/[.03] text-mute-2"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={auctionCardId}
                      onChange={(e) => setAuctionCardId(e.target.value)}
                      className="bg-line/[.04] border border-line/[.1] rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none"
                    >
                      {cards.map((card) => (
                        <option key={card.id} value={card.id} className="bg-surface">
                          {card.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={auctionStartBid}
                      onChange={(e) => setAuctionStartBid(Number(e.target.value))}
                      placeholder="Start bid"
                      className="bg-line/[.04] border border-line/[.1] rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none"
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      auctionCardId &&
                      action(() =>
                        startAuction({
                          roomId: room.id,
                          powerCardId: auctionCardId,
                          type: auctionType,
                          startingBid: auctionStartBid,
                        }).then(() => undefined)
                      )
                    }
                    disabled={pending || !auctionCardId || !teams.length}
                  >
                    <Icon name="gavel" size={13} />
                    Start {auctionType} Auction
                  </Button>
                </>
              )}
            </section>

            {/* ACHIEVEMENTS */}
            <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-4 flex flex-col gap-2.5">
              <span className="text-sm font-bold text-ink-2">Achievements</span>
              {(() => {
                const suggested = achievements.filter((a) => a.status === "SUGGESTED");
                const awarded = achievements.filter((a) => a.status === "AWARDED").slice(0, 3);
                return (
                  <>
                    {suggested.length === 0 && (
                      <span className="text-[12px] text-mute-2">
                        No suggestions right now — they appear as teams answer.
                      </span>
                    )}
                    {suggested.map((ach) => {
                      const def = ACHIEVEMENTS[ach.type];
                      return (
                        <div
                          key={ach.id}
                          className="rounded-xl border border-warn/25 bg-warn/[.06] p-3 flex flex-col gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{def.emoji}</span>
                            <span className="flex flex-col min-w-0">
                              <span className="text-[13px] font-semibold text-ink truncate">
                                {teamById.get(ach.teamId)?.name ?? "Team"} — {def.label}
                              </span>
                              <span className="text-[11px] text-mute-2 truncate">
                                {def.description} · +{ach.coinReward} coins
                              </span>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => action(() => awardAchievement(ach.id))}
                              disabled={pending}
                            >
                              Award +{ach.coinReward}
                            </Button>
                            <Button
                              variant="subtle"
                              size="sm"
                              onClick={() => action(() => dismissAchievement(ach.id))}
                              disabled={pending}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    {awarded.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {awarded.map((ach) => (
                          <span
                            key={ach.id}
                            className="flex items-center gap-1 rounded-full border border-success/25 bg-success/[.08] px-2 py-1 text-[11px] text-success"
                          >
                            {ACHIEVEMENTS[ach.type].emoji} {teamById.get(ach.teamId)?.name ?? "Team"}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Manual award — for the calls the system can't see. */}
                    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-line/[.06]">
                      <span className="text-[11px] font-semibold tracking-[.08em] text-label">GIVE MANUALLY</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={manualAchTeamId}
                          onChange={(e) => setManualAchTeamId(e.target.value)}
                          className="bg-line/[.04] border border-line/[.1] rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none"
                        >
                          {teams.map((team) => (
                            <option key={team.id} value={team.id} className="bg-surface">
                              {team.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={manualAchType}
                          onChange={(e) => setManualAchType(e.target.value as AchievementType)}
                          className="bg-line/[.04] border border-line/[.1] rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none"
                        >
                          {MANUAL_ACHIEVEMENTS.map((type) => (
                            <option key={type} value={type} className="bg-surface">
                              {ACHIEVEMENTS[type].emoji} {ACHIEVEMENTS[type].label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() =>
                          manualAchTeamId &&
                          action(() => giveManualAchievement(room.id, manualAchTeamId, manualAchType))
                        }
                        disabled={pending || !manualAchTeamId}
                      >
                        Give {ACHIEVEMENTS[manualAchType].label} (+{ACHIEVEMENTS[manualAchType].coinReward})
                      </Button>
                    </div>
                  </>
                );
              })()}
            </section>
            {/* POWER STORE CONTROL */}
            <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-4 flex flex-col gap-2.5">
              {(() => {
                const storeOpen = room.storeStatus === "OPEN";
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink-2">Power Store</span>
                      <span
                        className={`ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[.08em] ${
                          storeOpen
                            ? "bg-success/15 text-success border border-success/30"
                            : "bg-line/[.06] text-mute-2 border border-line/[.1]"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${storeOpen ? "bg-success animate-enc-pulse" : "bg-mute-2"}`} />
                        {storeOpen ? "OPEN" : "CLOSED"}
                      </span>
                    </div>
                    <span className="text-[12px] text-mute-2">
                      {storeOpen
                        ? "Teams can buy power cards with coins right now."
                        : "Teams cannot buy power cards until you open the store."}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={storeOpen ? "success" : "subtle"}
                        onClick={() => action(() => openStore(room.id))}
                        disabled={pending || storeOpen}
                      >
                        {storeOpen ? "● Open" : "Open Store"}
                      </Button>
                      <Button
                        variant={storeOpen ? "subtle" : "danger"}
                        onClick={() => action(() => closeStore(room.id))}
                        disabled={pending || !storeOpen}
                      >
                        {storeOpen ? "Close Store" : "● Closed"}
                      </Button>
                    </div>
                  </>
                );
              })()}
              {feedback && <span className="text-[12px] text-danger-soft">{feedback}</span>}

              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-line/[.06]">
                <span className="text-[11px] font-semibold tracking-[.08em] text-label">STORE EVENTS</span>
                {room.liveState.flashSaleActive ? (
                  <Button variant="danger" size="sm" onClick={() => action(() => endFlashSale(room.id))} disabled={pending}>
                    <Icon name="zap-off" size={13} />
                    End Flash Sale
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="subtle" size="sm" onClick={() => action(() => startFlashSale(room.id, 50, 2))} disabled={pending}>
                      <Icon name="zap" size={13} />
                      50% · 2 min
                    </Button>
                    <Button variant="subtle" size="sm" onClick={() => action(() => startFlashSale(room.id, 30, 5))} disabled={pending}>
                      <Icon name="zap" size={13} />
                      30% · 5 min
                    </Button>
                  </div>
                )}
                <Button variant="subtle" size="sm" onClick={() => action(() => freeRewardDrop(room.id))} disabled={pending}>
                  <Icon name="gift" size={13} />
                  Free Reward Drop
                </Button>
              </div>
            </section>

            {round && (
              <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-4 flex flex-col gap-2">
                <span className="text-sm font-bold text-ink-2">Round Power Card Access</span>
                <span className="text-[11.5px] text-mute-2">
                  {roundIsRestricted
                    ? <>&quot;{round.title}&quot; restricts play to its allowed cards — check/uncheck to change what&apos;s live for this event.</>
                    : <>&quot;{round.title}&quot; allows every power card by default — uncheck any to turn it off for this event.</>}
                </span>
                <div className="flex flex-col gap-1.5">
                  {cards.map((card) => {
                    const allowedByRound = roundIsRestricted ? round.allowedPowerCards.includes(card.id) : true;
                    const forced = overrideSet.has(card.id);
                    const excluded = exclusionSet.has(card.id);
                    const live = (allowedByRound || forced) && !excluded;
                    return (
                      <label
                        key={card.id}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12px] cursor-pointer ${
                          live
                            ? "border-success/30 bg-success/[.06] text-ink-2"
                            : "border-line/[.08] bg-line/[.02] text-mute-2"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={live}
                          disabled={pending}
                          onChange={() =>
                            action(() =>
                              allowedByRound
                                ? toggleRoomPowerCardExclusion(room.id, card.id)
                                : toggleRoomPowerCardOverride(room.id, card.id)
                            )
                          }
                          className="accent-accent"
                        />
                        <span className="truncate">{card.name}</span>
                        {!allowedByRound && forced && (
                          <span className="ml-auto text-[10px] font-semibold text-accent shrink-0">FORCED ON</span>
                        )}
                        {allowedByRound && excluded && (
                          <span className="ml-auto text-[10px] font-semibold text-danger-soft shrink-0">TURNED OFF</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            {/* BROADCAST */}
            <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-4 flex flex-col gap-2">
              <span className="text-sm font-bold text-ink-2">Broadcast</span>
              {/* One-tap templates for the announcements a host repeats. */}
              <div className="flex flex-wrap gap-1.5">
                {BROADCAST_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => sendTemplate(t.message)}
                    disabled={pending}
                    className="rounded-full border border-line/[.1] bg-line/[.05] px-2.5 py-1 text-[11px] font-semibold text-ink-3 hover:bg-line/[.1] cursor-pointer disabled:opacity-40"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <textarea
                value={broadcast}
                onChange={(event) => setBroadcast(event.target.value)}
                placeholder="Custom announcement..."
                maxLength={180}
                className="min-h-20 bg-line/[.05] border border-line/[.1] rounded-xl px-3 py-2 text-[12px] text-ink outline-none resize-none"
              />
              <Button variant="primary" onClick={sendCurrentBroadcast} disabled={pending || !broadcast.trim()}>
                Send Custom Broadcast
              </Button>
              {feedback && <span className="text-[12px] text-danger-soft">{feedback}</span>}
            </section>
              {/* EMERGENCY ACTIONS */}
              <section className="rounded-2xl border border-danger/25 bg-danger/[.05] p-4 flex flex-col gap-2.5">
                <span className="flex items-center gap-1.5 text-sm font-bold text-danger-soft">
                  <Icon name="triangle-alert" size={15} />
                  Emergency Actions
                </span>
                <span className="text-[11.5px] text-mute-2">
                  Reset wipes this room&apos;s live progress. Use with care.
                </span>
                <Button variant="danger" onClick={() => { setEventActionsOpen(false); setResetOpen(true); }} disabled={pending}>
                  Reset Room
                </Button>
              </section>
              <Button variant="subtle" onClick={() => setEventActionsOpen(false)}>
                Close Drawer
              </Button>
            </div>
          </div>
        </div>
      )}

      <ScoringModal
        key={`${scoringOpen}-${scoringTeamId}-${scoringSeed}`}
        open={scoringOpen}
        onClose={() => setScoringOpen(false)}
        teams={teams}
        teamId={scoringTeamId}
        onTeamChange={setScoringTeamId}
        participants={participants}
        activeEffects={(ownedByTeam.get(scoringTeamId) ?? [])
          .filter((o) => o.status === "ACTIVE")
          .map((o) => cardById.get(o.powerCardId))
          .filter((c): c is PowerCardRecord => Boolean(c))
          .map((c) => ({ name: c.name, icon: c.icon, effectType: c.effectType }))}
        roundMode={round?.specialMode ?? "NONE"}
        insured={Boolean(question?.id && teamById.get(scoringTeamId)?.insuredQuestionIds?.includes(question.id))}
        initialValue={scoringSeed}
        pending={pending}
        onSubmit={(input) => {
          if (input.points !== 0) {
            setScoreFloat({
              id: Date.now(),
              points: input.points,
              team: teamById.get(input.teamId)?.name ?? "Team",
            });
          }
          action(() =>
            giveMarks({
              roomId: room.id,
              teamId: input.teamId,
              points: input.points,
              reason: input.reason,
              participantId: input.participantId || null,
              questionId: question?.id ?? null,
            })
          );
        }}
      />

      <RoomResetModal
        key={resetOpen ? "open" : "closed"}
        open={resetOpen}
        pending={pending}
        onClose={() => setResetOpen(false)}
        onReset={(removeTeams) =>
          action(async () => {
            await resetRoom(room.id, "RESET", removeTeams);
            setResetOpen(false);
          })
        }
      />

      <LuckySpinModal
        open={spinOpen}
        onClose={() => setSpinOpen(false)}
        teams={teams}
        teamId={surpriseTeamId}
        onTeamChange={setSurpriseTeamId}
        onSpin={(teamId) => {
          play("spin");
          return luckySpin(room.id, teamId);
        }}
        onDone={() => router.refresh()}
      />

      {/* Correct / Wrong burst — mirrors what the marked team sees on their
          phone, so the host screen reacts to the call too. */}
      {scoreFloat && (() => {
        const positive = scoreFloat.points >= 0;
        const color = positive ? "var(--color-success)" : "var(--color-danger-soft)";
        return (
          <div key={scoreFloat.id} className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-0 animate-[encEdgeFlash_1s_ease-out_forwards]"
              style={{ boxShadow: `inset 0 0 140px 30px color-mix(in oklab, ${color} 45%, transparent)` }}
            />
            <div
              className={`flex flex-col items-center gap-1.5 animate-[encBurst_1.4s_ease-out_forwards] ${
                positive ? "" : "animate-[encShake_0.5s_ease]"
              }`}
            >
              <span
                className="flex items-center justify-center w-20 h-20 rounded-full border-4 text-4xl font-black"
                style={{
                  color,
                  borderColor: color,
                  background: `color-mix(in oklab, ${color} 15%, transparent)`,
                  boxShadow: `0 0 50px color-mix(in oklab, ${color} 50%, transparent)`,
                }}
              >
                {positive ? "✓" : "✗"}
              </span>
              <span className="text-[13px] font-black tracking-[.18em]" style={{ color }}>
                {positive ? "CORRECT" : "WRONG"}
              </span>
              <span className="font-mono font-black text-3xl" style={{ color }}>
                {positive ? `+${scoreFloat.points}` : scoreFloat.points}
              </span>
              <span className="text-[12px] font-semibold text-ink-2">{scoreFloat.team}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function LuckySpinModal({
  open,
  onClose,
  teams,
  teamId,
  onTeamChange,
  onSpin,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  teams: TeamRecord[];
  teamId: string;
  onTeamChange: (id: string) => void;
  onSpin: (teamId: string) => Promise<SpinResult>;
  onDone: () => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const segAngle = 360 / SPIN_SEGMENTS.length;

  // Build the wheel face once — a conic gradient of the segment colors.
  const conic = SPIN_SEGMENTS.map(
    (s, i) => `${s.color} ${i * segAngle}deg ${(i + 1) * segAngle}deg`
  ).join(", ");

  async function spin() {
    if (spinning || !teamId) return;
    setResult(null);
    setSpinning(true);
    try {
      const outcome = await onSpin(teamId);
      // Land the chosen segment's center under the top pointer, after 5 turns.
      const landing = 360 - (outcome.index * segAngle + segAngle / 2);
      setRotation((prev) => {
        const base = Math.ceil(prev / 360) * 360;
        return base + 360 * 5 + landing;
      });
      window.setTimeout(() => {
        setResult(outcome);
        setSpinning(false);
        onDone();
      }, 3700);
    } catch {
      setSpinning(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !spinning && onClose()} className="max-w-[380px]">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-line/[.07]">
        <Icon name="disc-3" size={18} className="text-accent" />
        <span className="text-base font-bold text-ink">Lucky Spin</span>
        <button onClick={onClose} disabled={spinning} className="ml-auto w-[30px] h-[30px] rounded-lg flex items-center justify-center text-dim hover:bg-line/[.06] cursor-pointer disabled:opacity-40">
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className="px-6 py-5 flex flex-col items-center gap-4">
        <select
          value={teamId}
          onChange={(e) => onTeamChange(e.target.value)}
          disabled={spinning}
          className="w-full bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id} className="bg-surface">
              {team.name}
            </option>
          ))}
        </select>

        <div className="relative w-[240px] h-[240px]">
          {/* pointer */}
          <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-10 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-accent" />
          <div
            className="w-full h-full rounded-full border-4 border-line/[.14]"
            style={{
              background: `conic-gradient(${conic})`,
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 3.6s cubic-bezier(0.15,0.8,0.25,1)" : "none",
            }}
          >
            {SPIN_SEGMENTS.map((s, i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 text-lg"
                style={{
                  transform: `rotate(${i * segAngle + segAngle / 2}deg) translateY(-92px) translateX(-50%)`,
                  transformOrigin: "center top",
                }}
              >
                {s.emoji}
              </div>
            ))}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card border-2 border-line/[.16] flex items-center justify-center">
            <Icon name="sparkles" size={16} className="text-accent" />
          </div>
        </div>

        {result ? (
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-3xl">{result.emoji}</span>
            <span className="text-lg font-bold text-ink">
              {result.cardName ? `${result.label}: ${result.cardName}` : result.label}
            </span>
            <span className="text-[12px] text-mute-2">{teams.find((t) => t.id === teamId)?.name}</span>
            {result.cardName && (
              <span className="text-[11px] text-accent">Added to their inventory — usable next question.</span>
            )}
          </div>
        ) : (
          <span className="text-[12px] text-mute-2 h-[68px] flex items-center">
            {spinning ? "Spinning..." : "Pick a team and spin the wheel."}
          </span>
        )}
      </div>

      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
        <Button variant="plain" onClick={onClose} disabled={spinning}>
          Close
        </Button>
        <Button variant="primary" onClick={spin} disabled={spinning || !teamId}>
          {spinning ? "Spinning..." : result ? "Spin Again" : "Spin"}
        </Button>
      </div>
    </Modal>
  );
}

function SetupRequiredCard({
  checklist,
  canGenerate,
  pending,
  onGenerate,
}: {
  checklist: { label: string; ready: boolean }[];
  canGenerate: boolean;
  pending: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="w-full max-w-[480px] rounded-[28px] border border-dashed border-line/[.16] bg-line/[.02] p-8 flex flex-col items-center gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center">
        <Icon name="clapperboard" size={26} className="text-accent" />
      </div>
      <span className="text-xl font-bold text-ink">Setup required</span>
      <span className="text-[13px] text-mute-2">This room isn&apos;t ready to go live yet.</span>
      <div className="w-full flex flex-col gap-2 text-left">
        {checklist.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-[13px]">
            <Icon
              name={item.ready ? "check-circle-2" : "circle-x"}
              size={16}
              className={item.ready ? "text-success" : "text-danger-soft"}
            />
            <span className={item.ready ? "text-ink-2" : "text-mute-2"}>{item.label}</span>
          </div>
        ))}
      </div>
      <Button variant="primary" onClick={onGenerate} disabled={pending || !canGenerate}>
        Generate Scenes From Rounds
      </Button>
      {!canGenerate && (
        <span className="text-[11.5px] text-mute-2">Add rounds with questions to this room first.</span>
      )}
    </div>
  );
}

const EFFECT_LABEL: Record<PowerCardEffectType, string> = {
  HINT: "Hint unlocked",
  EXTRA_TIME: "Extra time",
  BLOCK_NEGATIVE: "Shield — blocks one negative",
  INSURANCE: "Insurance — no negatives for 3 questions",
  DOUBLE_SCORE: "Double Points — next correct counts 2×",
  SECOND_CHANCE: "Second Chance — may answer again",
  MYSTERY: "Mystery effect",
  GAMBLE: "All-or-Nothing — double reward or double penalty",
  FREEZE: "Freeze — opponent's cards locked next question",
  PEEK: "Peek — one wrong MCQ option ruled out",
};

function ScoringModal({
  open,
  onClose,
  teams,
  teamId,
  onTeamChange,
  participants,
  activeEffects,
  roundMode,
  insured,
  initialValue,
  pending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  teams: TeamRecord[];
  teamId: string;
  onTeamChange: (id: string) => void;
  participants: ParticipantRecord[];
  activeEffects: ActiveEffect[];
  roundMode: SpecialRoundMode;
  insured: boolean;
  initialValue: number;
  pending: boolean;
  onSubmit: (input: { teamId: string; points: number; reason: ScoreReason; participantId: string }) => void;
}) {
  const [points, setPoints] = useState(initialValue);
  const [reason, setReason] = useState<ScoreReason>(
    roundMode === "BONUS" ? "BONUS" : initialValue >= 0 ? "CORRECT" : "WRONG"
  );
  const [participantId, setParticipantId] = useState("");

  const teamParticipants = participants.filter((p) => p.teamId === teamId);
  const hasDouble = activeEffects.some((e) => e.effectType === "DOUBLE_SCORE");
  const hasShield = activeEffects.some((e) => e.effectType === "BLOCK_NEGATIVE");
  const hasGamble = activeEffects.some((e) => e.effectType === "GAMBLE");
  const combo = hasDouble && hasShield;
  const modeDef = roundMode !== "NONE" ? ROUND_MODES[roundMode] : null;
  const scoreValues = roundMode === "BONUS" ? SCORE_VALUES.filter((value) => value >= 0) : SCORE_VALUES;

  function submit() {
    onSubmit({ teamId, points, reason, participantId });
    onClose();
  }

  return (
    <Modal open={open} onClose={() => !pending && onClose()} className="max-w-[420px]">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-line/[.07]">
        <span className="text-base font-bold text-ink">Give Marks</span>
        <button onClick={onClose} className="ml-auto w-[30px] h-[30px] rounded-lg flex items-center justify-center text-dim hover:bg-line/[.06] cursor-pointer">
          <Icon name="x" size={15} />
        </button>
      </div>
      <div className="px-6 py-5 flex flex-col gap-3.5">
        <label className="flex flex-col gap-[7px]">
          <span className="text-xs font-semibold text-ink-3">Team</span>
          <select
            value={teamId}
            onChange={(e) => onTeamChange(e.target.value)}
            className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none"
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id} className="bg-surface">
                {team.name}
              </option>
            ))}
          </select>
        </label>

        {teamParticipants.length > 0 && (
          <label className="flex flex-col gap-[7px]">
            <span className="text-xs font-semibold text-ink-3">Member (optional)</span>
            <select
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none"
            >
              <option value="" className="bg-surface">
                Whole team
              </option>
              {teamParticipants.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface">
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {modeDef && (
          <div
            className="flex flex-col gap-2 rounded-xl border px-3 py-2.5"
            style={{
              borderColor: `color-mix(in oklab, ${modeDef.color} 40%, transparent)`,
              background: `color-mix(in oklab, ${modeDef.color} 10%, transparent)`,
            }}
          >
            <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: modeDef.color }}>
              {modeDef.emoji} {modeDef.label} — {modeDef.description}
            </span>
            {roundMode === "RISK" && modeDef.riskTiers && (
              <div className="grid grid-cols-3 gap-1.5">
                {modeDef.riskTiers.map((tier) => (
                  <button
                    key={tier.label}
                    onClick={() => {
                      setPoints(tier.points);
                      setReason("CORRECT");
                    }}
                    className="rounded-lg border border-line/[.12] bg-line/[.04] px-2 py-1.5 text-[11.5px] font-semibold text-ink-3 hover:text-ink cursor-pointer"
                  >
                    {tier.label} +{tier.points}
                  </button>
                ))}
              </div>
            )}
            {roundMode === "SPEED" && (
              <button
                onClick={() => setPoints(Math.round(Math.abs(points || 10) * 1.5))}
                className="self-start rounded-lg border border-line/[.12] bg-line/[.04] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-3 hover:text-ink cursor-pointer"
              >
                ×1.5 speed bonus → +{Math.round(Math.abs(points || 10) * 1.5)}
              </button>
            )}
            {roundMode === "BONUS" && (
              <button
                onClick={() => setReason("BONUS")}
                className="self-start rounded-lg border border-line/[.12] bg-line/[.04] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-3 hover:text-ink cursor-pointer"
              >
                Set reason: BONUS (rewards only)
              </button>
            )}
          </div>
        )}

        {combo && (
          <div className="rounded-xl border border-accent/40 bg-[linear-gradient(90deg,rgba(108,123,250,.16),rgba(61,214,140,.16))] px-3 py-2 text-[12px] font-semibold text-ink">
            🔥 COMBO · Safe Double Attack — this team is doubled and protected.
          </div>
        )}

        {insured && (
          <div className="rounded-xl border border-info/40 bg-info/[.1] px-3 py-2 text-[12px] font-semibold text-info">
            🩹 Insurance active — negative marks are auto-blocked for this team on this question.
          </div>
        )}

        <div className="grid grid-cols-4 gap-1.5">
          {scoreValues.map((value) => (
            <button
              key={value}
              onClick={() => setPoints(value)}
              className={`rounded-lg border px-2 py-2 text-[12px] font-mono font-bold cursor-pointer ${
                points === value ? "border-accent/60 bg-accent/20 text-ink" : "border-line/[.08] bg-line/[.04] text-mute-2"
              }`}
            >
              {value > 0 ? `+${value}` : value}
            </button>
          ))}
          <input
            type="number"
            min={roundMode === "BONUS" ? 0 : undefined}
            value={points}
            onChange={(e) => setPoints(roundMode === "BONUS" ? Math.max(0, Number(e.target.value)) : Number(e.target.value))}
            className="col-span-4 bg-line/[.05] border border-line/[.1] rounded-xl px-3 py-2 text-[13px] text-ink outline-none"
            placeholder="Custom"
          />
        </div>

        {activeEffects.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/[.08] px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[.1em] text-accent">
              <Icon name="zap" size={12} />
              ACTIVE POWERS — APPLIED AUTOMATICALLY
            </span>
            <div className="flex flex-col gap-1">
              {activeEffects.map((effect, i) => (
                <span key={`${effect.effectType}-${i}`} className="flex items-center gap-1.5 text-[12px] text-ink-3">
                  <span>{effect.icon}</span>
                  {EFFECT_LABEL[effect.effectType]}
                </span>
              ))}
            </div>
            {(hasShield || hasDouble || hasGamble) && (
              <span className="text-[11px] text-mute-2">
                Enter the number normally — Shield/Double/Gamble apply and consume themselves on submit, no need to
                pre-multiply.
              </span>
            )}
          </div>
        )}

        <label className="flex flex-col gap-[7px]">
          <span className="text-xs font-semibold text-ink-3">Reason</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as ScoreReason)}
            className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none"
          >
            {SCORE_REASONS.map((r) => (
              <option key={r} value={r} className="bg-surface">
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
        <Button variant="plain" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} loading={pending} disabled={!teamId}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
    </Modal>
  );
}

const DEVICE_ROLE_META: Record<ParticipantRecord["role"], { emoji: string; label: string }> = {
  CAPTAIN: { emoji: "👑", label: "Captain" },
  VICE_CAPTAIN: { emoji: "⭐", label: "Vice Captain" },
  MEMBER: { emoji: "👤", label: "Member" },
};

/**
 * Connected phones for one team, with host controls to reassign the
 * Captain / Vice Captain. The host is the ultimate authority over roles —
 * automatic assignment (first phone = captain) is just the default.
 */
function TeamDevicesPanel({
  roomId,
  devices,
  pending,
  action,
}: {
  roomId: string;
  devices: ParticipantRecord[];
  pending: boolean;
  action: (run: () => Promise<void>) => void;
}) {
  if (devices.length === 0) {
    return (
      <span className="mt-1 text-[10.5px] text-dim">No phones connected for this team yet.</span>
    );
  }
  return (
    <div className="flex flex-col gap-1 mt-1">
      <span className="text-[10px] font-semibold text-dim-2 tracking-[.1em]">CONNECTED DEVICES</span>
      {devices.map((device) => {
        const meta = DEVICE_ROLE_META[device.role];
        return (
          <div key={device.id} className="flex items-center gap-2 text-[11.5px] text-ink-3">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${device.connected ? "bg-success" : "bg-line/[.25]"}`}
              title={device.connected ? "Connected" : "Disconnected"}
            />
            <span className="truncate flex-1">
              {meta.emoji} {device.name}
              <span className="text-dim"> · {meta.label}{device.connected ? "" : " · offline"}</span>
            </span>
            {device.role !== "CAPTAIN" && (
              <button
                onClick={() => action(() => setTeamDeviceRole(roomId, device.id, "CAPTAIN"))}
                disabled={pending}
                className="text-warn hover:brightness-125 text-[10.5px] font-semibold cursor-pointer shrink-0"
              >
                Make Captain
              </button>
            )}
            {device.role === "MEMBER" && (
              <button
                onClick={() => action(() => setTeamDeviceRole(roomId, device.id, "VICE_CAPTAIN"))}
                disabled={pending}
                className="text-accent hover:brightness-125 text-[10.5px] font-semibold cursor-pointer shrink-0"
              >
                Make VC
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Written answers submitted by team captains for the current question
 * (rooms with answerMode CAPTAIN_SUBMIT). A record for the host to judge —
 * marks are still given manually via Give Marks.
 */
function SubmittedAnswers({
  logs,
  questionId,
  teamById,
}: {
  logs: EventLogRecord[];
  questionId: string;
  teamById: Map<string, TeamRecord>;
}) {
  // Latest submission per team for this question only.
  const byTeam = new Map<string, EventLogRecord>();
  for (const log of logs) {
    if (log.type !== "ANSWER_SUBMITTED") continue;
    if (String(log.metadata?.questionId ?? "") !== questionId) continue;
    const teamId = String(log.metadata?.teamId ?? "");
    if (!byTeam.has(teamId)) byTeam.set(teamId, log); // logs are newest-first
  }
  if (byTeam.size === 0) return null;

  return (
    <div className="flex flex-col gap-1 mt-1">
      <span className="text-[10px] font-semibold text-dim-2 tracking-[.1em]">SUBMITTED ANSWERS</span>
      {[...byTeam.entries()].map(([teamId, log]) => {
        const team = teamById.get(teamId);
        return (
          <div key={log.id} className="flex items-center gap-2 rounded-lg bg-line/[.04] px-2 py-1.5 text-[11.5px]">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: team?.color ?? "#6C7BFA" }} />
            <span className="font-semibold text-ink-3 shrink-0">{team?.name ?? "Team"}:</span>
            <span className="text-ink-2 truncate">{String(log.metadata?.text ?? "")}</span>
          </div>
        );
      })}
    </div>
  );
}
