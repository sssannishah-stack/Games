"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { QuestionEditorModal, QuestionTypeBadge } from "@/components/question/QuestionEditorModal";
import { AddToRoundModal } from "@/components/question/AddToRoundModal";
import { AddExistingToGroupModal } from "@/components/question/AddExistingToGroupModal";
import { QuestionPickerModal } from "@/components/question/QuestionPickerModal";
import { deleteQuestion, duplicateQuestion } from "@/actions/question.actions";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { QuestionRecord } from "@/data/queries/question.queries";
import { QUESTION_TYPES, type QuestionDifficulty } from "@/types/db";

const DIFFICULTIES: QuestionDifficulty[] = ["EASY", "MEDIUM", "HARD"];

interface QuestionBankBoardProps {
  questions: QuestionRecord[];
  rounds: RoundRecord[];
  usedQuestionIds: string[];
}

export function QuestionBankBoard({ questions, rounds, usedQuestionIds }: QuestionBankBoardProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState("ALL");
  const [tagFilter, setTagFilter] = useState("ALL");
  const [usageFilter, setUsageFilter] = useState<"ALL" | "USED" | "UNUSED">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionRecord | null>(null);
  const [addingToRound, setAddingToRound] = useState<QuestionRecord | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // "All Questions" is the flat library; "By Group" / "By Round" each show
  // tiles first, and opening a tile filters down to just that tile's questions.
  const [viewMode, setViewMode] = useState<"ALL" | "GROUPS" | "ROUNDS">("ALL");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [openRound, setOpenRound] = useState<string | null>(null);
  const [addExistingToRoundOpen, setAddExistingToRoundOpen] = useState(false);

  const usedSet = new Set(usedQuestionIds);
  const tags = [...new Set(questions.flatMap((question) => question.tags ?? []))].sort();
  const existingGroups = [...new Set(questions.map((q) => q.groupName).filter((g): g is string => Boolean(g)))].sort();
  const GENERAL_GROUP = "General";
  const groupCounts = new Map<string, number>();
  for (const question of questions) {
    const key = question.groupName ?? GENERAL_GROUP;
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
  }
  const groupTiles = [...groupCounts.entries()].sort((a, b) =>
    a[0] === GENERAL_GROUP ? 1 : b[0] === GENERAL_GROUP ? -1 : a[0].localeCompare(b[0])
  );
  // The pool "Existing Question" draws from — General questions only, since
  // that's what "not yet selected in any group" means.
  const generalQuestions = questions.filter((q) => !q.groupName);
  const roundsByQuestion = new Map<string, RoundRecord[]>();
  for (const round of rounds) {
    for (const questionId of round.questionIds) {
      const list = roundsByQuestion.get(questionId) ?? [];
      list.push(round);
      roundsByQuestion.set(questionId, list);
    }
  }
  // "By Round" tiles: one per round (in library order), plus an Unassigned
  // bucket for questions not attached to any round yet. Unlike a group, a
  // question can belong to several rounds at once, so it can appear under
  // more than one round tile — same as the card's existing "In N rounds" tag.
  const UNASSIGNED_ROUND = "__UNASSIGNED__";
  const roundTiles: { id: string; title: string; count: number }[] = rounds.map((round) => ({
    id: round.id,
    title: round.title,
    count: questions.filter((q) => (roundsByQuestion.get(q.id) ?? []).some((r) => r.id === round.id)).length,
  }));
  const unassignedCount = questions.filter((q) => (roundsByQuestion.get(q.id)?.length ?? 0) === 0).length;
  if (unassignedCount > 0) {
    roundTiles.push({ id: UNASSIGNED_ROUND, title: "Unassigned", count: unassignedCount });
  }
  const openRoundRecord = openRound ? rounds.find((r) => r.id === openRound) ?? null : null;

  const filtered = questions.filter((question) => {
    const text = `${question.question} ${question.answer}`.toLowerCase();
    const isUsed = usedSet.has(question.id);
    const groupKey = question.groupName ?? GENERAL_GROUP;
    const inOpenRound =
      viewMode !== "ROUNDS" || openRound === null
        ? true
        : openRound === UNASSIGNED_ROUND
          ? (roundsByQuestion.get(question.id)?.length ?? 0) === 0
          : (roundsByQuestion.get(question.id) ?? []).some((r) => r.id === openRound);
    return (
      text.includes(query.toLowerCase()) &&
      (typeFilter === "ALL" || question.type === typeFilter) &&
      (difficultyFilter === "ALL" || question.difficulty === difficultyFilter) &&
      (tagFilter === "ALL" || (question.tags ?? []).includes(tagFilter)) &&
      (usageFilter === "ALL" || (usageFilter === "USED" ? isUsed : !isUsed)) &&
      (viewMode !== "GROUPS" || openGroup === null || groupKey === openGroup) &&
      inOpenRound
    );
  });
  // Whether the search/filter bar + question grid should render at all: on
  // the flat All Questions tab, or once a group/round tile has been opened.
  const showList = viewMode === "ALL" || (viewMode === "GROUPS" && openGroup !== null) || (viewMode === "ROUNDS" && openRound !== null);

  function remove(question: QuestionRecord) {
    startTransition(async () => {
      await deleteQuestion(question.id);
      router.refresh();
    });
  }

  function duplicate(question: QuestionRecord) {
    startTransition(async () => {
      await duplicateQuestion(question.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[22px] font-bold text-ink-2 tracking-[-.02em]">Question Bank</span>
          <span className="text-[13px] text-mute-2">Create reusable questions once — attach them to any round.</span>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={14} />
          Create Question
        </Button>
      </div>

      {/* All Questions (flat, everything) vs By Group (tiles first, then
          that group's questions) — a pure view toggle, no filtering logic
          duplicated elsewhere. */}
      <div className="flex items-center gap-1 rounded-xl border border-line/[.09] bg-line/[.03] p-1 w-fit">
        <button
          onClick={() => {
            setViewMode("ALL");
            setOpenGroup(null);
            setOpenRound(null);
          }}
          className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold cursor-pointer transition ${
            viewMode === "ALL" ? "bg-accent text-white" : "text-mute-2 hover:text-ink-3"
          }`}
        >
          All Questions · {questions.length}
        </button>
        <button
          onClick={() => {
            setViewMode("GROUPS");
            setOpenRound(null);
          }}
          className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold cursor-pointer transition ${
            viewMode === "GROUPS" ? "bg-accent text-white" : "text-mute-2 hover:text-ink-3"
          }`}
        >
          By Group · {groupTiles.length}
        </button>
        <button
          onClick={() => {
            setViewMode("ROUNDS");
            setOpenGroup(null);
          }}
          className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold cursor-pointer transition ${
            viewMode === "ROUNDS" ? "bg-accent text-white" : "text-mute-2 hover:text-ink-3"
          }`}
        >
          By Round · {roundTiles.length}
        </button>
      </div>

      {viewMode === "GROUPS" && (
        openGroup === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {groupTiles.map(([name, count]) => (
              <button
                key={name}
                onClick={() => setOpenGroup(name)}
                className="flex flex-col items-start gap-1.5 rounded-2xl border border-line/[.09] bg-line/[.03] p-4 text-left hover:border-accent/50 hover:bg-accent/[.05] cursor-pointer transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
                  <Icon name={name === GENERAL_GROUP ? "inbox" : "folder"} size={16} />
                </div>
                <span className="text-[13.5px] font-bold text-ink-2 truncate w-full">{name}</span>
                <span className="text-[11px] text-mute-2">{count} question{count === 1 ? "" : "s"}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setOpenGroup(null)}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-accent hover:brightness-125 cursor-pointer w-fit"
            >
              <Icon name="chevron-left" size={14} />
              All Groups
              <span className="text-mute-2 font-normal">
                / {openGroup} · {filtered.length} question{filtered.length === 1 ? "" : "s"}
              </span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="subtle" size="sm" onClick={() => setCreateOpen(true)}>
                <Icon name="plus" size={13} />
                New Question
              </Button>
              {/* Adding an "existing" question only makes sense for a named
                  group — General's own pool is itself. */}
              {openGroup !== GENERAL_GROUP && (
                <Button variant="subtle" size="sm" onClick={() => setAddExistingOpen(true)}>
                  <Icon name="folder-input" size={13} />
                  Existing Question
                </Button>
              )}
            </div>
          </div>
        )
      )}

      {viewMode === "ROUNDS" && (
        openRound === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {roundTiles.map((tile) => (
              <button
                key={tile.id}
                onClick={() => setOpenRound(tile.id)}
                className="flex flex-col items-start gap-1.5 rounded-2xl border border-line/[.09] bg-line/[.03] p-4 text-left hover:border-accent/50 hover:bg-accent/[.05] cursor-pointer transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
                  <Icon name={tile.id === UNASSIGNED_ROUND ? "inbox" : "list-video"} size={16} />
                </div>
                <span className="text-[13.5px] font-bold text-ink-2 truncate w-full">{tile.title}</span>
                <span className="text-[11px] text-mute-2">{tile.count} question{tile.count === 1 ? "" : "s"}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setOpenRound(null)}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-accent hover:brightness-125 cursor-pointer w-fit"
            >
              <Icon name="chevron-left" size={14} />
              All Rounds
              <span className="text-mute-2 font-normal">
                / {openRoundRecord?.title ?? "Unassigned"} · {filtered.length} question{filtered.length === 1 ? "" : "s"}
              </span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="subtle" size="sm" onClick={() => setCreateOpen(true)}>
                <Icon name="plus" size={13} />
                New Question
              </Button>
              {/* Adding an "existing" question only makes sense for a real
                  round — Unassigned has no round to add it into. */}
              {openRound !== UNASSIGNED_ROUND && (
                <Button variant="subtle" size="sm" onClick={() => setAddExistingToRoundOpen(true)}>
                  <Icon name="folder-input" size={13} />
                  Existing Question
                </Button>
              )}
            </div>
          </div>
        )
      )}

      {showList && (
      <>
      <Card className="rounded-2xl p-4 grid grid-cols-1 md:grid-cols-5 gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-3 py-2 text-sm text-ink outline-none"
        />
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-2 py-2 text-sm text-ink outline-none">
          <option value="ALL" className="bg-surface">All types</option>
          {QUESTION_TYPES.map((type) => (
            <option key={type} value={type} className="bg-surface">
              {type.replace(/_/g, " + ")}
            </option>
          ))}
        </select>
        <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)} className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-2 py-2 text-sm text-ink outline-none">
          <option value="ALL" className="bg-surface">All difficulty</option>
          {DIFFICULTIES.map((difficulty) => (
            <option key={difficulty} value={difficulty} className="bg-surface">
              {difficulty}
            </option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
          className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-2 py-2 text-sm text-ink outline-none"
        >
          <option value="ALL" className="bg-surface">All tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag} className="bg-surface">
              {tag}
            </option>
          ))}
        </select>
        <select
          value={usageFilter}
          onChange={(event) => setUsageFilter(event.target.value as "ALL" | "USED" | "UNUSED")}
          className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-2 py-2 text-sm text-ink outline-none"
        >
          <option value="ALL" className="bg-surface">Used + Unused</option>
          <option value="USED" className="bg-surface">Used only</option>
          <option value="UNUSED" className="bg-surface">Unused only</option>
        </select>
      </Card>

      {filtered.length === 0 ? (
        <Card className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-14 h-14 rounded-[18px] bg-accent/10 border border-dashed border-accent/45 flex items-center justify-center">
            <Icon name="help-circle" size={24} className="text-accent" />
          </div>
          <span className="text-[15px] font-bold text-ink">
            {questions.length === 0 ? "No questions yet" : "No questions match your filters"}
          </span>
          {questions.length === 0 && (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              Create First Question
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((question) => {
            const inRounds = roundsByQuestion.get(question.id) ?? [];
            return (
              <Card key={question.id} className="rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <QuestionTypeBadge type={question.type} />
                  <span className="text-[11px] text-dim">{question.difficulty}</span>
                  {question.isMCQ && (
                    <span className="text-[10.5px] font-semibold text-accent bg-accent/10 border border-accent/25 rounded-full px-2 py-0.5">
                      MCQ
                    </span>
                  )}
                  <span
                    className={`ml-auto text-[10.5px] font-semibold rounded-full px-2 py-0.5 ${
                      inRounds.length > 0
                        ? "text-success bg-success/10 border border-success/25"
                        : "text-mute-2 bg-line/[.05] border border-line/[.08]"
                    }`}
                  >
                    {inRounds.length > 0 ? `In ${inRounds.length} round${inRounds.length > 1 ? "s" : ""}` : "Unused"}
                  </span>
                </div>
                <span className="text-[14px] font-semibold text-ink-2">
                  {question.question || question.media?.name || "Untitled"}
                </span>
                <span className="text-[11.5px] text-mute-2">
                  Answer: {question.answer} - {question.hints.length} hints - {question.timer}s
                </span>
                {(question.groupName || question.tags.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {question.groupName && (
                      <span className="flex items-center gap-1 rounded-full border border-accent/25 bg-accent/[.08] px-2 py-0.5 text-[10.5px] font-semibold text-accent">
                        <Icon name="folder" size={10} />
                        {question.groupName}
                      </span>
                    )}
                    {question.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-line/[.08] bg-line/[.04] px-2 py-0.5 text-[10.5px] text-mute-2">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="subtle" size="sm" onClick={() => setEditingQuestion(question)}>
                    Edit
                  </Button>
                  <Button variant="subtle" size="sm" onClick={() => duplicate(question)} disabled={pending}>
                    Duplicate
                  </Button>
                  <Button variant="subtle" size="sm" onClick={() => setAddingToRound(question)}>
                    Add to Round
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => remove(question)} disabled={pending}>
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      </>
      )}

      <QuestionEditorModal
        // Remounts on every open (the key flips false<->true) so a fresh
        // instance always picks up the *current* default group/round instead
        // of whatever was true the first time this modal ever mounted, and so
        // leftover field values from a previous create don't linger.
        key={createOpen ? "create-open" : "create-closed"}
        rounds={rounds}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        existingGroups={existingGroups}
        defaultGroupName={viewMode === "GROUPS" && openGroup && openGroup !== GENERAL_GROUP ? openGroup : null}
        defaultAttachRoundIds={viewMode === "ROUNDS" && openRound && openRound !== UNASSIGNED_ROUND ? [openRound] : undefined}
      />
      {editingQuestion && (
        <QuestionEditorModal
          rounds={rounds}
          question={editingQuestion}
          open={editingQuestion !== null}
          onClose={() => setEditingQuestion(null)}
          existingGroups={existingGroups}
          usedContext={
            (roundsByQuestion.get(editingQuestion.id)?.length ?? 0) > 0
              ? `${roundsByQuestion.get(editingQuestion.id)?.length} round${
                  (roundsByQuestion.get(editingQuestion.id)?.length ?? 0) > 1 ? "s" : ""
                }`
              : undefined
          }
        />
      )}
      <AddToRoundModal question={addingToRound} rounds={rounds} onClose={() => setAddingToRound(null)} />
      {openGroup && openGroup !== GENERAL_GROUP && (
        <AddExistingToGroupModal
          groupName={openGroup}
          open={addExistingOpen}
          onClose={() => setAddExistingOpen(false)}
          generalQuestions={generalQuestions}
        />
      )}
      {openRoundRecord && (
        <QuestionPickerModal
          roundId={openRoundRecord.id}
          open={addExistingToRoundOpen}
          onClose={() => setAddExistingToRoundOpen(false)}
          libraryQuestions={questions}
          alreadyInRound={openRoundRecord.questionIds}
          rounds={rounds}
        />
      )}
    </div>
  );
}
