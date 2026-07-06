"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
} from "@/actions/powerCard.actions";
import { giveCoins } from "@/actions/coin.actions";
import { giveMarks, hostUndoScoreTransaction } from "@/actions/score.actions";
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
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [broadcast, setBroadcast] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [teamCoinAmount, setTeamCoinAmount] = useState(100);
  const [teamCardId, setTeamCardId] = useState(cards[0]?.id ?? "");
  const [revealedHintsByQuestion, setRevealedHintsByQuestion] = useState<Record<string, number>>({});
  const [scoringOpen, setScoringOpen] = useState(false);
  const [scoringTeamId, setScoringTeamId] = useState(teams[0]?.id ?? "");
  const [scoringSeed, setScoringSeed] = useState(10);
  const [manualAchTeamId, setManualAchTeamId] = useState(teams[0]?.id ?? "");
  const [manualAchType, setManualAchType] = useState<AchievementType>(MANUAL_ACHIEVEMENTS[0]);
  const [spinOpen, setSpinOpen] = useState(false);
  const [surpriseTeamId, setSurpriseTeamId] = useState(teams[0]?.id ?? "");
  const [bonusAmount, setBonusAmount] = useState(200);
  const [auctionType, setAuctionType] = useState<AuctionType>("NORMAL");
  const [auctionCardId, setAuctionCardId] = useState(cards[0]?.id ?? "");
  const [auctionStartBid, setAuctionStartBid] = useState(500);
  const [scoreFloat, setScoreFloat] = useState<{ id: number; points: number; team: string } | null>(null);

  const current = scenes.find((scene) => scene.id === room.currentSceneId) ?? scenes[0] ?? null;
  const question = current?.questionId ? questions.find((item) => item.id === current.questionId) : null;
  const round = current?.roundId ? rounds.find((item) => item.id === current.roundId) : null;
  const overrideSet = new Set(room.powerCardOverrides);
  const roundIsRestricted = round?.powerCardMode === "CUSTOM";

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const cardById = new Map(cards.map((c) => [c.id, c]));
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

  useEffect(() => {
    if (!scoreFloat) return;
    const t = window.setTimeout(() => setScoreFloat(null), 1300);
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

  const questionIndex = round && question ? round.questionIds.indexOf(question.id) + 1 : null;
  const connectedCount = room.onlineDevices || participants.length;
  const revealedHints = question ? (revealedHintsByQuestion[question.id] ?? 0) : 0;

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

  function sceneIcon(scene: SceneRecord) {
    if (scene.id === room.currentSceneId) return "LIVE";
    if (scene.status === "COMPLETED") return "DONE";
    return "NEXT";
  }

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

  function toggleTimer() {
    action(() =>
      timerRunning ? pauseTimer(room.id) : startTimer(room.id, Number(current?.settings?.timer ?? 30))
    );
  }

  function addTime(seconds: number) {
    action(() => startTimer(room.id, (secondsLeft ?? Number(current?.settings?.timer ?? 30)) + seconds));
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

  return (
    <div className="h-screen bg-shell flex flex-col overflow-hidden">
      {/* TOP BAR */}
      <div className="min-h-16 border-b border-line/[.07] px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 flex-wrap shrink-0">
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
          <Icon name="users" size={13} />
          {connectedCount} Connected
        </span>
        <span className="ml-auto font-mono text-lg sm:text-xl font-black text-ink tabular-nums shrink-0">
          {timerDisplay}
        </span>
        <Button
          variant="primary"
          size="sm"
          onClick={() => action(() => startEvent(room.id))}
          disabled={pending || scenes.length === 0 || room.status === "LIVE"}
          className="shrink-0"
        >
          {room.status === "LIVE" ? "Live" : room.status === "TESTING" ? "Start Test" : "Start Event"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_360px] flex-1 min-h-0 overflow-y-auto xl:overflow-hidden">
        {/* LEFT PANEL — EVENT FLOW */}
        <aside className="hidden lg:flex flex-col border-r border-line/[.07] min-h-0">
          <div className="px-4 py-3 text-[11px] font-mono font-semibold tracking-[.12em] text-label">
            EVENT FLOW
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-3">
            {flowGroups.length === 0 ? (
              <span className="text-[12px] text-mute-2 px-1">No scenes yet.</span>
            ) : (
              flowGroups.map((group) => (
                <div key={group.key} className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-mono font-semibold tracking-[.1em] text-dim-2 px-1 uppercase">
                    {group.label}
                  </span>
                  {group.scenes.map((scene, index) => {
                    const moveUpDisabled = scene.order === 0 || index === 0;
                    const moveDownDisabled = scene.order === scenes.length - 1 || index === group.scenes.length - 1;
                    return (
                      <div
                        key={scene.id}
                        className={`rounded-xl border px-2 py-2 flex items-center gap-2 ${
                        scene.id === room.currentSceneId
                          ? "border-accent/55 bg-accent/15"
                          : "border-line/[.08] bg-line/[.03] hover:bg-line/[.06]"
                      }`}
                      >
                        <button
                          onClick={() => action(() => publishScene(room.id, scene.id).then(() => undefined))}
                          className="min-w-0 flex-1 flex items-center gap-2 text-left cursor-pointer"
                        >
                          <span className="text-[9px] font-mono w-8 text-center shrink-0 text-mute-2">{sceneIcon(scene)}</span>
                          <span className="flex flex-col min-w-0">
                            <span className="text-[12.5px] font-semibold text-ink-2 truncate">{scene.title}</span>
                            <span className="text-[10.5px] text-mute-2">{scene.type.replace(/_/g, " ")}</span>
                          </span>
                        </button>
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
              ))
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
                    : "Waiting"}
              </span>
            )}
          </div>
          {scenes.length > 0 && (
            <div className="lg:hidden border-b border-line/[.07] px-3 py-2 overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {scenes.map((scene) => (
                  <button
                    key={scene.id}
                    onClick={() => action(() => publishScene(room.id, scene.id).then(() => undefined))}
                    className={`rounded-lg border px-3 py-2 text-left min-w-[132px] ${
                      scene.id === room.currentSceneId
                        ? "border-accent/55 bg-accent/15"
                        : "border-line/[.08] bg-line/[.03]"
                    }`}
                  >
                    <span className="block text-[9px] font-mono text-mute-2">{sceneIcon(scene)}</span>
                    <span className="block text-[12px] font-semibold text-ink-2 truncate">{scene.title}</span>
                  </button>
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
                <div className="w-full max-w-[720px] rounded-[28px] border border-line/[.09] bg-[rgba(18,20,27,.82)] p-8 flex flex-col items-center text-center gap-4">
                  <span className="text-[11px] font-semibold text-accent bg-accent/15 rounded-full px-3 py-1">
                    {current?.type ?? "NO SCENE"}
                  </span>
                  {round && <span className="text-[12px] text-mute-2">{round.title}</span>}
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
                  <span className="font-mono text-3xl font-black text-ink tabular-nums">{timerDisplay}</span>
                </div>

                {question && (
                  <div className="w-full max-w-[720px] rounded-2xl border border-warn/25 bg-warn/[.06] p-4 flex flex-col gap-2 text-left">
                    <span className="text-[10px] font-mono font-semibold tracking-[.12em] text-warn">
                      ANSWER — HOST ONLY, HIDDEN FROM PARTICIPANTS
                    </span>
                    <span className="text-lg font-bold text-ink">{question.answer}</span>
                    {question.hostNotes && (
                      <>
                        <span className="text-[10px] font-mono font-semibold tracking-[.12em] text-dim-2 mt-2">
                          HOST NOTES
                        </span>
                        <span className="text-[13px] text-mute-2">{question.hostNotes}</span>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* RIGHT PANEL — CONTROL CENTER */}
        <aside className="flex flex-col border-t xl:border-t-0 xl:border-l border-line/[.07] min-h-[620px] xl:min-h-0">
          <div className="px-4 py-3 text-[11px] font-mono font-semibold tracking-[.12em] text-label">
            CONTROL CENTER
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {/* CURRENT QUESTION */}
            <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-4 flex flex-col gap-2">
              <span className="text-sm font-bold text-ink-2">Current Question</span>
              {question ? (
                <>
                  <span className="text-[12px] text-mute-2">
                    {questionIndex ? `Q${questionIndex}` : "Question"} · {question.type}
                  </span>
                  <span className="text-[12px] text-mute-2">
                    Answer: <b className="text-ink-2">{question.answer}</b>
                  </span>
                  {revealedHints > 0 && (
                    <div className="flex flex-col gap-1 mt-1">
                      {question.hints.slice(0, revealedHints).map((hint, i) => (
                        <span key={i} className="text-[11.5px] text-ink-3 bg-line/[.04] rounded-lg px-2 py-1">
                          Hint {i + 1}: {hint.text} (-{hint.penalty})
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() =>
                        setRevealedHintsByQuestion((currentHints) => ({
                          ...currentHints,
                          [question.id]: Math.min((currentHints[question.id] ?? 0) + 1, question.hints.length),
                        }))
                      }
                      disabled={revealedHints >= question.hints.length}
                    >
                      Reveal Hint
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => action(() => revealAnswer(room.id))} disabled={pending}>
                      Reveal Answer
                    </Button>
                  </div>
                </>
              ) : (
                <span className="text-[12px] text-mute-2">No question active.</span>
              )}
            </section>

            {/* TIMER */}
            <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-4 flex flex-col gap-3">
              <span className="text-sm font-bold text-ink-2">Timer</span>
              <span className="font-mono text-3xl font-black text-center text-ink tabular-nums">{timerDisplay}</span>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="primary" onClick={() => action(() => startTimer(room.id, Number(current?.settings?.timer ?? 30)))} disabled={pending}>
                  Start
                </Button>
                <Button variant="subtle" onClick={() => action(() => pauseTimer(room.id))} disabled={pending}>
                  Pause
                </Button>
                <Button variant="subtle" onClick={() => action(() => resetTimer(room.id))} disabled={pending}>
                  Reset
                </Button>
                <Button variant="subtle" onClick={() => addTime(10)} disabled={pending}>
                  +10 sec
                </Button>
              </div>
            </section>

            {/* TEAMS */}
            <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-4 flex flex-col gap-2">
              <span className="text-sm font-bold text-ink-2">Teams</span>
              {teams.map((team) => {
                const owned = ownedByTeam.get(team.id) ?? [];
                const expanded = expandedTeamId === team.id;
                return (
                  <div key={team.id} className="rounded-xl border border-line/[.07] bg-elev overflow-hidden">
                    <button
                      onClick={() => setExpandedTeamId(expanded ? null : team.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: team.color ?? "#6C7BFA" }} />
                      <span className="text-[12.5px] font-semibold text-ink-2 truncate">{team.name}</span>
                      <span className="ml-auto flex items-center gap-2 text-[11px] font-mono shrink-0">
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
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

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
                    value={surpriseTeamId}
                    onChange={(e) => setSurpriseTeamId(e.target.value)}
                    className="bg-line/[.04] border border-line/[.1] rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none"
                  >
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
                    surpriseTeamId &&
                    bonusAmount !== 0 &&
                    action(() => giveCoins(room.id, surpriseTeamId, bonusAmount, "Bonus"))
                  }
                  disabled={pending || !surpriseTeamId}
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

            {/* POWER REQUESTS */}
            <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-4 flex flex-col gap-2">
              <span className="text-sm font-bold text-ink-2">Power Requests</span>
              {powerRequests.length === 0 ? (
                <span className="text-[12px] text-mute-2">No requests yet.</span>
              ) : (
                powerRequests.slice(0, 5).map((request) => (
                  <div key={request.id} className="rounded-xl border border-line/[.08] bg-line/[.035] p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{request.powerCardIcon}</span>
                      <span className="flex flex-col min-w-0">
                        <span className="text-[12px] font-bold text-ink-2 truncate">{request.powerCardName}</span>
                        <span className="text-[10.5px] text-mute-2 truncate">
                          {request.teamName} - {request.status}
                        </span>
                      </span>
                    </div>
                    {request.status === "REQUESTED" && (
                      <div className="grid grid-cols-3 gap-1.5">
                        <Button variant="primary" size="sm" onClick={() => action(() => resolvePowerCardRequest(request.id, true).then(() => undefined))} disabled={pending}>
                          Approve
                        </Button>
                        <Button variant="subtle" size="sm" onClick={() => action(() => resolvePowerCardRequest(request.id, false).then(() => undefined))} disabled={pending}>
                          Reject
                        </Button>
                        <Button variant="success" size="sm" onClick={() => action(() => hostForceActivatePowerCard(request.id).then(() => undefined))} disabled={pending}>
                          Force
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
                ))
              )}
            </section>

            {/* POWER STORE CONTROL */}
            <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-4 flex flex-col gap-2.5">
              <span className="text-sm font-bold text-ink-2">Power Store Control</span>
              <span className="text-[12px] text-mute-2">Power Store is {room.storeStatus.toLowerCase()}.</span>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="subtle" onClick={() => action(() => openStore(room.id))} disabled={pending}>
                  Open
                </Button>
                <Button variant="subtle" onClick={() => action(() => closeStore(room.id))} disabled={pending}>
                  Close
                </Button>
              </div>

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
                {!roundIsRestricted ? (
                  <span className="text-[12px] text-mute-2">
                    &quot;{round.title}&quot; allows every power card — no restrictions to override.
                  </span>
                ) : (
                  <>
                    <span className="text-[11.5px] text-mute-2">
                      &quot;{round.title}&quot; restricts play to its allowed cards. Force one on for this event anyway:
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {cards.map((card) => {
                        const allowedByRound = round.allowedPowerCards.includes(card.id);
                        const forced = overrideSet.has(card.id);
                        return (
                          <label
                            key={card.id}
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12px] ${
                              allowedByRound || forced
                                ? "border-success/30 bg-success/[.06] text-ink-2"
                                : "border-line/[.08] bg-line/[.02] text-mute-2"
                            }`}
                          >
                            {allowedByRound ? (
                              <Icon name="check" size={13} className="text-success shrink-0" />
                            ) : (
                              <input
                                type="checkbox"
                                checked={forced}
                                disabled={pending}
                                onChange={() => action(() => toggleRoomPowerCardOverride(room.id, card.id))}
                                className="accent-accent"
                              />
                            )}
                            <span className="truncate">{card.name}</span>
                            {!allowedByRound && forced && (
                              <span className="ml-auto text-[10px] font-semibold text-accent shrink-0">FORCED ON</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* BROADCAST */}
            <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-4 flex flex-col gap-2">
              <span className="text-sm font-bold text-ink-2">Broadcast</span>
              <textarea
                value={broadcast}
                onChange={(event) => setBroadcast(event.target.value)}
                placeholder="Break time, warning, announcement..."
                maxLength={180}
                className="min-h-20 bg-line/[.05] border border-line/[.1] rounded-xl px-3 py-2 text-[12px] text-ink outline-none resize-none"
              />
              <Button variant="primary" onClick={sendCurrentBroadcast} disabled={pending || !broadcast.trim()}>
                Send Broadcast
              </Button>
              {feedback && <span className="text-[12px] text-danger-soft">{feedback}</span>}
            </section>

            {/* EVENT LOG */}
            <section className="rounded-2xl border border-line/[.08] bg-line/[.03] p-4 flex flex-col gap-2">
              <span className="text-sm font-bold text-ink-2">Event Log</span>
              {logs.length === 0 ? (
                <span className="text-[12px] text-mute-2">No actions yet.</span>
              ) : (
                logs.slice(0, 12).map((log) => {
                  const visual = LOG_VISUAL[log.type] ?? { icon: "circle", color: "text-mute-2" };
                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-2 text-[11.5px] text-mute-2 border-b border-line/[.06] pb-1"
                    >
                      <Icon name={visual.icon} size={12} className={`${visual.color} shrink-0`} />
                      <span className="truncate">{formatLog(log)}</span>
                    </div>
                  );
                })
              )}
            </section>
          </div>
        </aside>
      </div>

      {/* BOTTOM HOST DOCK */}
      <div className="h-16 border-t border-line/[.08] bg-[rgba(8,9,12,.94)] px-3 flex items-center gap-2 overflow-x-auto shrink-0">
        <Button variant="subtle" onClick={() => action(() => stepScene(room.id, "previous"))} disabled={pending} className="shrink-0">
          <Icon name="skip-back" size={14} />
          Previous
        </Button>
        <Button variant="primary" onClick={() => action(() => stepScene(room.id, "next"))} disabled={pending} className="shrink-0">
          Next
          <Icon name="skip-forward" size={14} />
        </Button>
        <Button variant="subtle" onClick={toggleTimer} disabled={pending} className="shrink-0">
          {timerRunning ? "Pause Timer" : "Start Timer"}
        </Button>
        <Button variant="subtle" onClick={() => action(() => revealAnswer(room.id))} disabled={pending} className="shrink-0">
          Reveal Answer
        </Button>
        <Button
          variant="subtle"
          onClick={() => openScoring(teams[0]?.id ?? "", 10)}
          disabled={pending || teams.length === 0}
          className="shrink-0"
        >
          Give Marks
        </Button>
        <Button
          variant="subtle"
          onClick={jumpToLeaderboard}
          disabled={pending || !scenes.some((scene) => scene.type === "LEADERBOARD")}
          className="shrink-0"
        >
          Leaderboard
        </Button>
        <Button
          variant="subtle"
          onClick={() => action(() => (room.storeStatus === "OPEN" ? closeStore(room.id) : openStore(room.id)))}
          disabled={pending}
          className="shrink-0"
        >
          {room.storeStatus === "OPEN" ? "Close Store" : "Power Store"}
        </Button>
        <Button variant="subtle" onClick={sendCurrentBroadcast} disabled={pending || !broadcast.trim()} className="shrink-0">
          Broadcast
        </Button>
        <Button
          variant="plain"
          onClick={() => {
            const last = scoreHistory.find((entry) => !entry.isUndo && !entry.isReverted);
            if (last) action(() => hostUndoScoreTransaction(last.id));
          }}
          disabled={pending || !scoreHistory.some((entry) => !entry.isUndo && !entry.isReverted)}
          className="shrink-0"
        >
          Undo
        </Button>
      </div>

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

      <LuckySpinModal
        open={spinOpen}
        onClose={() => setSpinOpen(false)}
        teams={teams}
        teamId={surpriseTeamId}
        onTeamChange={setSurpriseTeamId}
        onSpin={(teamId) => luckySpin(room.id, teamId)}
        onDone={() => router.refresh()}
      />

      {/* Floating score feedback — the applied delta drifts up and fades. */}
      {scoreFloat && (
        <div
          key={scoreFloat.id}
          className="pointer-events-none fixed left-1/2 top-1/2 z-[80] -translate-x-1/2 flex flex-col items-center animate-[encFloatUp_1.3s_ease-out_forwards]"
        >
          <span
            className={`font-mono font-black text-4xl ${
              scoreFloat.points >= 0 ? "text-success" : "text-danger-soft"
            }`}
          >
            {scoreFloat.points >= 0 ? `+${scoreFloat.points}` : scoreFloat.points}
          </span>
          <span className="text-[12px] font-semibold text-ink-2">{scoreFloat.team}</span>
        </div>
      )}
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
            <span className="text-lg font-bold text-ink">{result.label}</span>
            <span className="text-[12px] text-mute-2">{teams.find((t) => t.id === teamId)?.name}</span>
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
  DOUBLE_SCORE: "Double Points — next correct counts 2×",
  SECOND_CHANCE: "Second Chance — may answer again",
  MYSTERY: "Mystery effect",
  GAMBLE: "All-or-Nothing — double reward or double penalty",
  FREEZE: "Freeze — opponent power paused",
  STEAL: "Steal — coins from another team",
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
  initialValue: number;
  pending: boolean;
  onSubmit: (input: { teamId: string; points: number; reason: ScoreReason; participantId: string }) => void;
}) {
  const [points, setPoints] = useState(initialValue);
  const [reason, setReason] = useState<ScoreReason>(initialValue >= 0 ? "CORRECT" : "WRONG");
  const [participantId, setParticipantId] = useState("");

  const teamParticipants = participants.filter((p) => p.teamId === teamId);
  const hasDouble = activeEffects.some((e) => e.effectType === "DOUBLE_SCORE");
  const hasShield = activeEffects.some((e) => e.effectType === "BLOCK_NEGATIVE");
  const hasGamble = activeEffects.some((e) => e.effectType === "GAMBLE");
  const combo = hasDouble && hasShield;
  const modeDef = roundMode !== "NONE" ? ROUND_MODES[roundMode] : null;

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

        <div className="grid grid-cols-4 gap-1.5">
          {SCORE_VALUES.map((value) => (
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
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="col-span-4 bg-line/[.05] border border-line/[.1] rounded-xl px-3 py-2 text-[13px] text-ink outline-none"
            placeholder="Custom"
          />
        </div>

        {activeEffects.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/[.08] px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[.1em] text-accent">
              <Icon name="zap" size={12} />
              ACTIVE POWERS — YOU DECIDE HOW THEY APPLY
            </span>
            <div className="flex flex-col gap-1">
              {activeEffects.map((effect, i) => (
                <span key={`${effect.effectType}-${i}`} className="flex items-center gap-1.5 text-[12px] text-ink-3">
                  <span>{effect.icon}</span>
                  {EFFECT_LABEL[effect.effectType]}
                </span>
              ))}
            </div>
            {(hasDouble || hasGamble) && points > 0 && (
              <button
                onClick={() => setPoints(points * 2)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-success/40 bg-success/[.12] px-2.5 py-1.5 text-[12px] font-semibold text-success cursor-pointer hover:bg-success/20"
              >
                <Icon name="trending-up" size={11} />
                Apply 2× → +{points * 2}
              </button>
            )}
            {(hasShield || hasGamble) && points < 0 && (
              <button
                onClick={() => setPoints(hasShield ? 0 : points * 2)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-info/40 bg-info/[.12] px-2.5 py-1.5 text-[12px] font-semibold text-info cursor-pointer hover:bg-info/20"
              >
                <Icon name="shield" size={11} />
                {hasShield ? "Shield → 0" : `Double penalty → ${points * 2}`}
              </button>
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
        <Button variant="primary" onClick={submit} disabled={pending || !teamId}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
