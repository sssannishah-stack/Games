import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { CategoryIcon } from "@/components/power-card/PowerCardBadge";
import type { PowerCardRecord, TeamPowerCardRecord } from "@/data/queries/powerCard.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { PowerCardStatus } from "@/types/db";

const STATUS_STYLE: Record<PowerCardStatus, string> = {
  AVAILABLE: "text-mute-2 bg-line/[.05] border-line/[.08]",
  REQUESTED: "text-warn bg-warn/10 border-warn/25",
  APPROVED: "text-accent bg-accent/10 border-accent/25",
  ACTIVE: "text-success bg-success/10 border-success/25",
  CONSUMED: "text-dim bg-line/[.03] border-line/[.06]",
};

interface InventoryPanelProps {
  teams: TeamRecord[];
  cards: PowerCardRecord[];
  ownedCards: TeamPowerCardRecord[];
}

/** Read-only view of which power cards every team currently holds and their state. */
export function InventoryPanel({ teams, cards, ownedCards }: InventoryPanelProps) {
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const byTeam = new Map<string, TeamPowerCardRecord[]>();
  for (const owned of ownedCards) {
    const list = byTeam.get(owned.teamId) ?? [];
    list.push(owned);
    byTeam.set(owned.teamId, list);
  }

  return (
    <Card className="rounded-2xl p-5 flex flex-col gap-3.5">
      <SectionLabel className="text-[11px] tracking-[.12em]">
        <Icon name="package" size={13} />
        TEAM INVENTORY
      </SectionLabel>

      {teams.length === 0 ? (
        <span className="text-xs text-mute-2">Add teams to see their power card inventory.</span>
      ) : (
        <div className="flex flex-col gap-3">
          {teams.map((team) => {
            const owned = byTeam.get(team.id) ?? [];
            return (
              <div key={team.id} className="rounded-xl border border-line/[.07] bg-elev p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: team.color || "#6C7BFA" }}
                  />
                  <span className="text-[12.5px] font-semibold text-ink-2">{team.name}</span>
                  <span className="ml-auto flex items-center gap-1 text-[10.5px] font-mono text-warn">
                    <Icon name="coins" size={11} />
                    {team.coins}
                  </span>
                </div>
                {owned.length === 0 ? (
                  <span className="text-[11.5px] text-dim">No cards owned yet.</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {owned.map((o) => {
                      const card = cardById.get(o.powerCardId);
                      return (
                        <div
                          key={`${o.teamId}-${o.powerCardId}`}
                          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 border text-[11px] ${STATUS_STYLE[o.status]}`}
                        >
                          {card && <CategoryIcon category={card.category} />}
                          <span className="text-ink-3">{card?.name ?? "Unknown card"}</span>
                          <span className="font-mono text-[10px] opacity-80">x{o.remainingUses}</span>
                          <span className="font-mono text-[9.5px] uppercase tracking-[.06em]">{o.status}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
