"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { openStore, closeStore, giveFreeCard } from "@/actions/powerCard.actions";
import { giveCoins } from "@/actions/coin.actions";
import type { PowerCardRecord } from "@/data/queries/powerCard.queries";
import type { CoinTransactionRecord } from "@/data/queries/powerCard.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { StoreStatus } from "@/types/db";

interface StorePanelProps {
  roomId: string;
  storeStatus: StoreStatus;
  teams: TeamRecord[];
  cards: PowerCardRecord[];
  purchases: CoinTransactionRecord[];
}

const inputClass =
  "bg-line/[.04] border border-line/[.1] rounded-[9px] px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-accent/60";

/** Host controls the live Power Store: open/close, give coins, give a free card, review purchases. */
export function StorePanel({ roomId, storeStatus, teams, cards, purchases }: StorePanelProps) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [coinAmount, setCoinAmount] = useState(100);
  const [freeCardId, setFreeCardId] = useState(cards[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggleStore() {
    startTransition(async () => {
      if (storeStatus === "OPEN") await closeStore(roomId);
      else await openStore(roomId);
      router.refresh();
    });
  }

  function sendCoins() {
    setError(null);
    if (!teamId) return setError("Pick a team.");
    startTransition(async () => {
      try {
        await giveCoins(roomId, teamId, coinAmount);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not give coins.");
      }
    });
  }

  function sendFreeCard() {
    setError(null);
    if (!teamId || !freeCardId) return setError("Pick a team and a card.");
    startTransition(async () => {
      try {
        await giveFreeCard(roomId, teamId, freeCardId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not give card.");
      }
    });
  }

  const teamById = new Map(teams.map((t) => [t.id, t]));

  return (
    <Card className="rounded-2xl p-5 flex flex-col gap-3.5">
      <div className="flex items-center gap-2">
        <SectionLabel className="text-[11px] tracking-[.12em]">
          <Icon name="store" size={13} />
          POWER STORE
        </SectionLabel>
        <span
          className={`ml-auto flex items-center gap-1.5 text-[10.5px] font-bold tracking-[.06em] rounded-full px-2.5 py-1 ${
            storeStatus === "OPEN"
              ? "text-success bg-success/10 border border-success/25"
              : "text-mute-2 bg-line/[.05] border border-line/[.08]"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${storeStatus === "OPEN" ? "bg-success animate-enc-pulse" : "bg-dim"}`} />
          {storeStatus}
        </span>
      </div>

      <Button
        variant={storeStatus === "OPEN" ? "danger" : "success"}
        size="md"
        onClick={toggleStore}
        disabled={pending}
        className="self-start disabled:opacity-60"
      >
        <Icon name={storeStatus === "OPEN" ? "lock" : "lock-open"} size={13} />
        {storeStatus === "OPEN" ? "Close Power Store" : "Open Power Store"}
      </Button>

      <div className="flex flex-col gap-2 border-t border-line/[.06] pt-3">
        <span className="text-[10.5px] font-mono font-semibold tracking-[.1em] text-dim-2">
          GIVE COINS
        </span>
        <div className="flex gap-1.5">
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={`${inputClass} flex-1`}>
            {teams.map((t) => (
              <option key={t.id} value={t.id} className="bg-surface">
                {t.name} · {t.coins}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={coinAmount}
            onChange={(e) => setCoinAmount(Number(e.target.value))}
            className={`${inputClass} w-20`}
          />
          <Button variant="subtle" size="sm" onClick={sendCoins} disabled={pending}>
            <Icon name="coins" size={13} />
            Give
          </Button>
        </div>
      </div>

      {cards.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line/[.06] pt-3">
          <span className="text-[10.5px] font-mono font-semibold tracking-[.1em] text-dim-2">
            GIVE FREE CARD
          </span>
          <div className="flex gap-1.5">
            <select value={freeCardId} onChange={(e) => setFreeCardId(e.target.value)} className={`${inputClass} flex-1`}>
              {cards.map((c) => (
                <option key={c.id} value={c.id} className="bg-surface">
                  {c.name}
                </option>
              ))}
            </select>
            <Button variant="subtle" size="sm" onClick={sendFreeCard} disabled={pending}>
              <Icon name="gift" size={13} />
              Give
            </Button>
          </div>
        </div>
      )}

      {error && (
        <span className="text-[12.5px] text-danger-soft bg-danger/[.08] border border-danger/25 rounded-[10px] px-3 py-2">
          {error}
        </span>
      )}

      <div className="flex flex-col gap-1.5 border-t border-line/[.06] pt-3">
        <span className="text-[10.5px] font-mono font-semibold tracking-[.1em] text-dim-2">
          RECENT PURCHASES
        </span>
        {purchases.length === 0 ? (
          <span className="text-[11.5px] text-dim">No coin activity yet.</span>
        ) : (
          <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto">
            {purchases.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-[11.5px]">
                <span className={`font-mono font-bold w-14 ${p.amount >= 0 ? "text-success" : "text-danger-soft"}`}>
                  {p.amount >= 0 ? "+" : ""}
                  {p.amount}
                </span>
                <span className="text-ink-3 truncate flex-1">
                  {teamById.get(p.teamId)?.name ?? "Team"} · {p.reason ?? p.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
