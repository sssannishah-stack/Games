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

export default async function HostRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const user = await requireUser();
  const room = await getRoomById(roomId, user.id);
  if (!room) notFound();

  const [scenes, rounds, questions, teams, logs, powerRequests, scoreHistory, cards, participants, achievements, auction] =
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
      getActiveAuction(roomId),
    ]);
  // Starter/default cards are ensured once at team creation and on Reset
  // Room (see team.actions.ts / room.actions.ts) — re-running that
  // find+bulkWrite here on every render (i.e. every button click, since
  // router.refresh() re-executes this whole page) was pure redundant work.
  const ownedCards = await getTeamPowerCardsByRoom(teams.map((team) => team.id));

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
