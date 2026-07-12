"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { purchasePowerCard, requestPowerCard } from "@/actions/powerCard.actions";
import { placeBid } from "@/actions/auction.actions";
import { submitTeamAnswer } from "@/actions/room.actions";
import { submitMcqAnswer } from "@/actions/score.actions";
import { JoinForm, type JoinedParticipant } from "@/components/room/JoinForm";
import { JoinPageShell } from "@/components/room/JoinPageShell";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Confetti } from "@/components/motion/Confetti";
import { NumberTicker } from "@/components/motion/NumberTicker";
import { PowerCardFace } from "@/components/power-card/PowerCardFace";
import { FlippablePowerCard } from "@/components/power-card/FlippablePowerCard";
import { powerCardPlayability, type PowerPlayContext } from "@/lib/powerCardPlay";
import { timerUrgency, TIMER_URGENCY_TEXT, TIMER_URGENCY_GLOW } from "@/lib/timerUrgency";
import { useMotionEnabled } from "@/components/motion/useMotionEnabled";
import type { PublicRoomInfo } from "@/data/queries/room.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { SceneType } from "@/types/db";

type TeamDeviceRole = "CAPTAIN" | "VICE_CAPTAIN" | "MEMBER";

type TeamDevice = {
  id: string;
  name: string;
  role: TeamDeviceRole;
  connected: boolean;
};

type LiveTeam = {
  id: string;
  name: string;
  color?: string;
  score: number;
  coins: number;
  rank: number;
  members: { name: string }[];
  devices?: TeamDevice[];
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
  /** Card details for POWER_CARD_USED — drives the card's activation animation. */
  power?: {
    name: string;
    icon: string;
    effectType: string;
    rarity: string;
    teamName: string;
    teamId: string;
  } | null;
};

type LivePayload = {
  serverNow: string;
  room: {
    id: string;
    name: string;
    roomCode: string;
    status: string;
    storeStatus: "OPEN" | "CLOSED";
    answerMode?: "VERBAL" | "CAPTAIN_SUBMIT";
    permissions?: {
      viewLeaderboard: boolean;
      viewTeamScore: boolean;
      buyPowers: boolean;
      requestLifelines: boolean;
    };
  };
  /** This device's team role + whether it currently controls team actions. */
  me: {
    id: string;
    name: string;
    role: TeamDeviceRole;
    canControl: boolean;
    isActingCaptain: boolean;
    captainConnected: boolean;
    captainName: string | null;
  } | null;
  /** My team's own submitted answer for the current question (captain-submit mode). */
  myAnswer: { text: string; submittedBy: string; createdAt: string } | null;
  /** My team's MCQ selection state for the live question. */
  myMcq: {
    graded: { optionIndex: number; correct: boolean; points: number } | null;
    retryFirstPick: number | null;
    canAnswer: boolean;
  } | null;
  /** The host's most recent Correct/Wrong call on my team. */
  judgment: { id: string; reason: "CORRECT" | "WRONG"; points: number } | null;
  competition: { id: string; title: string };
  turn: {
    assignedTeamId: string | null;
    assignedTeamName: string | null;
    isMyTurn: boolean;
    frozen: boolean;
  };
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
    coinReward: number;
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
    isMCQ: boolean;
    options: string[];
    answer: string | null;
    hints: { text: string; penalty: number }[];
    hintsTotal: number;
    peekedOptionIndex: number | null;
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

/** Current "can cards be played?" context — mirrors the server's gate exactly. */
function livePlayContext(live: LivePayload): PowerPlayContext {
  const endsAt = live.timer.endsAt ? new Date(live.timer.endsAt).getTime() : 0;
  return {
    sceneType: live.currentScene?.type ?? null,
    timerRunning: endsAt > Date.now() && !live.timer.paused,
    assignedTeamId: live.turn.assignedTeamId,
    actingTeamId: live.team?.id ?? null,
    frozen: live.turn.frozen,
    hintsTotal: live.question?.hintsTotal ?? 0,
    hintsRevealed: live.question?.hints.length ?? 0,
    isMCQ: live.question?.isMCQ ?? false,
    optionsCount: live.question?.options.length ?? 0,
    alreadyPeeked: live.question?.peekedOptionIndex != null,
  };
}

export function LivePlayClient({ room, teams }: LivePlayClientProps) {
  // Initialize to null (matching the server, which has no access to
  // localStorage) and read the stored participant after mount — reading it
  // synchronously in the initializer caused a hydration mismatch, since the
  // server always renders the "not joined" JoinForm but the client's first
  // render pass would already see a returning participant.
  const [participant, setParticipant] = useState<StoredParticipant | null>(null);
  useEffect(() => {
    const stored = readParticipant(room.roomCode);
    if (stored) setParticipant(stored);
  }, [room.roomCode]);
  const [live, setLive] = useState<LivePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [moment, setMoment] = useState<LiveFeedItem | null>(null);
  const [powerMoment, setPowerMoment] = useState<LiveFeedItem | null>(null);
  // When OUR team plays a card we skip the big card-flip (it wastes their
  // answering time) and show a quick effect toast — the result, not the card.
  const [selfPower, setSelfPower] = useState<{ id: string; effectType: string; icon: string; name: string } | null>(null);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [privacyCovered, setPrivacyCovered] = useState(false);
  const lastNotableId = useRef<string | null>(null);
  const seededNotable = useRef(false);
  const [celebrate, setCelebrate] = useState(false);
  const [scoreShake, setScoreShake] = useState(false);
  // A one-shot CORRECT/WRONG feedback burst driven by the host's judgment
  // call, not the score number (which can be a 0 delta — Insurance/Shield
  // voided it — and would otherwise show nothing at all).
  const [answerFx, setAnswerFx] = useState<{ id: string; correct: boolean; points: number } | null>(null);
  const lastJudgmentId = useRef<string | null>(null);
  const seededJudgment = useRef(false);
  const prevScoreRef = useRef<number | null>(null);
  const { enabled: motionEnabled } = useMotionEnabled();
  const [pending, startTransition] = useTransition();
  const liveProtection = live?.room.status === "LIVE";
  const privacyActive = Boolean(liveProtection && privacyCovered);
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

  useEffect(() => {
    function cover() {
      if (liveProtection) setPrivacyCovered(true);
    }
    function uncover() {
      setPrivacyCovered(false);
    }
    function handleVisibility() {
      if (document.hidden) cover();
      else if (document.hasFocus()) uncover();
    }
    function blockCopy(event: ClipboardEvent) {
      if (liveProtection) event.preventDefault();
    }

    window.addEventListener("blur", cover);
    window.addEventListener("focus", uncover);
    window.addEventListener("beforeprint", cover);
    window.addEventListener("afterprint", uncover);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("copy", blockCopy);
    return () => {
      window.removeEventListener("blur", cover);
      window.removeEventListener("focus", uncover);
      window.removeEventListener("beforeprint", cover);
      window.removeEventListener("afterprint", uncover);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("copy", blockCopy);
    };
  }, [liveProtection]);

  function handleJoined(joined: JoinedParticipant) {
    const stored = { ...joined, roomCode: room.roomCode.toUpperCase() };
    window.localStorage.setItem(storageKey(room.roomCode), JSON.stringify(stored));
    // JoinForm shows its own "You're in!" confirmation on successful join —
    // delay swapping to the live view so that moment is actually visible
    // instead of being replaced in the very same render.
    window.setTimeout(() => setParticipant(stored), 1400);
  }

  function leavePhone() {
    window.localStorage.removeItem(storageKey(room.roomCode));
    setParticipant(null);
    setLive(null);
  }

  function buy(card: LivePower) {
    if (!live?.team || !participant) return;
    startTransition(async () => {
      try {
        await purchasePowerCard(live.room.id, live.team!.id, card.id, participant.id);
        setToast(`${card.name} added to your team.`);
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Could not buy card.");
      }
    });
  }

  function request(card: LivePower) {
    if (!live?.team || !participant) return;
    startTransition(async () => {
      try {
        const result = await requestPowerCard({
          roomId: live.room.id,
          teamId: live.team!.id,
          powerCardId: card.id,
          participantId: participant.id,
        });
        setToast(
          result.status === "ACTIVE"
            ? `${card.name} activated.`
            : `${card.name} request sent to host.`
        );
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Could not request card.");
      }
    });
  }

  function bid(amount: number) {
    if (!live?.team || !live.auction || !participant) return;
    startTransition(async () => {
      try {
        await placeBid(live.room.id, live.team!.id, live.auction!.id, amount, participant.id);
        setToast(`Bid placed: ${amount} coins.`);
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Could not place bid.");
      }
    });
  }

  function submitAnswer(text: string) {
    if (!live?.team || !participant) return;
    startTransition(async () => {
      try {
        await submitTeamAnswer({
          roomId: live.room.id,
          teamId: live.team!.id,
          participantId: participant.id,
          text,
        });
        setToast("Answer submitted — the host will judge it.");
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Could not submit answer.");
      }
    });
  }

  function selectMcqOption(optionIndex: number) {
    if (!live?.team || !participant) return;
    startTransition(async () => {
      try {
        const res = await submitMcqAnswer({
          roomId: live.room.id,
          teamId: live.team!.id,
          participantId: participant.id,
          optionIndex,
        });
        if (res.result === "RETRY") {
          setToast("Wrong — Double Guess gives you one more try!");
          if (motionEnabled && typeof navigator !== "undefined") navigator.vibrate?.([30, 30]);
        }
        // CORRECT/WRONG feedback rides in on the `judgment` signal (same burst
        // the host's manual marking triggers), so nothing else to do here.
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Could not submit your answer.");
      }
    });
  }

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  // Flash a transient "moment" overlay when a new notable event lands. The
  // first poll only seeds the baseline so we never replay history on join —
  // seeded on the first poll *result* (even an empty feed), otherwise a fresh
  // room would swallow the first big moment of the night as "baseline".
  // Power card activations get their own cinematic overlay instead of the
  // generic moment card.
  useEffect(() => {
    if (!live) return;
    const newest = live.feed.find((item) => item.notable);
    if (!seededNotable.current) {
      seededNotable.current = true;
      lastNotableId.current = newest?.id ?? null;
      return;
    }
    if (!newest) return;
    if (newest.id !== lastNotableId.current) {
      lastNotableId.current = newest.id;
      if (newest.power) {
        // Our own play → quick effect toast; another team's play → full card.
        if (newest.power.teamId === live.team?.id) {
          setSelfPower({ id: newest.id, effectType: newest.power.effectType, icon: newest.power.icon, name: newest.power.name });
        } else {
          setPowerMoment(newest);
        }
        if (motionEnabled && typeof navigator !== "undefined") navigator.vibrate?.([30, 40, 60]);
      } else {
        setMoment(newest);
      }
    }
  }, [live, motionEnabled]);

  useEffect(() => {
    if (!selfPower) return;
    const timeout = window.setTimeout(() => setSelfPower(null), 1400);
    return () => window.clearTimeout(timeout);
  }, [selfPower]);

  useEffect(() => {
    if (!moment) return;
    const timeout = window.setTimeout(() => setMoment(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [moment]);

  useEffect(() => {
    if (!powerMoment) return;
    const timeout = window.setTimeout(() => setPowerMoment(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [powerMoment]);

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
      if (motionEnabled && typeof navigator !== "undefined") navigator.vibrate?.([40, 40, 70]);
    }
  }, [live?.team?.score, motionEnabled]);

  // The reliable Correct/Wrong burst — keyed off the host's judgment call
  // itself, so it fires exactly once per call even when points land at 0
  // (Shield/Insurance voided the penalty). First reading only seeds the
  // baseline so rejoining mid-game doesn't replay the last call.
  useEffect(() => {
    const judgment = live?.judgment;
    if (!judgment) return;
    if (!seededJudgment.current) {
      seededJudgment.current = true;
      lastJudgmentId.current = judgment.id;
      return;
    }
    if (judgment.id === lastJudgmentId.current) return;
    lastJudgmentId.current = judgment.id;
    setAnswerFx({ id: judgment.id, correct: judgment.reason === "CORRECT", points: judgment.points });
    if (motionEnabled && typeof navigator !== "undefined") {
      navigator.vibrate?.(judgment.reason === "CORRECT" ? 35 : [40, 40, 70]);
    }
  }, [live?.judgment, motionEnabled]);

  useEffect(() => {
    if (!answerFx) return;
    const t = window.setTimeout(() => setAnswerFx(null), 1600);
    return () => window.clearTimeout(t);
  }, [answerFx]);

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
    <>
    <div
      className={`min-h-[100dvh] bg-shell text-ink overflow-hidden ${liveProtection ? "select-none print:hidden" : ""}`}
      onContextMenu={(event) => liveProtection && event.preventDefault()}
      onDragStart={(event) => liveProtection && event.preventDefault()}
    >
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(520px_380px_at_50%_-10%,rgba(108,123,250,.22),transparent_65%)]" />
      <div className="max-w-[520px] mx-auto min-h-[100dvh] flex flex-col px-4 pt-4 pb-5">
        <header className="flex items-center gap-3 shrink-0">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black text-white"
            style={{
              background: `linear-gradient(135deg, ${live?.team?.color ?? "#6C7BFA"}, color-mix(in oklab, ${live?.team?.color ?? "#6C7BFA"} 70%, black))`,
              boxShadow: `0 0 0 2px color-mix(in oklab, ${live?.team?.color ?? "#6C7BFA"} 30%, transparent), 0 6px 16px color-mix(in oklab, ${live?.team?.color ?? "#6C7BFA"} 25%, transparent)`,
            }}
          >
            {(live?.team?.name ?? participant.teamName).charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            {/* Team name is the primary identity — keep it prominent and never
                let the long competition title crowd it out on small screens. */}
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-[14px] font-bold text-ink truncate">
                {live?.team?.name ?? participant.teamName}
              </span>
              {live?.me && <RoleBadge role={live.me.role} acting={live.me.isActingCaptain} />}
            </span>
            <span className="text-[11px] text-mute-2 truncate">
              {participant.name} · {live?.competition.title ?? room.name}
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
            {liveProtection && (
              <span title="Live content is protected from screenshots" className="w-8 h-8 rounded-xl bg-warn/10 border border-warn/25 text-warn flex items-center justify-center">
                <Icon name="lock" size={14} />
              </span>
            )}
            <button
              onClick={() => setLeaveConfirm(true)}
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
            {live.me && !live.me.captainConnected && (
              <CaptainStatusBanner me={live.me} />
            )}
            <main className="flex-1 min-h-0 py-4">
              <SceneScreen
                live={live}
                seconds={seconds}
                onRequest={request}
                onSubmitAnswer={submitAnswer}
                onSelectMcq={selectMcqOption}
                pending={pending}
                participantName={participant.name}
              />
            </main>
            {live.auction && (
              <AuctionPanel
                auction={live.auction}
                coins={live.team?.coins ?? 0}
                pending={pending}
                onBid={bid}
                canControl={live.me?.canControl ?? false}
              />
            )}
            <LiveFeed feed={live.feed} />
            <BottomBar live={live} pending={pending} onBuy={buy} onRequest={request} />
          </>
        )}
      </div>

      {celebrate && <Confetti count={80} />}
      <AnimatePresence>
        {answerFx && <AnswerFeedbackOverlay key={answerFx.id} correct={answerFx.correct} points={answerFx.points} />}
      </AnimatePresence>
      <AnimatePresence>
        {moment && <MomentOverlay key={moment.id} moment={moment} />}
      </AnimatePresence>
      <AnimatePresence>
        {selfPower && <SelfPowerEffect key={selfPower.id} effectType={selfPower.effectType} icon={selfPower.icon} name={selfPower.name} />}
      </AnimatePresence>
      <AnimatePresence>
        {powerMoment?.power && <PowerActivationOverlay key={powerMoment.id} power={powerMoment.power} />}
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

      {/* Confirm before actually leaving — a stray tap on the log-out icon
          shouldn't drop a player out of the live event. */}
      <AnimatePresence>
        {leaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center px-6"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setLeaveConfirm(false)} />
            <motion.div
              initial={{ scale: 0.9, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-[360px] rounded-[24px] border border-line/[.12] bg-card p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,.6)]"
            >
              <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-danger/10 border border-danger/25 flex items-center justify-center">
                <Icon name="log-out" size={20} className="text-danger-soft" />
              </div>
              <h2 className="text-[17px] font-bold text-ink">Leave the room?</h2>
              <p className="mt-1.5 text-[13px] text-mute-2 leading-relaxed">
                You&apos;ll be signed out of {live?.team?.name ?? participant.teamName}. You can rejoin with
                the room code, but your team role may change.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <Button variant="subtle" onClick={() => setLeaveConfirm(false)} className="justify-center">
                  Stay
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setLeaveConfirm(false);
                    leavePhone();
                  }}
                  className="justify-center"
                >
                  Leave
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {privacyActive && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-[#08090d] px-8 text-center">
          <div className="w-16 h-16 rounded-3xl border border-warn/30 bg-warn/10 text-warn flex items-center justify-center">
            <Icon name="lock" size={25} />
          </div>
          <span className="text-lg font-black text-ink">Live content protected</span>
          <span className="max-w-[300px] text-[13px] leading-relaxed text-mute-2">
            Return to the game to reveal the current question.
          </span>
        </div>
      )}
    </div>
    {liveProtection && (
      <div className="hidden print:flex min-h-screen items-center justify-center bg-white p-10 text-center text-black">
        Live competition content cannot be printed. Participant: {participant.name} · Room: {room.roomCode}
      </div>
    )}
    </>
  );
}

const EFFECT_ICON: Record<string, string> = {
  HINT: "💡",
  EXTRA_TIME: "⏱",
  BLOCK_NEGATIVE: "🛡",
  INSURANCE: "🩹",
  DOUBLE_SCORE: "⚡",
  SECOND_CHANCE: "↩",
  MYSTERY: "🎁",
  GAMBLE: "🎲",
  FREEZE: "❄",
  PEEK: "👁",
};

type RoundMode = "SPEED" | "RISK" | "SURVIVAL" | "BONUS";
const ROUND_MODE_META: Record<RoundMode, { label: string; emoji: string; description: string; color: string }> = {
  SPEED: { label: "Speed Round", emoji: "⚡", description: "Fast play with a host-awarded speed bonus.", color: "#5EC9E8" },
  RISK: { label: "Risk Round", emoji: "🎯", description: "Difficulty decides the available reward.", color: "#E8A33D" },
  SURVIVAL: { label: "Survival Round", emoji: "💀", description: "The host tracks lives and elimination manually.", color: "#FF6B6B" },
  BONUS: { label: "Bonus Round", emoji: "🎁", description: "Rewards only — negative marks are blocked.", color: "#3DD68C" },
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
  const activeTypes = new Set(activeEffects.map((e) => e.effectType));
  const combo = activeTypes.has("DOUBLE_SCORE") && activeTypes.has("BLOCK_NEGATIVE");
  const timerAccent: Record<ReturnType<typeof timerUrgency>, string | undefined> = {
    idle: undefined,
    safe: "#3DD68C",
    warning: "#E8A33D",
    critical: "#FF5A5A",
  };

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2">
        <Metric label="Rank" icon="medal" tone="#6C7BFA" value={live.team ? `#${live.team.rank}` : "-"} />
        <Metric label="Score" icon="zap" tone="#3DD68C" numeric={live.team?.score} shake={shake} />
        <Metric label="Coins" icon="coins" tone="#E8C84A" numeric={live.team?.coins} accent="#E8C84A" />
        <Metric
          label="Timer"
          icon="timer"
          tone={timerAccent[timerUrgency(seconds, live.question?.timer ?? 30)] ?? "#8EA0B8"}
          value={seconds === null ? "--" : `${seconds}s`}
          accent={timerAccent[timerUrgency(seconds, live.question?.timer ?? 30)]}
        />
      </div>

      {/* Streak + currently-active effects only. Owned cards live in the
          question's "Available Powers" grid — no need to repeat them here. */}
      {(streak >= 2 || activeEffects.length > 0) && (
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
  tone,
  icon,
  shake,
}: {
  label: string;
  value?: string;
  numeric?: number;
  accent?: string;
  /** Color for the tile's hairline + label icon (independent of the value color). */
  tone?: string;
  icon?: string;
  shake?: boolean;
}) {
  const edge = tone ?? "var(--color-accent)";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line/[.09] bg-gradient-to-b from-line/[.07] to-line/[.02] px-3 py-2.5 ${
        shake ? "animate-[encShake_0.5s_ease]" : ""
      }`}
    >
      {/* Per-stat accent hairline along the top edge — quiet color coding. */}
      <span
        aria-hidden
        className="absolute inset-x-2.5 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, color-mix(in oklab, ${edge} 60%, transparent), transparent)` }}
      />
      <span className="flex items-center gap-1 text-[9.5px] text-mute-2 font-bold tracking-[.14em]">
        {icon && <Icon name={icon} size={10} style={{ color: `color-mix(in oklab, ${edge} 80%, var(--color-ink))` }} />}
        {label}
      </span>
      <span
        className="block text-[19px] font-black mt-0.5 tabular-nums tracking-[-.02em]"
        style={{ color: accent ?? "var(--color-ink)" }}
      >
        {numeric != null ? <NumberTicker value={numeric} duration={0.7} /> : value}
      </span>
    </div>
  );
}

const ROLE_META: Record<TeamDeviceRole, { emoji: string; label: string; color: string }> = {
  CAPTAIN: { emoji: "👑", label: "Captain", color: "#E8C84A" },
  VICE_CAPTAIN: { emoji: "⭐", label: "Vice Captain", color: "#5EC9E8" },
  MEMBER: { emoji: "👤", label: "Member", color: "#8EA0B8" },
};

function RoleBadge({ role, acting }: { role: TeamDeviceRole; acting?: boolean }) {
  const meta = acting ? { ...ROLE_META.CAPTAIN, label: "Temp Captain" } : ROLE_META[role];
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border"
      style={{
        color: meta.color,
        borderColor: `color-mix(in oklab, ${meta.color} 38%, transparent)`,
        background: `color-mix(in oklab, ${meta.color} 12%, transparent)`,
      }}
    >
      {meta.emoji} {meta.label}
    </span>
  );
}

/** Shown when the team captain's phone has dropped off. */
function CaptainStatusBanner({ me }: { me: NonNullable<LivePayload["me"]> }) {
  return (
    <div className="mt-2 rounded-2xl border border-warn/30 bg-warn/[.08] px-3 py-2 text-[12px] font-medium text-warn">
      {me.isActingCaptain
        ? "👑 Captain disconnected — you are temporary captain."
        : `Captain${me.captainName ? ` ${me.captainName}` : ""} disconnected${me.role === "MEMBER" ? "." : " — vice captain has control."}`}
    </div>
  );
}

/**
 * Persistent bottom action bar: 🏆 Leaderboard / ⚡ Powers / 🛒 Store.
 * The store button only exists while the host has the store open.
 */
function BottomBar({
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
  const [open, setOpen] = useState<"LEADERBOARD" | "POWERS" | "STORE" | null>(null);
  const canControl = live.me?.canControl ?? false;
  const storeVisible =
    live.powers.storeOpen && live.room.permissions?.buyPowers !== false;
  const showLeaderboard = live.room.permissions?.viewLeaderboard !== false;
  const inventory = live.powers.cards.filter((c) => c.remainingUses > 0);

  // The host closing the store while its sheet is open should dismiss it.
  useEffect(() => {
    if (open === "STORE" && !storeVisible) setOpen(null);
  }, [open, storeVisible]);

  return (
    <>
      <nav className="shrink-0 grid gap-2 pt-1" style={{ gridTemplateColumns: `repeat(${(showLeaderboard ? 1 : 0) + 1 + (storeVisible ? 1 : 0)}, 1fr)` }}>
        {showLeaderboard && (
          <button
            onClick={() => setOpen("LEADERBOARD")}
            className="group rounded-2xl border border-line/[.09] bg-gradient-to-b from-line/[.06] to-line/[.02] px-3 py-2.5 cursor-pointer transition active:scale-[.97]"
          >
            <span className="block text-base leading-none">🏆</span>
            <span className="block mt-1 text-[11px] font-bold text-ink-2">Leaderboard</span>
          </button>
        )}
        <button
          onClick={() => setOpen("POWERS")}
          className="group relative rounded-2xl border border-accent/25 bg-gradient-to-b from-accent/[.1] to-accent/[.02] px-3 py-2.5 cursor-pointer transition active:scale-[.97]"
        >
          <span className="block text-base leading-none">⚡</span>
          <span className="block mt-1 text-[11px] font-bold text-ink-2">Powers</span>
          {inventory.length > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full bg-accent text-white text-[10px] font-black flex items-center justify-center px-1">
              {inventory.length}
            </span>
          )}
        </button>
        {storeVisible && (
          <button
            onClick={() => setOpen("STORE")}
            className="relative overflow-hidden rounded-2xl border border-warn/40 bg-gradient-to-b from-warn/[.16] to-warn/[.04] px-3 py-2.5 cursor-pointer transition active:scale-[.97] shadow-[0_4px_18px_rgba(232,163,61,.15)]"
          >
            <span className="block text-base leading-none">🛒</span>
            <span className="block mt-1 text-[11px] font-bold text-warn">Store</span>
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-warn animate-enc-pulse" />
          </button>
        )}
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
          >
            <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={() => setOpen(null)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="relative w-full max-w-[520px] max-h-[78dvh] overflow-y-auto rounded-t-[28px] border border-line/[.1] bg-card p-5 pb-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[13px] font-bold text-ink">
                  {open === "LEADERBOARD" ? "🏆 Leaderboard" : open === "POWERS" ? "⚡ Team Powers" : "🛒 Power Store"}
                </span>
                <button
                  onClick={() => setOpen(null)}
                  className="ml-auto w-8 h-8 rounded-xl bg-line/[.05] border border-line/[.08] text-mute-2 flex items-center justify-center cursor-pointer"
                  aria-label="Close"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>

              {open === "LEADERBOARD" && <LeaderboardSheet live={live} />}
              {open === "POWERS" && (
                <PowersSheet live={live} pending={pending} canControl={canControl} onRequest={onRequest} />
              )}
              {open === "STORE" && (
                <StoreSheet live={live} pending={pending} canControl={canControl} onBuy={onBuy} onRequest={onRequest} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Rank / team / score / gap-to-leader table, opened from the bottom bar. */
function LeaderboardSheet({ live }: { live: LivePayload }) {
  const leaderScore = live.leaderboard[0]?.score ?? 0;
  return (
    <div className="flex flex-col gap-1.5">
      {live.leaderboard.length === 0 && <span className="text-sm text-mute-2">No teams yet.</span>}
      {live.leaderboard.map((team) => {
        const isMine = team.id === live.team?.id;
        const diff = leaderScore - team.score;
        return (
          <div
            key={team.id}
            className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
              isMine ? "border-accent/45 bg-accent/[.08]" : "border-line/[.08] bg-line/[.03]"
            }`}
          >
            <span className="w-7 text-center font-mono text-[13px] font-black text-ink-3">{team.rank}</span>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: team.color ?? "#6C7BFA" }} />
            <span className="text-[13.5px] font-semibold text-ink truncate flex-1">
              {team.name}
              {isMine && <span className="ml-1.5 text-[10px] text-accent font-bold">YOU</span>}
            </span>
            <span className="flex flex-col items-end shrink-0">
              <span className="font-mono text-[15px] font-black text-ink tabular-nums">{team.score}</span>
              {team.rank > 1 && <span className="text-[10px] text-mute-2">-{diff} behind</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Team inventory drawer — the deck in your hand. Only the captain (or acting captain) can activate. */
function PowersSheet({
  live,
  pending,
  canControl,
  onRequest,
}: {
  live: LivePayload;
  pending: boolean;
  canControl: boolean;
  onRequest: (card: LivePower) => void;
}) {
  const inventory = live.powers.cards.filter((c) => c.remainingUses > 0);
  const requestsAllowed = live.room.permissions?.requestLifelines !== false;

  return (
    <div className="flex flex-col gap-2.5">
      {!canControl && (
        <div className="rounded-xl border border-line/[.09] bg-line/[.04] px-3 py-2 text-[11.5px] text-mute-2">
          👑 Only the captain can activate powers — you can watch the inventory here.
        </div>
      )}
      {inventory.length === 0 ? (
        <span className="text-sm text-mute-2 py-4 text-center">
          No power cards owned yet{live.powers.storeOpen ? " — buy one from the open store." : "."}
        </span>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {inventory.map((card) => {
            const play = powerCardPlayability(card.effectType, livePlayContext(live));
            const busy = card.status === "REQUESTED" || card.status === "ACTIVE";
            return (
              <div key={card.id} className="flex flex-col gap-1.5">
                <div className={card.status === "ACTIVE" ? "rounded-2xl ring-2 ring-success/70" : ""}>
                  {/* Tap the card to flip it and read what it does. */}
                  <FlippablePowerCard
                    name={card.name}
                    icon={card.icon}
                    effectType={card.effectType}
                    rarity={card.rarity}
                    category={card.category}
                    description={card.description}
                    detailLines={[`${card.remainingUses} use${card.remainingUses === 1 ? "" : "s"} left`]}
                    hint={play.usable ? null : play.reason}
                    size="md"
                    frontExtras={
                      <>
                        {/* Copies badge, deck-style. */}
                        <span className="absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1 rounded-full bg-ink text-shell text-[11px] font-black flex items-center justify-center border-2 border-card shadow">
                          ×{card.remainingUses}
                        </span>
                        {card.status === "ACTIVE" && (
                          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-success/90 text-white text-[9px] font-bold tracking-[.1em] px-2 py-0.5">
                            ACTIVE
                          </span>
                        )}
                      </>
                    }
                  />
                </div>
                {canControl ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={pending || !requestsAllowed || busy || !play.usable}
                      onClick={() => onRequest(card)}
                      className="justify-center"
                    >
                      {card.status === "REQUESTED" ? "Pending" : card.status === "ACTIVE" ? "Active" : "Use Power"}
                    </Button>
                    {!play.usable && !busy && (
                      <span className="text-center text-[9.5px] text-dim leading-snug">{play.reason}</span>
                    )}
                  </>
                ) : (
                  <span className="text-center text-[10.5px] text-dim py-1">Only captain can activate</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Store sheet — captain buys, members can only look. */
function StoreSheet({
  live,
  pending,
  canControl,
  onBuy,
  onRequest,
}: {
  live: LivePayload;
  pending: boolean;
  canControl: boolean;
  onBuy: (card: LivePower) => void;
  onRequest: (card: LivePower) => void;
}) {
  const cards = useMemo(() => {
    const rank = (c: LivePower) => (c.isMystery ? 0 : c.limited ? 1 : 2);
    return [...live.powers.cards].sort((a, b) => rank(a) - rank(b));
  }, [live.powers.cards]);
  const flashSale = live.powers.flashSale;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-warn font-semibold">{live.team?.coins ?? 0} 🪙 team coins</span>
        {!canControl && (
          <span className="ml-auto text-[10.5px] text-mute-2">👑 Only the captain can buy</span>
        )}
      </div>
      {flashSale.active && <FlashSaleBanner percent={flashSale.percent} endsAt={flashSale.endsAt} />}
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <StoreCard
            key={card.id}
            card={card}
            live={live}
            pending={pending}
            canControl={canControl}
            onBuy={onBuy}
            onRequest={onRequest}
          />
        ))}
      </div>
    </div>
  );
}

function SceneScreen({
  live,
  seconds,
  onRequest,
  onSubmitAnswer,
  onSelectMcq,
  pending,
  participantName,
}: {
  live: LivePayload;
  seconds: number | null;
  onRequest: (card: LivePower) => void;
  onSubmitAnswer: (text: string) => void;
  onSelectMcq: (optionIndex: number) => void;
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
      className="relative h-full min-h-[430px] rounded-[28px] border border-line/[.09] bg-card/90 shadow-[0_22px_70px_rgba(0,0,0,.44)] p-5 flex flex-col overflow-hidden"
      style={{ boxShadow: `0 20px 80px color-mix(in oklab, ${accent} 18%, transparent)` }}
    >
      {/* Scene-accent hairline + soft top glow — gives the card a lit, premium edge. */}
      <span
        aria-hidden
        className="absolute inset-x-8 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, color-mix(in oklab, ${accent} 65%, transparent), transparent)` }}
      />
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-24 pointer-events-none"
        style={{ background: `radial-gradient(60% 100% at 50% 0%, color-mix(in oklab, ${accent} 8%, transparent), transparent)` }}
      />
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
      {type === "QUESTION" && (
        <QuestionScene live={live} seconds={seconds} onRequest={onRequest} onSubmitAnswer={onSubmitAnswer} onSelectMcq={onSelectMcq} pending={pending} />
      )}
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
  onSubmitAnswer,
  onSelectMcq,
  pending,
}: {
  live: LivePayload;
  seconds: number | null;
  onRequest: (card: LivePower) => void;
  onSubmitAnswer: (text: string) => void;
  onSelectMcq: (optionIndex: number) => void;
  pending: boolean;
}) {
  const available = live.powers.cards.filter((card) => card.remainingUses > 0).slice(0, 3);
  const canControl = live.me?.canControl ?? false;
  const captainSubmit = live.room.answerMode === "CAPTAIN_SUBMIT";
  const totalTimer = live.question?.timer && live.question.timer > 0 ? live.question.timer : 30;
  // A paused timer (e.g. the host just called Correct/Wrong) computes to
  // `null` seconds — remember the last real reading so the ring freezes
  // exactly where it stopped instead of snapping back to the full duration.
  const lastSecondsRef = useRef<number | null>(null);
  if (seconds !== null) lastSecondsRef.current = seconds;
  const displaySeconds = live.timer.paused ? lastSecondsRef.current : seconds;
  const urgency = timerUrgency(displaySeconds, totalTimer);
  // Progress ring: full at the start, depleting clockwise as time runs out.
  const RING_R = 36;
  const RING_C = 2 * Math.PI * RING_R;
  const fraction = displaySeconds === null ? 1 : Math.max(0, Math.min(1, displaySeconds / totalTimer));
  const ringStroke: Record<typeof urgency, string> = {
    idle: "var(--color-accent)",
    safe: "#3DD68C",
    warning: "#E8A33D",
    critical: "#FF5A5A",
  };
  return (
    <div className="flex-1 flex flex-col gap-4 pt-5">
      <div className="flex items-center justify-center">
        {/* Breathing timer ring — the heartbeat speeds up (and the pulse
            grows) as the clock runs down: calm in the green, urgent in red. */}
        <motion.div
          className="relative w-[94px] h-[94px]"
          animate={
            displaySeconds === null || urgency === "idle" || live.timer.paused
              ? { scale: 1 }
              : { scale: urgency === "critical" ? [1, 1.09, 1] : urgency === "warning" ? [1, 1.05, 1] : [1, 1.03, 1] }
          }
          transition={{
            duration: urgency === "critical" ? 0.6 : urgency === "warning" ? 0.95 : 1.6,
            repeat: displaySeconds === null || live.timer.paused ? 0 : Infinity,
            ease: "easeInOut",
          }}
        >
          {/* Soft glow halo behind the ring, tinted by urgency. */}
          <span
            aria-hidden
            className="absolute inset-1 rounded-full transition-[background] duration-500"
            style={{ background: `radial-gradient(circle, ${TIMER_URGENCY_GLOW[urgency]}, transparent 70%)` }}
          />
          <svg viewBox="0 0 94 94" className="absolute inset-0 -rotate-90">
            <circle
              cx="47"
              cy="47"
              r={RING_R}
              fill="none"
              strokeWidth="6"
              stroke="color-mix(in oklab, var(--color-ink) 12%, transparent)"
            />
            <circle
              cx="47"
              cy="47"
              r={RING_R}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              stroke={ringStroke[urgency]}
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - fraction)}
              className="transition-[stroke-dashoffset,stroke] duration-500 ease-linear"
              style={{ filter: `drop-shadow(0 0 8px ${TIMER_URGENCY_GLOW[urgency]})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-[26px] leading-none font-black tabular-nums ${TIMER_URGENCY_TEXT[urgency]}`}>
              {displaySeconds ?? live.question?.timer ?? "--"}
            </span>
            <span className="mt-0.5 text-[8.5px] font-bold tracking-[.22em] text-mute-2">
              {live.timer.paused ? "PAUSED" : "SEC"}
            </span>
          </div>
          {live.timer.paused && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-shell border border-line/[.12] flex items-center justify-center text-[11px]"
            >
              ⏸
            </span>
          )}
        </motion.div>
      </div>
      {live.turn.frozen && (
        <div className="relative overflow-hidden rounded-2xl border border-info/45 bg-info/[.1] px-4 py-3 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-[.14em] text-info">
            <span className="text-[13px]">❄️</span>
            YOUR TEAM IS FROZEN
          </span>
          <span className="block mt-1 text-[12px] text-mute-2">
            An opponent froze you — no power cards on this question.
          </span>
        </div>
      )}
      {live.turn.assignedTeamId && (
        <div
          className={`relative overflow-hidden rounded-2xl border px-4 py-3 text-center ${
            live.turn.isMyTurn
              ? "border-success/35 bg-[linear-gradient(135deg,color-mix(in_oklab,#3DD68C_14%,transparent),color-mix(in_oklab,#3DD68C_5%,transparent))]"
              : "border-warn/35 bg-[linear-gradient(135deg,color-mix(in_oklab,#E8A33D_12%,transparent),color-mix(in_oklab,#E8A33D_4%,transparent))]"
          }`}
        >
          <span
            aria-hidden
            className="absolute inset-x-6 top-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${live.turn.isMyTurn ? "rgba(61,214,140,.55)" : "rgba(232,163,61,.55)"}, transparent)`,
            }}
          />
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-black tracking-[.14em] ${live.turn.isMyTurn ? "text-success" : "text-warn"}`}>
            <span className="text-[12px]">{live.turn.isMyTurn ? "🎯" : "⏳"}</span>
            {live.turn.isMyTurn ? "YOUR TEAM'S TURN" : `${live.turn.assignedTeamName ?? "ANOTHER TEAM"}'S TURN`}
          </span>
          <span className="block mt-1 text-[12px] text-mute-2">
            {live.turn.isMyTurn
              ? "You may use any allowed card except Freeze."
              : "Only Freeze can be played by your team right now."}
          </span>
        </div>
      )}
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
        <h1 className="text-[28px] leading-[1.12] font-black tracking-[-.03em]">
          {live.question?.question || live.currentScene.title}
        </h1>
        <span
          aria-hidden
          className="mx-auto mt-3.5 block h-[3px] w-14 rounded-full"
          style={{ background: "linear-gradient(90deg, #6C7BFA, #9BA6FF)" }}
        />
        <p className="text-[13px] text-mute-2 mt-3">
          {captainSubmit
            ? canControl
              ? "Discuss with your team, then submit the team's answer below."
              : "Discuss with your team — the captain submits the answer."
            : "Discuss with your team. The host gives marks manually."}
        </p>
        {/* What's on the line for this question. */}
        {(() => {
          const pos = live.round?.positiveMarks ?? live.question?.positiveMarks ?? 0;
          const neg = Math.abs(live.round?.negativeMarks ?? live.question?.negativeMarks ?? 0);
          const coins = live.round?.coinReward ?? 0;
          const isBonus = live.round?.specialMode === "BONUS";
          const economy = live.powers.economyEnabled;
          return (
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
              <span className="flex items-center gap-1 rounded-full border border-success/30 bg-success/[.1] px-2.5 py-1 text-[11.5px] font-bold text-success">
                ✓ Correct +{pos}
                {economy && coins > 0 ? ` · ${coins}🪙` : ""}
              </span>
              {!isBonus && neg > 0 && (
                <span className="flex items-center gap-1 rounded-full border border-danger/30 bg-danger/[.08] px-2.5 py-1 text-[11.5px] font-bold text-danger-soft">
                  ✗ Wrong −{neg}
                </span>
              )}
              {isBonus && (
                <span className="rounded-full border border-warn/30 bg-warn/[.08] px-2.5 py-1 text-[11.5px] font-bold text-warn">
                  Bonus — no penalty
                </span>
              )}
            </div>
          );
        })()}
      </div>
      {live.question?.isMCQ && live.question.options.length > 0 && (() => {
        const mcq = live.myMcq;
        const graded = mcq?.graded ?? null;
        const retryFirstPick = mcq?.retryFirstPick ?? null;
        const answerRevealed = Boolean(live.question?.answer);
        // Captain can pick while it's the team's turn and nothing's finalized.
        const selectable = Boolean(mcq?.canAnswer) && canControl && !pending;
        return (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-2">
              {live.question!.options.map((option, index) => {
                const eliminated = live.question?.peekedOptionIndex === index;
                const wrongFirst = retryFirstPick === index;
                const isMyPick = graded?.optionIndex === index;
                const isTheAnswer = answerRevealed && option === live.question?.answer;
                const locked = eliminated || wrongFirst || !selectable;

                // Color: revealed answer > my graded pick > eliminated/first-wrong.
                let tone = "border-line/[.08] bg-line/[.04] text-ink";
                if (isTheAnswer) tone = "border-success/45 bg-success/[.12] text-ink";
                else if (isMyPick) tone = graded!.correct ? "border-success/45 bg-success/[.12] text-ink" : "border-danger/40 bg-danger/[.1] text-ink";
                else if (eliminated || wrongFirst) tone = "border-line/[.06] bg-line/[.02] opacity-45";

                return (
                  <button
                    key={`${index}-${option}`}
                    disabled={locked}
                    onClick={() => selectable && onSelectMcq(index)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${tone} ${
                      selectable && !eliminated && !wrongFirst ? "cursor-pointer active:scale-[.99] hover:border-accent/40" : "cursor-default"
                    }`}
                  >
                    <span className="w-7 h-7 rounded-full border border-line/[.09] bg-line/[.06] flex items-center justify-center text-xs font-bold text-ink-3 shrink-0">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className={`text-sm font-semibold ${eliminated || wrongFirst ? "line-through" : ""}`}>{option}</span>
                    {isTheAnswer && <span className="ml-auto text-[13px]">✓</span>}
                    {isMyPick && !isTheAnswer && <span className="ml-auto text-[13px]">{graded!.correct ? "✓" : "✗"}</span>}
                    {eliminated && !isMyPick && <span className="ml-auto text-[9.5px] font-bold text-mute-2">👁 OUT</span>}
                    {wrongFirst && !isMyPick && <span className="ml-auto text-[9.5px] font-bold text-mute-2">TRIED</span>}
                  </button>
                );
              })}
            </div>
            {graded ? (
              <span className={`text-center text-[12px] font-bold ${graded.correct ? "text-success" : "text-danger-soft"}`}>
                {graded.correct ? `Correct · +${graded.points}` : graded.points < 0 ? `Wrong · ${graded.points}` : "Wrong"}
              </span>
            ) : retryFirstPick !== null ? (
              <span className="text-center text-[12px] font-bold text-warn">↩ Double Guess — pick again</span>
            ) : mcq && !mcq.canAnswer ? (
              <span className="text-center text-[11px] text-mute-2">Not your team&apos;s turn to answer.</span>
            ) : !canControl ? (
              <span className="text-center text-[11px] text-mute-2">👑 The captain taps your team&apos;s answer.</span>
            ) : (
              <span className="text-center text-[11px] text-mute-2">Tap your team&apos;s answer.</span>
            )}
          </div>
        );
      })()}
      {live.question?.answer && (
        <div className="rounded-2xl border border-success/25 bg-success/[.1] px-4 py-3 text-center text-sm font-bold text-success">
          Answer: {live.question.answer}
        </div>
      )}
      {(live.question?.hints?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-warn/25 bg-warn/[.07] px-3.5 py-3">
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-[.12em] text-warn">
            💡 HINT{(live.question?.hints?.length ?? 0) > 1 ? "S" : ""} UNLOCKED
          </span>
          {live.question!.hints.map((hint, i) => (
            <span key={i} className="text-[13.5px] font-semibold text-ink leading-snug">
              {hint.text}
            </span>
          ))}
        </div>
      )}
      {captainSubmit && !live.question?.isMCQ && (
        <CaptainAnswerBox live={live} canControl={canControl} pending={pending} onSubmit={onSubmitAnswer} />
      )}
      <div className="mt-auto">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[.12em] text-label">
          <Icon name="zap" size={10} className="text-accent" />
          AVAILABLE POWERS
        </span>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {available.length === 0 ? (
            <div className="col-span-3 rounded-2xl border border-dashed border-line/[.12] bg-line/[.02] px-3 py-3.5 text-center text-[12px] text-mute-2">
              No powers available.
            </div>
          ) : (
            available.map((card) => {
              const play = powerCardPlayability(card.effectType, livePlayContext(live));
              // ACTIVE = already armed (Shield/Double Points/Gamble waiting on
              // the next mark) or a card that just resolved but hasn't been
              // re-synced yet — either way it isn't AVAILABLE to play again.
              // Without this check the button stayed clickable and tapping it
              // threw a confusing "you don't own an available copy" error.
              const armed = card.status === "ACTIVE";
              const usable = canControl && play.usable && card.status === "AVAILABLE";
              return (
                <button
                  key={card.id}
                  onClick={() => usable && onRequest(card)}
                  disabled={pending || !usable}
                  className={`group relative overflow-hidden rounded-2xl border px-2 pt-3 pb-2.5 text-center transition active:scale-[.97] ${
                    usable
                      ? "border-accent/25 bg-gradient-to-b from-accent/[.1] to-accent/[.02] cursor-pointer"
                      : armed
                        ? "border-success/30 bg-success/[.06]"
                        : "border-line/[.08] bg-line/[.03] opacity-60"
                  }`}
                >
                  <span
                    className={`mx-auto flex w-9 h-9 items-center justify-center rounded-xl text-lg border ${
                      usable ? "border-accent/25 bg-accent/[.12]" : armed ? "border-success/30 bg-success/[.1]" : "border-line/[.1] bg-line/[.05]"
                    }`}
                  >
                    {card.icon}
                  </span>
                  <span className="block text-[11px] font-bold text-ink mt-1.5 truncate">{card.name}</span>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[.06em] ${
                      usable ? "bg-accent/15 text-accent" : armed ? "bg-success/15 text-success" : "bg-line/[.07] text-mute-2"
                    }`}
                  >
                    {!canControl
                      ? "CAPTAIN ONLY"
                      : card.status === "REQUESTED"
                        ? "PENDING"
                        : armed
                          ? "ARMED"
                          : !play.usable
                            ? "LOCKED"
                            : `${card.remainingUses} LEFT`}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {!canControl && available.length > 0 && (
          <span className="block mt-1.5 text-center text-[10.5px] text-dim">👑 Only the captain can activate powers.</span>
        )}
      </div>
    </div>
  );
}

/**
 * Captain-submit answer mode (room setting): the captain types the team's
 * answer; everyone else sees the submitted state. The host still judges and
 * awards marks manually — this is a written record, not auto-grading.
 */
function CaptainAnswerBox({
  live,
  canControl,
  pending,
  onSubmit,
}: {
  live: LivePayload;
  canControl: boolean;
  pending: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const submitted = live.myAnswer;

  if (submitted) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/[.08] px-4 py-3">
        <span className="block text-[10px] font-semibold tracking-[.12em] text-accent">TEAM ANSWER SUBMITTED</span>
        <span className="block text-[14px] font-bold text-ink mt-1">{submitted.text}</span>
        <span className="block text-[10.5px] text-mute-2 mt-0.5">
          by {submitted.submittedBy} · waiting for the host to judge
        </span>
      </div>
    );
  }

  if (!canControl) {
    return (
      <div className="rounded-2xl border border-line/[.09] bg-line/[.04] px-4 py-3 text-center text-[12px] text-mute-2">
        👑 The captain submits the team&apos;s answer.
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your team's answer…"
        className="flex-1 min-w-0 bg-line/[.05] border border-line/[.1] rounded-[13px] px-3.5 py-3 text-[14px] text-ink outline-none focus:border-accent/60"
      />
      <Button
        variant="primary"
        size="sm"
        disabled={pending || !text.trim()}
        onClick={() => {
          onSubmit(text.trim());
          setText("");
        }}
        className="shrink-0 px-4"
      >
        Submit
      </Button>
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
  canControl,
}: {
  auction: LiveAuction;
  coins: number;
  pending: boolean;
  onBid: (amount: number) => void;
  canControl: boolean;
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

      {canControl ? (
        <>
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
        </>
      ) : (
        <div className="mt-2.5 rounded-lg border border-line/[.09] bg-line/[.04] px-3 py-2 text-center text-[12px] text-mute-2">
          👑 Waiting for your captain to bid…
        </div>
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
  canControl,
  onBuy,
  onRequest,
}: {
  card: LivePower;
  live: LivePayload;
  pending: boolean;
  canControl: boolean;
  onBuy: (card: LivePower) => void;
  onRequest: (card: LivePower) => void;
}) {
  const play = powerCardPlayability(card.effectType, livePlayContext(live));
  const canRequest =
    canControl &&
    play.usable &&
    card.remainingUses > 0 &&
    card.requestable &&
    live.room.permissions?.requestLifelines !== false;
  const canBuy =
    canControl && live.powers.storeOpen && live.room.permissions?.buyPowers !== false;
  const soldOut = card.limited && (card.stock ?? 0) <= 0;

  return (
    <div className="relative flex flex-col gap-1.5">
      <div className={soldOut ? "opacity-45 saturate-50" : ""}>
        {/* Tap the card to flip it and read what it does. */}
        <FlippablePowerCard
          name={card.name}
          icon={card.icon}
          effectType={card.effectType}
          rarity={card.rarity}
          category={card.category}
          description={card.description}
          detailLines={[
            `Price: ${card.price} 🪙`,
            ...(card.remainingUses > 0
              ? [`${card.remainingUses} use${card.remainingUses === 1 ? "" : "s"} owned`]
              : []),
            ...(card.limited ? [soldOut ? "Sold out" : `${card.stock} left in stock`] : []),
          ]}
          hint={play.usable ? null : play.reason}
          size="md"
          footer={
            <span className="rounded-full bg-black/45 border border-white/15 px-2 py-0.5 text-[10px] font-black text-warn tabular-nums">
              {card.onSale && card.basePrice != null && (
                <span className="line-through opacity-60 mr-1 font-semibold">{card.basePrice}</span>
              )}
              {card.price} 🪙
            </span>
          }
          frontExtras={
            <>
              {/* Status ribbons over the card art. */}
              {card.limited && (
                <span
                  className={`absolute top-1.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[8.5px] font-bold tracking-[.08em] ${
                    soldOut ? "bg-black/70 text-mute-2" : "bg-pink/85 text-white"
                  }`}
                >
                  {soldOut ? "SOLD OUT" : `${card.stock} LEFT`}
                </span>
              )}
              {card.onSale && !card.limited && (
                <span className="absolute top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-warn/90 text-black px-2 py-0.5 text-[8.5px] font-black tracking-[.08em]">
                  SALE
                </span>
              )}
            </>
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant="subtle"
          size="sm"
          disabled={pending || !canRequest || ["REQUESTED", "APPROVED", "ACTIVE"].includes(card.status)}
          onClick={() => onRequest(card)}
          className="justify-center text-[11px] px-2"
        >
          {card.status === "REQUESTED"
            ? "Sent"
            : card.status === "APPROVED"
              ? "Approved"
              : card.status === "ACTIVE"
                ? "Active"
                : card.isMystery
                  ? "—"
                  : card.requiresApproval
                    ? "Request"
                    : "Use now"}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={pending || !canBuy || soldOut}
          onClick={() => onBuy(card)}
          className="justify-center text-[11px] px-2"
        >
          Buy {card.price}
        </Button>
      </div>
    </div>
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

/**
 * CORRECT / WRONG feedback burst the moment our own team's score changes.
 * Green stamp + rising points on a gain, red stamp + shake on a loss. Brief
 * and pointer-events-none so it never blocks the game.
 */
function AnswerFeedbackOverlay({ correct, points }: { correct: boolean; points: number }) {
  const positive = correct;
  // A WRONG call that landed at 0 means Shield/Insurance voided the penalty —
  // worth calling out distinctly rather than just showing "WRONG · 0".
  const blocked = !correct && points === 0;
  const color = positive ? "#3DD68C" : blocked ? "#5EC9E8" : "#FF5A5A";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[65] flex items-center justify-center pointer-events-none"
    >
      {/* Edge flash — a colored vignette pulses in from the screen borders. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.1, times: [0, 0.2, 1] }}
        className="absolute inset-0"
        style={{ boxShadow: `inset 0 0 140px 30px color-mix(in oklab, ${color} 55%, transparent)` }}
      />
      <motion.div
        initial={{ scale: 0.4, rotate: positive ? -12 : 0, opacity: 0 }}
        animate={
          positive
            ? { scale: [0.4, 1.15, 1], rotate: [-12, 4, 0], opacity: 1 }
            : { scale: [0.4, 1.1, 1], x: [0, -14, 12, -8, 6, 0], opacity: 1 }
        }
        exit={{ scale: 0.7, opacity: 0, y: -20 }}
        transition={{ duration: positive ? 0.5 : 0.55, ease: [0.2, 0.9, 0.3, 1] }}
        className="relative flex flex-col items-center gap-2"
      >
        <span
          className="flex items-center justify-center w-24 h-24 rounded-full border-4 text-5xl"
          style={{
            color,
            borderColor: color,
            background: `color-mix(in oklab, ${color} 16%, transparent)`,
            boxShadow: `0 0 60px color-mix(in oklab, ${color} 55%, transparent)`,
          }}
        >
          {positive ? "✓" : blocked ? "🛡" : "✗"}
        </span>
        <span className="text-[15px] font-black tracking-[.18em]" style={{ color }}>
          {positive ? "CORRECT" : blocked ? "BLOCKED" : "WRONG"}
        </span>
        <motion.span
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: -6, opacity: 1 }}
          className={`font-mono font-black tabular-nums ${blocked ? "text-[15px] tracking-[.06em]" : "text-[26px]"}`}
          style={{ color }}
        >
          {blocked ? "Marks saved" : points > 0 ? `+${points}` : points}
        </motion.span>
      </motion.div>
    </motion.div>
  );
}

/**
 * Effect-specific copy for the quick toast shown to the team that PLAYED a
 * card — the result, not a card-flip that would eat their answering time.
 */
const SELF_POWER_FX: Record<string, { icon: string; text: string; color: string }> = {
  EXTRA_TIME: { icon: "⏱", text: "+30 sec added to the timer", color: "#3DD68C" },
  HINT: { icon: "💡", text: "Hint revealed · +10 sec", color: "#E8A33D" },
  INSURANCE: { icon: "🩹", text: "Insured — no negatives for 3 questions", color: "#6FD3C6" },
  FREEZE: { icon: "❄️", text: "Opponent frozen next question", color: "#6ED3F2" },
  DOUBLE_SCORE: { icon: "⚡", text: "Double Points armed", color: "#FF9A3D" },
  BLOCK_NEGATIVE: { icon: "🛡", text: "Shield armed", color: "#9BC0EF" },
  GAMBLE: { icon: "🎲", text: "Gamble on — double or nothing", color: "#F06A96" },
  SECOND_CHANCE: { icon: "↩", text: "Second chance ready", color: "#3DD68C" },
  PEEK: { icon: "👁", text: "One wrong option ruled out", color: "#5EC9E8" },
};

/**
 * Quick, non-blocking confirmation for your OWN play. Extra Time shows the
 * "+30s" rising toward the timer; every other card shows a compact effect
 * pill. ~1.4s, pointer-events-none — the game underneath stays interactive.
 */
function SelfPowerEffect({ effectType, icon, name }: { effectType: string; icon: string; name: string }) {
  const fx = SELF_POWER_FX[effectType] ?? { icon, text: `${name} activated`, color: "#6C7BFA" };

  if (effectType === "EXTRA_TIME") {
    // Float the bonus up toward the timer ring at the top of the card.
    return (
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.7 }}
        animate={{ opacity: [0, 1, 1, 0], y: [40, -140, -180, -220], scale: [0.7, 1.1, 1, 0.9] }}
        transition={{ duration: 1.4, times: [0, 0.2, 0.7, 1], ease: "easeOut" }}
        className="fixed left-1/2 top-1/2 z-[66] -translate-x-1/2 pointer-events-none flex flex-col items-center"
      >
        <span className="font-mono text-[40px] font-black" style={{ color: fx.color, textShadow: `0 0 24px ${fx.color}` }}>
          +30s
        </span>
        <span className="text-[11px] font-bold tracking-[.12em]" style={{ color: fx.color }}>
          EXTRA TIME
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 340, damping: 22 }}
      className="fixed left-1/2 top-[16%] z-[66] -translate-x-1/2 pointer-events-none"
    >
      <div
        className="flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 bg-card/95 shadow-[0_16px_40px_rgba(0,0,0,.5)]"
        style={{ borderColor: `color-mix(in oklab, ${fx.color} 45%, transparent)`, boxShadow: `0 0 34px color-mix(in oklab, ${fx.color} 32%, transparent)` }}
      >
        <span className="text-2xl">{fx.icon}</span>
        <span className="text-[13.5px] font-bold" style={{ color: fx.color }}>
          {fx.text}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * The big moment: a team plays a power card and every phone in the room sees
 * the card itself slam in — ray wheel behind it, card flips up from the deck,
 * team name stamped below. ~3s, pointer-events-none, then gone.
 */
function PowerActivationOverlay({ power }: { power: NonNullable<LiveFeedItem["power"]> }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />

      {/* Slow-spinning ray wheel behind the card. */}
      <div
        aria-hidden
        className="absolute w-[560px] h-[560px] animate-[encSpinSlow_14s_linear_infinite]"
        style={{
          background:
            "repeating-conic-gradient(rgba(255,255,255,.07) 0deg 9deg, transparent 9deg 24deg)",
          maskImage: "radial-gradient(circle, black 0%, transparent 68%)",
          WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 68%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-4">
        <motion.div
          initial={{ scale: 0.25, rotateY: 180, y: 140, opacity: 0 }}
          animate={{ scale: 1, rotateY: 0, y: 0, opacity: 1 }}
          exit={{ scale: 0.85, y: -30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 210, damping: 20 }}
          style={{ transformPerspective: 900 }}
          className="w-[212px]"
        >
          <PowerCardFace
            name={power.name}
            icon={power.icon}
            effectType={power.effectType}
            rarity={power.rarity}
            size="lg"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex flex-col items-center gap-1"
        >
          <span className="text-[11px] font-bold tracking-[.24em] text-warn">POWER PLAYED</span>
          <span className="text-lg font-black text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.8)]">
            {power.teamName} activated {power.name}!
          </span>
        </motion.div>
      </div>
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
