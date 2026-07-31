"use client";

import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import type { ReplayEvent } from "@/data/queries/replay.queries";
import type { SceneRecord } from "@/data/queries/scene.queries";
import type { RoundRecord } from "@/data/queries/round.queries";

const SPEEDS = [0.5, 1, 2, 4] as const;

function eventIndexForScene(events: ReplayEvent[], sceneId: string): number {
  const idx = events.findIndex((e) => e.type === "SCENE_CHANGED" && String(e.metadata.sceneId) === sceneId);
  return idx === -1 ? 0 : idx;
}

export function ReplayControls({
  cursorIndex,
  eventsCount,
  playing,
  speed,
  onTogglePlay,
  onPrev,
  onNext,
  onBack,
  onForward,
  onSpeedChange,
  onJumpIndex,
  events,
  scenes,
  rounds,
}: {
  cursorIndex: number;
  eventsCount: number;
  playing: boolean;
  speed: number;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onForward: () => void;
  onSpeedChange: (speed: number) => void;
  onJumpIndex: (index: number) => void;
  events: ReplayEvent[];
  scenes: SceneRecord[];
  rounds: RoundRecord[];
}) {
  const roundIntroScenes = rounds.map((round) => ({
    round,
    scene: scenes.find((s) => s.roundId === round.id && s.type === "ROUND_INTRO") ?? null,
  }));
  const winnerScene = scenes.find((s) => s.type === "WINNER") ?? null;
  const questionScenes = scenes.filter((s) => s.type === "QUESTION" || s.type === "DRAWING");

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line/[.09] bg-card p-3">
      {/* Round quick-nav */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {roundIntroScenes.map(({ round, scene }, i) => (
          <button
            key={round.id}
            disabled={!scene}
            onClick={() => scene && onJumpIndex(eventIndexForScene(events, scene.id))}
            className="rounded-lg px-2.5 py-1 text-[10.5px] font-bold text-mute-2 hover:text-ink-2 hover:bg-line/[.05] disabled:opacity-40 cursor-pointer border border-line/[.08]"
          >
            Round {i + 1}
          </button>
        ))}
        {winnerScene && (
          <button
            onClick={() => onJumpIndex(eventIndexForScene(events, winnerScene.id))}
            className="rounded-lg px-2.5 py-1 text-[10.5px] font-bold text-warn hover:bg-warn/[.08] cursor-pointer border border-warn/25"
          >
            🏆 Winner
          </button>
        )}
        <select
          onChange={(e) => e.target.value && onJumpIndex(eventIndexForScene(events, e.target.value))}
          value=""
          className="ml-auto bg-line/[.04] border border-line/[.09] rounded-lg px-2 py-1 text-[10.5px] text-ink-3 outline-none"
        >
          <option value="">Jump to question…</option>
          {questionScenes.map((s, i) => (
            <option key={s.id} value={s.id}>
              Q{i + 1} — {s.title.slice(0, 40)}
            </option>
          ))}
        </select>
      </div>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={Math.max(0, eventsCount - 1)}
        value={cursorIndex}
        onChange={(e) => onJumpIndex(Number(e.target.value))}
        className="w-full accent-accent"
      />

      {/* Transport controls */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="plain" size="sm" onClick={onPrev} title="Previous event">
          <Icon name="skip-back" size={14} />
        </Button>
        <Button variant="plain" size="sm" onClick={onBack} title="Back 10s">
          <Icon name="rewind" size={14} />
        </Button>
        <Button variant="primary" onClick={onTogglePlay} className="w-11 h-11 justify-center rounded-full p-0">
          <Icon name={playing ? "pause" : "play"} size={18} />
        </Button>
        <Button variant="plain" size="sm" onClick={onForward} title="Forward 10s">
          <Icon name="fast-forward" size={14} />
        </Button>
        <Button variant="plain" size="sm" onClick={onNext} title="Next event">
          <Icon name="skip-forward" size={14} />
        </Button>
        <div className="flex items-center gap-1 ml-3">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`rounded-md px-2 py-1 text-[10.5px] font-bold cursor-pointer ${
                speed === s ? "bg-accent/15 border border-accent/40 text-ink" : "border border-line/[.09] text-mute-2 hover:text-ink-3"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
        <span className="text-[10.5px] text-dim tabular-nums ml-2">
          {cursorIndex + 1} / {eventsCount}
        </span>
      </div>
    </div>
  );
}
