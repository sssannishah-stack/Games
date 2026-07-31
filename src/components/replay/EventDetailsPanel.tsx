"use client";

import { Card } from "@/components/ui/Card";
import type { ReplayEvent } from "@/data/queries/replay.queries";
import type { SceneRecord } from "@/data/queries/scene.queries";
import type { QuestionRecord } from "@/data/queries/question.queries";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { PowerCardRecord } from "@/data/queries/powerCard.queries";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-line/[.05] last:border-0">
      <span className="text-[10.5px] text-mute-2">{label}</span>
      <span className="text-[11.5px] font-semibold text-ink-2 text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}

export function EventDetailsPanel({
  event,
  scenes,
  questions,
  rounds,
  teams,
  cards,
}: {
  event: ReplayEvent | null;
  scenes: SceneRecord[];
  questions: QuestionRecord[];
  rounds: RoundRecord[];
  teams: TeamRecord[];
  cards: PowerCardRecord[];
}) {
  if (!event) {
    return (
      <Card className="rounded-2xl p-3.5">
        <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label">EVENT DETAILS</span>
        <p className="text-[11.5px] text-mute-2 mt-2">Select an event on the timeline.</p>
      </Card>
    );
  }

  const teamId = event.metadata.teamId ? String(event.metadata.teamId) : null;
  const team = teamId ? teams.find((t) => t.id === teamId) : null;
  const cardId = event.metadata.powerCardId ? String(event.metadata.powerCardId) : null;
  const card = cardId ? cards.find((c) => c.id === cardId) : null;

  let sceneRows: React.ReactNode = null;
  if (event.type === "SCENE_CHANGED" && event.metadata.sceneId) {
    const scene = scenes.find((s) => s.id === String(event.metadata.sceneId));
    if (scene && (scene.type === "QUESTION" || scene.type === "ANSWER_REVEAL" || scene.type === "DRAWING")) {
      const question = scene.questionId ? questions.find((q) => q.id === scene.questionId) : null;
      const round = scene.roundId ? rounds.find((r) => r.id === scene.roundId) : null;
      const assignedTeamId = typeof scene.settings?.assignedTeamId === "string" ? scene.settings.assignedTeamId : null;
      const assignedTeam = assignedTeamId ? teams.find((t) => t.id === assignedTeamId) : null;
      sceneRows = (
        <>
          {round && <Row label="Round" value={round.title} />}
          {question && <Row label="Question" value={question.question || question.media?.name || "Untitled"} />}
          {assignedTeam && <Row label="Assigned Team" value={assignedTeam.name} />}
          {question && <Row label="Timer" value={`${question.timerMode === "CUSTOM" ? question.timer : round?.defaultTimer ?? 30}s`} />}
          {question && <Row label="Correct Answer" value={question.answer} />}
          {round && round.powerCardMode === "CUSTOM" && (
            <Row label="Power Cards Allowed" value={`${round.allowedPowerCards.length} card(s)`} />
          )}
        </>
      );
    }
  }

  return (
    <Card className="rounded-2xl p-3.5 flex flex-col gap-1">
      <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label mb-1">EVENT DETAILS</span>
      <Row label="Type" value={event.type.replace(/_/g, " ")} />
      <Row label="Time" value={new Date(event.createdAt).toLocaleTimeString()} />
      {team && <Row label="Team" value={team.name} />}
      {card && <Row label="Power Card" value={card.name} />}
      {event.type === "SCORE_CHANGED" && (
        <>
          <Row label="Points" value={`${Number(event.metadata.points ?? 0) >= 0 ? "+" : ""}${event.metadata.points}`} />
          <Row label="Reason" value={String(event.metadata.reason ?? "")} />
        </>
      )}
      {event.type === "COIN_AWARDED" && <Row label="Amount" value={String(event.metadata.amount ?? 0)} />}
      {event.type === "AUCTION_SOLD" && <Row label="Winning Bid" value={String(event.metadata.amount ?? 0)} />}
      {sceneRows}
      {!sceneRows && (
        <p className="text-[11px] text-ink-3 mt-1.5 leading-relaxed">{event.text}</p>
      )}
    </Card>
  );
}
