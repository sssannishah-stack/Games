"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import {
  resolvePowerCardRequest,
  hostActivatePowerCard,
  hostConsumePowerCard,
} from "@/actions/powerCard.actions";
import type { PowerCardRequestRecord } from "@/data/queries/powerCard.queries";

interface RequestsPanelProps {
  requests: PowerCardRequestRecord[];
}

const STATUS_STYLE: Record<PowerCardRequestRecord["status"], string> = {
  REQUESTED: "text-warn bg-warn/10 border-warn/25",
  APPROVED: "text-accent bg-accent/10 border-accent/25",
  ACTIVE: "text-success bg-success/10 border-success/25",
  CONSUMED: "text-dim bg-line/[.03] border-line/[.06]",
  REJECTED: "text-danger-soft bg-danger/[.08] border-danger/25",
};

/** Host approves/rejects power card requests and moves approved ones through activate → consume. */
export function RequestsPanel({ requests }: RequestsPanelProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function resolve(requestId: string, approve: boolean) {
    startTransition(async () => {
      await resolvePowerCardRequest(requestId, approve);
      router.refresh();
    });
  }

  function activate(requestId: string) {
    startTransition(async () => {
      await hostActivatePowerCard(requestId);
      router.refresh();
    });
  }

  function consume(requestId: string) {
    startTransition(async () => {
      await hostConsumePowerCard(requestId);
      router.refresh();
    });
  }

  const pendingRequests = requests.filter((r) => r.status === "REQUESTED");
  const inProgress = requests.filter((r) => r.status === "APPROVED" || r.status === "ACTIVE");
  const resolved = requests.filter((r) => r.status === "CONSUMED" || r.status === "REJECTED");

  return (
    <Card className="rounded-2xl p-5 flex flex-col gap-3.5">
      <SectionLabel className="text-[11px] tracking-[.12em]">
        <Icon name="inbox" size={13} />
        POWER CARD REQUESTS · {pendingRequests.length} pending
      </SectionLabel>

      {requests.length === 0 ? (
        <span className="text-xs text-mute-2">No power card requests yet.</span>
      ) : (
        <div className="flex flex-col gap-4">
          {pendingRequests.length > 0 && (
            <div className="flex flex-col gap-2">
              {pendingRequests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-xl border border-line/[.08] bg-elev px-3 py-2.5"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: r.teamColor || "#6C7BFA" }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12.5px] font-semibold text-ink-2 truncate">
                      {r.teamName} → {r.powerCardName}
                    </span>
                    <span className={`self-start mt-0.5 font-mono text-[9.5px] uppercase tracking-[.06em] rounded px-1.5 py-0.5 border ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="ml-auto flex gap-1.5 shrink-0">
                    <Button variant="success" size="sm" onClick={() => resolve(r.id, true)} disabled={pending}>
                      Approve
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => resolve(r.id, false)} disabled={pending}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {inProgress.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-line/[.06] pt-3">
              {inProgress.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-xl border border-line/[.08] bg-elev px-3 py-2.5"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: r.teamColor || "#6C7BFA" }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12.5px] font-semibold text-ink-2 truncate">
                      {r.teamName} → {r.powerCardName}
                    </span>
                    <span className={`self-start mt-0.5 font-mono text-[9.5px] uppercase tracking-[.06em] rounded px-1.5 py-0.5 border ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="ml-auto shrink-0">
                    {r.status === "APPROVED" && (
                      <Button variant="primary" size="sm" onClick={() => activate(r.id)} disabled={pending}>
                        Activate
                      </Button>
                    )}
                    {r.status === "ACTIVE" && (
                      <Button variant="subtle" size="sm" onClick={() => consume(r.id)} disabled={pending}>
                        Mark consumed
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {resolved.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-line/[.06] pt-3">
              <span className="text-[10.5px] font-mono font-semibold tracking-[.1em] text-dim-2">HISTORY</span>
              {resolved.slice(0, 10).map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-[11.5px]">
                  <span className={`font-mono text-[9.5px] uppercase tracking-[.06em] rounded px-1.5 py-0.5 border ${STATUS_STYLE[r.status]}`}>
                    {r.status}
                  </span>
                  <span className="text-ink-3 truncate">
                    {r.teamName} · {r.powerCardName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
