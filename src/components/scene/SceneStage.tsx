"use client";

import { RoundsRoadmap, RoundProgress, readRoadmap } from "@/components/scene/RoundScenes";
import type { RoomDetail } from "@/data/queries/room.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { QuestionRecord } from "@/data/queries/question.queries";
import type { SceneRecord } from "@/data/queries/scene.queries";

const DIFF_PILL: Record<string, string> = {
  EASY: "text-success border-success/30 bg-success/[.1]",
  MEDIUM: "text-warn border-warn/30 bg-warn/[.08]",
  HARD: "text-danger-soft border-danger/30 bg-danger/[.08]",
};

/**
 * Renders one scene the way it actually appeared to players — a real MCQ card
 * with options, an answer-reveal that highlights the correct choice, round
 * intros/roadmaps and leaderboards — rather than just printing the title.
 *
 * Deliberately takes a plain data snapshot (not a live-polled payload), so it
 * works for two very different callers: the Event Flow builder's live preview
 * (current room state) and Competition Replay (a historical, reconstructed
 * snapshot at some point in the past — same shapes, different data source).
 * `teams` in particular may be synthetic for replay (real team identity, but
 * `score` swapped for the reconstructed score at the replay cursor).
 */
export function SceneStage({
  scene,
  question,
  round,
  teams,
  room,
  compact,
}: {
  scene: SceneRecord;
  question: QuestionRecord | null;
  round: RoundRecord | null;
  teams: TeamRecord[];
  room: RoomDetail;
  compact: boolean;
}) {
  const h1 = compact ? "text-[17px]" : "text-[26px]";
  const body = compact ? "text-[12.5px]" : "text-[15px]";
  const opt = compact ? "text-[12.5px]" : "text-[15px]";
  const roundIndex = round ? room.selectedRounds.indexOf(round.id) : -1;
  const roadmap = readRoadmap(scene.content as Record<string, unknown> | undefined);
  const leaderboard = teams.map((t) => ({ id: t.id, name: t.name, score: t.score, color: t.color }));

  switch (scene.type) {
    case "WELCOME":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2.5">
          <span className="text-[10px] font-black tracking-[.18em] text-accent">LIVE COMPETITION</span>
          <h1 className={`${h1} font-black text-ink leading-tight`}>{room.competitionTitle}</h1>
          <p className={`${body} text-mute-2`}>{room.name}</p>
          <div className="mt-2 rounded-xl border border-accent/25 bg-accent/[.06] px-4 py-2 flex flex-col items-center gap-0.5">
            <span className="text-[9px] font-semibold tracking-[.14em] text-mute-2">JOIN CODE</span>
            <span className="text-[18px] font-black tracking-[.2em] text-accent tabular-nums">{room.roomCode}</span>
          </div>
          <p className="text-[10.5px] text-dim mt-1">Waiting for the host to begin…</p>
        </div>
      );

    case "RULES":
      return (
        <div className="flex-1 flex flex-col justify-center gap-3">
          <h1 className={`${h1} font-black text-ink`}>{scene.title || "Rules"}</h1>
          <ul className={`${body} text-ink-3 flex flex-col gap-1.5`}>
            <li>• The host controls every screen — wait for each step.</li>
            <li>• Answer out loud when it&apos;s your team&apos;s turn.</li>
            <li>• Power cards can be played during questions.</li>
          </ul>
        </div>
      );

    case "ROUND_OVERVIEW":
      return roadmap.length > 0 ? (
        <div className="flex-1 overflow-y-auto">
          <RoundsRoadmap roadmap={roadmap} economy={room.economyEnabled} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center text-mute-2 text-[12px]">
          Roadmap builds when you generate the event flow.
        </div>
      );

    case "ROUND_INTRO": {
      const timerSummary = (scene.content as Record<string, unknown> | undefined)?.timerSummary;
      const timerText =
        typeof timerSummary === "number"
          ? `${timerSummary}s`
          : timerSummary && typeof timerSummary === "object"
            ? `${(timerSummary as { min: number }).min}–${(timerSummary as { max: number }).max}s`
            : `${round?.defaultTimer ?? 30}s`;
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2.5">
          <span className="text-[10px] font-black tracking-[.18em] text-info">
            ROUND {roundIndex >= 0 ? roundIndex + 1 : ""}
          </span>
          <h1 className={`${h1} font-black text-ink leading-tight`}>{round?.title ?? scene.title}</h1>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            <Metric label="Questions" value={String(round?.questionCount ?? 0)} />
            <Metric label="Timer" value={timerText} />
            <Metric label="Correct" value={`+${round?.positiveMarks ?? 0}`} tone="success" />
            <Metric label="Wrong" value={`−${Math.abs(round?.negativeMarks ?? 0)}`} tone="danger" />
          </div>
        </div>
      );
    }

    case "QUESTION":
    case "ANSWER_REVEAL": {
      if (!question) {
        return (
          <div className="flex-1 flex items-center justify-center text-center text-mute-2 text-[12px]">
            No question linked — pick one in Step Settings.
          </div>
        );
      }
      const reveal = scene.type === "ANSWER_REVEAL";
      const answerIdx = question.options.findIndex((o) => o.trim() === question.answer.trim());
      const pos = question.positiveMarks;
      const neg = Math.abs(question.negativeMarks);
      return (
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[9.5px] font-bold tracking-wide ${DIFF_PILL[question.difficulty] ?? DIFF_PILL.MEDIUM}`}>
              {question.difficulty}
            </span>
            {reveal ? (
              <span className="text-[9.5px] font-black tracking-[.12em] text-success">✓ ANSWER REVEAL</span>
            ) : (
              <span className="text-[10px] text-mute-2">{question.isMCQ ? "Multiple choice" : "Host-marked"}</span>
            )}
          </div>
          <h1 className={`${h1} font-black text-ink leading-tight`}>{question.question}</h1>
          {question.media?.url && (
            <span className="text-[11px] text-mute-2">📎 {question.media.type}: {question.media.name}</span>
          )}
          {question.isMCQ ? (
            <div className="flex flex-col gap-2">
              {question.options.map((option, i) => {
                const isAns = reveal && i === answerIdx;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2 ${
                      isAns ? "border-success/50 bg-success/[.14]" : "border-line/[.08] bg-line/[.04]"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 ${
                        isAns ? "border-success/50 bg-success/20 text-success" : "border-line/[.12] bg-line/[.06] text-ink-3"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className={`${opt} font-semibold ${isAns ? "text-success" : "text-ink"}`}>{option}</span>
                    {isAns && <span className="ml-auto text-[10px] font-bold text-success shrink-0">✓ CORRECT</span>}
                  </div>
                );
              })}
            </div>
          ) : reveal ? (
            <div className="rounded-2xl border border-success/40 bg-success/[.12] px-3.5 py-3">
              <span className="text-[9.5px] font-bold tracking-[.12em] text-success">CORRECT ANSWER</span>
              <p className={`${opt} font-bold text-ink mt-0.5`}>{question.answer}</p>
            </div>
          ) : (
            <p className={`${body} text-mute-2`}>Discuss with your team — the host awards marks.</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
            <span className="rounded-full border border-success/30 bg-success/[.1] px-2 py-0.5 text-[10px] font-bold text-success">✓ +{pos}</span>
            {neg > 0 && <span className="rounded-full border border-danger/30 bg-danger/[.08] px-2 py-0.5 text-[10px] font-bold text-danger-soft">✗ −{neg}</span>}
            {!reveal && (
              <span className="rounded-full border border-line/[.12] bg-line/[.04] px-2 py-0.5 text-[10px] font-semibold text-mute-2">
                ⏱ {question.timerMode === "CUSTOM" ? question.timer : round?.defaultTimer ?? 30}s
              </span>
            )}
          </div>
        </div>
      );
    }

    case "LEADERBOARD":
    case "ROUND_COMPLETE":
      return roadmap.length > 0 ? (
        <div className="flex-1 overflow-y-auto">
          <RoundProgress roadmap={roadmap} roundIndex={roundIndex} leaderboard={leaderboard} economy={room.economyEnabled} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-2">
          <span className="text-[11px] font-black tracking-[.14em] text-warn">🏆 LEADERBOARD</span>
          {leaderboard.length === 0 ? (
            <span className="text-[12px] text-mute-2">Add teams to preview standings.</span>
          ) : (
            [...leaderboard].sort((a, b) => b.score - a.score).map((t, i) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-line/[.08] bg-line/[.03] px-3 py-1.5">
                <span className="text-[12px] font-black text-mute-2 w-5">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                <span className={`${body} font-semibold text-ink truncate flex-1`}>{t.name}</span>
                <span className={`${body} font-black text-accent tabular-nums`}>{t.score}</span>
              </div>
            ))
          )}
        </div>
      );

    case "WINNER": {
      const ranked = [...leaderboard].sort((a, b) => b.score - a.score);
      const winner = ranked[0];
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
          <span className="text-4xl">🏆</span>
          <span className="text-[10px] font-black tracking-[.18em] text-warn">WINNER</span>
          <h1 className={`${h1} font-black text-ink leading-tight`}>{winner?.name ?? "—"}</h1>
          {winner && <span className={`${body} font-bold text-warn tabular-nums`}>{winner.score} pts</span>}
        </div>
      );
    }

    default:
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
          <h1 className={`${h1} font-black text-ink`}>{scene.title}</h1>
          <span className="text-[11px] text-mute-2">{scene.type.replace(/_/g, " ")}</span>
        </div>
      );
  }
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-danger-soft" : "text-ink";
  return (
    <span className="flex flex-col items-center rounded-xl border border-line/[.1] bg-line/[.04] px-3 py-1.5 min-w-[64px]">
      <span className={`text-[15px] font-black tabular-nums ${color}`}>{value}</span>
      <span className="text-[8.5px] font-semibold tracking-[.12em] text-mute-2">{label.toUpperCase()}</span>
    </span>
  );
}
