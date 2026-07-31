"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import type { RoomDetail } from "@/data/queries/room.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type {
  OverviewRow,
  RoundBreakdown,
  TimelineEntry,
  EconomyRow,
  PowerCardUsageRow,
  CompetitionStatistics,
} from "@/data/queries/analytics.queries";
import type { AchievementRecord } from "@/data/queries/achievement.queries";
import { OverviewTab } from "./OverviewTab";
import { RoundBreakdownTab } from "./RoundBreakdownTab";
import { TimelineTab } from "./TimelineTab";
import { EconomyTab } from "./EconomyTab";
import { PowerCardsTab } from "./PowerCardsTab";
import { AchievementsTab } from "./AchievementsTab";
import { StatisticsTab } from "./StatisticsTab";
import { TeamDetailDrawer } from "./TeamDetailDrawer";
import { exportCsv, exportXlsx } from "./exportAnalytics";

/** Everything the Competition Analytics Center needs, fetched once server-side. */
export interface AnalyticsBundle {
  overview: OverviewRow[];
  roundBreakdown: RoundBreakdown;
  timeline: TimelineEntry[];
  economy: EconomyRow[];
  powerCardUsage: PowerCardUsageRow[];
  statistics: CompetitionStatistics;
  achievements: AchievementRecord[];
}

const TABS = [
  "Overview",
  "Round Breakdown",
  "Timeline",
  "Economy",
  "Power Cards",
  "Achievements",
  "Statistics",
] as const;
type Tab = (typeof TABS)[number];

/**
 * Host-only "why is this team winning" dashboard — a new tab in the Room
 * dashboard (not the live Host Console), built on top of the append-only
 * ledgers (ScoreTransaction/CoinTransaction/EventLog/PowerCardRequest) that
 * already exist. Works both mid-event (auto-refreshes) and post-event
 * (becomes a static report) since it's the same data either way.
 */
export function AnalyticsCenter({
  room,
  teams,
  analytics,
}: {
  room: RoomDetail;
  teams: TeamRecord[];
  analytics: AnalyticsBundle;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [search, setSearch] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const router = useRouter();

  // Live mode: while this tab is open (i.e. this component is mounted — the
  // Room dashboard unmounts inactive sections), refresh the whole page's data
  // periodically so standings update during a live event. Same interval
  // pattern already used by HostConsole's own live-refresh loop.
  useEffect(() => {
    if (room.status !== "LIVE" && room.status !== "TESTING") return;
    const interval = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [room.status, router]);

  const q = search.trim().toLowerCase();
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const selectedTeam = selectedTeamId ? teamById.get(selectedTeamId) ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[13px] font-bold text-ink-2">Competition Analytics Center</span>
        {(room.status === "LIVE" || room.status === "TESTING") && (
          <span className="flex items-center gap-1 rounded-full bg-success/10 border border-success/30 px-2 py-0.5 text-[10px] font-bold text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-enc-pulse" />
            LIVE
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team, round, question, card…"
              className="w-[220px] bg-line/[.04] border border-line/[.09] rounded-[10px] pl-8 pr-3 py-1.5 text-[12.5px] text-ink outline-none"
            />
          </div>
          <div className="relative">
            <Button variant="subtle" size="sm" onClick={() => setExportOpen((v) => !v)}>
              <Icon name="download" size={13} />
              Export
            </Button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-[80]" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-[calc(100%+6px)] z-[81] w-[180px] rounded-xl border border-line/[.1] bg-surface shadow-[0_12px_40px_rgba(0,0,0,.25)] p-1.5 flex flex-col gap-0.5">
                  <button
                    onClick={() => {
                      exportCsv(room, teams, analytics);
                      setExportOpen(false);
                    }}
                    className="text-left px-2.5 py-2 rounded-lg text-[12.5px] font-semibold text-ink-2 hover:bg-line/[.06] cursor-pointer"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => {
                      exportXlsx(room, teams, analytics);
                      setExportOpen(false);
                    }}
                    className="text-left px-2.5 py-2 rounded-lg text-[12.5px] font-semibold text-ink-2 hover:bg-line/[.06] cursor-pointer"
                  >
                    Export Excel
                  </button>
                  <a
                    href={`/admin/rooms/${room.id}/analytics/print`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setExportOpen(false)}
                    className="text-left px-2.5 py-2 rounded-lg text-[12.5px] font-semibold text-ink-2 hover:bg-line/[.06] cursor-pointer"
                  >
                    Export PDF (print)
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap border-b border-line/[.08] pb-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold cursor-pointer transition-colors ${
              tab === t ? "bg-accent/15 border border-accent/40 text-ink" : "border border-transparent text-mute-2 hover:text-ink-2 hover:bg-line/[.04]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab rows={analytics.overview} search={q} onSelectTeam={setSelectedTeamId} />}
      {tab === "Round Breakdown" && (
        <RoundBreakdownTab breakdown={analytics.roundBreakdown} search={q} onSelectTeam={setSelectedTeamId} />
      )}
      {tab === "Timeline" && <TimelineTab entries={analytics.timeline} search={q} />}
      {tab === "Economy" && <EconomyTab rows={analytics.economy} search={q} onSelectTeam={setSelectedTeamId} />}
      {tab === "Power Cards" && <PowerCardsTab rows={analytics.powerCardUsage} search={q} />}
      {tab === "Achievements" && <AchievementsTab roomId={room.id} rows={analytics.achievements} teams={teams} />}
      {tab === "Statistics" && <StatisticsTab stats={analytics.statistics} />}

      {selectedTeam && (
        <TeamDetailDrawer
          team={selectedTeam}
          analytics={analytics}
          onClose={() => setSelectedTeamId(null)}
        />
      )}
    </div>
  );
}
