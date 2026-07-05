import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { countRoomsUsingRound, getRoundById, getRoundsByOwner } from "@/data/queries/round.queries";
import { getQuestionsByRoundId, getQuestionsByOwner } from "@/data/queries/question.queries";
import { getPowerCardsByOwner } from "@/data/queries/powerCard.queries";
import { seedDefaultPowerCards } from "@/actions/powerCard.actions";
import { RoundBuilder } from "@/components/round/RoundBuilder";

export default async function AdminRoundBuilderPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
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

  return (
    <RoundBuilder
      round={round}
      questions={questions}
      libraryQuestions={libraryQuestions}
      powerCards={powerCards}
      allRounds={allRounds}
      roomUsageCount={roomUsageCount}
    />
  );
}
