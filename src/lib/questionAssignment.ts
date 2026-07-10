import type { QuestionAssignmentMode } from "@/types/db";

export type EffectiveQuestionAssignmentMode = Exclude<QuestionAssignmentMode, "DEFAULT">;

export interface QuestionTeamAssignment {
  questionId: string;
  teamId: string;
  source: "FIXED" | "RANDOM" | "RANDOM_REMAINDER";
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

/**
 * FIXED_ORDER uses complete team cycles. Leftover questions use a shuffled
 * bag, so 10 questions and 4 teams is two fixed cycles plus two random teams.
 * RANDOM_TEAM uses shuffled bags throughout to stay random and balanced.
 */
export function buildQuestionTeamAssignments(
  questionIds: string[],
  teamIds: string[],
  mode: EffectiveQuestionAssignmentMode,
  random: () => number = Math.random
): QuestionTeamAssignment[] {
  if (questionIds.length === 0 || teamIds.length === 0) return [];
  if (mode === "ANY_TEAM" || mode === "HOST_CHOOSES") return [];

  if (mode === "FIXED_ORDER") {
    const completeCycleCount = Math.floor(questionIds.length / teamIds.length) * teamIds.length;
    const assignments: QuestionTeamAssignment[] = questionIds.slice(0, completeCycleCount).map((questionId, index) => ({
      questionId,
      teamId: teamIds[index % teamIds.length],
      source: "FIXED" as const,
    }));
    const remainderTeams = shuffled(teamIds, random);
    questionIds.slice(completeCycleCount).forEach((questionId, index) => {
      assignments.push({ questionId, teamId: remainderTeams[index], source: "RANDOM_REMAINDER" });
    });
    return assignments;
  }

  const assignments: QuestionTeamAssignment[] = [];
  for (let offset = 0; offset < questionIds.length; offset += teamIds.length) {
    const bag = shuffled(teamIds, random);
    questionIds.slice(offset, offset + teamIds.length).forEach((questionId, index) => {
      assignments.push({ questionId, teamId: bag[index], source: "RANDOM" });
    });
  }
  return assignments;
}
