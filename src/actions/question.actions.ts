"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { Question, Round, Scene } from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertQuestionOwnership } from "@/lib/authz";
import { addQuestionsToRound } from "@/actions/round.actions";
import {
  createQuestionSchema,
  updateQuestionSchema,
  type CreateQuestionInput,
  type UpdateQuestionInput,
} from "@/validators/question.validator";

function refreshQuestionPaths() {
  revalidatePath("/admin/questions");
}

export type CreateQuestionArgs = CreateQuestionInput & { attachToRoundIds?: string[] };

/** Create a reusable question in the host's library. Optionally attach it to one or more existing rounds. */
export async function createQuestion(input: CreateQuestionArgs): Promise<{ id: string }> {
  const user = await requireUser();
  const { attachToRoundIds, ...rest } = input;
  const data = createQuestionSchema.parse(rest);

  await connectToDatabase();
  const question = await Question.create({ ownerId: user.id, ...data });

  if (attachToRoundIds && attachToRoundIds.length > 0) {
    await Promise.all(
      attachToRoundIds.map((roundId) => addQuestionsToRound(roundId, [question._id.toString()]))
    );
  }

  refreshQuestionPaths();
  return { id: question._id.toString() };
}

export async function updateQuestion(questionId: string, input: UpdateQuestionInput): Promise<void> {
  const user = await requireUser();
  await assertQuestionOwnership(questionId, user.id);
  const data = updateQuestionSchema.parse(input);

  // `updateQuestionSchema` is `baseQuestionSchema.partial()` — for any field
  // that also has a `.default()` (question, tags, hints, difficulty,
  // scoringMode, timerMode, timer, ...), Zod reintroduces that default when
  // the key is simply absent from `input`, not just when the caller sends
  // `undefined`. Blindly `$set`-ing the full parsed object would silently
  // reset every field the caller never touched — only write the keys the
  // caller actually provided.
  const providedKeys = Object.keys(input) as (keyof typeof data)[];
  const patch: Record<string, unknown> = {};
  for (const key of providedKeys) {
    if (key in data) patch[key] = data[key];
  }

  await connectToDatabase();
  await Question.findByIdAndUpdate(questionId, { $set: patch });

  refreshQuestionPaths();
}

/** Duplicates a question as a fresh, standalone library item — not auto-attached to any round. */
export async function duplicateQuestion(questionId: string): Promise<{ id: string }> {
  const user = await requireUser();
  const source = await assertQuestionOwnership(questionId, user.id);
  await connectToDatabase();

  const copy = await Question.create({
    ownerId: user.id,
    type: source.type,
    question: `${source.question} Copy`,
    mediaUrl: source.mediaUrl,
    media: source.media,
    isMCQ: source.isMCQ,
    options: source.options,
    optionRationales: source.optionRationales ?? [],
    answer: source.answer,
    explanation: source.explanation,
    hints: source.hints,
    hostNotes: source.hostNotes,
    scoringMode: source.scoringMode,
    timerMode: source.timerMode,
    timer: source.timer,
    positiveMarks: source.positiveMarks,
    negativeMarks: source.negativeMarks,
    bonusMarks: source.bonusMarks,
    coinReward: source.coinReward,
    difficulty: source.difficulty,
    tags: source.tags ?? [],
    groupName: source.groupName ?? null,
  });

  refreshQuestionPaths();
  return { id: copy._id.toString() };
}

/** Deletes a question from the library, detaching it from every round and clearing any scene that pointed at it. */
export async function deleteQuestion(questionId: string): Promise<void> {
  const user = await requireUser();
  await assertQuestionOwnership(questionId, user.id);

  await connectToDatabase();
  await Question.findByIdAndDelete(questionId);
  await Round.updateMany({ questions: questionId }, { $pull: { questions: questionId } });
  await Scene.updateMany({ questionId }, { $set: { questionId: null } });

  refreshQuestionPaths();
}

/** The Question Bank list's "Add to Round" row action — attaches an existing question to one or more rounds. */
export async function attachQuestionToRounds(questionId: string, roundIds: string[]): Promise<void> {
  const user = await requireUser();
  await assertQuestionOwnership(questionId, user.id);

  await Promise.all(roundIds.map((roundId) => addQuestionsToRound(roundId, [questionId])));
  refreshQuestionPaths();
}

/* ─────────────── bulk library operations ─────────────── */

/** Scope an id list to the ones this host actually owns (defense against a
 *  spoofed list, and skips ids already deleted elsewhere). */
async function ownedQuestionIds(questionIds: string[], ownerId: string): Promise<string[]> {
  const owned = await Question.find({ _id: { $in: questionIds }, ownerId }).select("_id").lean();
  return owned.map((q) => q._id.toString());
}

/** Move many questions into a group at once (null = back to General). Purely
 *  organizational — never touches any other field (see the partial-update bug
 *  history in updateQuestion). */
export async function setQuestionsGroup(questionIds: string[], groupName: string | null): Promise<void> {
  const user = await requireUser();
  await connectToDatabase();
  const ids = await ownedQuestionIds(questionIds, user.id);
  if (ids.length === 0) return;
  const name = groupName?.trim() || null;
  await Question.updateMany({ _id: { $in: ids } }, { $set: { groupName: name } });
  refreshQuestionPaths();
}

/** Set the difficulty on many questions at once. */
export async function setQuestionsDifficulty(
  questionIds: string[],
  difficulty: "EASY" | "MEDIUM" | "HARD"
): Promise<void> {
  const user = await requireUser();
  if (!["EASY", "MEDIUM", "HARD"].includes(difficulty)) throw new Error("Invalid difficulty.");
  await connectToDatabase();
  const ids = await ownedQuestionIds(questionIds, user.id);
  if (ids.length === 0) return;
  await Question.updateMany({ _id: { $in: ids } }, { $set: { difficulty } });
  refreshQuestionPaths();
}

/** Delete many questions, detaching each from every round and scene. */
export async function deleteQuestions(questionIds: string[]): Promise<void> {
  const user = await requireUser();
  await connectToDatabase();
  const ids = await ownedQuestionIds(questionIds, user.id);
  if (ids.length === 0) return;
  await Question.deleteMany({ _id: { $in: ids } });
  await Round.updateMany({ questions: { $in: ids } }, { $pull: { questions: { $in: ids } } });
  await Scene.updateMany({ questionId: { $in: ids } }, { $set: { questionId: null } });
  refreshQuestionPaths();
}

/** Attach many existing questions to one round in a single call. */
export async function addQuestionsToRoundBulk(roundId: string, questionIds: string[]): Promise<void> {
  await requireUser();
  await addQuestionsToRound(roundId, questionIds);
  refreshQuestionPaths();
}

/* ─────────────── JSON import ─────────────── */

/** One imported question, normalized from the flexible input shape. */
type NormalizedImport = {
  question: string;
  options: string[];
  optionRationales: string[];
  answer: string;
  hints: { text: string; penalty: number }[];
  difficulty: "EASY" | "MEDIUM" | "HARD";
  isMCQ: boolean;
};

/**
 * Normalize one loosely-typed question object (from pasted/uploaded JSON) into
 * our shape. Supports the common export forms:
 *  - options as plain strings, or objects { text, isCorrect?, rationale?, label? }
 *  - correct answer via an option's isCorrect, a `correctAnswer` label (A/B/…)
 *    or index, or a top-level `answer`/`correctAnswer` string
 *  - `hint` (single) or `hints` (array of strings or { text, penalty })
 * Throws a descriptive error (with the question number) if it can't find a
 * usable question text + answer, so the importer can report exactly which row
 * failed instead of silently dropping it.
 */
function normalizeImportedQuestion(raw: unknown, index: number): NormalizedImport {
  const where = `Question ${index + 1}`;
  if (!raw || typeof raw !== "object") throw new Error(`${where}: not an object.`);
  const q = raw as Record<string, unknown>;

  const text = String(q.question ?? q.text ?? q.questionText ?? "").trim();
  if (!text) throw new Error(`${where}: missing "question" text.`);

  const rawOptions = Array.isArray(q.options) ? q.options : [];
  const options: string[] = [];
  const optionRationales: string[] = [];
  let correctFromFlag: string | null = null;
  rawOptions.forEach((opt) => {
    if (opt && typeof opt === "object") {
      const o = opt as Record<string, unknown>;
      const optText = String(o.text ?? o.option ?? o.label ?? "").trim();
      options.push(optText);
      optionRationales.push(String(o.rationale ?? o.explanation ?? "").trim());
      if (o.isCorrect === true && optText) correctFromFlag = optText;
    } else {
      options.push(String(opt ?? "").trim());
      optionRationales.push("");
    }
  });
  const cleanOptions = options.filter(Boolean);
  const isMCQ = cleanOptions.length >= 2;

  // Resolve the answer text.
  let answer = String(q.answer ?? "").trim();
  if (!answer && correctFromFlag) answer = correctFromFlag;
  if (!answer && q.correctAnswer != null) {
    const ca = q.correctAnswer;
    if (typeof ca === "number" && options[ca]) {
      answer = options[ca].trim();
    } else {
      const caStr = String(ca).trim();
      // A single letter/number label like "A"/"B" or "1" maps to an option by
      // position; otherwise treat it as the literal answer text.
      const letterIdx = /^[A-Za-z]$/.test(caStr) ? caStr.toUpperCase().charCodeAt(0) - 65 : -1;
      const numIdx = /^\d+$/.test(caStr) ? Number(caStr) - 1 : -1;
      if (letterIdx >= 0 && options[letterIdx]) answer = options[letterIdx].trim();
      else if (numIdx >= 0 && options[numIdx]) answer = options[numIdx].trim();
      else answer = caStr;
    }
  }
  if (!answer) throw new Error(`${where}: could not determine the correct answer.`);

  // Hints: `hints` array (strings or objects) or a single `hint`.
  const hints: { text: string; penalty: number }[] = [];
  const pushHint = (h: unknown) => {
    if (h && typeof h === "object") {
      const ho = h as Record<string, unknown>;
      const t = String(ho.text ?? "").trim();
      if (t) hints.push({ text: t, penalty: Number(ho.penalty ?? 0) || 0 });
    } else {
      const t = String(h ?? "").trim();
      if (t) hints.push({ text: t, penalty: 0 });
    }
  };
  if (Array.isArray(q.hints)) q.hints.forEach(pushHint);
  else if (q.hint) pushHint(q.hint);

  const rawDiff = String(q.difficulty ?? "").toUpperCase();
  const difficulty = rawDiff === "EASY" || rawDiff === "HARD" ? rawDiff : "MEDIUM";

  return {
    question: text,
    options: isMCQ ? cleanOptions : [],
    optionRationales: isMCQ ? optionRationales.slice(0, cleanOptions.length) : [],
    answer,
    hints,
    difficulty,
    isMCQ,
  };
}

export interface ImportQuestionsInput {
  /** Group to import into; null/"" imports into General. */
  groupName: string | null;
  /** The parsed `questions` array (or a bare array) from the pasted JSON. */
  questions: unknown[];
}

/**
 * Bulk-create library questions from pasted/uploaded JSON, all into one group,
 * unattached to any round. Every row is validated through the same
 * createQuestionSchema the manual editor uses, so imported questions are
 * indistinguishable from hand-made ones. Returns how many imported and any
 * per-row errors (nothing is written unless all rows normalize cleanly, so a
 * bad paste never leaves a half-import behind).
 */
export async function importQuestions(
  input: ImportQuestionsInput
): Promise<{ imported: number }> {
  const user = await requireUser();
  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    throw new Error("No questions found to import.");
  }
  if (input.questions.length > 500) throw new Error("Import is limited to 500 questions at a time.");

  const groupName = input.groupName?.trim() || null;

  // Normalize + validate every row first; abort the whole import on the first
  // bad row so a paste is all-or-nothing.
  const docs = input.questions.map((raw, i) => {
    const n = normalizeImportedQuestion(raw, i);
    const parsed = createQuestionSchema.parse({
      type: "TEXT",
      question: n.question,
      isMCQ: n.isMCQ,
      options: n.options,
      optionRationales: n.optionRationales,
      answer: n.answer,
      hints: n.hints,
      difficulty: n.difficulty,
      groupName,
    });
    return { ownerId: user.id, ...parsed };
  });

  await connectToDatabase();
  await Question.insertMany(docs);
  refreshQuestionPaths();
  return { imported: docs.length };
}
