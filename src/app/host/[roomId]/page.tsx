import { notFound } from "next/navigation";
import { HostConsole } from "@/components/host/HostConsole";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { getRoomById } from "@/data/queries/room.queries";
import { getScenesByRoom } from "@/data/queries/scene.queries";
import { getSelectedRoundsForRoom } from "@/data/queries/round.queries";
import { getQuestionsForRoomRounds } from "@/data/queries/question.queries";
import { getTeamsByRoom } from "@/data/queries/team.queries";
import { getEventLogsByRoom } from "@/data/queries/eventLog.queries";
import {
  getPowerCardRequestsByRoom,
  getPowerCardsByOwner,
  getTeamPowerCardsByRoom,
} from "@/data/queries/powerCard.queries";
import { getScoreHistoryByRoom } from "@/data/queries/score.queries";
import { getParticipantsByRoom } from "@/data/queries/participant.queries";

export default async function HostRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const user = await requireUser();
  const room = await getRoomById(roomId, user.id);
  if (!room) notFound();

  const [scenes, rounds, questions, teams, logs, powerRequests, scoreHistory, cards, participants] =
    await Promise.all([
      getScenesByRoom(roomId),
      getSelectedRoundsForRoom(room.selectedRounds),
      getQuestionsForRoomRounds(room.selectedRounds),
      getTeamsByRoom(roomId),
      getEventLogsByRoom(roomId),
      getPowerCardRequestsByRoom(roomId),
      getScoreHistoryByRoom(roomId),
      getPowerCardsByOwner(user.id),
      getParticipantsByRoom(roomId),
    ]);
  const ownedCards = await getTeamPowerCardsByRoom(teams.map((t) => t.id));

  return (
    <HostConsole
      room={room}
      scenes={scenes}
      rounds={rounds}
      questions={questions}
      teams={teams}
      logs={logs}
      powerRequests={powerRequests}
      scoreHistory={scoreHistory}
      cards={cards}
      ownedCards={ownedCards}
      participants={participants}
    />
  );
}
