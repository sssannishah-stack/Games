"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

const SWATCHES = ["#3a3f4a", "#7EB5F0", "#3DD68C", "#F5B93D", "#E36A8A"];

/* Light drawing surface with the floating tool dock — canvas UI only. */
export function DrawingCanvas() {
  return (
    <div className="flex-1 rounded-[18px] bg-canvas relative shadow-[inset_0_2px_12px_rgba(0,0,0,.12)] overflow-hidden">
      <span className="absolute top-3.5 left-3.5 font-mono font-medium text-[10px] text-[#9a958a] bg-black/5 rounded-md px-2 py-[3px]">
        live canvas · strokes sync in &lt;50ms
      </span>

      {/* illustrative sketch strokes from the design */}
      <div className="absolute bottom-[100px] left-[120px] w-[280px] h-2 rounded bg-[#3a3f4a] opacity-75 -rotate-2" />
      <div className="absolute bottom-[150px] left-[180px] w-[160px] h-[90px] rounded-t-full border-[7px] border-b-0 border-[#3a3f4a] opacity-70" />
      <div className="absolute top-[110px] right-[220px] w-[70px] h-10 rounded-full bg-info opacity-50" />
      <div className="absolute top-[100px] right-[160px] w-[90px] h-12 rounded-full bg-info opacity-65" />
      {[
        { top: 170, right: 200 },
        { top: 176, right: 236 },
        { top: 200, right: 180 },
      ].map((drop, i) => (
        <div
          key={i}
          className="absolute w-1 h-[22px] rounded-sm bg-sky rotate-[14deg]"
          style={{ top: drop.top, right: drop.right }}
        />
      ))}

      {/* tool dock */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-[3px] bg-[rgba(20,22,30,.94)] border border-line/10 rounded-[14px] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,.35)]">
        {[
          { icon: "pen", active: true },
          { icon: "brush" },
          { icon: "eraser" },
        ].map((tool) => (
          <button
            key={tool.icon}
            className={cn(
              "w-[34px] h-[34px] rounded-[10px] flex items-center justify-center cursor-pointer",
              tool.active ? "bg-line/[.12] text-white" : "text-mute hover:bg-line/[.08]"
            )}
          >
            <Icon name={tool.icon} size={15} />
          </button>
        ))}
        <span className="w-px h-5 bg-line/[.12] mx-[3px]" />
        {SWATCHES.map((color, i) => (
          <button
            key={color}
            className={cn("w-[22px] h-[22px] rounded-full mx-0.5 cursor-pointer", i === 0 && "border-2 border-white")}
            style={{ background: color }}
          />
        ))}
        <span className="w-px h-5 bg-line/[.12] mx-[3px]" />
        <button className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-mute hover:bg-line/[.08] cursor-pointer">
          <Icon name="undo-2" size={15} />
        </button>
        <button className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-dim-2">
          <Icon name="redo-2" size={15} />
        </button>
        <button className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center text-danger-soft hover:bg-danger/[.12] cursor-pointer">
          <Icon name="trash-2" size={15} />
        </button>
      </div>
    </div>
  );
}
