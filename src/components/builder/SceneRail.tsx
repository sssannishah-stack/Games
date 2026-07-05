"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import type { Scene } from "@/types";
import { builderSections } from "@/data/mock/scenes";

function RailScene({ scene }: { scene: Scene }) {
  const active = scene.status === "on-air";
  return (
    <button
      className={cn(
        "flex items-center gap-2.5 px-2 py-[7px] rounded-[10px] w-full text-left cursor-pointer",
        active
          ? "bg-accent/[.13] border border-accent/45"
          : "hover:bg-line/[.04] border border-transparent"
      )}
    >
      <div
        className={cn(
          "w-[34px] h-[52px] rounded-[7px] flex items-center justify-center text-[11px] shrink-0",
          active
            ? "bg-[linear-gradient(160deg,#232738,#161926)] border border-accent"
            : "bg-[linear-gradient(160deg,#1A1D28,#12141C)] border border-line/10"
        )}
      >
        {scene.emoji ?? <Icon name={scene.icon ?? "square"} size={13} className={scene.icon === "ferris-wheel" ? "text-amber" : scene.icon === "crown" ? "text-warn" : "text-mute-2"} />}
      </div>
      <div className="flex flex-col gap-px min-w-0">
        <span className={cn("text-xs truncate", active ? "font-semibold text-ink" : "font-medium text-ink-3")}>
          {scene.index} · {scene.title}
        </span>
        <span className={cn("font-mono text-[10px]", active ? "text-[#A5AEFC]" : "text-dim-2")}>
          {scene.meta}
        </span>
      </div>
      {active && <Icon name="grip-vertical" size={13} className="text-dim-2 ml-auto" />}
    </button>
  );
}

/* Left rail of the Scene Builder. */
export function SceneRail() {
  return (
    <div className="border-r border-line/[.06] px-3 py-4 flex flex-col gap-1.5 overflow-y-auto w-[248px] shrink-0">
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="text-[12.5px] font-semibold text-ink-2">24 scenes</span>
        <span className="text-[11px] text-dim">· 92 min</span>
        <Icon name="list-filter" size={14} className="text-dim ml-auto" />
      </div>
      {builderSections.map((section) => (
        <div key={section.label} className="flex flex-col gap-1.5">
          <div className="font-mono font-semibold text-[9.5px] tracking-[.13em] text-label px-1 pt-1">
            {section.label}
          </div>
          {section.scenes.map((scene) => (
            <RailScene key={scene.id} scene={scene} />
          ))}
        </div>
      ))}
      <button className="mt-2 flex items-center justify-center gap-[7px] border-[1.5px] border-dashed border-line/[.14] rounded-[11px] py-[11px] text-mute-2 text-[12.5px] font-medium hover:border-accent hover:text-ink-2 cursor-pointer transition-colors">
        <Icon name="plus" size={14} />
        Add scene
      </button>
    </div>
  );
}
