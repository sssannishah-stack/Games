"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Tabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";

interface BlockRow {
  icon: string;
  iconColor?: string;
  title: string;
  detail: string;
  visible: boolean;
}

const BLOCKS: BlockRow[] = [
  { icon: "type", title: "Question text", detail: "“Guess the movie” + emoji", visible: true },
  { icon: "list-checks", title: "Optional prompts", detail: "shown on phones · not scored", visible: true },
  { icon: "lightbulb", iconColor: "#F5B93D", title: "Hints × 2", detail: "host reveals after approval", visible: false },
];

const BLOCKS_AFTER: BlockRow[] = [
  { icon: "eye", iconColor: "#3DD68C", title: "Answer reveal", detail: "host controls when it appears", visible: false },
  { icon: "party-popper", iconColor: "#E36A8A", title: "Confetti on reveal", detail: "with crowd-cheer sound", visible: true },
];

function Block({ block }: { block: BlockRow }) {
  return (
    <div className="flex items-center gap-2.5 bg-elev border border-line/[.07] rounded-xl px-3 py-2.5 hover:border-line/[.16] transition-colors cursor-pointer">
      <Icon name="grip-vertical" size={13} className="text-faint" />
      <Icon name={block.icon} size={14} className="text-mute" style={block.iconColor ? { color: block.iconColor } : undefined} />
      <div className="flex flex-col min-w-0">
        <span className="text-[12.5px] font-medium text-ink-2 truncate">{block.title}</span>
        <span className="text-[10.5px] text-dim truncate">{block.detail}</span>
      </div>
      <Icon name={block.visible ? "eye" : "eye-off"} size={13} className="text-dim-2 ml-auto" />
    </div>
  );
}

/* Right inspector of the Scene Builder — block stack + selected Timer block. */
export function Inspector() {
  const [tab, setTab] = useState("Blocks");
  const [timerMode, setTimerMode] = useState("Countdown");
  const [tick, setTick] = useState(true);

  return (
    <div className="border-l border-line/[.06] flex flex-col overflow-hidden w-[312px] shrink-0">
      <Tabs
        tabs={[{ label: "Blocks" }, { label: "Design" }, { label: "Timing" }, { label: "Marks" }]}
        active={tab}
        onChange={setTab}
      />
      <div className="p-3.5 flex flex-col gap-2 overflow-y-auto">
        {BLOCKS.map((b) => (
          <Block key={b.title} block={b} />
        ))}

        {/* selected Timer block */}
        <div className="bg-[color-mix(in_oklab,#6C7BFA_9%,#14161E)] border border-accent/55 rounded-xl p-3 flex flex-col gap-3 shadow-[0_0_0_3px_rgba(108,123,250,.1)]">
          <div className="flex items-center gap-2.5">
            <Icon name="grip-vertical" size={13} className="text-dim-2" />
            <Icon name="timer" size={14} className="text-accent" />
            <span className="text-[12.5px] font-semibold text-ink">Timer</span>
            <span className="font-mono font-medium text-[10px] text-accent ml-auto">SELECTED</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-mute-2">Mode</span>
            <div className="flex bg-black/25 border border-line/[.08] rounded-[9px] p-[2.5px]">
              {["Countdown", "Rapid fire", "Sudden death"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTimerMode(mode)}
                  className={cn(
                    "flex-1 text-center text-[11px] py-1.5 rounded-[7px] cursor-pointer",
                    mode === timerMode ? "font-semibold text-ink bg-line/10" : "text-mute-2"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-[11px] font-semibold text-mute-2">Duration</span>
              <span className="font-mono font-semibold text-[11px] text-ink">20s</span>
            </div>
            <div className="relative h-1 rounded-sm bg-line/10">
              <div className="absolute left-0 inset-y-0 w-1/3 rounded-sm bg-accent" />
              <div className="absolute left-1/3 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,.5)]" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] text-ink-3 flex items-center gap-[7px]">
              <Icon name="volume-2" size={13} className="text-mute-2" />
              Tick sound in last 5s
            </span>
            <button
              onClick={() => setTick(!tick)}
              className={cn(
                "w-[34px] h-5 rounded-full relative cursor-pointer transition-colors",
                tick ? "bg-accent" : "bg-line/15"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                  tick ? "right-0.5" : "left-0.5"
                )}
              />
            </button>
          </div>
        </div>

        {BLOCKS_AFTER.map((b) => (
          <Block key={b.title} block={b} />
        ))}

        <button className="flex items-center justify-center gap-[7px] border-[1.5px] border-dashed border-line/[.14] rounded-[11px] py-2.5 text-mute-2 text-xs font-medium mt-0.5 hover:border-accent hover:text-ink-2 cursor-pointer transition-colors">
          <Icon name="plus" size={13} />
          Add block — text · image · audio · video · drawing · wheel
        </button>
      </div>
    </div>
  );
}
