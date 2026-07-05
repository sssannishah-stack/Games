import { requireUser } from "@/lib/auth/getCurrentUser";
import { getQuestionsByOwner } from "@/data/queries/question.queries";
import { getRoundsByOwner, getUsedQuestionIdSet } from "@/data/queries/round.queries";
import { QuestionBankBoard } from "@/components/question/QuestionBankBoard";

export default async function AdminQuestionsPage() {
  const user = await requireUser();
  const [questions, rounds, usedIds] = await Promise.all([
    getQuestionsByOwner(user.id),
    getRoundsByOwner(user.id),
    getUsedQuestionIdSet(user.id),
  ]);

  return <QuestionBankBoard questions={questions} rounds={rounds} usedQuestionIds={[...usedIds]} />;
}
