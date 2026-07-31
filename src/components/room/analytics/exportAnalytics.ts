import type { RoomDetail } from "@/data/queries/room.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { AnalyticsBundle } from "./AnalyticsCenter";

type Row = (string | number)[];

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(rows: Row[]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function download(filename: string, mime: string, content: string | Blob) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Builds the same set of labeled sections for both CSV (flattened, one file) and XLSX (one sheet per section). */
function buildSections(room: RoomDetail, teams: TeamRecord[], analytics: AnalyticsBundle): { name: string; rows: Row[] }[] {
  const overviewRows: Row[] = [
    ["Rank", "Team", "Score", "Coins", "Power Cards", "Correct", "Wrong", "Streak"],
    ...analytics.overview.map((r) => [r.rank, r.name, r.score, r.coins, r.powerCardsRemaining, r.correctAnswers, r.wrongAnswers, r.streak]),
  ];

  const { rounds, teams: bTeams, matrix, totals } = analytics.roundBreakdown;
  const roundRows: Row[] = [
    ["Round", ...bTeams.map((t) => t.name)],
    ...rounds.map((r) => [r.title, ...bTeams.map((t) => matrix[r.roundId]?.[t.id] ?? 0)]),
    ["Round Total", ...bTeams.map((t) => totals[t.id] ?? 0)],
  ];

  const economyRows: Row[] = [
    ["Team", "Started", "Earned", "Spent", "Current"],
    ...analytics.economy.map((r) => [r.name, r.byType.STARTING_BONUS ?? 0, r.earned, r.spent, r.current]),
  ];

  const statsEntries = Object.entries(analytics.statistics) as [string, number][];
  const statsRows: Row[] = [
    ["Metric", "Value"],
    ...statsEntries.map(([k, v]) => [k.replace(/([A-Z])/g, " $1").trim(), v]),
  ];

  const timelineRows: Row[] = [
    ["Time", "Team", "Event"],
    ...analytics.timeline.map((e) => [new Date(e.createdAt).toLocaleString(), e.teamName ?? "", e.text]),
  ];

  return [
    { name: "Overview", rows: overviewRows },
    { name: "Round Breakdown", rows: roundRows },
    { name: "Economy", rows: economyRows },
    { name: "Statistics", rows: statsRows },
    { name: "Timeline", rows: timelineRows },
  ];
}

export function exportCsv(room: RoomDetail, teams: TeamRecord[], analytics: AnalyticsBundle) {
  const sections = buildSections(room, teams, analytics);
  const csv = sections.map((s) => `${s.name}\n${rowsToCsv(s.rows)}`).join("\n\n");
  download(`${room.name.replace(/\s+/g, "-")}-analytics.csv`, "text/csv;charset=utf-8", csv);
}

export async function exportXlsx(room: RoomDetail, teams: TeamRecord[], analytics: AnalyticsBundle) {
  const XLSX = await import("xlsx");
  const sections = buildSections(room, teams, analytics);
  const wb = XLSX.utils.book_new();
  for (const section of sections) {
    const ws = XLSX.utils.aoa_to_sheet(section.rows);
    XLSX.utils.book_append_sheet(wb, ws, section.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${room.name.replace(/\s+/g, "-")}-analytics.xlsx`);
}
