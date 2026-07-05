"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { CategoryIcon, RarityBadge } from "@/components/power-card/PowerCardBadge";
import { assignPowerCardsToRoom } from "@/actions/powerCard.actions";
import type { PowerCardRecord } from "@/data/queries/powerCard.queries";

interface PowerCardsPanelProps {
  roomId: string;
  cards: PowerCardRecord[];
  economyEnabled: boolean;
  teamCount: number;
}

/**
 * Read-only view of the host's global Power Card catalog (managed from the
 * Round Builder). In Simple Mode, the host assigns cards directly to every
 * team here; Economy Mode operational controls live in the Store panel.
 */
export function PowerCardsPanel({ roomId, cards, economyEnabled, teamCount }: PowerCardsPanelProps) {
  const [assignUses, setAssignUses] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function assignToRoom() {
    setError(null);
    const assignments = Object.entries(assignUses)
      .filter(([, uses]) => uses > 0)
      .map(([powerCardId, uses]) => ({ powerCardId, uses }));

    if (assignments.length === 0) return setError("Pick at least one card with uses > 0.");
    if (teamCount === 0) return setError("Add teams before assigning power cards.");

    startTransition(async () => {
      try {
        await assignPowerCardsToRoom(roomId, assignments);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not assign cards.");
      }
    });
  }

  return (
    <Card className="rounded-2xl p-5 flex flex-col gap-3.5">
      <div className="flex items-center gap-2">
        <SectionLabel className="text-[11px] tracking-[.12em]">
          <Icon name="sparkles" size={13} />
          POWER CARDS · {cards.length}
        </SectionLabel>
        <span className="text-[10.5px] font-semibold text-mute-2 bg-line/[.05] rounded-full px-2.5 py-1">
          {economyEnabled ? "Economy Mode · buy from store" : "Simple Mode · host assigns"}
        </span>
        <Link href="/admin/rounds" className="ml-auto text-[11.5px] font-semibold text-accent hover:brightness-125">
          Manage catalog
        </Link>
      </div>

      {cards.length === 0 ? (
        <span className="text-xs text-mute-2">
          No power cards yet — create some from a round&apos;s Power Cards tab in the Round Builder.
        </span>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {cards.map((card) => (
            <div
              key={card.id}
              className={`flex flex-col gap-2 rounded-xl px-3 py-2.5 border transition-colors ${
                card.enabled ? "border-line/[.08] bg-elev" : "border-line/[.05] bg-elev opacity-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <CategoryIcon category={card.category} />
                <div className="flex flex-col min-w-0">
                  <span className="text-[12.5px] font-semibold text-ink-2 truncate">{card.name}</span>
                  <span className="text-[10px] text-dim truncate">{card.description || card.effectType}</span>
                </div>
                <RarityBadge rarity={card.rarity} />
              </div>

              {economyEnabled ? (
                <div className="flex items-center gap-1.5 text-[10px] text-dim">
                  <Icon name="coins" size={11} className="text-warn" />
                  {card.price} coins {card.stock !== null && `· ${card.stock} left`}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-dim">Uses per team</span>
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={assignUses[card.id] ?? 0}
                    onChange={(e) =>
                      setAssignUses((prev) => ({ ...prev, [card.id]: Number(e.target.value) }))
                    }
                    className="w-12 bg-line/[.06] border border-line/[.1] rounded-[7px] text-center text-[11px] text-ink py-1 outline-none"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <span className="text-[12.5px] text-danger-soft bg-danger/[.08] border border-danger/25 rounded-[10px] px-3 py-2">
          {error}
        </span>
      )}

      {!economyEnabled && cards.length > 0 && (
        <Button
          variant="primary"
          size="md"
          onClick={assignToRoom}
          disabled={pending}
          className="self-start disabled:opacity-60"
        >
          {pending ? "Saving…" : "Assign to every team"}
        </Button>
      )}
    </Card>
  );
}
