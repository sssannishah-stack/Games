"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomDetail } from "@/data/queries/room.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { QuestionRecord } from "@/data/queries/question.queries";
import type { PowerCardRecord } from "@/data/queries/powerCard.queries";
import type { ReplayData } from "./reconstructState";
import { reconstructState } from "./reconstructState";
import { detectMoments } from "./momentDetector";
import { TimelinePanel } from "./TimelinePanel";
import { LiveReplayPanel } from "./LiveReplayPanel";
import { EventDetailsPanel } from "./EventDetailsPanel";
import { StatePanel } from "./StatePanel";
import { ReplayControls } from "./ReplayControls";
import { ReplaySummary } from "./ReplaySummary";

const BASE_TICK_MS = 900;

export function ReplayShell({
  room,
  teams,
  rounds,
  questions,
  cards,
  data,
  otherRooms,
}: {
  room: RoomDetail;
  teams: TeamRecord[];
  rounds: RoundRecord[];
  questions: QuestionRecord[];
  cards: PowerCardRecord[];
  data: ReplayData;
  /** Other rooms in this competition, for the room-switcher — empty if only one. */
  otherRooms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [cursorIndex, setCursorIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const eventsCount = data.events.length;

  useEffect(() => {
    if (!playing) return;
    if (cursorIndex >= eventsCount - 1) {
      setPlaying(false);
      return;
    }
    const interval = window.setInterval(() => {
      setCursorIndex((i) => {
        if (i >= eventsCount - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, BASE_TICK_MS / speed);
    return () => window.clearInterval(interval);
  }, [playing, speed, eventsCount, cursorIndex]);

  const state = useMemo(() => reconstructState(data, cursorIndex), [data, cursorIndex]);
  const moments = useMemo(() => detectMoments(data, teams), [data, teams]);
  const currentEvent = data.events[cursorIndex] ?? null;

  function jump(index: number) {
    setPlaying(false);
    setCursorIndex(Math.max(0, Math.min(index, eventsCount - 1)));
  }

  function back10s() {
    const t = currentEvent ? new Date(currentEvent.createdAt).getTime() - 10000 : 0;
    const idx = data.events.findIndex((e) => new Date(e.createdAt).getTime() >= t);
    jump(idx === -1 ? 0 : idx);
  }

  function forward10s() {
    const t = currentEvent ? new Date(currentEvent.createdAt).getTime() + 10000 : 0;
    const idx = data.events.findIndex((e) => new Date(e.createdAt).getTime() >= t);
    jump(idx === -1 ? eventsCount - 1 : idx);
  }

  if (eventsCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line/[.15] p-12 text-center text-mute-2">
        This room has no recorded events yet — replay appears once the event has run.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-160px)] min-h-[600px]">
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <span className="text-[13px] font-bold text-ink-2">Competition Replay</span>
        <span className="text-[12px] text-mute-2">{room.name}</span>
        {otherRooms.length > 0 && (
          <select
            defaultValue=""
            onChange={(e) => e.target.value && router.push(`?room=${e.target.value}`)}
            className="ml-2 bg-line/[.04] border border-line/[.09] rounded-lg px-2 py-1 text-[11.5px] text-ink-3 outline-none"
          >
            <option value="">Switch room…</option>
            {otherRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
        {moments.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            {moments.map((m) => (
              <button
                key={m.id}
                onClick={() => jump(m.eventIndex)}
                className="flex items-center gap-1 rounded-full border border-line/[.1] bg-line/[.03] px-2.5 py-1 text-[10.5px] font-semibold text-ink-3 hover:border-accent/40 hover:text-ink cursor-pointer"
              >
                <span>{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_300px] gap-3 flex-1 min-h-0">
        <div className="min-h-0 xl:h-full">
          <TimelinePanel events={data.events} teams={teams} cards={cards} cursorIndex={cursorIndex} onJump={jump} />
        </div>
        <div className="min-h-0 xl:h-full">
          <LiveReplayPanel state={state} room={room} teams={teams} rounds={rounds} questions={questions} cards={cards} />
        </div>
        <div className="flex flex-col gap-3 min-h-0 xl:h-full xl:overflow-y-auto encore-scrollbar">
          <EventDetailsPanel event={currentEvent} scenes={data.scenes} questions={questions} rounds={rounds} teams={teams} cards={cards} />
          <StatePanel state={state} teams={teams} cards={cards} rounds={rounds} questions={questions} />
        </div>
      </div>

      <div className="shrink-0">
        <ReplayControls
          cursorIndex={cursorIndex}
          eventsCount={eventsCount}
          playing={playing}
          speed={speed}
          onTogglePlay={() => setPlaying((p) => !p)}
          onPrev={() => jump(cursorIndex - 1)}
          onNext={() => jump(cursorIndex + 1)}
          onBack={back10s}
          onForward={forward10s}
          onSpeedChange={setSpeed}
          onJumpIndex={jump}
          events={data.events}
          scenes={data.scenes}
          rounds={rounds}
        />
      </div>

      <ReplaySummary data={data} rounds={rounds} cards={cards} />
    </div>
  );
}
