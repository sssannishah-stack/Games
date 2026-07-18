"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ModalHeader, ErrorText, NumberField } from "@/components/ui/FormFields";
import { importQuestions } from "@/actions/question.actions";

const NEW_GROUP = "__NEW__";

type DifficultyMode = "FROM_JSON" | "EASY" | "MEDIUM" | "HARD" | "ALTERNATE";
type OverrideMode = "INHERIT" | "CUSTOM";

/** A best-effort client-side normalization of one pasted row, purely for the
 * preview. It mirrors the server's `normalizeImportedQuestion` closely enough to
 * show the same question text, options, resolved correct answer, rationales and
 * hint the import will store — but the server remains the source of truth. Any
 * row that can't be understood is returned with an `error` so the preview can
 * flag it before the user imports. */
type PreviewRow = {
  question: string;
  isMCQ: boolean;
  options: string[];
  optionRationales: string[];
  answer: string;
  answerIndex: number;
  hint: string;
  difficulty: string;
  error: string | null;
};

function normalizeForPreview(raw: unknown): PreviewRow {
  const base: PreviewRow = {
    question: "",
    isMCQ: false,
    options: [],
    optionRationales: [],
    answer: "",
    answerIndex: -1,
    hint: "",
    difficulty: "MEDIUM",
    error: null,
  };
  if (!raw || typeof raw !== "object") return { ...base, error: "Not an object." };
  const q = raw as Record<string, unknown>;

  const text = String(q.question ?? q.text ?? q.questionText ?? "").trim();
  if (!text) return { ...base, error: 'Missing "question" text.' };
  base.question = text;

  const rawOptions = Array.isArray(q.options) ? q.options : [];
  let correctFromFlag: string | null = null;
  rawOptions.forEach((opt) => {
    if (opt && typeof opt === "object") {
      const o = opt as Record<string, unknown>;
      const optText = String(o.text ?? o.option ?? o.label ?? "").trim();
      base.options.push(optText);
      base.optionRationales.push(String(o.rationale ?? o.explanation ?? "").trim());
      if (o.isCorrect === true && optText) correctFromFlag = optText;
    } else {
      base.options.push(String(opt ?? "").trim());
      base.optionRationales.push("");
    }
  });
  base.isMCQ = base.options.filter(Boolean).length >= 2;

  // Resolve the answer the same way the server does.
  let answer = String(q.answer ?? "").trim();
  if (!answer && correctFromFlag) answer = correctFromFlag;
  if (!answer && q.correctAnswer != null) {
    const ca = q.correctAnswer;
    if (typeof ca === "number" && base.options[ca]) {
      answer = base.options[ca].trim();
    } else {
      const caStr = String(ca).trim();
      const letterIdx = /^[A-Za-z]$/.test(caStr) ? caStr.toUpperCase().charCodeAt(0) - 65 : -1;
      const numIdx = /^\d+$/.test(caStr) ? Number(caStr) - 1 : -1;
      if (letterIdx >= 0 && base.options[letterIdx]) answer = base.options[letterIdx].trim();
      else if (numIdx >= 0 && base.options[numIdx]) answer = base.options[numIdx].trim();
      else answer = caStr;
    }
  }
  base.answer = answer;
  base.answerIndex = base.options.findIndex((o) => o && o.trim() === answer);
  if (!answer) base.error = "Could not determine the correct answer.";

  const hint = String(
    q.hint ?? (Array.isArray(q.hints) && q.hints.length ? (typeof q.hints[0] === "object" ? (q.hints[0] as Record<string, unknown>).text : q.hints[0]) : "") ?? ""
  ).trim();
  base.hint = hint;

  const diff = String(q.difficulty ?? "").trim().toUpperCase();
  base.difficulty = ["EASY", "MEDIUM", "HARD"].includes(diff) ? diff : "MEDIUM";

  return base;
}

/**
 * Paste-a-JSON importer: accepts either a bare array of questions or an object
 * with a `questions` array (the shape our exports/quiz files use). Beyond the
 * detected count, it renders a real MCQ-style preview — the actual question,
 * lettered options with the correct one highlighted, per-option rationale, hint
 * and difficulty — so the user can flip through every question and see exactly
 * how it will look before committing. The server action still does the
 * authoritative normalization + validation on import.
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
  const [previewIdx, setPreviewIdx] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Batch settings applied to the whole import — same knobs as the single
  // question editor. Defaults match a hand-made question (difficulty from the
  // JSON, timer/scoring inherited from whatever round they're later placed in).
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [difficultyMode, setDifficultyMode] = useState<DifficultyMode>("FROM_JSON");
  // Per-question manual difficulty, keyed by row index — overrides the batch/JSON
  // baseline for just that row.
  const [perRowDifficulty, setPerRowDifficulty] = useState<Record<number, "EASY" | "MEDIUM" | "HARD">>({});
  const [timerMode, setTimerMode] = useState<OverrideMode>("INHERIT");
  const [timer, setTimer] = useState(20);
  const [scoringMode, setScoringMode] = useState<OverrideMode>("INHERIT");
  const [positiveMarks, setPositiveMarks] = useState(10);
  const [negativeMarks, setNegativeMarks] = useState(5);
  const [bonusMarks, setBonusMarks] = useState(0);
  const [coinReward, setCoinReward] = useState(0);

  // Live parse — the detected count, any parse error, plus normalized preview
  // rows. The authoritative validation still happens server-side on import.
  const parsed = useMemo<{ rows: PreviewRow[]; parseError: string | null }>(() => {
    const trimmed = text.trim();
    if (!trimmed) return { rows: [], parseError: null };
    try {
      const data = JSON.parse(trimmed);
      const arr = Array.isArray(data) ? data : Array.isArray(data?.questions) ? data.questions : null;
      if (!arr) return { rows: [], parseError: 'JSON must be an array, or an object with a "questions" array.' };
      return { rows: arr.map(normalizeForPreview), parseError: null };
    } catch (e) {
      return { rows: [], parseError: e instanceof Error ? `Invalid JSON: ${e.message}` : "Invalid JSON." };
    }
  }, [text]);

  const count = parsed.rows.length;
  const badRows = parsed.rows.filter((r) => r.error).length;
  const resolvedGroup = groupChoice === NEW_GROUP ? newGroup.trim() || null : groupChoice.trim() || null;

  // Keep the pager in range as the pasted content changes.
  useEffect(() => {
    if (previewIdx > count - 1) setPreviewIdx(Math.max(0, count - 1));
  }, [count, previewIdx]);

  const safeIdx = count > 0 ? Math.min(previewIdx, count - 1) : 0;
  const current = count > 0 ? parsed.rows[safeIdx] : null;

  // What difficulty this row will actually be stored as. A per-row manual pick
  // wins; otherwise it follows the batch mode (FROM_JSON keeps the row's own).
  function effectiveDifficulty(rowDifficulty: string, index: number): string {
    if (perRowDifficulty[index]) return perRowDifficulty[index];
    if (difficultyMode === "FROM_JSON") return rowDifficulty;
    if (difficultyMode === "ALTERNATE") return index % 2 === 0 ? "EASY" : "MEDIUM";
    return difficultyMode;
  }
  const shownDifficulty = current ? effectiveDifficulty(current.difficulty, safeIdx) : "MEDIUM";
  const isManualDifficulty = current ? Boolean(perRowDifficulty[safeIdx]) : false;

  function close() {
    if (pending) return;
    setText("");
    setError(null);
    setPreviewIdx(0);
    setSettingsOpen(false);
    setDifficultyMode("FROM_JSON");
    setPerRowDifficulty({});
    setTimerMode("INHERIT");
    setTimer(20);
    setScoringMode("INHERIT");
    setPositiveMarks(10);
    setNegativeMarks(5);
    setBonusMarks(0);
    setCoinReward(0);
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
        const res = await importQuestions({
          groupName: resolvedGroup,
          questions: arr,
          defaults: {
            difficultyMode,
            // Fold batch + JSON + manual picks into one final difficulty per row.
            difficultyOverrides: parsed.rows.map((r, i) => effectiveDifficulty(r.difficulty, i)),
            timerMode,
            timer,
            scoringMode,
            positiveMarks,
            negativeMarks,
            bonusMarks,
            coinReward,
          },
        });
        close();
        onImported(resolvedGroup);
        router.refresh();
        void res;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
      }
    });
  }

  const manualCount = Object.keys(perRowDifficulty).length;

  return (
    <Modal open={open} onClose={close} className="max-w-[640px]">
      <ModalHeader title="Import questions" onClose={close} />
      <div className="px-6 py-5 flex flex-col gap-3.5 max-h-[78dvh] overflow-y-auto">
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
            className="min-h-[160px] font-mono text-[12px] bg-line/[.04] border border-line/[.1] rounded-[12px] px-3 py-2.5 text-ink outline-none resize-y"
          />
        </label>

        {parsed.parseError ? (
          <span className="text-[12px] text-danger-soft">{parsed.parseError}</span>
        ) : count > 0 ? (
          <span className="text-[12px] text-success">
            ✓ Detected {count} question{count === 1 ? "" : "s"}
            {resolvedGroup ? ` → will import into "${resolvedGroup}"` : " → will import into General"}.
            {badRows > 0 && <span className="text-danger-soft"> · {badRows} need attention.</span>}
          </span>
        ) : (
          <span className="text-[11.5px] text-mute-2 leading-relaxed">
            Each question can carry options (with an <b>isCorrect</b> flag or a <b>correctAnswer</b> label), a
            per-option <b>rationale</b>, a <b>hint</b>, and a <b>difficulty</b>. They import unattached to any round.
          </span>
        )}

        {/* Batch settings — the same knobs the single-question editor exposes,
            applied to every imported row. Collapsed by default so a plain paste
            stays one click. */}
        {count > 0 && (
          <div className="rounded-2xl border border-line/[.09] bg-line/[.02] overflow-hidden">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left cursor-pointer hover:bg-line/[.03]"
            >
              <Icon name="sliders-horizontal" size={14} className="text-accent" />
              <span className="text-[12.5px] font-semibold text-ink">Batch settings</span>
              <span className="text-[11px] text-mute-2 truncate">
                · {difficultyMode === "FROM_JSON" ? "difficulty from JSON" : difficultyMode === "ALTERNATE" ? "alternating E/M" : `all ${difficultyMode}`}
                {manualCount > 0 ? ` (${manualCount} hand-set)` : ""}
                {timerMode === "CUSTOM" ? ` · ${timer}s` : ""}
                {scoringMode === "CUSTOM" ? ` · +${positiveMarks}/−${Math.abs(negativeMarks)}` : ""}
                {coinReward > 0 ? ` · ${coinReward}🪙` : ""}
              </span>
              <Icon name={settingsOpen ? "chevron-up" : "chevron-down"} size={15} className="ml-auto text-mute-2" />
            </button>
            {settingsOpen && (
              <div className="px-3.5 pb-3.5 pt-1 flex flex-col gap-3 border-t border-line/[.06]">
                {/* Difficulty */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-ink-3">Difficulty</span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {([
                      { key: "FROM_JSON", label: "From JSON" },
                      { key: "EASY", label: "Easy" },
                      { key: "MEDIUM", label: "Medium" },
                      { key: "HARD", label: "Hard" },
                      { key: "ALTERNATE", label: "Alt E/M" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setDifficultyMode(opt.key)}
                        className={`rounded-lg py-1.5 text-[11px] font-bold cursor-pointer transition-colors ${
                          difficultyMode === opt.key
                            ? "bg-accent/15 border border-accent/40 text-ink"
                            : "border border-line/[.09] bg-line/[.02] text-mute-2 hover:text-ink-3"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timer */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-ink-3">Timer</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={timerMode === "INHERIT" ? "primary" : "subtle"} size="sm" onClick={() => setTimerMode("INHERIT")}>
                      Use round&apos;s timer
                    </Button>
                    <Button variant={timerMode === "CUSTOM" ? "primary" : "subtle"} size="sm" onClick={() => setTimerMode("CUSTOM")}>
                      Custom timer
                    </Button>
                  </div>
                  {timerMode === "CUSTOM" ? (
                    <NumberField label="Timer (seconds)" value={timer} onChange={setTimer} />
                  ) : (
                    <span className="text-[11px] text-mute-2">Follows whichever round these questions are later placed under.</span>
                  )}
                </div>

                {/* Scoring */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-ink-3">Marks</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={scoringMode === "INHERIT" ? "primary" : "subtle"} size="sm" onClick={() => setScoringMode("INHERIT")}>
                      Use round default marks
                    </Button>
                    <Button variant={scoringMode === "CUSTOM" ? "primary" : "subtle"} size="sm" onClick={() => setScoringMode("CUSTOM")}>
                      Custom marks
                    </Button>
                  </div>
                  {scoringMode === "CUSTOM" && (
                    <div className="grid grid-cols-3 gap-2">
                      <NumberField label="Correct" value={positiveMarks} onChange={setPositiveMarks} />
                      <NumberField label="Wrong" value={negativeMarks} onChange={setNegativeMarks} />
                      <NumberField label="Bonus" value={bonusMarks} onChange={setBonusMarks} />
                    </div>
                  )}
                </div>

                {/* Coins */}
                <NumberField label="Coin reward (per correct answer)" value={coinReward} onChange={setCoinReward} />
              </div>
            )}
          </div>
        )}

        {/* Live MCQ preview — flip through every question exactly as it'll look. */}
        {current && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-[.12em] text-label">PREVIEW</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewIdx((i) => Math.max(0, i - 1))}
                  disabled={previewIdx <= 0}
                  className="w-6 h-6 rounded-lg border border-line/[.12] bg-line/[.05] text-ink-3 disabled:opacity-30 hover:bg-line/[.1] cursor-pointer disabled:cursor-not-allowed"
                >‹</button>
                <span className="text-[11px] font-mono text-mute-2 tabular-nums">{Math.min(previewIdx, count - 1) + 1} / {count}</span>
                <button
                  onClick={() => setPreviewIdx((i) => Math.min(count - 1, i + 1))}
                  disabled={previewIdx >= count - 1}
                  className="w-6 h-6 rounded-lg border border-line/[.12] bg-line/[.05] text-ink-3 disabled:opacity-30 hover:bg-line/[.1] cursor-pointer disabled:cursor-not-allowed"
                >›</button>
              </div>
            </div>

            {current.error ? (
              <div className="rounded-2xl border border-danger/30 bg-danger/[.06] p-4 text-[12.5px] text-danger-soft">
                ⚠ This question can’t be imported: {current.error}
              </div>
            ) : (
              <>
                {/* Phone-ish participant frame — mirrors the library preview. */}
                <div
                  data-theme="dark"
                  className="rounded-[22px] border border-line/[.12] bg-[linear-gradient(180deg,#0C0D13,#08090C)] p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {(["EASY", "MEDIUM", "HARD"] as const).map((lvl) => {
                        const active = shownDifficulty === lvl;
                        const activeCls =
                          lvl === "EASY" ? "border-success/45 bg-success/[.14] text-success"
                            : lvl === "HARD" ? "border-danger/45 bg-danger/[.12] text-danger-soft"
                              : "border-warn/45 bg-warn/[.12] text-warn";
                        return (
                          <button
                            key={lvl}
                            onClick={() => setPerRowDifficulty((prev) => ({ ...prev, [safeIdx]: lvl }))}
                            className={`rounded-full border px-2 py-0.5 text-[9.5px] font-bold tracking-wide cursor-pointer transition-colors ${
                              active ? activeCls : "border-line/[.1] bg-line/[.03] text-mute-2 hover:text-ink-3"
                            }`}
                          >
                            {lvl}
                          </button>
                        );
                      })}
                      {isManualDifficulty ? (
                        <button
                          onClick={() =>
                            setPerRowDifficulty((prev) => {
                              const next = { ...prev };
                              delete next[safeIdx];
                              return next;
                            })
                          }
                          className="text-[9px] text-mute-2 hover:text-ink-3 cursor-pointer underline decoration-dotted"
                          title="Revert this question to the batch / JSON difficulty"
                        >
                          reset
                        </button>
                      ) : (
                        <span className="text-[9px] text-dim-2">
                          {difficultyMode === "FROM_JSON" ? "from JSON" : "batch"}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-mute-2 shrink-0">{current.isMCQ ? "Multiple choice" : "Open / host-marked"}</span>
                  </div>

                  <h1 className="text-[16px] leading-tight font-black text-ink">{current.question}</h1>

                  {current.isMCQ ? (
                    <div className="flex flex-col gap-2">
                      {current.options.map((option, i) => {
                        const isAnswer = i === current.answerIndex;
                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 ${
                              isAnswer ? "border-success/45 bg-success/[.12]" : "border-line/[.08] bg-line/[.04]"
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                isAnswer ? "border-success/50 bg-success/20 text-success" : "border-line/[.12] bg-line/[.06] text-ink-3"
                              }`}
                            >
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className={`text-[13px] font-semibold ${isAnswer ? "text-success" : "text-ink"}`}>{option}</span>
                            {isAnswer && <span className="ml-auto text-[10px] font-bold text-success shrink-0">✓ CORRECT</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[12px] text-mute-2">Discuss with your team. The host gives marks.</p>
                  )}

                  {/* Reward chips — reflect the batch settings (or note inherited). */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {scoringMode === "CUSTOM" ? (
                      <>
                        <span className="rounded-full border border-success/30 bg-success/[.1] px-2 py-0.5 text-[10px] font-bold text-success">✓ +{positiveMarks}</span>
                        {negativeMarks !== 0 && (
                          <span className="rounded-full border border-danger/30 bg-danger/[.08] px-2 py-0.5 text-[10px] font-bold text-danger-soft">✗ −{Math.abs(negativeMarks)}</span>
                        )}
                        {bonusMarks > 0 && (
                          <span className="rounded-full border border-accent/30 bg-accent/[.1] px-2 py-0.5 text-[10px] font-bold text-accent">★ +{bonusMarks}</span>
                        )}
                      </>
                    ) : (
                      <span className="rounded-full border border-line/[.12] bg-line/[.04] px-2 py-0.5 text-[10px] font-semibold text-mute-2">Marks: round default</span>
                    )}
                    <span className="rounded-full border border-line/[.12] bg-line/[.04] px-2 py-0.5 text-[10px] font-semibold text-mute-2">
                      ⏱ {timerMode === "CUSTOM" ? `${timer}s` : "round timer"}
                    </span>
                    {coinReward > 0 && (
                      <span className="rounded-full border border-warn/30 bg-warn/[.08] px-2 py-0.5 text-[10px] font-bold text-warn">🪙 {coinReward}</span>
                    )}
                  </div>
                </div>

                {/* Host-only strip — answer, rationales, hint. */}
                <div className="rounded-2xl border border-warn/25 bg-warn/[.06] p-3.5 flex flex-col gap-2">
                  <span className="text-[9.5px] font-mono font-semibold tracking-[.12em] text-warn">HOST ONLY — HIDDEN FROM PLAYERS</span>
                  <span className="text-[13.5px] font-bold text-ink">Answer: {current.answer || "—"}</span>
                  {current.isMCQ && current.optionRationales.some((r) => r) && (
                    <div className="flex flex-col gap-1 mt-0.5">
                      {current.options.map((option, i) =>
                        current.optionRationales[i] ? (
                          <span key={i} className="text-[11px] text-mute-2 leading-snug">
                            <b className={i === current.answerIndex ? "text-success" : "text-ink-3"}>{String.fromCharCode(65 + i)}.</b>{" "}
                            {current.optionRationales[i]}
                          </span>
                        ) : null
                      )}
                    </div>
                  )}
                  {current.hint && (
                    <div className="mt-1 pt-2 border-t border-line/[.08]">
                      <span className="text-[9.5px] font-semibold tracking-[.1em] text-label">HINT (unlocked with the Hint card)</span>
                      <p className="text-[11.5px] text-ink-3 mt-0.5">{current.hint}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <ErrorText error={error} />
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
        <Button variant="plain" onClick={close} disabled={pending}>Cancel</Button>
        <Button variant="primary" onClick={runImport} disabled={pending || count === 0} loading={pending}>
          {pending ? "Importing…" : `Import ${count || ""}`.trim()}
        </Button>
      </div>
    </Modal>
  );
}
