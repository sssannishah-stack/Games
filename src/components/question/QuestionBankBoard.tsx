"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { QuestionEditorModal, QuestionTypeBadge } from "@/components/question/QuestionEditorModal";
import { AddToRoundModal } from "@/components/question/AddToRoundModal";
import { AddExistingToGroupModal } from "@/components/question/AddExistingToGroupModal";
import { QuestionPickerModal } from "@/components/question/QuestionPickerModal";
import { ImportQuestionsModal } from "@/components/question/ImportQuestionsModal";
import { QuestionPreviewModal } from "@/components/question/QuestionPreviewModal";
import {
  deleteQuestion,
  duplicateQuestion,
  setQuestionsGroup,
  setQuestionsDifficulty,
  deleteQuestions,
  addQuestionsToRoundBulk,
} from "@/actions/question.actions";
import { createRoundWithQuestions } from "@/actions/round.actions";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { QuestionRecord } from "@/data/queries/question.queries";
import { QUESTION_TYPES, type QuestionDifficulty } from "@/types/db";

const DIFFICULTIES: QuestionDifficulty[] = ["EASY", "MEDIUM", "HARD"];
const UNASSIGNED_ROUND = "__UNASSIGNED__";

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
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // "All Questions" is the flat library; "By Group" / "By Round" each show
  // tiles first, and opening a tile filters down to just that tile's
  // questions. This lives in the URL (not useState) because every save
  // action calls router.refresh(), and this app's template.tsx intentionally
  // remounts the whole page on every navigation (including refresh) for its
  // page-transition animation — plain component state would reset to
  // defaults on every save, which read as "getting bounced back to All
  // Questions" after adding/editing something.
  const rawView = searchParams.get("view");
  const viewMode: "ALL" | "GROUPS" | "ROUNDS" = rawView === "GROUPS" || rawView === "ROUNDS" ? rawView : "ALL";
  const openGroup = viewMode === "GROUPS" ? searchParams.get("group") : null;
  const openRound = viewMode === "ROUNDS" ? searchParams.get("round") : null;

  const setViewParams = useCallback(
    (next: { view?: "ALL" | "GROUPS" | "ROUNDS"; group?: string | null; round?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      const view = next.view ?? viewMode;
      if (view === "ALL") params.delete("view");
      else params.set("view", view);
      const group = "group" in next ? next.group : openGroup;
      if (group) params.set("group", group);
      else params.delete("group");
      const round = "round" in next ? next.round : openRound;
      if (round) params.set("round", round);
      else params.delete("round");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, viewMode, openGroup, openRound]
  );

  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [addExistingToRoundOpen, setAddExistingToRoundOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupError, setNewGroupError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionRecord | null>(null);

  // Bulk selection: a "Select" mode that adds checkboxes and a sticky action
  // bar, so the host can group/retag/delete many questions in one go.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkGroupChoice, setBulkGroupChoice] = useState("");
  const [makeRoundOpen, setMakeRoundOpen] = useState(false);
  const [makeRoundTitle, setMakeRoundTitle] = useState("");

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

  // Groups only exist as a value on Question.groupName (no separate Group
  // collection, same as tags) — so "creating" one here doesn't write
  // anything by itself. It just opens that (currently empty) group so the
  // host can immediately use New/Existing Question to populate it, which is
  // the moment the group actually starts existing for real.
  function confirmCreateGroup() {
    const name = newGroupName.trim();
    if (!name) return setNewGroupError("Enter a group name.");
    if (name === GENERAL_GROUP || existingGroups.some((g) => g.toLowerCase() === name.toLowerCase())) {
      return setNewGroupError("A group with this name already exists.");
    }
    setCreatingGroup(false);
    setNewGroupName("");
    setNewGroupError(null);
    setViewParams({ group: name });
  }

  // The questions currently shown (respecting search/filters + the open
  // group/round) — the pool bulk-select and "Make Round from group" act on.
  const filteredIds = filtered.map((q) => q.id);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
    setBulkGroupChoice("");
  }
  function runBulk(fn: (ids: string[]) => Promise<void>) {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      await fn(ids);
      exitSelect();
      router.refresh();
    });
  }

  // "Make Round from group" — turn the open group's questions into a new round.
  function confirmMakeRound() {
    const title = makeRoundTitle.trim();
    if (!title || filteredIds.length === 0) return;
    startTransition(async () => {
      const { id } = await createRoundWithQuestions(title, filteredIds);
      setMakeRoundOpen(false);
      setMakeRoundTitle("");
      router.push(`/admin/rounds/${id}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[22px] font-bold text-ink-2 tracking-[-.02em]">Question Bank</span>
          <span className="text-[13px] text-mute-2">Create reusable questions once — attach them to any round.</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="subtle" onClick={() => setImportOpen(true)}>
            <Icon name="upload" size={14} />
            Import
          </Button>
          {questions.length > 0 && (
            <Button variant={selectMode ? "primary" : "subtle"} onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}>
              <Icon name={selectMode ? "x" : "list-checks"} size={14} />
              {selectMode ? "Cancel" : "Select"}
            </Button>
          )}
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Icon name="plus" size={14} />
            Create Question
          </Button>
        </div>
      </div>

      {/* All Questions (flat, everything) vs By Group (tiles first, then
          that group's questions) — a pure view toggle, no filtering logic
          duplicated elsewhere. */}
      <div className="flex items-center gap-1 rounded-xl border border-line/[.09] bg-line/[.03] p-1 w-fit">
        <button
          onClick={() => setViewParams({ view: "ALL", group: null, round: null })}
          className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold cursor-pointer transition ${
            viewMode === "ALL" ? "bg-accent text-white" : "text-mute-2 hover:text-ink-3"
          }`}
        >
          All Questions · {questions.length}
        </button>
        <button
          onClick={() => setViewParams({ view: "GROUPS", round: null })}
          className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold cursor-pointer transition ${
            viewMode === "GROUPS" ? "bg-accent text-white" : "text-mute-2 hover:text-ink-3"
          }`}
        >
          By Group · {groupTiles.length}
        </button>
        <button
          onClick={() => setViewParams({ view: "ROUNDS", group: null })}
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
                onClick={() => setViewParams({ group: name })}
                className="flex flex-col items-start gap-1.5 rounded-2xl border border-line/[.09] bg-line/[.03] p-4 text-left hover:border-accent/50 hover:bg-accent/[.05] cursor-pointer transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
                  <Icon name={name === GENERAL_GROUP ? "inbox" : "folder"} size={16} />
                </div>
                <span className="text-[13.5px] font-bold text-ink-2 truncate w-full">{name}</span>
                <span className="text-[11px] text-mute-2">{count} question{count === 1 ? "" : "s"}</span>
              </button>
            ))}
            {creatingGroup ? (
              <div className="flex flex-col items-start gap-2 rounded-2xl border-[1.5px] border-dashed border-accent/45 bg-accent/[.05] p-4">
                <input
                  autoFocus
                  value={newGroupName}
                  onChange={(event) => {
                    setNewGroupName(event.target.value);
                    setNewGroupError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") confirmCreateGroup();
                    if (event.key === "Escape") {
                      setCreatingGroup(false);
                      setNewGroupName("");
                      setNewGroupError(null);
                    }
                  }}
                  placeholder="Group name"
                  maxLength={60}
                  className="w-full bg-line/[.04] border border-line/[.1] rounded-[10px] px-2.5 py-1.5 text-[13px] text-ink outline-none"
                />
                {newGroupError && <span className="text-[10.5px] text-danger-soft">{newGroupError}</span>}
                <div className="flex items-center gap-1.5 w-full">
                  <Button variant="primary" size="sm" onClick={confirmCreateGroup} className="flex-1 justify-center">
                    Create
                  </Button>
                  <Button
                    variant="plain"
                    size="sm"
                    onClick={() => {
                      setCreatingGroup(false);
                      setNewGroupName("");
                      setNewGroupError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreatingGroup(true)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-line/[.16] bg-line/[.02] p-4 text-mute-2 hover:border-accent hover:text-ink-2 cursor-pointer transition-colors min-h-[104px]"
              >
                <Icon name="plus" size={18} />
                <span className="text-[12.5px] font-bold">New Group</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setViewParams({ group: null })}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-accent hover:brightness-125 cursor-pointer w-fit"
            >
              <Icon name="chevron-left" size={14} />
              All Groups
              <span className="text-mute-2 font-normal">
                / {openGroup} · {filtered.length} question{filtered.length === 1 ? "" : "s"}
              </span>
            </button>
            <div className="ml-auto flex items-center gap-2">
              {/* Turn this whole group into a round in one click. */}
              {filteredIds.length > 0 &&
                (makeRoundOpen ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={makeRoundTitle}
                      onChange={(e) => setMakeRoundTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmMakeRound();
                        if (e.key === "Escape") setMakeRoundOpen(false);
                      }}
                      placeholder="Round title"
                      maxLength={120}
                      className="bg-line/[.04] border border-line/[.1] rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink outline-none w-44"
                    />
                    <Button variant="primary" size="sm" onClick={confirmMakeRound} disabled={pending || !makeRoundTitle.trim()}>
                      Create
                    </Button>
                    <Button variant="plain" size="sm" onClick={() => setMakeRoundOpen(false)} disabled={pending}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => {
                      setMakeRoundTitle(openGroup === GENERAL_GROUP ? "" : openGroup ?? "");
                      setMakeRoundOpen(true);
                    }}
                  >
                    <Icon name="list-video" size={13} />
                    Make Round
                  </Button>
                ))}
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
                onClick={() => setViewParams({ round: tile.id })}
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
              onClick={() => setViewParams({ round: null })}
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
            const isSelected = selected.has(question.id);
            return (
              <Card
                key={question.id}
                onClick={selectMode ? () => toggleSelect(question.id) : undefined}
                className={`rounded-2xl p-4 flex flex-col gap-3 transition ${
                  selectMode ? "cursor-pointer" : ""
                } ${isSelected ? "ring-2 ring-accent border-accent/50" : ""}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {selectMode && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(question.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-accent w-4 h-4 shrink-0"
                    />
                  )}
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
                {!selectMode && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="subtle" size="sm" onClick={() => setPreviewQuestion(question)}>
                      Preview
                    </Button>
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
                )}
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

      <ImportQuestionsModal
        key={importOpen ? "import-open" : "import-closed"}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingGroups={existingGroups}
        defaultGroupName={viewMode === "GROUPS" && openGroup && openGroup !== GENERAL_GROUP ? openGroup : null}
        onImported={(group) => setViewParams({ view: "GROUPS", group: group ?? GENERAL_GROUP })}
      />
      <QuestionPreviewModal question={previewQuestion} onClose={() => setPreviewQuestion(null)} />

      {/* Bulk action bar — appears while selecting; spacer keeps it from
          covering the last card. */}
      {selectMode && (
        <>
          <div className="h-20" aria-hidden />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line/[.1] bg-[rgba(12,13,18,.97)] backdrop-blur px-4 py-3">
            <div className="mx-auto max-w-[1100px] flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-bold text-ink">{selected.size} selected</span>
              <button
                onClick={() => setSelected(new Set(filteredIds))}
                className="text-[12px] font-semibold text-accent hover:brightness-125 cursor-pointer"
              >
                Select all ({filteredIds.length})
              </button>
              <button
                onClick={() => setSelected(new Set())}
                disabled={selected.size === 0}
                className="text-[12px] font-semibold text-mute-2 hover:text-ink-3 cursor-pointer disabled:opacity-40"
              >
                Clear
              </button>

              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <select
                  value={bulkGroupChoice}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBulkGroupChoice("");
                    if (v === "") return;
                    const target = v === "__GENERAL__" ? null : v;
                    runBulk((ids) => setQuestionsGroup(ids, target));
                  }}
                  disabled={pending || selected.size === 0}
                  className="bg-line/[.05] border border-line/[.12] rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none disabled:opacity-40"
                >
                  <option value="" className="bg-surface">Assign group…</option>
                  <option value="__GENERAL__" className="bg-surface">General (no group)</option>
                  {existingGroups.map((g) => (
                    <option key={g} value={g} className="bg-surface">{g}</option>
                  ))}
                </select>

                <select
                  value=""
                  onChange={(e) => {
                    const v = e.target.value as QuestionDifficulty | "";
                    if (!v) return;
                    runBulk((ids) => setQuestionsDifficulty(ids, v));
                  }}
                  disabled={pending || selected.size === 0}
                  className="bg-line/[.05] border border-line/[.12] rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none disabled:opacity-40"
                >
                  <option value="" className="bg-surface">Set difficulty…</option>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d} className="bg-surface">{d}</option>
                  ))}
                </select>

                {rounds.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const roundId = e.target.value;
                      if (!roundId) return;
                      runBulk((ids) => addQuestionsToRoundBulk(roundId, ids));
                    }}
                    disabled={pending || selected.size === 0}
                    className="bg-line/[.05] border border-line/[.12] rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none disabled:opacity-40 max-w-[180px]"
                  >
                    <option value="" className="bg-surface">Add to round…</option>
                    {rounds.map((r) => (
                      <option key={r.id} value={r.id} className="bg-surface">{r.title}</option>
                    ))}
                  </select>
                )}

                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (selected.size === 0) return;
                    if (window.confirm(`Delete ${selected.size} question${selected.size === 1 ? "" : "s"}? This cannot be undone.`)) {
                      runBulk((ids) => deleteQuestions(ids));
                    }
                  }}
                  disabled={pending || selected.size === 0}
                >
                  Delete
                </Button>
                <Button variant="plain" size="sm" onClick={exitSelect} disabled={pending}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
