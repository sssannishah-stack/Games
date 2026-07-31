"use client";

import { Fragment, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import type { PowerCardUsageRow } from "@/data/queries/analytics.queries";

export function PowerCardsTab({ rows, search }: { rows: PowerCardUsageRow[]; search: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = rows.filter(
    (r) =>
      !search ||
      r.teamName.toLowerCase().includes(search) ||
      r.powerCardName.toLowerCase().includes(search)
  );

  if (filtered.length === 0) {
    return (
      <Card className="rounded-2xl p-8 text-center text-[12.5px] text-mute-2">
        No power cards owned or used yet.
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line/[.08]">
              <th className="px-3.5 py-2.5 text-[10.5px] font-bold tracking-[.08em] text-mute-2">Team</th>
              <th className="px-3.5 py-2.5 text-[10.5px] font-bold tracking-[.08em] text-mute-2">Power</th>
              <th className="px-3.5 py-2.5 text-[10.5px] font-bold tracking-[.08em] text-mute-2">Owned</th>
              <th className="px-3.5 py-2.5 text-[10.5px] font-bold tracking-[.08em] text-mute-2">Used</th>
              <th className="px-3.5 py-2.5 text-[10.5px] font-bold tracking-[.08em] text-mute-2">Remaining</th>
              <th className="px-3.5 py-2.5 text-[10.5px] font-bold tracking-[.08em] text-mute-2">Acquired</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const key = `${row.teamId}:${row.powerCardId}`;
              const isOpen = expanded === key;
              return (
                <Fragment key={key}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : key)}
                    className="border-b border-line/[.05] cursor-pointer hover:bg-line/[.03] transition-colors"
                  >
                    <td className="px-3.5 py-2.5 text-[12.5px] font-semibold text-ink-2">{row.teamName}</td>
                    <td className="px-3.5 py-2.5 text-[12.5px] font-bold text-ink">
                      <span className="flex items-center gap-1.5">
                        {row.events.length > 0 && <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={12} className="text-dim" />}
                        <Icon name={row.powerCardIcon} size={13} className="text-accent" />
                        {row.powerCardName}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-[12.5px] tabular-nums">{row.owned}</td>
                    <td className="px-3.5 py-2.5 text-[12.5px] tabular-nums">{row.used}</td>
                    <td className="px-3.5 py-2.5 text-[12.5px] tabular-nums text-success">{row.remaining}</td>
                    <td className="px-3.5 py-2.5 text-[11px] text-mute-2">{row.purchased ? "Purchased" : "Free / host-granted"}</td>
                  </tr>
                  {isOpen && row.events.length > 0 && (
                    <tr className="bg-line/[.02]">
                      <td colSpan={6} className="px-3.5 py-2.5">
                        <div className="flex flex-col gap-1">
                          {row.events.map((event, j) => (
                            <span key={j} className="text-[11px] text-mute-2">
                              Used · {event.roundTitle ?? "Unknown round"} · {new Date(event.at).toLocaleTimeString()}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
