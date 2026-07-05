"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { QuickCreateRoundModal } from "@/components/round/QuickCreateRoundModal";
import type { RoundRecord } from "@/data/queries/round.queries";

interface RoundPickerChecklistProps {
  rounds: RoundRecord[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** "Add to: [ ] Round A [ ] Round B  + Create New Round" — used when saving a question. */
export function RoundPickerChecklist({ rounds, selected, onChange }: RoundPickerChecklistProps) {
  const [createOpen, setCreateOpen] = useState(false);

  function toggle(roundId: string) {
    onChange(selected.includes(roundId) ? selected.filter((id) => id !== roundId) : [...selected, roundId]);
  }

  return (
    <div className="flex flex-col gap-[7px]">
      <span className="text-xs font-semibold text-ink-3">Add to round (optional)</span>
      <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto rounded-[10px] border border-line/[.08] bg-line/[.02] p-2">
        {rounds.length === 0 ? (
          <span className="text-[12px] text-mute-2 px-1 py-1">No rounds yet.</span>
        ) : (
          rounds.map((round) => (
            <label
              key={round.id}
              className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg hover:bg-line/[.04] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(round.id)}
                onChange={() => toggle(round.id)}
                className="accent-accent"
              />
              <span className="text-[12.5px] text-ink-2">{round.title}</span>
              <span className="ml-auto text-[10.5px] text-dim">{round.questionCount} questions</span>
            </label>
          ))
        )}
      </div>
      <button
        onClick={() => setCreateOpen(true)}
        className="flex items-center justify-center gap-1.5 border-[1.5px] border-dashed border-line/[.14] rounded-[10px] py-2 text-mute-2 text-[11.5px] hover:border-accent hover:text-ink-2 cursor-pointer transition-colors"
      >
        <Icon name="plus" size={12} />
        Create New Round
      </button>

      <QuickCreateRoundModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(round) => onChange([...selected, round.id])}
      />
    </div>
  );
}
