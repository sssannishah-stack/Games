"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ModalHeader, ErrorText, TextField } from "@/components/ui/FormFields";
import { createRound } from "@/actions/round.actions";
import { ROUND_CATEGORIES, type RoundType } from "@/types/db";

const ROUND_TYPES: { label: string; value: RoundType }[] = [
  { label: "Normal", value: "GENERAL" },
  { label: "Text Q&A", value: "QUESTION_ANSWER" },
  { label: "Image", value: "IMAGE_BASED" },
  { label: "Drawing", value: "DRAWING" },
  { label: "Custom", value: "CUSTOM" },
];

interface QuickCreateRoundModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (round: { id: string; title: string }) => void;
}

/** Minimal round creation (name + type only) — full settings are edited later in the Round Builder. */
export function QuickCreateRoundModal({ open, onClose, onCreated }: QuickCreateRoundModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("Knowledge");
  const [roundType, setRoundType] = useState<RoundType>("GENERAL");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!title.trim()) return setError("Round name is required.");

    startTransition(async () => {
      try {
        const { id } = await createRound({ title: title.trim(), category, roundType });
        setTitle("");
        setCategory("Knowledge");
        setRoundType("GENERAL");
        onCreated({ id, title: title.trim() });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create round.");
      }
    });
  }

  return (
    <Modal open={open} onClose={() => !pending && onClose()} className="max-w-[460px]">
      <ModalHeader title="Create round" onClose={onClose} />
      <div className="px-6 py-5 flex flex-col gap-4">
        <TextField label="Round name" value={title} onChange={setTitle} placeholder="Chitra Upar Thi Geet" />
        <label className="flex flex-col gap-[7px]">
          <span className="text-xs font-semibold text-ink-3">Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none"
          >
            {ROUND_CATEGORIES.map((item) => (
              <option key={item} value={item} className="bg-surface">
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-[7px]">
          <span className="text-xs font-semibold text-ink-3">Round type</span>
          <select
            value={roundType}
            onChange={(event) => setRoundType(event.target.value as RoundType)}
            className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none"
          >
            {ROUND_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <ErrorText error={error} />
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
        <Button variant="plain" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={pending}>
          {pending ? "Creating..." : "Create round"}
        </Button>
      </div>
    </Modal>
  );
}

export { ROUND_TYPES };
