"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TextField, NumberField, ErrorText } from "@/components/ui/FormFields";
import { CategoryIcon, RarityBadge } from "@/components/power-card/PowerCardBadge";
import { QuestionPickerModal } from "@/components/question/QuestionPickerModal";
import { QuestionTypeBadge } from "@/components/question/QuestionEditorModal";
import { duplicateRound, updateRound, removeQuestionFromRound, reorderRoundQuestions } from "@/actions/round.actions";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { QuestionRecord } from "@/data/queries/question.queries";
import type { PowerCardRecord } from "@/data/queries/powerCard.queries";
import {
  ROUND_CATEGORIES,
  SPECIAL_ROUND_MODES,
  type QuestionAssignmentMode,
  type RoundType,
  type RuleOverrideMode,
  type SpecialRoundMode,
} from "@/types/db";
import { ROUND_MODES } from "@/lib/roundModes";

const SECTIONS = ["Settings", "Power Cards", "Questions"] as const;
type Section = (typeof SECTIONS)[number];

const ROUND_TYPES: { label: string; value: RoundType }[] = [
  { label: "Normal", value: "GENERAL" },
  { label: "Text Q&A", value: "QUESTION_ANSWER" },
  { label: "Image", value: "IMAGE_BASED" },
  { label: "Drawing", value: "DRAWING" },
  { label: "Custom", value: "CUSTOM" },
];

interface RoundBuilderProps {
  round: RoundRecord;
  questions: QuestionRecord[];
  libraryQuestions: QuestionRecord[];
  powerCards: PowerCardRecord[];
  allRounds: RoundRecord[];
  roomUsageCount: number;
  /** Real teams of the room this round was opened from (via ?roomId=), in the
   * same creation-order used by the server's actual assignment logic — lets
   * the Questions tab preview true team names instead of generic "Team N". */
  roomTeams?: { id: string; name: string }[];
}

export function RoundBuilder({ round, questions, libraryQuestions, powerCards, allRounds, roomUsageCount, roomTeams }: RoundBuilderProps) {
  const [section, setSection] = useState<Section>("Settings");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-[12.5px] text-mute-2 flex-wrap">
        <Link href="/admin/rounds" className="hover:text-ink-2">
          Rounds
        </Link>
        <Icon name="chevron-right" size={13} className="text-faint" />
        <span className="text-ink-2 font-medium">{round.title}</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-[22px] font-bold text-ink-2 tracking-[-.02em]">{round.title}</span>
          <span className="text-[13px] text-mute-2">
            {round.roundType.replace(/_/g, " ")} · {round.questionCount} questions
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-md">
        {SECTIONS.map((item) => (
          <button
            key={item}
            onClick={() => setSection(item)}
            className={`px-3 py-2 rounded-xl text-[12.5px] font-medium border transition-colors cursor-pointer ${
              section === item
                ? "text-ink-2 bg-accent/[.14] border-accent/40"
                : "text-mute-2 bg-line/[.03] border-line/[.07] hover:text-ink-3"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {section === "Settings" && <RoundSettingsForm round={round} roomUsageCount={roomUsageCount} />}
      {section === "Power Cards" && <RoundPowerCardsTab round={round} powerCards={powerCards} roomUsageCount={roomUsageCount} />}
      {section === "Questions" && (
        <RoundQuestionsTab
          round={round}
          questions={questions}
          libraryQuestions={libraryQuestions}
          allRounds={allRounds}
          roomTeams={roomTeams}
        />
      )}
    </div>
  );
}

function RoundSettingsForm({ round, roomUsageCount }: { round: RoundRecord; roomUsageCount: number }) {
  const [title, setTitle] = useState(round.title);
  const [description, setDescription] = useState(round.description ?? "");
  const [rules, setRules] = useState(round.rules ?? "");
  const [category, setCategory] = useState(round.category ?? "Custom");
  const [roundType, setRoundType] = useState<RoundType>(round.roundType);
  const [specialMode, setSpecialMode] = useState<SpecialRoundMode>(round.specialMode);
  const [defaultTimer, setDefaultTimer] = useState(round.defaultTimer);
  const [scoringMode, setScoringMode] = useState<RuleOverrideMode>(round.scoringMode);
  const [positiveMarks, setPositiveMarks] = useState(round.positiveMarks);
  const [negativeMarks, setNegativeMarks] = useState(round.negativeMarks);
  const [bonusMarks, setBonusMarks] = useState(round.bonusMarks);
  const [questionAssignment, setQuestionAssignment] = useState<QuestionAssignmentMode>(round.questionAssignment);
  const [error, setError] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Parameters<typeof updateRound>[1] | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function buildPayload() {
    return {
      title: title.trim(),
      description: description.trim() || undefined,
      rules: rules.trim() || undefined,
      category,
      roundType,
      specialMode,
      scoringMode,
      defaultTimer,
      positiveMarks,
      negativeMarks,
      bonusMarks,
      questionAssignment,
    };
  }

  function save(strategy?: "UPDATE_SHARED" | "DUPLICATE") {
    setError(null);
    if (!title.trim()) return setError("Round name is required.");
    const payload = pendingPayload ?? buildPayload();
    if (roomUsageCount > 0 && !strategy) {
      setPendingPayload(payload);
      setSafetyOpen(true);
      return;
    }

    startTransition(async () => {
      try {
        if (strategy === "DUPLICATE") {
          const { id } = await duplicateRound(round.id);
          await updateRound(id, payload);
          router.push(`/admin/rounds/${id}`);
        } else {
          await updateRound(round.id, payload);
        }
        setPendingPayload(null);
        setSafetyOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save round.");
      }
    });
  }

  return (
    <Card className="rounded-2xl p-5 flex flex-col gap-4 max-w-2xl">
      <TextField label="Round name" value={title} onChange={setTitle} placeholder="Image Guess" />
      <TextField label="Description" value={description} onChange={setDescription} multiline />
      <TextField label="Rules" value={rules} onChange={setRules} multiline />

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

      <div className="flex flex-col gap-[7px]">
        <span className="text-xs font-semibold text-ink-3">Special mode (host-assisted)</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {SPECIAL_ROUND_MODES.map((mode) => {
            const def = ROUND_MODES[mode];
            const active = specialMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setSpecialMode(mode)}
                className={`flex items-center gap-1.5 rounded-[10px] border px-2.5 py-2 text-[12px] font-medium cursor-pointer transition-colors ${
                  active ? "border-accent/60 bg-accent/[.14] text-ink" : "border-line/[.09] bg-line/[.03] text-mute-2 hover:text-ink-2"
                }`}
              >
                {def.emoji && <span>{def.emoji}</span>}
                {def.label}
              </button>
            );
          })}
        </div>
        {specialMode !== "NONE" && (
          <span className="text-[11.5px] text-mute-2">{ROUND_MODES[specialMode].description}</span>
        )}
      </div>

      <NumberField label="Timer (seconds)" value={defaultTimer} onChange={setDefaultTimer} />

      <div className="grid grid-cols-2 gap-2">
        <Button variant={scoringMode === "INHERIT" ? "primary" : "subtle"} onClick={() => setScoringMode("INHERIT")}>
          Use Default Rules
        </Button>
        <Button variant={scoringMode === "CUSTOM" ? "primary" : "subtle"} onClick={() => setScoringMode("CUSTOM")}>
          Custom Rules
        </Button>
      </div>
      {scoringMode === "CUSTOM" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <NumberField label="Correct points" value={positiveMarks} onChange={setPositiveMarks} />
          <NumberField label="Wrong points" value={negativeMarks} onChange={setNegativeMarks} />
          <NumberField label="Bonus allowed" value={bonusMarks} onChange={setBonusMarks} />
        </div>
      )}

      <label className="flex flex-col gap-[7px]">
        <span className="text-xs font-semibold text-ink-3">Team order</span>
        <select
          value={questionAssignment}
          onChange={(event) => setQuestionAssignment(event.target.value as QuestionAssignmentMode)}
          className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none"
        >
          <option value="DEFAULT">Use competition default</option>
          <option value="ANY_TEAM">Any team answers</option>
          <option value="FIXED_ORDER">Fixed team order</option>
          <option value="HOST_CHOOSES">Host selects team</option>
          <option value="RANDOM_TEAM">Random team</option>
        </select>
        <span className="text-[11.5px] text-mute-2">
          {questionAssignment === "FIXED_ORDER"
            ? "Complete cycles follow team creation order; leftover questions go to randomly shuffled teams."
            : questionAssignment === "RANDOM_TEAM"
              ? "Questions use shuffled team cycles, keeping random order balanced across teams."
              : questionAssignment === "HOST_CHOOSES"
                ? "No team is pre-assigned; the host selects the team while scoring."
                : questionAssignment === "ANY_TEAM"
                  ? "No team is pre-assigned; any team may answer."
                  : "Uses the competition-level team assignment rule."}
        </span>
      </label>

      <ErrorText error={error} />
      <Button variant="primary" onClick={() => save()} loading={pending} className="self-start disabled:opacity-60">
        {pending ? "Saving..." : "Save Settings"}
      </Button>
      {safetyOpen && (
        <ConfirmSharedRoundModal
          roomUsageCount={roomUsageCount}
          pending={pending}
          onClose={() => setSafetyOpen(false)}
          onDuplicate={() => save("DUPLICATE")}
          onUpdateShared={() => save("UPDATE_SHARED")}
        />
      )}
    </Card>
  );
}

function RoundPowerCardsTab({
  round,
  powerCards,
  roomUsageCount,
}: {
  round: RoundRecord;
  powerCards: PowerCardRecord[];
  roomUsageCount: number;
}) {
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [pendingAllowedCards, setPendingAllowedCards] = useState<string[] | null>(null);
  // Tracks whether the pending change is a normal toggle (stays CUSTOM) or the
  // "Allow all" reset (goes back to DEFAULT) — both flow through the same
  // save-with-confirmation path when the round is already in use by a room.
  const [pendingMode, setPendingMode] = useState<"CUSTOM" | "DEFAULT">("CUSTOM");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const allowed = useMemo(() => new Set(round.allowedPowerCards), [round.allowedPowerCards]);
  const isRestricted = round.powerCardMode === "CUSTOM";

  function toggle(cardId: string) {
    const next = allowed.has(cardId)
      ? round.allowedPowerCards.filter((id) => id !== cardId)
      : [...round.allowedPowerCards, cardId];
    if (roomUsageCount > 0) {
      setPendingAllowedCards(next);
      setPendingMode("CUSTOM");
      setSafetyOpen(true);
      return;
    }
    saveAllowed(next, "CUSTOM", "UPDATE_SHARED");
  }

  function saveAllowed(next: string[], mode: "CUSTOM" | "DEFAULT", strategy: "UPDATE_SHARED" | "DUPLICATE") {
    startTransition(async () => {
      if (strategy === "DUPLICATE") {
        const { id } = await duplicateRound(round.id);
        await updateRound(id, { allowedPowerCards: next, powerCardMode: mode });
        router.push(`/admin/rounds/${id}`);
      } else {
        await updateRound(round.id, { allowedPowerCards: next, powerCardMode: mode });
      }
      setPendingAllowedCards(null);
      setSafetyOpen(false);
      router.refresh();
    });
  }

  // Once any checkbox is toggled the round is locked into CUSTOM mode — there
  // was previously no way back to "allow everything by default" short of
  // manually re-checking every card in the catalog (which also silently
  // excludes any card added to the library later, unlike true DEFAULT mode).
  // This restores that: clears the allow-list and flips the mode back.
  function resetToUnrestricted() {
    if (roomUsageCount > 0) {
      setPendingAllowedCards([]);
      setPendingMode("DEFAULT");
      setSafetyOpen(true);
      return;
    }
    saveAllowed([], "DEFAULT", "UPDATE_SHARED");
  }

  return (
    <Card className="rounded-2xl p-5 flex flex-col gap-3.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[13px] font-bold text-ink-2">Allowed power cards</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-[.04em] ${
            isRestricted ? "border-warn/35 bg-warn/[.08] text-warn" : "border-success/30 bg-success/[.08] text-success"
          }`}
        >
          {isRestricted ? "RESTRICTED" : "ALLOWS EVERYTHING"}
        </span>
        <Link href="/admin/power-cards" className="ml-auto">
          <Button variant="subtle" size="sm">Manage Library</Button>
        </Link>
        {isRestricted && (
          <Button variant="subtle" size="sm" onClick={resetToUnrestricted} disabled={pending}>
            <Icon name="rotate-ccw" size={13} />
            Allow all (reset)
          </Button>
        )}
      </div>
      <span className="text-[11.5px] text-mute-2 -mt-2">
        {isRestricted
          ? "This round only allows the cards checked below — everything else is off, including any new card you add to the library later."
          : "Every power card in your library is allowed by default, including ones you add later. Check a box to switch this round to a fixed allow-list instead."}
      </span>

      {powerCards.length === 0 ? (
        <span className="text-xs text-mute-2">No power cards in your library yet. Create cards from Build - Power Cards.</span>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {powerCards.map((card) => (
            <label
              key={card.id}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border cursor-pointer transition-colors ${
                allowed.has(card.id) ? "border-accent/40 bg-accent/[.06]" : "border-line/[.08] bg-elev"
              }`}
            >
              <input
                type="checkbox"
                checked={allowed.has(card.id)}
                onChange={() => toggle(card.id)}
                disabled={pending}
                className="accent-accent"
              />
              <CategoryIcon category={card.category} />
              <div className="flex flex-col min-w-0">
                <span className="text-[12.5px] font-semibold text-ink-2 truncate">{card.name}</span>
                <span className="text-[10px] text-dim truncate">{card.effectType.replace(/_/g, " ")}</span>
              </div>
              <RarityBadge rarity={card.rarity} />
            </label>
          ))}
        </div>
      )}

      {safetyOpen && pendingAllowedCards && (
        <ConfirmSharedRoundModal
          roomUsageCount={roomUsageCount}
          pending={pending}
          onClose={() => setSafetyOpen(false)}
          onDuplicate={() => saveAllowed(pendingAllowedCards, pendingMode, "DUPLICATE")}
          onUpdateShared={() => saveAllowed(pendingAllowedCards, pendingMode, "UPDATE_SHARED")}
        />
      )}
    </Card>
  );
}

function ConfirmSharedRoundModal({
  roomUsageCount,
  pending,
  onClose,
  onDuplicate,
  onUpdateShared,
}: {
  roomUsageCount: number;
  pending: boolean;
  onClose: () => void;
  onDuplicate: () => void;
  onUpdateShared: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(4,5,7,.62)] backdrop-blur-[4px]" onClick={onClose} />
      <Card className="relative w-full max-w-[480px] rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-ink">Reusable round</span>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-dim hover:bg-line/[.06]">
            <Icon name="x" size={15} />
          </button>
        </div>
        <span className="text-[13px] text-mute-2 leading-relaxed">
          This round is selected by {roomUsageCount} room{roomUsageCount === 1 ? "" : "s"}. Update all rooms that use it, or duplicate it and edit the copy.
        </span>
        <div className="flex items-center justify-end gap-2.5">
          <Button variant="plain" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="subtle" onClick={onDuplicate} disabled={pending}>
            Duplicate Copy
          </Button>
          <Button variant="primary" onClick={onUpdateShared} disabled={pending}>
            Update Shared
          </Button>
        </div>
      </Card>
    </div>
  );
}

const TEAM_PREVIEW_COLORS = [
  { badge: "bg-accent/20 text-accent border-accent/35" },
  { badge: "bg-success/20 text-success border-success/35" },
  { badge: "bg-warn/20 text-warn border-warn/35" },
  { badge: "bg-pink/20 text-pink border-pink/35" },
  { badge: "bg-info/20 text-info border-info/35" },
  { badge: "bg-amber/20 text-amber border-amber/35" },
];

interface AssignmentPreviewEntry {
  teamIndex: number | null; // null => decided randomly when the room generates its Event Flow
}

// Only the FIXED_ORDER complete-cycle portion is deterministic — it always
// follows team creation order, so it's shown as a real assignment. Leftover
// questions (FIXED_ORDER remainder) and all of RANDOM_TEAM are genuinely
// re-shuffled with Math.random() every time the room's Event Flow is
// (re)generated, so we mark them "Random" rather than faking a specific team.
function useAssignmentPreview(round: RoundRecord, questionIds: string[], teamCount: number) {
  return useMemo(() => {
    const mode = round.questionAssignment as QuestionAssignmentMode;
    if (mode !== "FIXED_ORDER" && mode !== "RANDOM_TEAM") return null;
    if (teamCount <= 0) return null;
    const byQuestion = new Map<string, AssignmentPreviewEntry>();
    if (mode === "FIXED_ORDER") {
      const completeCycleCount = Math.floor(questionIds.length / teamCount) * teamCount;
      questionIds.forEach((questionId, index) => {
        byQuestion.set(questionId, {
          teamIndex: index < completeCycleCount ? index % teamCount : null,
        });
      });
    } else {
      questionIds.forEach((questionId) => byQuestion.set(questionId, { teamIndex: null }));
    }
    return byQuestion;
  }, [round.questionAssignment, questionIds, teamCount]);
}

function RoundQuestionsTab({
  round,
  questions,
  libraryQuestions,
  allRounds,
  roomTeams,
}: {
  round: RoundRecord;
  questions: QuestionRecord[];
  libraryQuestions: QuestionRecord[];
  allRounds: RoundRecord[];
  roomTeams?: { id: string; name: string }[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [genericTeamCount, setGenericTeamCount] = useState(4);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const hasRoomTeams = Boolean(roomTeams && roomTeams.length > 0);
  const teamCount = hasRoomTeams ? roomTeams!.length : genericTeamCount;
  const questionIds = useMemo(() => questions.map((q) => q.id), [questions]);
  const preview = useAssignmentPreview(round, questionIds, teamCount);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    startTransition(async () => {
      await reorderRoundQuestions(round.id, next.map((q) => q.id));
      router.refresh();
    });
  }

  function remove(questionId: string) {
    startTransition(async () => {
      await removeQuestionFromRound(round.id, questionId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[13px] font-bold text-ink-2">Questions in this round</span>
        <Button variant="primary" size="sm" onClick={() => setPickerOpen(true)}>
          <Icon name="plus" size={13} />
          Add Questions
        </Button>
      </div>

      {preview && questions.length > 0 && (
        <div className="rounded-xl border border-line/[.08] bg-line/[.03] p-3 flex items-center gap-3 flex-wrap">
          {hasRoomTeams ? (
            <span className="text-[11.5px] text-mute-2">
              Team assignment for this round&apos;s &quot;
              {round.questionAssignment === "FIXED_ORDER" ? "Fixed team order" : "Random team"}&quot; setting,
              using this room&apos;s {roomTeams!.length} real teams.
            </span>
          ) : (
            <>
              <span className="text-[11.5px] text-mute-2">
                Preview team assignment for this round&apos;s &quot;
                {round.questionAssignment === "FIXED_ORDER" ? "Fixed team order" : "Random team"}&quot; setting with
              </span>
              <select
                value={genericTeamCount}
                onChange={(event) => setGenericTeamCount(Number(event.target.value))}
                className="bg-line/[.06] border border-line/[.12] rounded-lg px-2 py-1 text-[12px] text-ink outline-none"
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n} teams</option>
                ))}
              </select>
              <span className="text-[11px] text-dim">
                Open this round from a room (via its Rounds tab) to see the real teams.
              </span>
            </>
          )}
        </div>
      )}

      {questions.length === 0 ? (
        <Card className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center">
          <span className="text-[15px] font-bold text-ink">No questions attached yet</span>
          <Button variant="primary" onClick={() => setPickerOpen(true)}>
            Add Questions
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {questions.map((question, index) => {
            const entry = preview?.get(question.id);
            const color = entry && entry.teamIndex !== null ? TEAM_PREVIEW_COLORS[entry.teamIndex % TEAM_PREVIEW_COLORS.length] : null;
            const teamName = entry && entry.teamIndex !== null
              ? (hasRoomTeams ? roomTeams![entry.teamIndex].name : `Team ${entry.teamIndex + 1}`)
              : null;
            return (
              <Card key={question.id} className="rounded-xl p-3 flex items-center gap-3">
                <span className="font-mono text-[11px] font-bold text-accent bg-accent/10 border border-accent/25 rounded-lg px-2 py-1">
                  {index + 1}
                </span>
                <QuestionTypeBadge type={question.type} />
                <span className="text-[13px] text-ink-2 truncate flex-1">
                  {question.question || question.media?.name || "Untitled"}
                </span>
                {entry && teamName && color && (
                  <span className={`text-[10.5px] font-semibold rounded-full px-2.5 py-1 border shrink-0 ${color.badge}`}>
                    👥 {teamName}
                  </span>
                )}
                {entry && entry.teamIndex === null && (
                  <span
                    className="text-[10.5px] font-semibold rounded-full px-2.5 py-1 border border-line/[.14] bg-line/[.06] text-mute-2 shrink-0"
                    title="Assigned to a random team each time this room's Event Flow is generated"
                  >
                    🎲 Random
                  </span>
                )}
                <div className="flex gap-1 shrink-0">
                  <Button variant="plain" size="sm" onClick={() => move(index, -1)} disabled={index === 0 || pending}>
                    Up
                  </Button>
                  <Button
                    variant="plain"
                    size="sm"
                    onClick={() => move(index, 1)}
                    disabled={index === questions.length - 1 || pending}
                  >
                    Down
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => remove(question.id)} disabled={pending}>
                    Remove
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <QuestionPickerModal
        roundId={round.id}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        libraryQuestions={libraryQuestions}
        alreadyInRound={round.questionIds}
        rounds={allRounds}
      />
    </div>
  );
}
