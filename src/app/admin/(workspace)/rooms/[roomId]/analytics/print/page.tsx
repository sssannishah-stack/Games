import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { getRoomById } from "@/data/queries/room.queries";
import { getTeamsByRoom } from "@/data/queries/team.queries";
import {
  getOverviewRows,
  getRoundBreakdown,
  getEconomyBreakdown,
  getCompetitionStatistics,
} from "@/data/queries/analytics.queries";
import { PrintReport } from "./PrintReport";

/**
 * A print-optimized static report — no interactivity, just the numbers laid
 * out for `window.print()` -> "Save as PDF". Reuses the same analytics
 * queries as the live dashboard so the export always matches what's shown.
 */
export default async function AnalyticsPrintPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const user = await requireUser();
  const room = await getRoomById(roomId, user.id);
  if (!room) notFound();

  const [teams, overview, roundBreakdown, economy, statistics] = await Promise.all([
    getTeamsByRoom(roomId),
    getOverviewRows(roomId),
    getRoundBreakdown(roomId),
    getEconomyBreakdown(roomId),
    getCompetitionStatistics(roomId),
  ]);

  return (
    <PrintReport
      room={room}
      teams={teams}
      overview={overview}
      roundBreakdown={roundBreakdown}
      economy={economy}
      statistics={statistics}
    />
  );
}
