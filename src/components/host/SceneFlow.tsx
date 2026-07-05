"use client";

import { Icon } from "@/components/ui/Icon";
import { Kbd } from "@/components/ui/Kbd";
import { cn } from "@/lib/utils";
import type { Scene, SceneGroup } from "@/types";
import { mockSceneGroups } from "@/data/mock/scenes";

function sceneIcon(scene: Scene) {
  if (scene.icon === "lightbulb") return <Icon name="lightbulb" size={12} className="text-warn" />;
  if (scene.icon === "ferris-wheel") return <Icon name="ferris-wheel" size={12} className="text-amber" />;
  if (scene.icon === "crown") return <Icon name="crown" size={12} className="text-warn" />;
  if (scene.icon) return <Icon name={scene.icon} size={12} />;
  return null;
}

function SceneRow({ scene }: { scene: Scene }) {
  if (scene.status === "done") {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-[9px] text-dim-2">
        <Icon name="check" size={12} className="text-success" />
        <span className="text-xs line-through">
          {scene.index} · {scene.title}
        </span>
      </div>
    );
  }
  if (scene.status === "on-air") {
    return (
      <div className="flex items-center gap-2 px-2 py-2 rounded-[10px] bg-[linear-gradient(90deg,rgba(255,92,92,.14),rgba(255,92,92,.04))] border border-danger/35">
        <span className="w-1.5 h-1.5 rounded-full bg-danger animate-enc-pulse" />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-ink">
            {scene.index} · {scene.title}
          </span>
          <span className="font-mono font-semibold text-[8.5px] tracking-[.1em] text-[#FF8383]">
            ON AIR · {scene.onAirElapsed}
          </span>
        </div>
      </div>
    );
  }
  if (scene.status === "up-next") {
    return (
      <div className="flex items-center gap-2 px-2 py-[7px] rounded-[10px] border border-success/25 bg-success/[.05]">
        <Icon name="eye" size={12} className="text-success" />
        <div className="flex flex-col">
          <span className="text-xs font-medium text-ink-3">
            {scene.index} · {scene.title}
          </span>
          <span className="font-mono font-semibold text-[8.5px] tracking-[.1em] text-success">UP NEXT</span>
        </div>
        <Icon name="grip-vertical" size={12} className="text-faint ml-auto" />
      </div>
    );
  }
  return (
    <button className="flex items-center gap-2 px-2 py-1.5 rounded-[9px] text-mute hover:bg-line/[.04] cursor-pointer w-full text-left">
      {sceneIcon(scene)}
      <span className="text-xs">
        {scene.index ? `${scene.index} · ` : "· "}
        {scene.title}
      </span>
      {scene.meta && (
        <span className="font-mono text-[9px] text-dim-2 ml-auto">{scene.meta}</span>
      )}
    </button>
  );
}

function GroupRow({ group }: { group: SceneGroup }) {
  return (
    <>
      <button
        className={cn(
          "flex items-center gap-2 px-2 py-[7px] rounded-[9px] cursor-pointer w-full text-left",
          group.expanded ? "text-ink-3 bg-line/[.03]" : "text-dim-2 hover:bg-line/[.04]"
        )}
      >
        <Icon
          name={group.expanded ? "chevron-down" : "chevron-right"}
          size={12}
          className={group.expanded ? "text-mute-2" : undefined}
        />
        <span className="text-xs font-semibold">{group.label}</span>
        {group.summaryTone === "done" ? (
          <span className="text-[10px] ml-auto flex items-center gap-1 text-success">
            <Icon name="check" size={11} />
            {group.summary}
          </span>
        ) : (
          <span className="font-mono font-medium text-[10px] text-dim-2 ml-auto">
            {group.summary}
          </span>
        )}
      </button>
      {group.expanded && group.scenes.length > 0 && (
        <div className="flex flex-col gap-0.5 pl-3.5 ml-3.5 border-l border-line/[.06]">
          {group.scenes.map((scene) => (
            <SceneRow key={scene.id} scene={scene} />
          ))}
        </div>
      )}
    </>
  );
}

/* LEFT panel — collapsible scene flow with the on-air scene highlighted. */
export function SceneFlow() {
  return (
    <div className="border-r border-line/[.06] flex flex-col px-2.5 pt-3 pb-2.5 gap-0.5 overflow-y-auto">
      <div className="flex items-center gap-2 px-2 pb-2.5">
        <span className="font-mono font-semibold text-[10px] tracking-[.13em] text-label">
          SCENE FLOW
        </span>
        <span className="text-[10.5px] text-faint">24 scenes</span>
        <Icon name="search" size={13} className="text-dim-2 ml-auto" />
      </div>
      {mockSceneGroups.map((group) => (
        <GroupRow key={group.id} group={group} />
      ))}
      <div className="mt-auto flex flex-col gap-1.5 pt-3">
        <button className="flex items-center justify-center gap-1.5 border-[1.5px] border-dashed border-line/[.13] rounded-[10px] py-2 text-mute-2 text-xs hover:border-accent hover:text-ink-2 cursor-pointer transition-colors">
          <Icon name="zap" size={13} />
          Insert scene
          <Kbd>I</Kbd>
        </button>
        <span className="text-[10.5px] text-faint text-center">
          drag to reorder · right-click to skip
        </span>
      </div>
    </div>
  );
}
