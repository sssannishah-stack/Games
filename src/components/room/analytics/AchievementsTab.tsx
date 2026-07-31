"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { awardAchievement, dismissAchievement } from "@/actions/achievement.actions";
import { ACHIEVEMENTS } from "@/lib/achievements";
import type { AchievementRecord } from "@/data/queries/achievement.queries";
import type { TeamRecord } from "@/data/queries/team.queries";

export function AchievementsTab({
  roomId,
  rows,
  teams,
}: {
  roomId: string;
  rows: AchievementRecord[];
  teams: TeamRecord[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const teamById = new Map(teams.map((t) => [t.id, t]));

  function act(run: () => Promise<void>) {
    startTransition(async () => {
      await run();
      router.refresh();
    });
  }

  const suggested = rows.filter((r) => r.status === "SUGGESTED");
  const awarded = rows.filter((r) => r.status === "AWARDED");

  if (rows.length === 0) {
    return (
      <Card className="rounded-2xl p-8 text-center text-[12.5px] text-mute-2">
        No achievements yet — they're detected automatically from streaks, comebacks, and first blood as the event runs.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {suggested.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[.1em] text-warn">AWAITING HOST APPROVAL</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {suggested.map((row) => {
              const def = ACHIEVEMENTS[row.type];
              return (
                <Card key={row.id} className="rounded-2xl p-3.5 flex items-center gap-3 border-warn/25 bg-warn/[.04]">
                  <span className="text-2xl shrink-0">{def.emoji}</span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[12.5px] font-bold text-ink truncate">{def.label}</span>
                    <span className="text-[10.5px] text-mute-2 truncate">
                      {teamById.get(row.teamId)?.name ?? "Team"} · +{row.coinReward} coins
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="success" size="sm" onClick={() => act(() => awardAchievement(row.id))} disabled={pending}>
                      Award
                    </Button>
                    <Button variant="plain" size="sm" onClick={() => act(() => dismissAchievement(row.id))} disabled={pending}>
                      Dismiss
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold tracking-[.1em] text-success">AWARDED</span>
        {awarded.length === 0 ? (
          <span className="text-[12px] text-mute-2">None awarded yet.</span>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {awarded.map((row) => {
              const def = ACHIEVEMENTS[row.type];
              return (
                <Card key={row.id} className="rounded-2xl p-3.5 flex items-center gap-3">
                  <span className="text-2xl shrink-0">{def.emoji}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12.5px] font-bold text-ink truncate">{def.label}</span>
                    <span className="text-[10.5px] text-mute-2 truncate">
                      {teamById.get(row.teamId)?.name ?? "Team"} · +{row.coinReward} coins
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
