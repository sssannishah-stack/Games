"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { purchasePowerCard, requestPowerCard } from "@/actions/powerCard.actions";
import { JoinForm, type JoinedParticipant } from "@/components/room/JoinForm";
import { JoinPageShell } from "@/components/room/JoinPageShell";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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
};

type LivePower = {
  id: string;
  name: string;
  description: string;
  icon: string;
  price: number;
  stock: number | null;
  requiresApproval: boolean;
  remainingUses: number;
  requestable?: boolean;
  status: "AVAILABLE" | "REQUESTED" | "APPROVED" | "ACTIVE" | "CONSUMED" | "REJECTED";
  requestId: string | null;
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
    cards: LivePower[];
  };
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

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

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
            <StatusStrip live={live} seconds={seconds} />
            <main className="flex-1 min-h-0 py-4">
              <SceneScreen live={live} seconds={seconds} onRequest={request} pending={pending} participantName={participant.name} />
            </main>
            <PowerTray live={live} pending={pending} onBuy={buy} onRequest={request} />
          </>
        )}
      </div>

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

function StatusStrip({ live, seconds }: { live: LivePayload; seconds: number | null }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      <Metric label="Rank" value={live.team ? `#${live.team.rank}` : "-"} />
      <Metric label="Score" value={live.team ? String(live.team.score) : "-"} />
      <Metric label="Timer" value={seconds === null ? "--" : `${seconds}s`} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line/[.08] bg-line/[.04] px-3 py-3">
      <span className="block text-[10px] text-mute-2 font-semibold tracking-[.12em]">{label}</span>
      <span className="block text-lg font-bold text-ink mt-1">{value}</span>
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
  return (
    <div className="flex-1 flex flex-col justify-center gap-5">
      <div>
        <span className="text-[11px] font-semibold tracking-[.14em] text-success">ROUND</span>
        <h1 className="text-4xl font-black tracking-[-.04em] mt-2">{live.round?.title ?? live.currentScene.title}</h1>
        <p className="text-sm text-mute-2 mt-3 leading-relaxed">
          {live.round?.description || live.round?.rules || "Get ready. The next challenge is about to begin."}
        </p>
      </div>
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
  return (
    <div className="flex-1 flex flex-col gap-3 pt-5">
      <h1 className="text-3xl font-black tracking-[-.03em]">Leaderboard</h1>
      <div className="flex flex-col gap-2">
        {live.leaderboard.map((team) => (
          <motion.div
            layout
            key={team.id}
            className="rounded-2xl border border-line/[.08] bg-line/[.04] px-4 py-3 flex items-center gap-3"
          >
            <span className="w-8 h-8 rounded-xl bg-line/[.06] flex items-center justify-center font-mono font-bold">
              {team.rank}
            </span>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: team.color ?? "#6C7BFA" }} />
            <span className="font-bold text-ink">{team.name}</span>
            <span className="ml-auto font-mono font-black text-lg">{team.score}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function WinnerScene({ live }: { live: LivePayload }) {
  const winner = live.leaderboard[0];
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
      <div className="text-6xl">***</div>
      <div>
        <span className="text-[11px] text-label font-semibold tracking-[.14em]">WINNER</span>
        <h1 className="text-4xl font-black tracking-[-.04em] mt-2">{winner?.name ?? "Final results"}</h1>
      </div>
      <div className="rounded-[24px] border border-warn/25 bg-warn/[.1] px-8 py-5">
        <span className="block text-[12px] text-mute-2">Final score</span>
        <span className="block text-5xl font-black text-warn mt-1">{winner?.score ?? 0}</span>
      </div>
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
  const cards = useMemo(() => live.powers.cards.slice(0, 5), [live.powers.cards]);
  if (!cards.length) return null;

  const economyEnabled = live.powers.economyEnabled;
  const storeClosed = economyEnabled && !live.powers.storeOpen;

  return (
    <footer className="shrink-0 rounded-[24px] border border-line/[.08] bg-line/[.035] p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-semibold tracking-[.12em] text-label">POWER STORE</span>
        {economyEnabled && <span className="ml-auto text-[11px] text-mute-2">{live.team?.coins ?? 0} coins</span>}
      </div>
      {storeClosed && (
        <div className="mb-2 rounded-xl border border-line/[.08] bg-line/[.03] px-3 py-2 text-center text-[12px] text-mute-2">
          Store currently closed
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {cards.map((card) => {
          const canRequest = (card.remainingUses > 0 || card.requestable) && live.room.permissions?.requestLifelines !== false;
          const canBuy = economyEnabled && live.powers.storeOpen && live.room.permissions?.buyPowers !== false;
          return (
            <div key={card.id} className="min-w-[138px] rounded-2xl border border-line/[.08] bg-card p-3">
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
                  {card.status === "REQUESTED" ? "Sent" : "Use"}
                </Button>
                {economyEnabled && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={pending || !canBuy}
                    onClick={() => onBuy(card)}
                    className="justify-center text-[11px] px-2"
                  >
                    {card.price}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </footer>
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
