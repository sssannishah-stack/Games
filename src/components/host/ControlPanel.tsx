"use client";

import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { TeamChip } from "@/components/ui/TeamChip";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TimerControl } from "@/components/host/TimerControl";
import { TeamCard } from "@/components/team/TeamCard";
import { PowerCardRequestTile } from "@/components/lifeline/LifelineRequest";
import { useHostStore } from "@/stores/hostStore";
import { mockTeams } from "@/data/mock/teams";
import { mockApprovals, mockTimeline, quickBroadcasts } from "@/data/mock/live";
import { cn } from "@/lib/utils";
import type { ControlTab } from "@/stores/hostStore";

const QUICK_VALUES = [
  { label: "+20", tone: "plus" },
  { label: "+10", tone: "plus" },
  { label: "+5", tone: "plus" },
  { label: "0", tone: "zero" },
  { label: "−5", tone: "minus" },
  { label: "−10", tone: "minus" },
] as const;

const REASON_CHIPS = ["Correct", "Half answer", "Bonus", "Penalty"];

function QuickMarks() {
  const { markTeamId, setMarkTeam } = useHostStore();
  return (
    <Card className="px-3.5 py-3 flex flex-col gap-2.5">
      <SectionLabel>
        QUICK MARKS
        <span className="ml-auto font-medium tracking-normal text-dim-2">M = full pad</span>
      </SectionLabel>
      <div className="flex gap-[5px] flex-wrap">
        {mockTeams.slice(0, 5).map((team) => (
          <TeamChip
            key={team.id}
            team={team}
            selected={team.id === markTeamId}
            onClick={() => setMarkTeam(team.id)}
            className="text-[11px] px-2 py-1"
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {QUICK_VALUES.map((v) => (
          <button
            key={v.label}
            className={cn(
              "flex items-center justify-center rounded-[10px] py-[11px] font-mono font-bold text-[15px] cursor-pointer transition-colors",
              v.tone === "plus" &&
                "bg-success/10 border border-success/30 text-success hover:bg-success/20",
              v.tone === "zero" &&
                "bg-line/[.04] border border-line/10 text-ink-3 hover:bg-line/[.09]",
              v.tone === "minus" &&
                "bg-danger/[.08] border border-danger/25 text-danger-soft hover:bg-danger/[.16]"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="flex gap-[5px] flex-wrap">
        {REASON_CHIPS.map((reason, i) => (
          <button
            key={reason}
            className={cn(
              "text-[10.5px] rounded-full px-2.5 py-[3px] cursor-pointer",
              i === 0
                ? "font-semibold text-success bg-success/10"
                : "text-mute bg-line/[.05] hover:text-ink-2"
            )}
          >
            {reason}
          </button>
        ))}
      </div>
    </Card>
  );
}

function Broadcast() {
  return (
    <Card className="px-3.5 py-3 flex flex-col gap-2.5">
      <SectionLabel>BROADCAST · B</SectionLabel>
      <div className="flex gap-1.5">
        <input
          placeholder="Announce something…"
          className="flex-1 bg-line/[.04] border border-line/[.09] rounded-[9px] px-3 py-2 text-xs text-ink-2 placeholder:text-dim outline-none min-w-0"
        />
        <button className="w-[34px] rounded-[9px] bg-accent flex items-center justify-center hover:brightness-110 cursor-pointer">
          <Icon name="send-horizontal" size={14} className="text-white" />
        </button>
      </div>
      <div className="flex gap-[5px] flex-wrap">
        <button className="text-[10.5px] text-mute bg-line/[.05] rounded-full px-2.5 py-[3px] hover:text-ink-2 cursor-pointer">☕ Tea break</button>
        <button className="text-[10.5px] text-mute bg-line/[.05] rounded-full px-2.5 py-[3px] hover:text-ink-2 cursor-pointer">🤫 Please maintain silence</button>
        <button className="text-[10.5px] text-mute bg-line/[.05] rounded-full px-2.5 py-[3px] hover:text-ink-2 cursor-pointer">▶ Round starts</button>
      </div>
    </Card>
  );
}

/* RIGHT panel — Controls / Approvals / Teams / Timeline tabs. */
export function ControlPanel() {
  const { controlTab, setControlTab, openTeamDrawer } = useHostStore();

  return (
    <div className="border-l border-line/[.06] flex flex-col overflow-hidden">
      <Tabs
        tabs={[
          { label: "Controls" },
          {
            label: "Approvals",
            badge: (
              <span className="font-mono font-semibold text-[10px] bg-danger text-white rounded-full px-1.5 py-px">
                2
              </span>
            ),
          },
          { label: "Teams" },
          { label: "Timeline" },
        ]}
        active={controlTab}
        onChange={(label) => setControlTab(label as ControlTab)}
      />

      <div className="p-3 flex flex-col gap-2.5 overflow-y-auto">
        {controlTab === "Controls" && (
          <>
            <TimerControl />
            <QuickMarks />
            <PowerCardRequestTile
              request={mockApprovals[0]}
              pendingCount={2}
              extraNote="Stars requested a Hint"
            />
            <Broadcast />
          </>
        )}

        {controlTab === "Approvals" && (
          <>
            {mockApprovals.map((request) => (
              <PowerCardRequestTile key={request.id} request={request} />
            ))}
          </>
        )}

        {controlTab === "Teams" && (
          <>
            {mockTeams.slice(0, 5).map((team) => (
              <TeamCard key={team.id} team={team} onClick={() => openTeamDrawer(team.id)} />
            ))}
          </>
        )}

        {controlTab === "Timeline" && (
          <div className="flex flex-col gap-1.5 text-[11px] text-mute-2 px-1 pt-1">
            {mockTimeline.map((e) => (
              <span key={e.id} className="flex gap-2">
                <span className="font-mono font-medium text-[10px] text-label pt-px">{e.time}</span>
                <span>
                  {e.bold && <b className="text-ink-3">{e.bold}</b>} {e.text}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* quick broadcast strip (from v1 bottom bar) */}
      <div className="mt-auto px-3 py-2.5 border-t border-line/[.06] hidden 2xl:flex items-center gap-1.5 flex-wrap">
        {quickBroadcasts.map((b) => (
          <button
            key={b.label}
            className="flex items-center gap-1.5 text-[11px] text-ink-3 bg-line/[.04] border border-line/[.09] rounded-full px-2.5 py-1 hover:bg-line/[.09] cursor-pointer"
          >
            <Icon name={b.icon} size={12} />
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
