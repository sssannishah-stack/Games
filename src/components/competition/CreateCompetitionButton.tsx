"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { createCompetition } from "@/actions/competition.actions";
import type { CompetitionSettings } from "@/types/db";
import { cn } from "@/lib/utils";

const LANGUAGES = ["English", "Gujarati", "Hindi"];
const THEMES = [
  { value: "#6C7BFA", label: "Dark" },
  { value: "#2FBFA7", label: "Temple" },
  { value: "#E8A33D", label: "Kids" },
  { value: "#E36A8A", label: "Festival" },
];

interface CreateCompetitionButtonProps {
  label?: string;
  variant?: "primary" | "outline";
}

const inputClass =
  "bg-line/[.04] border border-line/[.1] rounded-[11px] px-3.5 py-[11px] text-sm text-ink outline-none focus:border-accent/60";

function defaultCompetitionSettings(mode: CompetitionSettings["mode"]): CompetitionSettings {
  return {
    mode,
    room: {
      name: "Main Room",
      joinMethod: "BOTH",
      participantJoining: "ANYONE",
    },
    permissions: {
      viewLeaderboard: true,
      viewTeamScore: true,
      viewPowerCards: true,
    },
    scoring: {
      defaultCorrect: 10,
      defaultWrong: -5,
      defaultTimer: 30,
      defaultCoinReward: 100,
      defaultPowerCardApprovalRequired: true,
      allowNegative: true,
      allowBonus: true,
      manualScoring: true,
      questionAssignment: "ANY_TEAM",
    },
    turnRules: {
      enableTeamTurns: false,
      allowStealing: false,
      allowChallenges: false,
    },
    economy: {
      enabled: mode === "ADVANCED",
      startingCoins: 5000,
      correctAnswerCoins: 100,
      fastAnswerBonusCoins: 25,
      roundWinnerCoins: 250,
      storeAvailability: "BETWEEN_ROUNDS",
    },
    setupDraft: {
      teams: [],
      rounds: [],
    },
  };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold text-ink-3">{children}</span>;
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[10px] border px-3 py-2 text-[12.5px] font-semibold transition-colors",
        active
          ? "border-accent/60 bg-accent/[.16] text-ink"
          : "border-line/[.09] bg-line/[.035] text-mute-2 hover:text-ink-2"
      )}
    >
      {children}
    </button>
  );
}

export function CreateCompetitionButton({
  label = "Create Competition",
  variant = "primary",
}: CreateCompetitionButtonProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [theme, setTheme] = useState(THEMES[0].value);
  const [mode, setMode] = useState<CompetitionSettings["mode"]>("SIMPLE");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function close() {
    if (!pending) setOpen(false);
  }

  function reset() {
    setTitle("");
    setDescription("");
    setLanguage(LANGUAGES[0]);
    setTheme(THEMES[0].value);
    setMode("SIMPLE");
    setError(null);
  }

  function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Competition name is required.");
      return;
    }

    startTransition(async () => {
      try {
        const { id } = await createCompetition({
          title: title.trim(),
          description: description.trim() || undefined,
          language,
          theme,
          settings: defaultCompetitionSettings(mode),
          powerCards: [],
        });
        setOpen(false);
        reset();
        router.push(`/admin/competitions/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create competition.");
      }
    });
  }

  return (
    <>
      <Button
        variant={variant === "primary" ? "primary" : "outline"}
        size="md"
        className="px-4 py-[9px] text-[13px]"
        onClick={() => setOpen(true)}
      >
        <Icon name="plus" size={15} />
        {label}
      </Button>

      <Modal open={open} onClose={close} className="max-w-[620px]">
        <div className="flex items-center gap-3 px-5 sm:px-6 py-5 border-b border-line/[.07]">
          <div className="flex flex-col gap-px min-w-0">
            <span className="text-base font-bold text-ink tracking-[-.01em]">
              Create competition
            </span>
            <span className="text-xs text-mute-2 truncate">
              Create the event container. Rooms, teams, rounds and scenes are set up next.
            </span>
          </div>
          <button
            onClick={close}
            className="ml-auto w-[30px] h-[30px] rounded-lg flex items-center justify-center text-dim hover:bg-line/[.06] hover:text-ink-2 cursor-pointer"
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 flex flex-col gap-4">
          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Competition name</FieldLabel>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Summer Camp 2026"
              className={inputClass}
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-[7px]">
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="3 day knowledge competition"
              className={`${inputClass} resize-none`}
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-3.5">
            <label className="flex flex-col gap-[7px]">
              <FieldLabel>Language</FieldLabel>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className={inputClass}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang} className="bg-surface">
                    {lang}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-[7px]">
              <FieldLabel>Theme</FieldLabel>
              <div className="flex gap-2 items-center h-[42px]">
                {THEMES.map((themeOption) => (
                  <button
                    type="button"
                    key={themeOption.value}
                    onClick={() => setTheme(themeOption.value)}
                    title={themeOption.label}
                    className={cn(
                      "w-8 h-8 rounded-[9px] cursor-pointer transition",
                      theme === themeOption.value && "ring-2 ring-ink ring-offset-2 ring-offset-card"
                    )}
                    style={{ background: themeOption.value }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[7px]">
            <FieldLabel>Default settings</FieldLabel>
            <div className="grid sm:grid-cols-2 gap-2">
              <ModeButton active={mode === "SIMPLE"} onClick={() => setMode("SIMPLE")}>
                Simple mode
              </ModeButton>
              <ModeButton active={mode === "ADVANCED"} onClick={() => setMode("ADVANCED")}>
                Economy mode
              </ModeButton>
            </div>
          </div>

          {error && (
            <span className="text-[12.5px] text-danger-soft bg-danger/[.08] border border-danger/25 rounded-[10px] px-3 py-2">
              {error}
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
          <Button variant="plain" size="md" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            className="disabled:opacity-60"
            onClick={submit}
            loading={pending}
          >
            {pending ? "Creating..." : "Create"}
            {!pending && <Icon name="check" size={14} />}
          </Button>
        </div>
      </Modal>
    </>
  );
}
