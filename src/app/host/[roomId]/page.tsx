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
import { getAchievementsByRoom } from "@/data/queries/achievement.queries";
import { getActiveAuction } from "@/data/queries/auction.queries";
import { ensureRoomDefaultPowerCardsForTeams } from "@/lib/starterPowerCards";

export default async function HostRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const user = await requireUser();
  const room = await getRoomById(roomId, user.id);
  if (!room) notFound();

  const [scenes, rounds, questions, teams, logs, powerRequests, scoreHistory, cards, participants, achievements] =
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
      getAchievementsByRoom(roomId),
    ]);
  const [ownedCards, auction] = await Promise.all([
    ensureRoomDefaultPowerCardsForTeams(teams.map((team) => team.id), room.id, user.id).then(() =>
      getTeamPowerCardsByRoom(teams.map((team) => team.id))
    ),
    getActiveAuction(roomId),
  ]);

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
      achievements={achievements}
      auction={auction}
    />
  );
}
