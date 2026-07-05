"use client";

import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { Kbd } from "@/components/ui/Kbd";
import { TeamChip } from "@/components/ui/TeamChip";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useHostStore } from "@/stores/hostStore";
import { mockTeams, getTeam } from "@/data/mock/teams";
import { markReasons } from "@/data/mock/live";
import { cn } from "@/lib/utils";

const PAD: { value: number | null; label: string; key: string; tone: "plus" | "zero" | "minus" | "custom" }[] = [
  { value: 20, label: "+20", key: "Q", tone: "plus" },
  { value: 10, label: "+10", key: "W", tone: "plus" },
  { value: 5, label: "+5", key: "E", tone: "plus" },
  { value: 0, label: "0", key: "R", tone: "zero" },
  { value: -5, label: "−5", key: "D", tone: "minus" },
  { value: -10, label: "−10", key: "F", tone: "minus" },
  { value: null, label: "Custom", key: "C", tone: "custom" },
];

/* V2-02 · Give Marks pad — one click, one reason, applied. Always undoable. */
export function GiveMarksModal() {
  const {
    marksOpen,
    closeMarks,
    markTeamId,
    setMarkTeam,
    markMemberId,
    setMarkMember,
    markValue,
    setMarkValue,
    markReason,
    setMarkReason,
  } = useHostStore();

  const team = getTeam(markTeamId);
  const member = team?.members.find((m) => m.id === markMemberId);
  const newScore = team ? team.score + (markValue ?? 0) : 0;

  return (
    <Modal open={marksOpen} onClose={closeMarks} className="max-w-[680px]">
      {/* header */}
      <div className="flex items-center gap-3 px-6 py-[18px] border-b border-line/[.07]">
        <div className="w-[34px] h-[34px] rounded-[10px] bg-success/[.12] flex items-center justify-center">
          <Icon name="badge-plus" size={17} className="text-success" />
        </div>
        <div className="flex flex-col">
          <span className="text-[15.5px] font-bold text-ink">Give marks</span>
          <span className="text-[11.5px] text-mute-2">
            Scene 07 · Question 3 · logged with reason, host and timestamp
          </span>
        </div>
        <Kbd className="ml-auto text-[10px] px-[7px] py-[3px] rounded-[5px]">M</Kbd>
        <button
          onClick={closeMarks}
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-dim hover:bg-line/[.06] hover:text-ink-2 cursor-pointer"
        >
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className="px-6 py-5 flex flex-col gap-[18px]">
        {/* team picker */}
        <div className="flex gap-2 flex-wrap">
          {mockTeams.slice(0, 5).map((t, i) => (
            <TeamChip
              key={t.id}
              team={t}
              selected={t.id === markTeamId}
              onClick={() => setMarkTeam(t.id)}
              suffix={String(i + 1)}
              className="flex-1 min-w-[100px] text-[12.5px] rounded-[11px] px-3.5 py-[9px]"
            />
          ))}
        </div>

        {/* member (optional) — host may credit the whole team or one member */}
        {team && team.members.length > 0 && (
          <div className="flex flex-col gap-2">
            <SectionLabel>MEMBER — OPTIONAL · WHO ANSWERED FOR THE TEAM</SectionLabel>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setMarkMember(null)}
                className={cn(
                  "text-[11.5px] rounded-full px-3 py-1.5 cursor-pointer transition-colors border",
                  markMemberId === null
                    ? "font-semibold text-ink bg-line/[.09] border-line/[.18]"
                    : "text-mute bg-line/[.04] border-line/[.09] hover:text-ink-2 hover:border-line/20"
                )}
              >
                Whole team
              </button>
              {team.members.map((m) => {
                const selected = m.id === markMemberId;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMarkMember(m.id)}
                    className={cn(
                      "flex items-center gap-[7px] text-[11.5px] rounded-full py-1.5 pl-1.5 pr-3 cursor-pointer transition-colors border",
                      selected
                        ? "font-semibold text-ink bg-line/[.09] border-line/[.2]"
                        : "text-ink-3 bg-line/[.04] border-line/[.09] hover:border-line/20"
                    )}
                  >
                    <span
                      className="w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[8px] font-bold text-white"
                      style={{ background: m.gradient }}
                    >
                      {m.initial}
                    </span>
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* value pad */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {PAD.map((p) => {
            const selected = p.value === markValue && p.value !== null;
            return (
              <button
                key={p.label}
                onClick={() => setMarkValue(p.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-[13px] py-4 cursor-pointer transition",
                  p.tone === "plus" &&
                    "bg-success/[.12] text-success font-mono font-bold text-[19px] hover:bg-success/[.22] " +
                      (selected
                        ? "border-[1.5px] border-success shadow-[0_0_0_3px_rgba(61,214,140,.14)]"
                        : "border border-success/35"),
                  p.tone === "zero" &&
                    "bg-line/[.04] border border-line/10 text-ink-3 font-mono font-bold text-[19px] hover:bg-line/[.09]",
                  p.tone === "minus" &&
                    "bg-danger/[.09] border border-danger/30 text-danger-soft font-mono font-bold text-[19px] hover:bg-danger/[.17]",
                  p.tone === "custom" &&
                    "bg-line/[.04] border border-dashed border-line/[.18] text-ink-3 text-[13px] font-semibold hover:border-accent"
                )}
              >
                <span className={p.tone === "custom" ? "" : "font-mono"}>{p.label}</span>
                <span
                  className={cn(
                    "font-mono font-medium text-[9px]",
                    p.tone === "plus" ? "text-[#4d7a63]" : p.tone === "minus" ? "text-[#7a4d4d]" : "text-dim-2"
                  )}
                >
                  {p.key}
                </span>
              </button>
            );
          })}
        </div>

        {/* reason */}
        <div className="flex flex-col gap-2">
          <SectionLabel>REASON — SHOWN ON PHONES &amp; IN SCORE HISTORY</SectionLabel>
          <div className="flex gap-1.5 flex-wrap">
            {markReasons.map((reason) => {
              const selected = reason === markReason;
              return (
                <button
                  key={reason}
                  onClick={() => setMarkReason(reason)}
                  className={cn(
                    "text-xs rounded-full px-[13px] py-1.5 cursor-pointer transition-colors border",
                    selected
                      ? "font-semibold text-success bg-success/[.12] border-success/35"
                      : "text-mute bg-line/[.04] border-line/[.09] hover:text-ink-2 hover:border-line/20"
                  )}
                >
                  {selected ? `✓ ${reason}` : reason}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="flex items-center gap-3 px-6 py-4 border-t border-line/[.07] bg-line/[.015] flex-wrap">
        {team && (
          <span className="flex items-center gap-2 text-[13px] text-ink-3">
            <span className="w-2 h-2 rounded-full" style={{ background: team.color }} />
            {team.name}
            {member && <span className="text-[11.5px] text-mute-2">· {member.name}</span>}
            <span className="font-mono font-semibold text-[13px] text-mute-2">{team.score}</span>
            <Icon name="arrow-right" size={13} className="text-dim-2" />
            <span className="font-mono font-bold text-[15px] text-success">{newScore}</span>
            <span className="text-[11.5px] text-dim">· {markReason}</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2.5">
          <span className="text-[11.5px] text-dim flex items-center gap-1">
            <Icon name="undo-2" size={12} />
            undoable for the whole show
          </span>
          <button
            onClick={closeMarks}
            className="flex items-center gap-2 bg-accent rounded-[11px] px-5 py-2.5 text-[13.5px] font-bold text-white shadow-[0_8px_24px_rgba(108,123,250,.4)] hover:brightness-110 cursor-pointer"
          >
            Apply
            <span className="font-mono font-medium text-[9.5px] bg-line/20 rounded px-1.5 py-0.5">↵</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
