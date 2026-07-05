"use client";

import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { useLiveStore } from "@/stores/liveStore";

interface HostTopBarProps {
  title: string;
  subtitle: string;
}

export function HostTopBar({ title, subtitle }: HostTopBarProps) {
  const { elapsed, phonesInSync, roomCode, latencyMs } = useLiveStore();
  return (
    <div className="flex items-center gap-3.5 px-5 py-[11px] border-b border-line/[.07] bg-line/[.015] flex-wrap">
      <Badge variant="live" size="lg" className="text-[11px]">
        <span className="w-2 h-2 rounded-full bg-danger animate-enc-ring" />
        LIVE
      </Badge>
      <div className="flex flex-col">
        <span className="text-sm font-bold text-ink tracking-[-.01em]">{title}</span>
        <span className="text-[11px] text-dim">{subtitle}</span>
      </div>
      <span className="font-mono font-semibold text-[15px] text-ink-3 ml-2">{elapsed}</span>
      <div className="ml-auto flex items-center gap-2.5 flex-wrap">
        <Badge size="lg" className="hidden md:inline-flex">
          <Icon name="smartphone" size={13} className="text-success" />
          {phonesInSync} phones in sync
        </Badge>
        <Badge size="lg" className="font-mono font-medium hidden sm:inline-flex">
          {roomCode}
        </Badge>
        <span className="hidden lg:flex items-center gap-1.5 text-xs text-success">
          <Icon name="wifi" size={14} />
          {latencyMs}ms
        </span>
        <button className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3 border border-line/10 rounded-[10px] px-3.5 py-[7px] hover:bg-line/[.06] cursor-pointer">
          <Icon name="user-plus" size={13} />
          Co-host
        </button>
      </div>
    </div>
  );
}
