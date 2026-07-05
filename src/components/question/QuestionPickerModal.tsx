"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ModalHeader, ErrorText } from "@/components/ui/FormFields";
import { QuestionEditorModal, QuestionTypeBadge } from "@/components/question/QuestionEditorModal";
import { addQuestionsToRound } from "@/actions/round.actions";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { QuestionRecord } from "@/data/queries/question.queries";
import { QUESTION_TYPES, type QuestionDifficulty } from "@/types/db";

const DIFFICULTIES: QuestionDifficulty[] = ["EASY", "MEDIUM", "HARD"];

interface QuestionPickerModalProps {
  roundId: string;
  open: boolean;
  onClose: () => void;
  libraryQuestions: QuestionRecord[];
  alreadyInRound: string[];
  rounds: RoundRecord[];
}

/** Round Builder's "+ Add Questions" — search/filter/multi-select existing questions, or create a new one inline. */
export function QuestionPickerModal({
  roundId,
  open,
  onClose,
  libraryQuestions,
  alreadyInRound,
  rounds,
}: QuestionPickerModalProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState("ALL");
  const [selected, setSelected] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const inRoundSet = new Set(alreadyInRound);
  const available = libraryQuestions.filter((question) => {
    if (inRoundSet.has(question.id)) return false;
    const text = `${question.question} ${question.answer}`.toLowerCase();
    return (
      text.includes(query.toLowerCase()) &&
      (typeFilter === "ALL" || question.type === typeFilter) &&
      (difficultyFilter === "ALL" || question.difficulty === difficultyFilter)
    );
  });

  function toggle(questionId: string) {
    setSelected((current) =>
      current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId]
    );
  }

  function addSelected() {
    setError(null);
    if (selected.length === 0) return setError("Pick at least one question.");
    startTransition(async () => {
      try {
        await addQuestionsToRound(roundId, selected);
        setSelected([]);
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add questions.");
      }
    });
  }

  function selectVisible() {
    const ids = available.map((question) => question.id);
    setSelected((current) => [...new Set([...current, ...ids])]);
  }

  return (
    <>
      <Modal open={open} onClose={() => !pending && onClose()} className="max-w-[720px]">
        <ModalHeader title="Add questions" onClose={onClose} />
        <div className="px-6 py-5 flex flex-col gap-3 max-h-[70dvh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_150px_150px_auto] gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search questions"
              className="flex-1 bg-line/[.04] border border-line/[.09] rounded-[10px] px-3 py-2 text-sm text-ink outline-none"
            />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-2 py-2 text-sm text-ink outline-none"
            >
              <option value="ALL">All types</option>
              {QUESTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " + ")}
                </option>
              ))}
            </select>
            <select
              value={difficultyFilter}
              onChange={(event) => setDifficultyFilter(event.target.value)}
              className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-2 py-2 text-sm text-ink outline-none"
            >
              <option value="ALL">All difficulty</option>
              {DIFFICULTIES.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty}
                </option>
              ))}
            </select>
            <Button variant="subtle" onClick={() => setCreateOpen(true)}>
              <Icon name="plus" size={13} />
              Create Question
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="plain" size="sm" onClick={selectVisible} disabled={available.length === 0}>
              Select filtered
            </Button>
            <Button variant="plain" size="sm" onClick={() => setSelected([])} disabled={selected.length === 0}>
              Clear
            </Button>
            <span className="ml-auto text-[11.5px] text-mute-2">
              {selected.length} selected
            </span>
          </div>

          {available.length === 0 ? (
            <span className="text-[12.5px] text-mute-2 py-6 text-center">
              {libraryQuestions.length === 0
                ? "No questions in your library yet — create one."
                : "No matching questions to add."}
            </span>
          ) : (
            <div className="flex flex-col gap-1.5">
              {available.map((question) => (
                <label
                  key={question.id}
                  className="flex items-center gap-2.5 rounded-xl border border-line/[.08] bg-elev px-3 py-2.5 cursor-pointer hover:border-accent/40"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(question.id)}
                    onChange={() => toggle(question.id)}
                    className="accent-accent"
                  />
                  <QuestionTypeBadge type={question.type} />
                  <span className="text-[12.5px] text-ink-2 truncate flex-1">
                    {question.question || question.media?.name || "Untitled"}
                  </span>
                  <span className="text-[10.5px] text-dim">{question.difficulty}</span>
                </label>
              ))}
            </div>
          )}
          <ErrorText error={error} />
        </div>
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
          <Button variant="plain" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={addSelected} disabled={pending || selected.length === 0}>
            {pending ? "Adding..." : `Add ${selected.length || ""}`.trim()}
          </Button>
        </div>
      </Modal>

      <QuestionEditorModal
        rounds={rounds}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultAttachRoundIds={[roundId]}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
