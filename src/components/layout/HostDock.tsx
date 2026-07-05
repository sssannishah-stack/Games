"use client";

import { Icon } from "@/components/ui/Icon";
import { Kbd } from "@/components/ui/Kbd";
import { cn } from "@/lib/utils";

interface DockAction {
  icon?: string;
  iconColor?: string;
  label: string;
  kbd?: string;
  onClick?: () => void;
  tone?: "default" | "primary" | "reveal" | "danger" | "outline";
}

interface HostDockProps {
  onGiveMarks?: () => void;
  onNext?: () => void;
  compact?: boolean; // drawing-round variant: no kbd labels
  note?: string;
}

function DockButton({ action, compact }: { action: DockAction; compact?: boolean }) {
  const tone = action.tone ?? "default";
  return (
    <button
      onClick={action.onClick}
      className={cn(
        "flex flex-col items-center gap-[3px] rounded-[11px] cursor-pointer transition select-none",
        compact ? "px-3.5 py-2.5 flex-row gap-1.5" : "px-3.5 py-2",
        tone === "default" && "text-ink-3 hover:bg-line/[.06]",
        tone === "primary" &&
          "bg-accent text-white rounded-xl shadow-[0_8px_26px_rgba(108,123,250,.45)] hover:brightness-110 px-6 py-[9px]",
        tone === "reveal" &&
          "text-ink-2 bg-success/[.08] border border-success/25 hover:bg-success/[.16]",
        tone === "danger" &&
          "text-danger-soft border border-danger/35 hover:bg-danger/10 px-4",
        tone === "outline" && "text-ink-3 border border-line/10 hover:bg-line/[.06]"
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5",
          tone === "primary" ? "text-[13.5px] font-bold gap-[7px]" : "text-[12.5px]",
          tone === "reveal" || tone === "danger" ? "font-semibold" : "font-medium"
        )}
      >
        {action.icon && (
          <Icon name={action.icon} size={14} style={action.iconColor ? { color: action.iconColor } : undefined} />
        )}
        {action.label}
        {tone === "primary" && <Icon name="skip-forward" size={15} />}
      </span>
      {!compact && action.kbd && (
        <span
          className={cn(
            "font-mono font-medium text-[9px]",
            tone === "primary" ? "text-white/70" : tone === "danger" ? "text-[#8A5B5B]" : "text-dim-2"
          )}
        >
          {action.kbd}
        </span>
      )}
    </button>
  );
}

/* The persistent host control dock — never leaves the live screens. */
export function HostDock({ onGiveMarks, onNext, compact, note }: HostDockProps) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 border-t border-line/[.09] bg-[rgba(13,14,20,.92)] backdrop-blur-2xl shadow-[0_-12px_40px_rgba(0,0,0,.4)] overflow-x-auto shrink-0">
      <DockButton compact={compact} action={{ icon: "skip-back", label: "Prev", kbd: "←" }} />
      <DockButton
        compact={compact}
        action={{ label: "Next scene", kbd: "Space", tone: "primary", onClick: onNext }}
      />
      <DockButton
        compact={compact}
        action={{ icon: "eye", iconColor: "#3DD68C", label: "Reveal", kbd: "R", tone: "reveal" }}
      />
      <DockButton compact={compact} action={{ icon: "pause", label: "Pause timer", kbd: "P" }} />
      <span className="w-px h-[30px] bg-line/[.09] mx-1 shrink-0" />
      <DockButton
        compact={compact}
        action={{ icon: "badge-plus", iconColor: "#3DD68C", label: "Give marks", kbd: "M", onClick: onGiveMarks }}
      />
      <DockButton
        compact={compact}
        action={{ icon: "crown", iconColor: "#F5B93D", label: "Leaderboard", kbd: "L" }}
      />
      <DockButton compact={compact} action={{ icon: "megaphone", label: "Broadcast", kbd: "B" }} />
      <DockButton compact={compact} action={{ icon: "undo-2", label: "Undo", kbd: "⌘Z" }} />
      <span className="ml-auto shrink-0 flex items-center gap-2">
        {note && <span className="text-[11px] text-dim-2 hidden xl:block">{note}</span>}
        <DockButton
          compact={compact}
          action={{ icon: "monitor-off", label: "Black screen", kbd: ".", tone: "outline" }}
        />
        <DockButton
          compact={compact}
          action={{ icon: "octagon-x", label: "Emergency stop", kbd: "hold Esc", tone: "danger" }}
        />
      </span>
    </div>
  );
}

export { Kbd as DockKbd };
