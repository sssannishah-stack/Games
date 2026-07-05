"use client";

import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ScenePhone } from "@/components/competition/ScenePhone";
import type { Question } from "@/types";

interface QuestionBuilderProps {
  question: Question;
  onClose?: () => void;
}

const STACK = [
  { icon: "type", label: "Guess the movie 🍿🎬😱" },
  { icon: "list-checks", label: "Optional prompts · visible only" },
  { icon: "lightbulb", iconColor: "#F5B93D", label: "Hint: “2007 comedy”", suffix: "host" },
  { icon: "timer", label: "20s countdown · host starts" },
  { icon: "eye", iconColor: "#3DD68C", label: "Answer reveal · no auto score" },
];

const RECIPES = ["🎵 Guess Song", "🔍 Zoom Reveal", "🎁 Lucky Box"];

/* Question editor drawer content — scene blocks + live mini preview. */
export function QuestionBuilder({ question, onClose }: QuestionBuilderProps) {
  return (
    <div className="flex flex-col h-full bg-drawer">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-line/[.06]">
        <span className="text-[13.5px] font-semibold text-ink">Edit scene</span>
        <span className="font-mono font-medium text-[10px] text-mute-2 bg-line/[.05] rounded px-[7px] py-0.5 uppercase">
          {question.id}
        </span>
        <div className="ml-auto flex gap-1.5">
          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-dim hover:bg-line/[.06] hover:text-ink-2 cursor-pointer">
            <Icon name="copy" size={14} />
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-dim hover:bg-line/[.06] hover:text-ink-2 cursor-pointer"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_172px] gap-3.5 px-5 py-4 flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-2 min-w-0">
          <SectionLabel className="tracking-[.12em] text-[10px]">BLOCK STACK</SectionLabel>
          {STACK.map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-2 bg-elev border border-line/[.08] rounded-[10px] px-[11px] py-[9px]"
            >
              <Icon name={b.icon} size={13} className="text-mute" style={b.iconColor ? { color: b.iconColor } : undefined} />
              <span className="text-xs text-ink-2 truncate">{b.label}</span>
              {b.suffix && (
                <span className="font-mono font-medium text-[10px] text-dim ml-auto">{b.suffix}</span>
              )}
            </div>
          ))}
          <button className="flex items-center justify-center gap-1.5 border-[1.5px] border-dashed border-line/[.14] rounded-[10px] py-2 text-mute-2 text-[11.5px] hover:border-accent hover:text-ink-2 cursor-pointer transition-colors">
            <Icon name="plus" size={12} />
            Add block
          </button>
          <SectionLabel className="tracking-[.12em] text-[10px] mt-1.5">RECIPES</SectionLabel>
          <div className="flex gap-1.5 flex-wrap">
            {RECIPES.map((r) => (
              <button
                key={r}
                className="text-[11px] text-mute border border-line/[.09] rounded-full px-2.5 py-1 hover:border-accent hover:text-ink-2 cursor-pointer transition-colors"
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 items-center">
          <SectionLabel className="tracking-[.12em] text-[10px] self-start">LIVE PREVIEW</SectionLabel>
          <ScenePhone question={question} roundLabel="EMOJI QUIZ" variant="mini" />
          <span className="text-[10px] text-dim-2 text-center">updates as you type</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 px-5 py-3.5 border-t border-line/[.06]">
        <span className="text-[11.5px] text-dim flex items-center gap-1.5">
          <Icon name="cloud-check" size={13} className="text-success" />
          Autosaved
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="subtle" size="md">Save + new</Button>
          <Button variant="primary" size="md" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
