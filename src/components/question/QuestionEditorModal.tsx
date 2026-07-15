"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ModalHeader, ErrorText, TextField, NumberField, HintEditor } from "@/components/ui/FormFields";
import { RoundPickerChecklist } from "@/components/question/RoundPickerChecklist";
import { createQuestion, duplicateQuestion, updateQuestion } from "@/actions/question.actions";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { QuestionRecord } from "@/data/queries/question.queries";
import { QUESTION_TYPES, type QuestionDifficulty, type QuestionMedia, type QuestionType, type RuleOverrideMode } from "@/types/db";

const TYPE_TILES: { value: QuestionType; label: string; icon: string; hint: string }[] = [
  { value: "TEXT", label: "Text", icon: "type", hint: "Question + answer, no media" },
  { value: "IMAGE", label: "Image", icon: "image", hint: "Show an image, guess the answer" },
  { value: "TEXT_IMAGE", label: "Text + Image", icon: "images", hint: "Question text alongside an image" },
  { value: "AUDIO", label: "Audio", icon: "music", hint: "Play a clip, guess the answer" },
  { value: "VIDEO", label: "Video", icon: "video", hint: "Play a video, guess the answer" },
  { value: "DRAWING", label: "Drawing", icon: "pencil", hint: "Host draws, teams guess" },
  { value: "COMPLETION", label: "Completion", icon: "text-cursor-input", hint: "Complete a phrase, verse or line" },
  { value: "IDENTIFY", label: "Identify", icon: "scan-search", hint: "Identify a person, place, object or image" },
  { value: "RAPID_FIRE", label: "Rapid Fire", icon: "zap", hint: "Fast sequence answered manually" },
];

const SUPPORTED_TYPES = new Set<QuestionType>(QUESTION_TYPES);

const DIFFICULTIES: QuestionDifficulty[] = ["EASY", "MEDIUM", "HARD"];

function OptionsEditor({
  options,
  setOptions,
}: {
  options: string[];
  setOptions: (updater: (options: string[]) => string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className="text-xs font-semibold text-ink-3">Answer options</span>
      {options.map((option, index) => (
        <div key={index} className="flex gap-1.5">
          <input
            value={option}
            onChange={(event) =>
              setOptions((current) => current.map((item, i) => (i === index ? event.target.value : item)))
            }
            placeholder={`Option ${index + 1}`}
            className="flex-1 bg-line/[.04] border border-line/[.09] rounded-[10px] px-3 py-2 text-sm text-ink outline-none"
          />
          {options.length > 2 && (
            <button
              onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
              className="w-9 h-9 rounded-[10px] flex items-center justify-center text-dim hover:text-danger-soft hover:bg-line/[.06]"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={() => setOptions((current) => [...current, ""])}
        className="flex items-center justify-center gap-1.5 border-[1.5px] border-dashed border-line/[.14] rounded-[10px] py-2 text-mute-2 text-[11.5px] hover:border-accent hover:text-ink-2 cursor-pointer transition-colors"
      >
        <Icon name="plus" size={12} />
        Add option
      </button>
    </div>
  );
}

interface QuestionEditorModalProps {
  rounds: RoundRecord[];
  question?: QuestionRecord;
  open: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
  defaultAttachRoundIds?: string[];
  usedContext?: string;
  /** Existing group names across the library, for the group picker's dropdown. */
  existingGroups?: string[];
  /** Preselect a group when creating from inside a group's filtered view. */
  defaultGroupName?: string | null;
}

const NEW_GROUP_VALUE = "__NEW__";

/**
 * Select an existing group, leave it General (no group), or type a brand new
 * one inline — the three options the spec calls for when adding a question.
 */
function GroupPicker({
  existingGroups,
  value,
  onChange,
}: {
  existingGroups: string[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const isNew = value !== null && !existingGroups.includes(value);
  const selectValue = value === null ? "" : isNew ? NEW_GROUP_VALUE : value;

  return (
    <div className="flex flex-col gap-[7px]">
      <span className="text-xs font-semibold text-ink-3">Group</span>
      <select
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === NEW_GROUP_VALUE) onChange("");
          else if (next === "") onChange(null);
          else onChange(next);
        }}
        className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none"
      >
        <option value="" className="bg-surface">
          General (no group)
        </option>
        {existingGroups.map((group) => (
          <option key={group} value={group} className="bg-surface">
            {group}
          </option>
        ))}
        <option value={NEW_GROUP_VALUE} className="bg-surface">
          + New group…
        </option>
      </select>
      {isNew && (
        <input
          autoFocus
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="e.g. Aadinath"
          maxLength={60}
          className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none"
        />
      )}
    </div>
  );
}

const HAS_MEDIA: Record<QuestionType, boolean> = {
  TEXT: false,
  IMAGE: true,
  TEXT_IMAGE: true,
  AUDIO: true,
  VIDEO: true,
  DRAWING: false,
  COMPLETION: false,
  IDENTIFY: true,
  RAPID_FIRE: false,
};

/** Create/edit a standalone library question. Create mode asks the type first, then shows only the relevant fields. */
export function QuestionEditorModal({
  rounds,
  question,
  open,
  onClose,
  onSaved,
  defaultAttachRoundIds,
  usedContext,
  existingGroups = [],
  defaultGroupName = null,
}: QuestionEditorModalProps) {
  const isEdit = Boolean(question);
  const [step, setStep] = useState<"TYPE" | "FORM">(isEdit ? "FORM" : "TYPE");
  const [type, setType] = useState<QuestionType>(question?.type ?? "TEXT");
  const [text, setText] = useState(question?.question ?? "");
  const [mediaUrl, setMediaUrl] = useState(question?.media?.url ?? question?.mediaUrl ?? "");
  const [mediaName, setMediaName] = useState(question?.media?.name ?? "");
  const [answer, setAnswer] = useState(question?.answer ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [hints, setHints] = useState<{ text: string; penalty: number }[]>(question?.hints ?? []);
  const [hostNotes, setHostNotes] = useState(question?.hostNotes ?? "");
  const [isMCQ, setIsMCQ] = useState(question?.isMCQ ?? false);
  const [options, setOptions] = useState<string[]>(question?.options.length ? question.options : ["", ""]);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(question?.difficulty ?? "MEDIUM");
  const [tagsText, setTagsText] = useState((question?.tags ?? []).join(", "));
  const [groupName, setGroupName] = useState<string | null>(question?.groupName ?? defaultGroupName ?? null);
  const [scoringMode, setScoringMode] = useState<RuleOverrideMode>(question?.scoringMode ?? "INHERIT");
  const [timerMode, setTimerMode] = useState<RuleOverrideMode>(question?.timerMode ?? "INHERIT");
  const [timer, setTimer] = useState(question?.timer ?? 20);
  const [positiveMarks, setPositiveMarks] = useState(question?.positiveMarks ?? 10);
  const [negativeMarks, setNegativeMarks] = useState(question?.negativeMarks ?? 5);
  const [bonusMarks, setBonusMarks] = useState(question?.bonusMarks ?? 0);
  const [attachRoundIds, setAttachRoundIds] = useState<string[]>(defaultAttachRoundIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<ReturnType<typeof buildPayload> | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const isDrawing = type === "DRAWING";
  const hasMedia = HAS_MEDIA[type];

  const media: QuestionMedia | null =
    hasMedia && mediaUrl.trim()
      ? {
          url: mediaUrl.trim(),
          type: type === "AUDIO" ? "AUDIO" : type === "VIDEO" ? "VIDEO" : "IMAGE",
          name: mediaName.trim() || mediaUrl.trim().split("/").pop() || "Media",
        }
      : null;

  function pickType(next: QuestionType) {
    setType(next);
    setStep("FORM");
  }

  function buildPayload() {
    return {
      type: SUPPORTED_TYPES.has(type) ? type : "TEXT",
      question: text.trim(),
      mediaUrl: media?.url,
      media,
      isMCQ: type === "TEXT" && isMCQ,
      options: type === "TEXT" && isMCQ ? options.map((o) => o.trim()).filter(Boolean) : [],
      answer: answer.trim(),
      explanation: explanation.trim() || undefined,
      hints: hints.filter((hint) => hint.text.trim()),
      hostNotes: hostNotes.trim() || undefined,
      difficulty,
      scoringMode,
      timerMode,
      timer,
      positiveMarks,
      negativeMarks,
      bonusMarks,
      tags: tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      groupName: groupName?.trim() || null,
    };
  }

  function save(strategy?: "UPDATE_SHARED" | "DUPLICATE") {
    setError(null);
    if (!text.trim() && !media) return setError("Question text or media is required.");
    if (!answer.trim()) return setError("Answer is required.");

    const payload = pendingPayload ?? buildPayload();
    if (question && usedContext && !strategy) {
      setPendingPayload(payload);
      setSafetyOpen(true);
      return;
    }

    startTransition(async () => {
      try {
        if (question) {
          if (strategy === "DUPLICATE") {
            const { id } = await duplicateQuestion(question.id);
            await updateQuestion(id, payload);
            onSaved?.(id);
          } else {
            await updateQuestion(question.id, payload);
            onSaved?.(question.id);
          }
        } else {
          const { id } = await createQuestion({ ...payload, attachToRoundIds: attachRoundIds });
          onSaved?.(id);
        }
        setPendingPayload(null);
        setSafetyOpen(false);
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save question.");
      }
    });
  }

  function close() {
    if (pending) return;
    onClose();
    if (!isEdit) setStep("TYPE");
  }

  return (
    <Modal open={open} onClose={close} className="max-w-[720px]">
      <ModalHeader title={question ? "Edit question" : "Create question"} onClose={close} />

      {step === "TYPE" ? (
        <div className="px-6 py-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TYPE_TILES.map((tile) => (
            <button
              key={tile.value}
              onClick={() => pickType(tile.value)}
              className="flex flex-col items-start gap-2 rounded-2xl border border-line/[.09] bg-line/[.03] p-4 text-left hover:border-accent/60 hover:bg-accent/[.06] cursor-pointer transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent">
                <Icon name={tile.icon} size={17} />
              </div>
              <span className="text-[13.5px] font-bold text-ink-2">{tile.label}</span>
              <span className="text-[11px] text-mute-2 leading-snug">{tile.hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="px-6 py-5 flex flex-col gap-4 max-h-[70dvh] overflow-y-auto">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-mute bg-line/[.06] rounded-md px-2 py-1">
                {TYPE_TILES.find((t) => t.value === type)?.label}
              </span>
              {!isEdit && (
                <button
                  onClick={() => setStep("TYPE")}
                  className="text-[11.5px] font-semibold text-accent hover:brightness-125 cursor-pointer"
                >
                  Change type
                </button>
              )}
            </div>

            <TextField
              label={isDrawing ? "Drawing instruction" : hasMedia && type === "IMAGE" ? "Question text (optional)" : "Question text"}
              value={text}
              onChange={setText}
              multiline
            />
            {hasMedia && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField label="Upload image / media URL" value={mediaUrl} onChange={setMediaUrl} placeholder="https://..." />
                <TextField label="Media name" value={mediaName} onChange={setMediaName} />
              </div>
            )}

            {type === "TEXT" && (
              <label className="flex items-center gap-2 text-[12.5px] text-ink-3">
                <input
                  type="checkbox"
                  checked={isMCQ}
                  onChange={(event) => setIsMCQ(event.target.checked)}
                  className="accent-accent"
                />
                Multiple choice (MCQ) — show answer options
              </label>
            )}
            {type === "TEXT" && isMCQ && (
              <OptionsEditor options={options} setOptions={setOptions} />
            )}

            {type === "TEXT" && isMCQ && options.filter((o) => o.trim()).length > 0 ? (
              <label className="flex flex-col gap-[7px]">
                <span className="text-xs font-semibold text-ink-3">Correct option</span>
                <select
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none"
                >
                  <option value="" className="bg-surface">
                    Choose the correct option
                  </option>
                  {options
                    .filter((o) => o.trim())
                    .map((option, index) => (
                      <option key={index} value={option} className="bg-surface">
                        {option}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <TextField
                label={isDrawing ? "Answer / reference" : "Correct answer / host reference"}
                value={answer}
                onChange={setAnswer}
              />
            )}
            <TextField label="Explanation" value={explanation} onChange={setExplanation} multiline />
            <HintEditor hints={hints} setHints={setHints} />
            <TextField label="Host notes" value={hostNotes} onChange={setHostNotes} multiline />
            <GroupPicker existingGroups={existingGroups} value={groupName} onChange={setGroupName} />
            <TextField
              label="Tags"
              value={tagsText}
              onChange={setTagsText}
              placeholder="Jain, Music, Kids, Easy"
            />

            <label className="flex flex-col gap-[7px]">
              <span className="text-xs font-semibold text-ink-3">Difficulty</span>
              <select
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as QuestionDifficulty)}
                className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none"
              >
                {DIFFICULTIES.map((item) => (
                  <option key={item} value={item} className="bg-surface">
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <Button variant={timerMode === "INHERIT" ? "primary" : "subtle"} onClick={() => setTimerMode("INHERIT")}>
                Use Round&apos;s Timer
              </Button>
              <Button variant={timerMode === "CUSTOM" ? "primary" : "subtle"} onClick={() => setTimerMode("CUSTOM")}>
                Custom Timer
              </Button>
            </div>
            {timerMode === "CUSTOM" ? (
              <NumberField label="Timer (seconds)" value={timer} onChange={setTimer} />
            ) : (
              <span className="text-[11.5px] text-mute-2 -mt-2">
                Follows whichever round&apos;s timer this question is placed under.
              </span>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant={scoringMode === "INHERIT" ? "primary" : "subtle"} onClick={() => setScoringMode("INHERIT")}>
                Use Round Default Marks
              </Button>
              <Button variant={scoringMode === "CUSTOM" ? "primary" : "subtle"} onClick={() => setScoringMode("CUSTOM")}>
                Custom Marks
              </Button>
            </div>
            {scoringMode === "CUSTOM" && (
              <div className="grid grid-cols-3 gap-2">
                <NumberField label="Correct" value={positiveMarks} onChange={setPositiveMarks} />
                <NumberField label="Wrong" value={negativeMarks} onChange={setNegativeMarks} />
                <NumberField label="Bonus" value={bonusMarks} onChange={setBonusMarks} />
              </div>
            )}

            {!isEdit && <RoundPickerChecklist rounds={rounds} selected={attachRoundIds} onChange={setAttachRoundIds} />}
            <ErrorText error={error} />
          </div>
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
            <Button variant="plain" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => save()} loading={pending}>
              {pending ? "Saving..." : "Save Question"}
            </Button>
          </div>
        </>
      )}
      {safetyOpen && (
        <Modal open={safetyOpen} onClose={() => !pending && setSafetyOpen(false)} className="max-w-[480px]">
          <ModalHeader title="Reusable question" onClose={() => setSafetyOpen(false)} />
          <div className="px-6 py-5 flex flex-col gap-3">
            <span className="text-[13px] text-mute-2 leading-relaxed">
              This question is used in {usedContext}. Choose whether this edit should update every usage or create a new copy.
            </span>
            <ErrorText error={error} />
          </div>
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
            <Button variant="plain" onClick={() => setSafetyOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="subtle" onClick={() => save("DUPLICATE")} disabled={pending}>
              Duplicate and Edit
            </Button>
            <Button variant="primary" onClick={() => save("UPDATE_SHARED")} disabled={pending}>
              Update Everywhere
            </Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

export function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const tile = TYPE_TILES.find((t) => t.value === type);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold text-mute bg-line/[.06]">
      {tile?.label ?? type}
    </span>
  );
}
