"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { purchasePowerCard, requestPowerCard } from "@/actions/powerCard.actions";
import { placeBid } from "@/actions/auction.actions";
import { JoinForm, type JoinedParticipant } from "@/components/room/JoinForm";
import { JoinPageShell } from "@/components/room/JoinPageShell";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Confetti } from "@/components/motion/Confetti";
import { NumberTicker } from "@/components/motion/NumberTicker";
import { useMotionEnabled } from "@/components/motion/useMotionEnabled";
import type { PublicRoomInfo } from "@/data/queries/room.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { SceneType } from "@/types/db";

type LiveTeam = {
  id: string;
  name: string;
  color?: string;
  score: number;
  coins: number;
  rank: number;
  members: { name: string }[];
  streak?: number;
  bestStreak?: number;
};

type LivePower = {
  id: string;
  name: string;
  description: string;
  icon: string;
  effectType?: string;
  category?: string;
  rarity?: string;
  price: number;
  basePrice?: number;
  onSale?: boolean;
  isMystery?: boolean;
  limited?: boolean;
  stock: number | null;
  requiresApproval: boolean;
  remainingUses: number;
  requestable?: boolean;
  status: "AVAILABLE" | "REQUESTED" | "APPROVED" | "ACTIVE" | "CONSUMED" | "REJECTED";
  requestId: string | null;
};

type LiveAuction = {
  id: string;
  type: "NORMAL" | "SECRET" | "LUCKY";
  stage: "LIVE" | "GOING_ONCE" | "GOING_TWICE";
  itemName: string;
  itemIcon: string;
  startingBid: number;
  minIncrement: number;
  currentBid: number;
  leaderName: string | null;
  leaderIsMe: boolean;
  bidderCount: number;
  myBid: number | null;
};

type LiveFeedItem = {
  id: string;
  type: string;
  text: string;
  icon: string;
  tone: "up" | "down" | "power" | "store" | "info" | "achievement";
  teamColor: string | null;
  notable: boolean;
  createdAt: string;
};

type LivePayload = {
  serverNow: string;
  room: {
    id: string;
    name: string;
    roomCode: string;
    status: string;
    storeStatus: "OPEN" | "CLOSED";
    permissions?: {
      viewLeaderboard: boolean;
      viewTeamScore: boolean;
      buyPowers: boolean;
      requestLifelines: boolean;
    };
  };
  competition: { id: string; title: string };
  currentScene: {
    id: string | null;
    type: SceneType;
    title: string;
    content: Record<string, unknown>;
    settings: Record<string, unknown>;
    order: number;
  };
  timer: {
    startedAt: string | null;
    endsAt: string | null;
    paused: boolean;
    showAnswer: boolean;
  };
  round: {
    id: string;
    title: string;
    rules?: string;
    description?: string;
    specialMode?: "NONE" | "SPEED" | "RISK" | "SURVIVAL" | "BONUS";
    defaultTimer: number;
    positiveMarks: number;
    negativeMarks: number;
    allowedPowerCards: { id: string; name: string; icon: string }[] | null;
  } | null;
  question: {
    id: string;
    type: string;
    question: string;
    media?: { url: string; type: "IMAGE" | "AUDIO" | "VIDEO"; name: string } | null;
    timer: number;
    positiveMarks: number;
    negativeMarks: number;
    answer: string | null;
    hints: { text: string; penalty: number }[];
  } | null;
  team: LiveTeam | null;
  leaderboard: Array<Omit<LiveTeam, "members">>;
  powers: {
    storeOpen: boolean;
    economyEnabled: boolean;
    flashSale: { active: boolean; percent: number; endsAt: string | null };
    cards: LivePower[];
  };
  feed: LiveFeedItem[];
  auction: LiveAuction | null;
  broadcast: { id: string; message: string; createdAt: string } | null;
  recentScores: Array<{
    id: string;
    teamId: string;
    points: number;
    reason: string;
    isUndo: boolean;
    isReverted: boolean;
    createdAt: string;
  }>;
};

interface StoredParticipant extends JoinedParticipant {
  roomCode: string;
}

interface LivePlayClientProps {
  room: PublicRoomInfo;
  teams: TeamRecord[];
}

function storageKey(roomCode: string) {
  return `encore.participant.${roomCode.toUpperCase()}`;
}

function readParticipant(roomCode: string): StoredParticipant | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(roomCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredParticipant;
    return parsed.roomCode === roomCode.toUpperCase() ? parsed : null;
  } catch {
    return null;
  }
}

function sceneAccent(type: SceneType) {
  if (type === "LEADERBOARD" || type === "WINNER") return "#F2C94C";
  if (type === "QUESTION" || type === "DRAWING") return "#6C7BFA";
  if (type === "WELCOME" || type === "ROUND_INTRO") return "#3DD68C";
  return "#8EA0B8";
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function LivePlayClient({ room, teams }: LivePlayClientProps) {
  const [participant, setParticipant] = useState<StoredParticipant | null>(() => readParticipant(room.roomCode));
  const [live, setLive] = useState<LivePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [moment, setMoment] = useState<LiveFeedItem | null>(null);
  const lastNotableId = useRef<string | null>(null);
  const seededNotable = useRef(false);
  const [celebrate, setCelebrate] = useState(false);
  const [scoreShake, setScoreShake] = useState(false);
  const prevScoreRef = useRef<number | null>(null);
  const { enabled: motionEnabled } = useMotionEnabled();
  const [pending, startTransition] = useTransition();
  const seconds = useMemo(() => {
    if (!live?.timer.endsAt || live.timer.paused) return null;
    return Math.max(0, Math.ceil((new Date(live.timer.endsAt).getTime() - now) / 1000));
  }, [live, now]);

  useEffect(() => {
    if (!participant) return;
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams({
          teamId: participant?.teamId ?? "",
          participantId: participant?.id ?? "",
        });
        const response = await fetch(`/api/live/${room.roomCode}?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Live room is unavailable.");
        const payload = (await response.json()) as LivePayload;
        if (!cancelled) {
          setLive(payload);
          setError(null);
          setOffline(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Connection lost.");
          setOffline(true);
        }
      }
    }

    load();
    const interval = window.setInterval(load, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [participant, room.roomCode]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  function handleJoined(joined: JoinedParticipant) {
    const stored = { ...joined, roomCode: room.roomCode.toUpperCase() };
    window.localStorage.setItem(storageKey(room.roomCode), JSON.stringify(stored));
    setParticipant(stored);
  }

  function leavePhone() {
    window.localStorage.removeItem(storageKey(room.roomCode));
    setParticipant(null);
    setLive(null);
  }

  function buy(card: LivePower) {
    if (!live?.team) return;
    startTransition(async () => {
      try {
        await purchasePowerCard(live.room.id, live.team!.id, card.id);
        setToast(`${card.name} added to your team.`);
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Could not buy card.");
      }
    });
  }

  function request(card: LivePower) {
    if (!live?.team) return;
    startTransition(async () => {
      try {
        await requestPowerCard({
          roomId: live.room.id,
          teamId: live.team!.id,
          powerCardId: card.id,
        });
        setToast(`${card.name} request sent to host.`);
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Could not request card.");
      }
    });
  }

  function bid(amount: number) {
    if (!live?.team || !live.auction) return;
    startTransition(async () => {
      try {
        await placeBid(live.room.id, live.team!.id, live.auction!.id, amount);
        setToast(`Bid placed: ${amount} coins.`);
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Could not place bid.");
      }
    });
  }

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  // Flash a transient "moment" overlay when a new notable event lands. The
  // first poll only seeds the baseline so we never replay history on join.
  useEffect(() => {
    const newest = live?.feed.find((item) => item.notable);
    if (!newest) return;
    if (!seededNotable.current) {
      seededNotable.current = true;
      lastNotableId.current = newest.id;
      return;
    }
    if (newest.id !== lastNotableId.current) {
      lastNotableId.current = newest.id;
      setMoment(newest);
    }
  }, [live?.feed]);

  useEffect(() => {
    if (!moment) return;
    const timeout = window.setTimeout(() => setMoment(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [moment]);

  // Celebrate when our own team's score rises (confetti + a happy buzz), or a
  // gentle shake + longer buzz when it drops. The first reading only seeds the
  // baseline so we don't fire on join.
  useEffect(() => {
    const score = live?.team?.score;
    if (score == null) return;
    const prev = prevScoreRef.current;
    prevScoreRef.current = score;
    if (prev == null || score === prev) return;
    if (score > prev) {
      setCelebrate(true);
      if (motionEnabled && typeof navigator !== "undefined") navigator.vibrate?.(35);
    } else {
      setScoreShake(true);
      if (motionEnabled && typeof navigator !== "undefined") navigator.vibrate?.(70);
    }
  }, [live?.team?.score, motionEnabled]);

  useEffect(() => {
    if (!celebrate) return;
    const t = window.setTimeout(() => setCelebrate(false), 3400);
    return () => window.clearTimeout(t);
  }, [celebrate]);

  useEffect(() => {
    if (!scoreShake) return;
    const t = window.setTimeout(() => setScoreShake(false), 600);
    return () => window.clearTimeout(t);
  }, [scoreShake]);

  if (!participant) {
    return (
      <JoinPageShell eyebrow={room.status === "LIVE" ? "EVENT IS LIVE" : "JOIN EVENT"}>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <span className="flex items-center gap-2 text-[11px] font-mono font-semibold tracking-[.12em] text-mute-2 bg-line/[.05] border border-line/[.08] rounded-full px-3 py-1">
            {room.roomCode}
          </span>
          <span className="text-2xl font-bold text-ink tracking-[-.015em]">{room.name}</span>
          <span className="text-[12px] text-mute-2">Enter your name and pick your team.</span>
        </div>
        <JoinForm roomCode={room.roomCode} teams={teams} onJoined={handleJoined} />
      </JoinPageShell>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-shell text-ink overflow-hidden">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(520px_380px_at_50%_-10%,rgba(108,123,250,.22),transparent_65%)]" />
      <div className="max-w-[520px] mx-auto min-h-[100dvh] flex flex-col px-4 pt-4 pb-5">
        <header className="flex items-center gap-3 shrink-0">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold text-white"
            style={{ background: live?.team?.color ?? "#6C7BFA" }}
          >
            {(live?.team?.name ?? participant.teamName).charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-bold text-ink truncate">{live?.competition.title ?? room.name}</span>
            <span className="text-[11px] text-mute-2 truncate">
              {participant.name} - {live?.team?.name ?? participant.teamName}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {offline ? (
              <span className="w-8 h-8 rounded-xl bg-danger/10 border border-danger/25 flex items-center justify-center">
                <Icon name="wifi-off" size={15} className="text-danger-soft" />
              </span>
            ) : (
              <span className="w-8 h-8 rounded-xl bg-success/10 border border-success/25 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-success animate-enc-pulse" />
              </span>
            )}
            <ThemeToggle className="w-8 h-8" />
            <button
              onClick={leavePhone}
              className="w-8 h-8 rounded-xl bg-line/[.04] border border-line/[.08] text-mute-2 flex items-center justify-center"
              aria-label="Leave room"
            >
              <Icon name="log-out" size={14} />
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-3 rounded-2xl border border-danger/20 bg-danger/[.08] px-3 py-2 text-[12px] text-danger-soft">
            {error} Reconnecting...
          </div>
        )}

        {!live ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-line/[.05] border border-line/[.08] flex items-center justify-center animate-enc-pulse-slow">
              <Icon name="loader" size={22} className="text-accent" />
            </div>
            <span className="text-sm text-mute-2">Connecting to the live room...</span>
          </div>
        ) : (
          <>
            <StatusStrip live={live} seconds={seconds} shake={scoreShake} />
            <main className="flex-1 min-h-0 py-4">
              <SceneScreen live={live} seconds={seconds} onRequest={request} pending={pending} participantName={participant.name} />
            </main>
            {live.auction && <AuctionPanel auction={live.auction} coins={live.team?.coins ?? 0} pending={pending} onBid={bid} />}
            <LiveFeed feed={live.feed} />
            <PowerTray live={live} pending={pending} onBuy={buy} onRequest={request} />
          </>
        )}
      </div>

      {celebrate && <Confetti count={80} />}
      <AnimatePresence>
        {moment && <MomentOverlay key={moment.id} moment={moment} />}
      </AnimatePresence>
      <AnimatePresence>
        {live?.broadcast?.message && <BroadcastOverlay key={live.broadcast.id} message={live.broadcast.message} />}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="fixed left-4 right-4 bottom-4 z-50 mx-auto max-w-[460px] rounded-2xl border border-line/[.1] bg-card px-4 py-3 text-sm font-semibold text-ink shadow-[0_18px_50px_rgba(0,0,0,.5)]"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const EFFECT_ICON: Record<string, string> = {
  HINT: "💡",
  EXTRA_TIME: "⏱",
  BLOCK_NEGATIVE: "🛡",
  DOUBLE_SCORE: "⚡",
  SECOND_CHANCE: "↩",
  MYSTERY: "🎁",
  GAMBLE: "🎲",
  FREEZE: "❄",
  STEAL: "🫳",
};

type RoundMode = "SPEED" | "RISK" | "SURVIVAL" | "BONUS";
const ROUND_MODE_META: Record<RoundMode, { label: string; emoji: string; description: string; color: string }> = {
  SPEED: { label: "Speed Round", emoji: "⚡", description: "Short timer, higher rewards — answer fast.", color: "#5EC9E8" },
  RISK: { label: "Risk Round", emoji: "🎯", description: "Pick your difficulty for bigger points.", color: "#E8A33D" },
  SURVIVAL: { label: "Survival Round", emoji: "💀", description: "Wrong answers cost a life — play safe.", color: "#FF6B6B" },
  BONUS: { label: "Bonus Round", emoji: "🎁", description: "Rewards only — no penalties.", color: "#3DD68C" },
};

function RoundModeBadge({ mode }: { mode?: string }) {
  if (!mode || mode === "NONE") return null;
  const meta = ROUND_MODE_META[mode as RoundMode];
  if (!meta) return null;
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-bold tracking-[.08em] rounded-full px-2 py-0.5 border"
      style={{
        color: meta.color,
        borderColor: `color-mix(in oklab, ${meta.color} 38%, transparent)`,
        background: `color-mix(in oklab, ${meta.color} 14%, transparent)`,
      }}
    >
      {meta.emoji} {meta.label.replace(" Round", "").toUpperCase()}
    </span>
  );
}

function StatusStrip({
  live,
  seconds,
  shake,
}: {
  live: LivePayload;
  seconds: number | null;
  shake?: boolean;
}) {
  const streak = live.team?.streak ?? 0;
  const activeEffects = live.powers.cards.filter((c) => c.status === "ACTIVE");
  const inventory = live.powers.cards.filter((c) => c.remainingUses > 0);
  const activeTypes = new Set(activeEffects.map((e) => e.effectType));
  const combo = activeTypes.has("DOUBLE_SCORE") && activeTypes.has("BLOCK_NEGATIVE");

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2">
        <Metric label="Rank" value={live.team ? `#${live.team.rank}` : "-"} />
        <Metric label="Score" numeric={live.team?.score} shake={shake} />
        <Metric label="Coins" numeric={live.team?.coins} accent="#E8C84A" />
        <Metric label="Timer" value={seconds === null ? "--" : `${seconds}s`} />
      </div>

      {(streak >= 2 || activeEffects.length > 0 || inventory.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {combo && (
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold bg-[linear-gradient(90deg,rgba(108,123,250,.25),rgba(61,214,140,.25))] border border-accent/40 text-ink">
              🔥 COMBO · Safe Double Attack
            </span>
          )}
          {streak >= 2 && (
            <span
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                streak >= 3
                  ? "bg-warn/15 border border-warn/35 text-warn"
                  : "bg-line/[.05] border border-line/[.1] text-ink-3"
              }`}
            >
              🔥 {streak} streak
            </span>
          )}
          {activeEffects.map((effect) => (
            <span
              key={`active-${effect.id}`}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-accent/15 border border-accent/35 text-accent"
            >
              {EFFECT_ICON[effect.effectType ?? ""] ?? effect.icon} {effect.name} active
            </span>
          ))}
          {inventory
            .filter((c) => c.status !== "ACTIVE")
            .map((card) => (
              <span
                key={`inv-${card.id}`}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium bg-line/[.05] border border-line/[.1] text-mute-2"
              >
                {EFFECT_ICON[card.effectType ?? ""] ?? card.icon} {card.name}
                {card.remainingUses > 1 && <span className="font-mono text-dim-2">×{card.remainingUses}</span>}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  numeric,
  accent,
  shake,
}: {
  label: string;
  value?: string;
  numeric?: number;
  accent?: string;
  shake?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-line/[.08] bg-line/[.04] px-3 py-3 ${
        shake ? "animate-[encShake_0.5s_ease]" : ""
      }`}
    >
      <span className="block text-[10px] text-mute-2 font-semibold tracking-[.12em]">{label}</span>
      <span className="block text-lg font-bold mt-1" style={{ color: accent ?? "var(--color-ink)" }}>
        {numeric != null ? <NumberTicker value={numeric} duration={0.7} /> : value}
      </span>
    </div>
  );
}

function SceneScreen({
  live,
  seconds,
  onRequest,
  pending,
  participantName,
}: {
  live: LivePayload;
  seconds: number | null;
  onRequest: (card: LivePower) => void;
  pending: boolean;
  participantName: string;
}) {
  const type = live.currentScene.type;
  const accent = sceneAccent(type);

  return (
    <motion.section
      key={`${live.currentScene.id}-${type}`}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="h-full min-h-[430px] rounded-[28px] border border-line/[.09] bg-card/90 shadow-[0_22px_70px_rgba(0,0,0,.44)] p-5 flex flex-col overflow-hidden"
      style={{ boxShadow: `0 20px 80px color-mix(in oklab, ${accent} 18%, transparent)` }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-bold tracking-[.16em] rounded-full px-3 py-1 border"
          style={{
            color: accent,
            background: `color-mix(in oklab, ${accent} 13%, transparent)`,
            borderColor: `color-mix(in oklab, ${accent} 32%, transparent)`,
          }}
        >
          {type.replace(/_/g, " ")}
        </span>
        {(type === "QUESTION" || type === "DRAWING" || type === "ANSWER_REVEAL") && live.round && (
          <span className="text-[11px] text-mute-2 truncate">{live.round.title}</span>
        )}
        <RoundModeBadge mode={live.round?.specialMode} />
        <span className="ml-auto text-[11px] text-mute-2">{live.room.roomCode}</span>
      </div>

      {type === "WAITING" && <WaitingScene live={live} participantName={participantName} />}
      {type === "WELCOME" && <WelcomeScene live={live} />}
      {type === "ROUND_INTRO" && <RoundIntroScene live={live} />}
      {type === "QUESTION" && <QuestionScene live={live} seconds={seconds} onRequest={onRequest} pending={pending} />}
      {type === "DRAWING" && <DrawingScene live={live} />}
      {type === "ANSWER_REVEAL" && <AnswerRevealScene live={live} />}
      {type === "LEADERBOARD" && <LeaderboardScene live={live} />}
      {type === "WINNER" && <WinnerScene live={live} />}
      {!["WAITING", "WELCOME", "ROUND_INTRO", "QUESTION", "DRAWING", "ANSWER_REVEAL", "LEADERBOARD", "WINNER"].includes(type) && (
        <FallbackScene live={live} />
      )}
    </motion.section>
  );
}

function WaitingScene({ live, participantName }: { live: LivePayload; participantName: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
      <div className="w-20 h-20 rounded-[28px] bg-line/[.05] border border-line/[.09] flex items-center justify-center">
        <Icon name="radio" size={30} className="text-accent" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-[-.03em]">{live.competition.title}</h1>
        {live.room.name !== live.competition.title && (
          <span className="text-[12px] text-mute-2">{live.room.name}</span>
        )}
        <p className="text-sm text-mute-2">
          {participantName} · You are in {live.team?.name}. Waiting for the host to start.
        </p>
      </div>
      <div className="w-full rounded-2xl border border-line/[.08] bg-line/[.035] p-3 text-left">
        <span className="text-[10px] font-semibold tracking-[.12em] text-label">TEAM MEMBERS</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {(live.team?.members.length ? live.team.members : [{ name: live.team?.name ?? "Team" }]).map((member) => (
            <span key={member.name} className="rounded-full bg-line/[.06] px-3 py-1 text-[12px] text-ink-3">
              {member.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function WelcomeScene({ live }: { live: LivePayload }) {
  const title = textValue(live.currentScene.content?.title, live.currentScene.title);
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
      <Icon name="sparkles" size={38} className="text-success" />
      <h1 className="text-4xl font-black tracking-[-.04em]">{title}</h1>
      <p className="text-sm text-mute-2 max-w-[300px]">
        Keep this phone ready. The host controls every screen from here.
      </p>
    </div>
  );
}

function RoundIntroScene({ live }: { live: LivePayload }) {
  const mode = live.round?.specialMode ?? "NONE";
  const modeMeta = mode !== "NONE" ? ROUND_MODE_META[mode] : null;
  return (
    <div className="flex-1 flex flex-col justify-center gap-5">
      <div>
        <span className="text-[11px] font-semibold tracking-[.14em] text-success">ROUND</span>
        <h1 className="text-4xl font-black tracking-[-.04em] mt-2">{live.round?.title ?? live.currentScene.title}</h1>
        <p className="text-sm text-mute-2 mt-3 leading-relaxed">
          {live.round?.description || live.round?.rules || "Get ready. The next challenge is about to begin."}
        </p>
      </div>
      {modeMeta && (
        <div
          className="rounded-2xl border px-4 py-3 flex items-center gap-3"
          style={{
            borderColor: `color-mix(in oklab, ${modeMeta.color} 40%, transparent)`,
            background: `color-mix(in oklab, ${modeMeta.color} 12%, transparent)`,
          }}
        >
          <span className="text-2xl">{modeMeta.emoji}</span>
          <div className="flex flex-col">
            <span className="text-[13px] font-bold" style={{ color: modeMeta.color }}>
              {modeMeta.label}
            </span>
            <span className="text-[11.5px] text-mute-2">{modeMeta.description}</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Timer" value={`${live.round?.defaultTimer ?? "--"}s`} />
        <Metric label="Correct" value={`+${live.round?.positiveMarks ?? "-"}`} />
        <Metric label="Wrong" value={`${live.round?.negativeMarks ?? "-"}`} />
      </div>
      {live.round?.allowedPowerCards && (
        <div>
          <span className="text-[10px] font-semibold tracking-[.12em] text-label">POWER CARDS ALLOWED THIS ROUND</span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {live.round.allowedPowerCards.length === 0 ? (
              <span className="text-[12px] text-mute-2">No power cards allowed this round.</span>
            ) : (
              live.round.allowedPowerCards.map((card) => (
                <span
                  key={card.id}
                  className="flex items-center gap-1.5 rounded-full bg-line/[.06] border border-line/[.08] px-3 py-1.5 text-[12px] text-ink-3"
                >
                  <span>{card.icon}</span>
                  {card.name}
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionScene({
  live,
  seconds,
  onRequest,
  pending,
}: {
  live: LivePayload;
  seconds: number | null;
  onRequest: (card: LivePower) => void;
  pending: boolean;
}) {
  const available = live.powers.cards.filter((card) => card.remainingUses > 0).slice(0, 3);
  return (
    <div className="flex-1 flex flex-col gap-4 pt-5">
      <div className="flex items-center justify-center">
        <div className="w-20 h-20 rounded-full border-[6px] border-accent/35 bg-line/[.04] flex items-center justify-center text-2xl font-black">
          {seconds ?? live.question?.timer ?? "--"}
        </div>
      </div>
      {live.question?.media?.url && (
        <div className="rounded-2xl overflow-hidden border border-line/[.08] bg-line/[.04]">
          {live.question.media.type === "IMAGE" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={live.question.media.url} alt={live.question.media.name} className="w-full max-h-44 object-cover" />
          )}
          {live.question.media.type === "AUDIO" && (
            <audio controls src={live.question.media.url} className="w-full p-3" />
          )}
          {live.question.media.type === "VIDEO" && (
            <video controls src={live.question.media.url} className="w-full max-h-52" />
          )}
        </div>
      )}
      <div className="text-center">
        <h1 className="text-[28px] leading-[1.08] font-black tracking-[-.03em]">
          {live.question?.question || live.currentScene.title}
        </h1>
        <p className="text-sm text-mute-2 mt-3">Discuss with your team. The host gives marks manually.</p>
      </div>
      {live.question?.answer && (
        <div className="rounded-2xl border border-success/25 bg-success/[.1] px-4 py-3 text-center text-sm font-bold text-success">
          Answer: {live.question.answer}
        </div>
      )}
      <div className="mt-auto">
        <span className="text-[10px] font-semibold tracking-[.12em] text-label">AVAILABLE POWERS</span>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {available.length === 0 ? (
            <div className="col-span-3 rounded-2xl border border-line/[.08] bg-line/[.03] px-3 py-3 text-center text-[12px] text-mute-2">
              No powers available.
            </div>
          ) : (
            available.map((card) => (
              <button
                key={card.id}
                onClick={() => onRequest(card)}
                disabled={pending || card.status === "REQUESTED"}
                className="rounded-2xl border border-line/[.08] bg-line/[.04] px-2 py-3 text-center disabled:opacity-55"
              >
                <span className="block text-xl">{card.icon}</span>
                <span className="block text-[11px] font-bold text-ink mt-1 truncate">{card.name}</span>
                <span className="block text-[10px] text-mute-2">{card.status === "REQUESTED" ? "Pending" : `${card.remainingUses} left`}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DrawingScene({ live }: { live: LivePayload }) {
  return (
    <div className="flex-1 flex flex-col justify-center gap-4 text-center">
      <Icon name="paintbrush" size={42} className="mx-auto text-accent" />
      <h1 className="text-3xl font-black tracking-[-.03em]">Drawing round</h1>
      {live.question?.question && (
        <p className="text-lg font-bold text-ink">{live.question.question}</p>
      )}
      <p className="text-sm text-mute-2">
        If the host selects you as drawer, use this screen. Everyone else should watch and guess with the team.
      </p>
      <div className="aspect-square rounded-[24px] border border-dashed border-line/[.16] bg-line/[.03] flex items-center justify-center text-sm text-mute-2">
        Canvas opens when host assigns the drawer
      </div>
      <span className="text-xs text-mute-2">Team: {live.team?.name}</span>
    </div>
  );
}

function AnswerRevealScene({ live }: { live: LivePayload }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
      <Icon name="circle-check" size={38} className="text-success" />
      {live.question?.question && (
        <p className="text-sm text-mute-2 max-w-[340px]">{live.question.question}</p>
      )}
      <div className="w-full rounded-[24px] border border-success/25 bg-success/[.1] px-6 py-6">
        <span className="block text-[11px] font-semibold tracking-[.14em] text-success">ANSWER</span>
        <span className="block text-2xl font-black text-ink mt-2">
          {live.question?.answer ?? "Revealed by the host"}
        </span>
      </div>
    </div>
  );
}

function LeaderboardScene({ live }: { live: LivePayload }) {
  // Snapshot ranks each render so we can flag a team that just climbed. The
  // effect writes *after* render, so `prevRanks` holds the previous poll.
  const prevRanks = useRef<Record<string, number>>({});
  useEffect(() => {
    const next: Record<string, number> = {};
    live.leaderboard.forEach((t) => (next[t.id] = t.rank));
    prevRanks.current = next;
  });

  return (
    <div className="flex-1 flex flex-col gap-3 pt-5">
      <h1 className="text-3xl font-black tracking-[-.03em]">Leaderboard</h1>
      <div className="flex flex-col gap-2">
        {live.leaderboard.map((team) => {
          const prev = prevRanks.current[team.id];
          const climbed = prev != null && team.rank < prev;
          const isMe = team.id === live.team?.id;
          return (
            <motion.div
              layout
              key={team.id}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${
                isMe ? "border-accent/40 bg-accent/[.08]" : "border-line/[.08] bg-line/[.04]"
              } ${team.rank === 1 ? "shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-warn)_40%,transparent)]" : ""}`}
            >
              <span className="w-8 h-8 rounded-xl bg-line/[.06] flex items-center justify-center font-mono font-bold">
                {team.rank}
              </span>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: team.color ?? "#6C7BFA" }} />
              <span className="font-bold text-ink truncate">{team.name}</span>
              {climbed && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[10px] font-bold text-success flex items-center gap-0.5"
                >
                  ↑ up
                </motion.span>
              )}
              <NumberTicker value={team.score} duration={0.6} className="ml-auto font-mono font-black text-lg" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

const WINNER_STEPS = ["Calculating scores…", "Analyzing results…", "3", "2", "1"];

function WinnerScene({ live }: { live: LivePayload }) {
  const winner = live.leaderboard[0];
  const { enabled } = useMotionEnabled();
  const [stage, setStage] = useState(enabled ? 0 : WINNER_STEPS.length);

  useEffect(() => {
    if (!enabled) {
      setStage(WINNER_STEPS.length);
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setStage(i);
      if (i >= WINNER_STEPS.length) window.clearInterval(id);
    }, 820);
    return () => window.clearInterval(id);
  }, [enabled]);

  const revealed = stage >= WINNER_STEPS.length;

  if (!revealed) {
    const isCountdown = stage >= 2;
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
        <span className="text-[11px] text-label font-semibold tracking-[.2em]">FINAL RESULTS</span>
        <motion.span
          key={stage}
          initial={{ opacity: 0, scale: isCountdown ? 1.6 : 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={isCountdown ? "text-7xl font-black text-accent" : "text-xl font-semibold text-ink-3"}
        >
          {WINNER_STEPS[stage]}
        </motion.span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
      <Confetti count={120} />
      <motion.div
        initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="text-6xl"
      >
        🏆
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <span className="text-[11px] text-label font-semibold tracking-[.14em]">WINNER</span>
        <h1 className="text-4xl font-black tracking-[-.04em] mt-2">{winner?.name ?? "Final results"}</h1>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-[24px] border border-warn/25 bg-warn/[.1] px-8 py-5"
      >
        <span className="block text-[12px] text-mute-2">Final score</span>
        <NumberTicker
          value={winner?.score ?? 0}
          duration={1.4}
          className="block text-5xl font-black text-warn mt-1"
        />
      </motion.div>
    </div>
  );
}

function FallbackScene({ live }: { live: LivePayload }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
      <h1 className="text-3xl font-black tracking-[-.03em]">{live.currentScene.title}</h1>
      <p className="text-sm text-mute-2">Follow the host. Your phone will update automatically.</p>
    </div>
  );
}

const AUCTION_STAGE_LABEL: Record<LiveAuction["stage"], string> = {
  LIVE: "LIVE",
  GOING_ONCE: "GOING ONCE…",
  GOING_TWICE: "GOING TWICE…",
};

function AuctionPanel({
  auction,
  coins,
  pending,
  onBid,
}: {
  auction: LiveAuction;
  coins: number;
  pending: boolean;
  onBid: (amount: number) => void;
}) {
  const suggested =
    auction.type === "NORMAL"
      ? Math.max(auction.startingBid, auction.currentBid + auction.minIncrement)
      : auction.myBid ?? auction.startingBid;
  const [amount, setAmount] = useState(suggested);
  const sealed = auction.type !== "NORMAL";
  const canAfford = coins >= amount && amount >= auction.startingBid;

  return (
    <motion.div
      initial={{ scale: 0.97, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="shrink-0 mb-2 rounded-2xl border-2 border-warn/40 bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-warn)_14%,var(--color-card)),var(--color-card))] p-3"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🔨</span>
        <span className="text-[11px] font-bold tracking-[.12em] text-warn">
          {auction.type} AUCTION
        </span>
        <span
          className={`ml-auto text-[10px] font-bold tracking-[.1em] px-2 py-0.5 rounded-full ${
            auction.stage === "LIVE" ? "bg-success/15 text-success" : "bg-danger/15 text-danger-soft animate-enc-pulse"
          }`}
        >
          {AUCTION_STAGE_LABEL[auction.stage]}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="text-2xl">{auction.itemIcon}</span>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-bold text-ink truncate">{auction.itemName}</span>
          {auction.type === "NORMAL" ? (
            <span className="text-[11px] text-mute-2 truncate">
              {auction.currentBid > 0
                ? `High bid ${auction.currentBid}${auction.leaderName ? ` · ${auction.leaderIsMe ? "You" : auction.leaderName}` : ""}`
                : `Starting ${auction.startingBid}`}
            </span>
          ) : (
            <span className="text-[11px] text-mute-2 truncate">
              {auction.bidderCount} bidding
              {auction.myBid != null ? ` · your sealed bid ${auction.myBid}` : ` · from ${auction.startingBid}`}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          onClick={() => setAmount((a) => Math.max(auction.startingBid, a - auction.minIncrement))}
          className="w-8 h-9 rounded-lg bg-line/[.06] text-ink font-bold cursor-pointer"
        >
          −
        </button>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="flex-1 min-w-0 h-9 bg-line/[.05] border border-line/[.1] rounded-lg px-2 text-center text-[14px] font-bold text-ink outline-none"
        />
        <button
          onClick={() => setAmount((a) => a + auction.minIncrement)}
          className="w-8 h-9 rounded-lg bg-line/[.06] text-ink font-bold cursor-pointer"
        >
          +
        </button>
        <Button
          variant="primary"
          size="sm"
          disabled={pending || !canAfford}
          onClick={() => onBid(amount)}
          className="h-9 px-3.5"
        >
          {sealed && auction.myBid != null ? "Update" : "Bid"}
        </Button>
      </div>
      {!canAfford && (
        <span className="mt-1.5 block text-[10.5px] text-danger-soft">
          {amount < auction.startingBid ? `Minimum bid is ${auction.startingBid}` : "Not enough coins"}
        </span>
      )}
    </motion.div>
  );
}

function FlashSaleBanner({ percent, endsAt }: { percent: number; endsAt: string | null }) {
  const [remaining, setRemaining] = useState(() =>
    endsAt ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)) : 0
  );
  useEffect(() => {
    if (!endsAt) return;
    const interval = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [endsAt]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="mb-2 flex items-center gap-2 rounded-xl border border-warn/40 bg-warn/[.12] px-3 py-2"
    >
      <span className="text-base animate-enc-pulse">⚡</span>
      <span className="text-[12px] font-bold text-warn">FLASH SALE — {percent}% OFF</span>
      <span className="ml-auto font-mono text-[12px] font-bold text-ink tabular-nums">
        {mm}:{ss}
      </span>
    </motion.div>
  );
}

function StoreCard({
  card,
  live,
  pending,
  economyEnabled,
  onBuy,
  onRequest,
}: {
  card: LivePower;
  live: LivePayload;
  pending: boolean;
  economyEnabled: boolean;
  onBuy: (card: LivePower) => void;
  onRequest: (card: LivePower) => void;
}) {
  const canRequest =
    (card.remainingUses > 0 || card.requestable) && live.room.permissions?.requestLifelines !== false;
  const canBuy = economyEnabled && live.powers.storeOpen && live.room.permissions?.buyPowers !== false;
  const soldOut = card.limited && (card.stock ?? 0) <= 0;

  return (
    <div
      className={`relative min-w-[150px] rounded-2xl border p-3 ${
        card.isMystery
          ? "border-accent/40 bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-accent)_14%,var(--color-card)),var(--color-card))]"
          : "border-line/[.08] bg-card"
      }`}
    >
      <div className="flex items-center gap-1 mb-1.5 min-h-[16px]">
        {card.isMystery && (
          <span className="rounded-full bg-accent/20 text-accent text-[8.5px] font-bold tracking-[.1em] px-1.5 py-0.5">
            MYSTERY
          </span>
        )}
        {card.limited && !card.isMystery && (
          <span className="rounded-full bg-pink/20 text-pink text-[8.5px] font-bold tracking-[.08em] px-1.5 py-0.5">
            {soldOut ? "SOLD OUT" : `${card.stock} LEFT`}
          </span>
        )}
        {card.onSale && (
          <span className="ml-auto rounded-full bg-warn/20 text-warn text-[8.5px] font-bold tracking-[.08em] px-1.5 py-0.5">
            SALE
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl">{card.icon}</span>
        <span className="text-[12px] font-bold text-ink truncate">{card.name}</span>
      </div>
      <p className="text-[10.5px] text-mute-2 mt-1 line-clamp-2 min-h-[30px]">{card.description}</p>
      <div className={`mt-3 grid gap-1.5 ${economyEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
        <Button
          variant="subtle"
          size="sm"
          disabled={pending || !canRequest || card.status === "REQUESTED"}
          onClick={() => onRequest(card)}
          className="justify-center text-[11px] px-2"
        >
          {card.status === "REQUESTED" ? "Sent" : card.isMystery ? "—" : "Use"}
        </Button>
        {economyEnabled && (
          <Button
            variant="primary"
            size="sm"
            disabled={pending || !canBuy || soldOut}
            onClick={() => onBuy(card)}
            className="justify-center text-[11px] px-2"
          >
            {card.onSale && card.basePrice != null ? (
              <span className="flex items-center gap-1">
                <span className="line-through opacity-60 text-[9px]">{card.basePrice}</span>
                {card.price}
              </span>
            ) : (
              card.price
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function PowerTray({
  live,
  pending,
  onBuy,
  onRequest,
}: {
  live: LivePayload;
  pending: boolean;
  onBuy: (card: LivePower) => void;
  onRequest: (card: LivePower) => void;
}) {
  // Shop ordering: mystery boxes and limited stock first (the exciting stuff),
  // then everything else. Flash-sale pricing is shown per-card.
  const cards = useMemo(() => {
    const rank = (c: LivePower) => (c.isMystery ? 0 : c.limited ? 1 : 2);
    return [...live.powers.cards].sort((a, b) => rank(a) - rank(b));
  }, [live.powers.cards]);
  if (!cards.length) return null;

  const economyEnabled = live.powers.economyEnabled;
  const storeClosed = economyEnabled && !live.powers.storeOpen;
  const flashSale = live.powers.flashSale;

  return (
    <footer className="shrink-0 rounded-[24px] border border-line/[.08] bg-line/[.035] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold tracking-[.12em] text-label">POWER STORE</span>
        {economyEnabled && <span className="ml-auto text-[11px] text-warn font-semibold">{live.team?.coins ?? 0} 🪙</span>}
      </div>
      {flashSale.active && <FlashSaleBanner percent={flashSale.percent} endsAt={flashSale.endsAt} />}
      {storeClosed && !flashSale.active && (
        <div className="mb-2 rounded-xl border border-line/[.08] bg-line/[.03] px-3 py-2 text-center text-[12px] text-mute-2">
          Store currently closed
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {cards.map((card) => (
          <StoreCard
            key={card.id}
            card={card}
            live={live}
            pending={pending}
            economyEnabled={economyEnabled}
            onBuy={onBuy}
            onRequest={onRequest}
          />
        ))}
      </div>
    </footer>
  );
}

const FEED_TONE: Record<LiveFeedItem["tone"], string> = {
  up: "text-success",
  down: "text-danger-soft",
  power: "text-accent",
  store: "text-warn",
  info: "text-mute-2",
  achievement: "text-warn",
};

function LiveFeed({ feed }: { feed: LiveFeedItem[] }) {
  const items = feed.slice(0, 4);
  if (items.length === 0) return null;
  return (
    <div className="shrink-0 mb-2 rounded-2xl border border-line/[.08] bg-line/[.03] px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-live animate-enc-pulse" />
        <span className="text-[10px] font-semibold tracking-[.12em] text-label">LIVE FEED</span>
      </div>
      <div className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-[12px]"
            >
              <span className="text-[13px]">{item.icon}</span>
              {item.teamColor && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.teamColor }} />
              )}
              <span className={`truncate font-medium ${FEED_TONE[item.tone]}`}>{item.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

const MOMENT_STYLE: Record<LiveFeedItem["tone"], { ring: string; label: string }> = {
  up: { ring: "#3DD68C", label: "BIG SCORE" },
  down: { ring: "#FF8383", label: "OUCH" },
  power: { ring: "#6C7BFA", label: "POWER PLAY" },
  store: { ring: "#F5B93D", label: "STORE" },
  info: { ring: "#8EA0B8", label: "UPDATE" },
  achievement: { ring: "#E8C84A", label: "ACHIEVEMENT" },
};

function MomentOverlay({ moment }: { moment: LiveFeedItem }) {
  const style = MOMENT_STYLE[moment.tone];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center px-8 pointer-events-none"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <motion.div
        initial={{ scale: 0.6, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="relative flex flex-col items-center gap-3 rounded-[28px] border-2 bg-card/95 px-8 py-7 text-center shadow-[0_30px_90px_rgba(0,0,0,.6)]"
        style={{ borderColor: style.ring, boxShadow: `0 0 60px color-mix(in oklab, ${style.ring} 40%, transparent)` }}
      >
        <motion.span
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 0.6, repeat: 1 }}
          className="text-5xl"
        >
          {moment.icon}
        </motion.span>
        <span className="text-[11px] font-bold tracking-[.2em]" style={{ color: style.ring }}>
          {style.label}
        </span>
        <span className="text-xl font-bold text-ink">{moment.text}</span>
      </motion.div>
    </motion.div>
  );
}

function BroadcastOverlay({ message }: { message: string }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      className="fixed top-4 left-4 right-4 z-40 mx-auto max-w-[480px] rounded-[22px] border border-accent/30 bg-card/95 backdrop-blur-lg px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,.5)]"
    >
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-2xl bg-accent/15 flex items-center justify-center">
          <Icon name="megaphone" size={17} className="text-accent" />
        </span>
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold tracking-[.14em] text-label">HOST BROADCAST</span>
          <span className="text-sm font-bold text-ink">{message}</span>
        </div>
      </div>
    </motion.div>
  );
}
