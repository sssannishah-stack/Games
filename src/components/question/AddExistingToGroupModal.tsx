"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ModalHeader, ErrorText } from "@/components/ui/FormFields";
import { QuestionTypeBadge } from "@/components/question/QuestionEditorModal";
import { updateQuestion } from "@/actions/question.actions";
import type { QuestionRecord } from "@/data/queries/question.queries";

interface AddExistingToGroupModalProps {
  groupName: string;
  open: boolean;
  onClose: () => void;
  /** Ungrouped (General) questions only — the pool this picker offers. */
  generalQuestions: QuestionRecord[];
}

/**
 * "Existing Question" path from inside a group: picks from questions that
 * are still General (no group yet) and assigns them to this group. Grouped
 * questions never show up here — moving a question between two named groups
 * isn't this flow, it's editing that question directly.
 */
export function AddExistingToGroupModal({
  groupName,
  open,
  onClose,
  generalQuestions,
}: AddExistingToGroupModalProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const available = generalQuestions.filter((question) => {
    const text = `${question.question} ${question.answer}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  function toggle(questionId: string) {
    setSelected((current) =>
      current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId]
    );
  }

  function close() {
    if (pending) return;
    setSelected([]);
    setQuery("");
    setError(null);
    onClose();
  }

  function addSelected() {
    setError(null);
    if (selected.length === 0) return setError("Pick at least one question.");
    startTransition(async () => {
      try {
        await Promise.all(selected.map((id) => updateQuestion(id, { groupName })));
        close();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add questions to the group.");
      }
    });
  }

  return (
    <Modal open={open} onClose={close} className="max-w-[640px]">
      <ModalHeader title={`Add existing question to "${groupName}"`} onClose={close} />
      <div className="px-6 py-5 flex flex-col gap-3 max-h-[70dvh] overflow-y-auto">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search General questions"
          className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-3 py-2 text-sm text-ink outline-none"
        />
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-mute-2">
            Only questions in <b className="text-ink-3">General</b> — not yet in any group — show up here.
          </span>
          <span className="ml-auto text-[11.5px] text-mute-2 shrink-0">{selected.length} selected</span>
        </div>

        {available.length === 0 ? (
          <span className="text-[12.5px] text-mute-2 py-6 text-center">
            {generalQuestions.length === 0
              ? "Every question is already in a group — nothing left in General."
              : "No matching General questions."}
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
        <Button variant="plain" onClick={close} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={addSelected} disabled={pending || selected.length === 0}>
          {pending ? "Adding..." : `Add ${selected.length || ""}`.trim()}
        </Button>
      </div>
    </Modal>
  );
}
