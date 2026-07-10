import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { countRoomsUsingRound, getRoundById, getRoundsByOwner } from "@/data/queries/round.queries";
import { getQuestionsByRoundId, getQuestionsByOwner } from "@/data/queries/question.queries";
import { getPowerCardsByOwner } from "@/data/queries/powerCard.queries";
import { getTeamsByRoom } from "@/data/queries/team.queries";
import { assertRoomOwnership } from "@/lib/authz";
import { seedDefaultPowerCards } from "@/actions/powerCard.actions";
import { RoundBuilder } from "@/components/round/RoundBuilder";

export default async function AdminRoundBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ roundId: string }>;
  searchParams: Promise<{ roomId?: string }>;
}) {
  const { roundId } = await params;
  const { roomId } = await searchParams;
  const user = await requireUser();
  const round = await getRoundById(roundId, user.id);
  if (!round) notFound();

  await seedDefaultPowerCards();
  const [questions, libraryQuestions, powerCards, allRounds, roomUsageCount] = await Promise.all([
    getQuestionsByRoundId(roundId),
    getQuestionsByOwner(user.id),
    getPowerCardsByOwner(user.id),
    getRoundsByOwner(user.id),
    countRoomsUsingRound(roundId),
  ]);

  // If opened from a specific room (RoundPicker's Edit link carries ?roomId=),
  // use that room's real teams for the assignment preview instead of a
  // generic team-count guess — this is the room the round will actually run
  // in, so the preview should match exactly what will happen there.
  let roomTeams: { id: string; name: string }[] | undefined;
  if (roomId) {
    try {
      await assertRoomOwnership(roomId, user.id);
      const teams = await getTeamsByRoom(roomId);
      roomTeams = teams.map((team) => ({ id: team.id, name: team.name }));
    } catch {
      roomTeams = undefined;
    }
  }

  return (
    <RoundBuilder
      round={round}
      questions={questions}
      libraryQuestions={libraryQuestions}
      powerCards={powerCards}
      allRounds={allRounds}
      roomUsageCount={roomUsageCount}
      roomTeams={roomTeams}
    />
  );
}
