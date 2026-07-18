"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ModalHeader, ErrorText } from "@/components/ui/FormFields";
import { importQuestions } from "@/actions/question.actions";

const NEW_GROUP = "__NEW__";

/**
 * Paste-a-JSON importer: accepts either a bare array of questions or an object
 * with a `questions` array (the shape our exports/quiz files use), previews the
 * detected count client-side, then hands the raw array to the server action,
 * which does the real per-row normalization + validation. Everything lands in
 * one chosen group, unattached to any round.
 */
export function ImportQuestionsModal({
  open,
  onClose,
  existingGroups,
  defaultGroupName,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  existingGroups: string[];
  defaultGroupName?: string | null;
  /** Called with the group the questions landed in, so the board can jump there. */
  onImported: (groupName: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [groupChoice, setGroupChoice] = useState<string>(defaultGroupName ?? "");
  const [newGroup, setNewGroup] = useState(defaultGroupName && !existingGroups.includes(defaultGroupName) ? defaultGroupName : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Live parse — just enough to show the detected count / a parse error. The
  // authoritative validation happens server-side on import.
  const parsed = useMemo<{ count: number; parseError: string | null }>(() => {
    const trimmed = text.trim();
    if (!trimmed) return { count: 0, parseError: null };
    try {
      const data = JSON.parse(trimmed);
      const arr = Array.isArray(data) ? data : Array.isArray(data?.questions) ? data.questions : null;
      if (!arr) return { count: 0, parseError: 'JSON must be an array, or an object with a "questions" array.' };
      return { count: arr.length, parseError: null };
    } catch (e) {
      return { count: 0, parseError: e instanceof Error ? `Invalid JSON: ${e.message}` : "Invalid JSON." };
    }
  }, [text]);

  const resolvedGroup = groupChoice === NEW_GROUP ? newGroup.trim() || null : groupChoice.trim() || null;

  function close() {
    if (pending) return;
    setText("");
    setError(null);
    onClose();
  }

  function runImport() {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) return setError("Paste your questions JSON first.");
    let arr: unknown[];
    try {
      const data = JSON.parse(trimmed);
      arr = Array.isArray(data) ? data : Array.isArray((data as { questions?: unknown[] })?.questions) ? (data as { questions: unknown[] }).questions : [];
    } catch {
      return setError("The JSON couldn't be parsed. Check for a stray comma or quote.");
    }
    if (arr.length === 0) return setError("No questions found in that JSON.");

    startTransition(async () => {
      try {
        const res = await importQuestions({ groupName: resolvedGroup, questions: arr });
        close();
        onImported(resolvedGroup);
        router.refresh();
        // Surface the count briefly via the URL-driven group view refresh.
        void res;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
      }
    });
  }

  return (
    <Modal open={open} onClose={close} className="max-w-[600px]">
      <ModalHeader title="Import questions" onClose={close} />
      <div className="px-6 py-5 flex flex-col gap-3.5 max-h-[74dvh] overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-3">Import into group</span>
          <select
            value={groupChoice}
            onChange={(e) => setGroupChoice(e.target.value)}
            className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none"
          >
            <option value="" className="bg-surface">General (no group)</option>
            {existingGroups.map((g) => (
              <option key={g} value={g} className="bg-surface">{g}</option>
            ))}
            <option value={NEW_GROUP} className="bg-surface">+ New group…</option>
          </select>
          {groupChoice === NEW_GROUP && (
            <input
              autoFocus
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              placeholder="New group name"
              maxLength={60}
              className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none"
            />
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-3">Questions JSON</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Paste JSON here — either an array, or { "questions": [ … ] }'}
            spellCheck={false}
            className="min-h-[240px] font-mono text-[12px] bg-line/[.04] border border-line/[.1] rounded-[12px] px-3 py-2.5 text-ink outline-none resize-y"
          />
        </label>

        {parsed.parseError ? (
          <span className="text-[12px] text-danger-soft">{parsed.parseError}</span>
        ) : parsed.count > 0 ? (
          <span className="text-[12px] text-success">
            ✓ Detected {parsed.count} question{parsed.count === 1 ? "" : "s"}
            {resolvedGroup ? ` → will import into "${resolvedGroup}"` : " → will import into General"}.
          </span>
        ) : (
          <span className="text-[11.5px] text-mute-2 leading-relaxed">
            Each question can carry options (with an <b>isCorrect</b> flag or a <b>correctAnswer</b> label), a
            per-option <b>rationale</b>, a <b>hint</b>, and a <b>difficulty</b>. They import unattached to any round.
          </span>
        )}

        <ErrorText error={error} />
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
        <Button variant="plain" onClick={close} disabled={pending}>Cancel</Button>
        <Button variant="primary" onClick={runImport} disabled={pending || parsed.count === 0} loading={pending}>
          {pending ? "Importing…" : `Import ${parsed.count || ""}`.trim()}
        </Button>
      </div>
    </Modal>
  );
}
