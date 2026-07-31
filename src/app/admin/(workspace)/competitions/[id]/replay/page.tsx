import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { getCompetitionById } from "@/data/queries/competition.queries";
import { getRoomsByCompetition, getRoomById } from "@/data/queries/room.queries";
import { getTeamsByRoom } from "@/data/queries/team.queries";
import { getSelectedRoundsForRoom } from "@/data/queries/round.queries";
import { getQuestionsForRoomRounds } from "@/data/queries/question.queries";
import { getScenesByRoom } from "@/data/queries/scene.queries";
import { getPowerCardsByOwner } from "@/data/queries/powerCard.queries";
import {
  getReplayEvents,
  getReplayScoreHistory,
  getReplayCoinHistory,
  getReplayAuctions,
} from "@/data/queries/replay.queries";
import { ReplayShell } from "@/components/replay/ReplayShell";
import { Card } from "@/components/ui/Card";

/**
 * Competition Replay — `/admin/competitions/[competitionId]/replay` (nested
 * under the existing `[id]` segment; Next.js requires one dynamic-segment
 * name per route level, so this reuses `id` rather than introducing a
 * conflicting `[competitionId]` sibling — the resulting URL is identical).
 * A competition can have multiple rooms (`getRoomsByCompetition`), so this
 * shows a room picker via `?room=` when there's more than one, and
 * auto-selects when there's exactly one.
 */
export default async function CompetitionReplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const { id: competitionId } = await params;
  const { room: roomParam } = await searchParams;
  const user = await requireUser();

  const competition = await getCompetitionById(competitionId, user.id);
  if (!competition) notFound();

  const rooms = await getRoomsByCompetition(competitionId);

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Header competitionTitle={competition.title} competitionId={competitionId} />
        <Card className="rounded-2xl p-10 text-center text-mute-2">
          This competition has no rooms yet — replay appears once a room has run an event.
        </Card>
      </div>
    );
  }

  const selectedRoomId =
    roomParam && rooms.some((r) => r.id === roomParam) ? roomParam : rooms.length === 1 ? rooms[0].id : null;

  if (!selectedRoomId) {
    return (
      <div className="flex flex-col gap-4">
        <Header competitionTitle={competition.title} competitionId={competitionId} />
        <span className="text-[13px] font-bold text-ink-2">Pick a room to replay</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rooms.map((room) => (
            <Link key={room.id} href={`/admin/competitions/${competitionId}/replay?room=${room.id}`}>
              <Card className="rounded-2xl p-4 flex flex-col gap-2 hover:border-accent/40 transition-colors cursor-pointer">
                <span className="text-[14px] font-bold text-ink">{room.name}</span>
                <span className="text-[11.5px] text-mute-2">
                  {room.roomCode} · {room.status} · {room.teamCount} teams
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const room = await getRoomById(selectedRoomId, user.id);
  if (!room) notFound();

  const [teams, rounds, questions, scenes, cards, events, scoreHistory, coinHistory, auctions] = await Promise.all([
    getTeamsByRoom(selectedRoomId),
    getSelectedRoundsForRoom(room.selectedRounds),
    getQuestionsForRoomRounds(room.selectedRounds),
    getScenesByRoom(selectedRoomId),
    getPowerCardsByOwner(user.id),
    getReplayEvents(selectedRoomId),
    getReplayScoreHistory(selectedRoomId),
    getReplayCoinHistory(selectedRoomId),
    getReplayAuctions(selectedRoomId),
  ]);

  const otherRooms = rooms.filter((r) => r.id !== selectedRoomId).map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="flex flex-col gap-4">
      <Header competitionTitle={competition.title} competitionId={competitionId} />
      <ReplayShell
        room={room}
        teams={teams}
        rounds={rounds}
        questions={questions}
        cards={cards}
        data={{ events, scoreHistory, coinHistory, auctions, scenes }}
        otherRooms={otherRooms}
      />
    </div>
  );
}

function Header({ competitionTitle, competitionId }: { competitionTitle: string; competitionId: string }) {
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-mute-2 flex-wrap">
      <Link href={`/admin/competitions/${competitionId}`} className="hover:text-ink-2">
        {competitionTitle}
      </Link>
      <span className="text-faint">/</span>
      <span className="text-ink-2 font-medium">Replay</span>
    </div>
  );
}
