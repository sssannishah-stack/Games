"use client";

import { useEffect } from "react";
import type { RoomDetail } from "@/data/queries/room.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { OverviewRow, RoundBreakdown, EconomyRow, CompetitionStatistics } from "@/data/queries/analytics.queries";

export function PrintReport({
  room,
  teams,
  overview,
  roundBreakdown,
  economy,
  statistics,
}: {
  room: RoomDetail;
  teams: TeamRecord[];
  overview: OverviewRow[];
  roundBreakdown: RoundBreakdown;
  economy: EconomyRow[];
  statistics: CompetitionStatistics;
}) {
  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#111", padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none; }
        }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 12px; }
        th { background: #f3f3f3; font-weight: 700; }
        h1 { font-size: 22px; margin-bottom: 2px; }
        h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 2px solid #333; padding-bottom: 4px; }
        .sub { color: #666; font-size: 13px; margin-bottom: 20px; }
      `}</style>

      <button className="no-print" onClick={() => window.print()} style={{ float: "right", padding: "8px 14px" }}>
        Print / Save as PDF
      </button>
      <h1>{room.name} — Competition Report</h1>
      <p className="sub">
        {room.competitionTitle} · {room.roomCode} · Generated {new Date().toLocaleString()}
      </p>

      <h2>Overview</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th><th>Team</th><th>Score</th><th>Coins</th><th>Power Cards</th><th>Correct</th><th>Wrong</th><th>Streak</th>
          </tr>
        </thead>
        <tbody>
          {overview.map((r) => (
            <tr key={r.teamId}>
              <td>#{r.rank}</td><td>{r.name}</td><td>{r.score}</td><td>{r.coins}</td>
              <td>{r.powerCardsRemaining}</td><td>{r.correctAnswers}</td><td>{r.wrongAnswers}</td><td>{r.streak}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {roundBreakdown.rounds.length > 0 && (
        <>
          <h2>Round Breakdown</h2>
          <table>
            <thead>
              <tr>
                <th>Round</th>
                {roundBreakdown.teams.map((t) => (
                  <th key={t.id}>{t.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roundBreakdown.rounds.map((round) => (
                <tr key={round.roundId}>
                  <td>{round.title}</td>
                  {roundBreakdown.teams.map((t) => (
                    <td key={t.id}>{roundBreakdown.matrix[round.roundId]?.[t.id] ?? 0}</td>
                  ))}
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td>Round Total</td>
                {roundBreakdown.teams.map((t) => (
                  <td key={t.id}>{roundBreakdown.totals[t.id] ?? 0}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </>
      )}

      <h2>Economy</h2>
      <table>
        <thead>
          <tr><th>Team</th><th>Earned</th><th>Spent</th><th>Current</th></tr>
        </thead>
        <tbody>
          {economy.map((r) => (
            <tr key={r.teamId}>
              <td>{r.name}</td><td>+{r.earned}</td><td>−{r.spent}</td><td>{r.current}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Statistics</h2>
      <table>
        <tbody>
          {Object.entries(statistics).map(([key, value]) => (
            <tr key={key}>
              <td style={{ fontWeight: 600 }}>{key.replace(/([A-Z])/g, " $1").trim()}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
