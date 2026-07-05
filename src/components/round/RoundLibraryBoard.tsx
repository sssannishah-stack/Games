"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { QuickCreateRoundModal } from "@/components/round/QuickCreateRoundModal";
import { duplicateRound, deleteRound } from "@/actions/round.actions";
import type { RoundRecord } from "@/data/queries/round.queries";

interface RoundLibraryBoardProps {
  rounds: RoundRecord[];
}

export function RoundLibraryBoard({ rounds }: RoundLibraryBoardProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const categories = [...new Set(rounds.map((round) => round.category || "Custom"))].sort();
  const filtered = rounds.filter((round) => {
    const matchesSearch = `${round.title} ${round.description ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = categoryFilter === "ALL" || (round.category || "Custom") === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  function duplicate(roundId: string) {
    startTransition(async () => {
      await duplicateRound(roundId);
      router.refresh();
    });
  }

  function remove(roundId: string) {
    startTransition(async () => {
      await deleteRound(roundId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[22px] font-bold text-ink-2 tracking-[-.02em]">Round Builder</span>
          <span className="text-[13px] text-mute-2">Create reusable rounds once — select them into any room.</span>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={14} />
          Create Round
        </Button>
      </div>

      {rounds.length > 0 && (
        <Card className="rounded-2xl p-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search rounds"
            className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-3 py-2 text-sm text-ink outline-none"
          />
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-2 py-2 text-sm text-ink outline-none"
          >
            <option value="ALL" className="bg-surface">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category} className="bg-surface">
                {category}
              </option>
            ))}
          </select>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-14 h-14 rounded-[18px] bg-accent/10 border border-dashed border-accent/45 flex items-center justify-center">
            <Icon name="list-ordered" size={24} className="text-accent" />
          </div>
          <span className="text-[15px] font-bold text-ink">
            {rounds.length === 0 ? "No rounds created" : "No rounds match your search"}
          </span>
          {rounds.length === 0 && (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              Create First Round
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((round) => (
            <Card key={round.id} className="rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-bold text-ink-2">{round.title}</span>
                <span className="text-[11.5px] text-mute-2">
                  {round.category} - {round.roundType.replace(/_/g, " ")} - {round.questionCount} questions - {round.defaultTimer}s
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/rounds/${round.id}`}>
                  <Button variant="primary" size="sm">
                    Manage
                  </Button>
                </Link>
                <Button variant="subtle" size="sm" onClick={() => duplicate(round.id)} disabled={pending}>
                  Duplicate
                </Button>
                <Button variant="danger" size="sm" onClick={() => remove(round.id)} disabled={pending}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <QuickCreateRoundModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(round) => router.push(`/admin/rounds/${round.id}`)}
      />
    </div>
  );
}
