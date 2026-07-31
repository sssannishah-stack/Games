"use client";

import { Card } from "@/components/ui/Card";
import type { CompetitionStatistics } from "@/data/queries/analytics.queries";

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Card className="rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-[.1em] text-mute-2">{label.toUpperCase()}</span>
      <span className={`text-[22px] font-black tabular-nums ${tone ?? "text-ink"}`}>{value}</span>
    </Card>
  );
}

export function StatisticsTab({ stats }: { stats: CompetitionStatistics }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <StatCard label="Questions Asked" value={stats.questionsAsked} />
      <StatCard label="Rounds Completed" value={stats.roundsCompleted} />
      <StatCard label="Correct Answers" value={stats.correctAnswers} tone="text-success" />
      <StatCard label="Wrong Answers" value={stats.wrongAnswers} tone="text-danger-soft" />
      <StatCard label="Hints Used" value={stats.hintsUsed} />
      <StatCard label="Power Cards Used" value={stats.powerCardsUsed} tone="text-accent" />
      <StatCard label="Store Purchases" value={stats.storePurchases} />
      <StatCard label="Auctions Sold" value={stats.auctionsSold} />
      <StatCard label="Coins Circulated" value={stats.coinsCirculated} tone="text-warn" />
      <StatCard label="Average Score" value={stats.averageScore} />
      <StatCard label="Highest Score" value={stats.highestScore} tone="text-success" />
      <StatCard label="Lowest Score" value={stats.lowestScore} tone="text-danger-soft" />
    </div>
  );
}
