import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import type { CompetitionRecord } from "@/data/queries/competition.queries";
import type { BadgeProps } from "@/components/ui/Badge";

const STATUS_BADGE: Record<CompetitionRecord["status"], BadgeProps["variant"]> = {
  DRAFT: "plain",
  READY: "accent",
  LIVE: "live",
  COMPLETED: "success",
};

const STATUS_LABEL: Record<CompetitionRecord["status"], string> = {
  DRAFT: "Draft",
  READY: "Ready",
  LIVE: "Live",
  COMPLETED: "Completed",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CompetitionCard({ competition }: { competition: CompetitionRecord }) {
  return (
    <Link
      href={`/admin/competitions/${competition.id}`}
      className="flex items-center gap-3 hover:opacity-90"
    >
      <div
        className="w-10 h-10 rounded-[11px] flex items-center justify-center border shrink-0"
        style={{
          background: `color-mix(in oklab, ${competition.theme} 12%, transparent)`,
          borderColor: `color-mix(in oklab, ${competition.theme} 20%, transparent)`,
        }}
      >
        <Icon name="trophy" size={18} style={{ color: competition.theme }} />
      </div>
      <div className="flex flex-col gap-px min-w-0">
        <span className="text-[13.5px] font-semibold text-ink-2 truncate">
          {competition.title}
        </span>
        <span className="text-[11.5px] text-mute-2 truncate">
          {formatDate(competition.createdAt)} ·{" "}
          {competition.roomCount === 1 ? "1 room" : `${competition.roomCount} rooms`}
        </span>
      </div>
      <Badge size="sm" variant={STATUS_BADGE[competition.status]} className="ml-auto font-medium">
        {competition.status === "LIVE" && (
          <span className="w-1.5 h-1.5 rounded-full bg-live animate-enc-pulse" />
        )}
        {competition.status === "READY" && (
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-enc-pulse-slow" />
        )}
        {STATUS_LABEL[competition.status]}
      </Badge>
    </Link>
  );
}
