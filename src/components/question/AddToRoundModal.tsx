"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ModalHeader, ErrorText } from "@/components/ui/FormFields";
import { RoundPickerChecklist } from "@/components/question/RoundPickerChecklist";
import { attachQuestionToRounds } from "@/actions/question.actions";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { QuestionRecord } from "@/data/queries/question.queries";

interface AddToRoundModalProps {
  question: QuestionRecord | null;
  rounds: RoundRecord[];
  onClose: () => void;
}

/** The Question Bank list's "Add to Round" row action — only offers rounds the question isn't already in. */
export function AddToRoundModal({ question, rounds, onClose }: AddToRoundModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const available = question ? rounds.filter((round) => !round.questionIds.includes(question.id)) : [];

  function submit() {
    if (!question) return;
    setError(null);
    if (selected.length === 0) return setError("Pick at least one round.");
    startTransition(async () => {
      try {
        await attachQuestionToRounds(question.id, selected);
        setSelected([]);
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add to round.");
      }
    });
  }

  return (
    <Modal open={question !== null} onClose={() => !pending && onClose()} className="max-w-[460px]">
      <ModalHeader title={`Add "${question?.question || question?.media?.name || "question"}" to round`} onClose={onClose} />
      <div className="px-6 py-5 flex flex-col gap-3">
        {available.length === 0 ? (
          <span className="text-[12.5px] text-mute-2">Already attached to every round.</span>
        ) : (
          <RoundPickerChecklist rounds={available} selected={selected} onChange={setSelected} />
        )}
        <ErrorText error={error} />
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
        <Button variant="plain" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={pending || available.length === 0}>
          {pending ? "Adding..." : "Add"}
        </Button>
      </div>
    </Modal>
  );
}
