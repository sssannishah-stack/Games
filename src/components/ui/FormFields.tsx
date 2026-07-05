"use client";

import { Icon } from "@/components/ui/Icon";

export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-6 py-5 border-b border-line/[.07]">
      <span className="text-base font-bold text-ink">{title}</span>
      <button
        onClick={onClose}
        className="ml-auto w-[30px] h-[30px] rounded-lg flex items-center justify-center text-dim hover:bg-line/[.06] hover:text-ink-2 cursor-pointer"
      >
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <span className="text-[12.5px] text-danger-soft bg-danger/[.08] border border-danger/25 rounded-[10px] px-3 py-2">
      {error}
    </span>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label className="flex flex-col gap-[7px]">
      <span className="text-xs font-semibold text-ink-3">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={3}
          className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3.5 py-[11px] text-sm text-ink outline-none focus:border-accent/60 resize-none"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3.5 py-[11px] text-sm text-ink outline-none focus:border-accent/60"
        />
      )}
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-[7px]">
      <span className="text-[11px] font-semibold text-ink-3">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-2 py-2 text-sm text-ink outline-none"
      />
    </label>
  );
}

export function HintEditor({
  hints,
  setHints,
}: {
  hints: { text: string; penalty: number }[];
  setHints: (updater: (hints: { text: string; penalty: number }[]) => { text: string; penalty: number }[]) => void;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className="text-xs font-semibold text-ink-3">Hints</span>
      {hints.length > 0 && (
        <div className="flex gap-1.5 px-0.5">
          <span className="flex-1 text-[10px] text-dim">Hint text</span>
          <span className="w-20 text-[10px] text-dim text-center">Penalty (pts)</span>
          <span className="w-9" />
        </div>
      )}
      {hints.map((hint, index) => (
        <div key={index} className="flex gap-1.5">
          <input
            value={hint.text}
            onChange={(event) =>
              setHints((current) =>
                current.map((item, i) => (i === index ? { ...item, text: event.target.value } : item))
              )
            }
            placeholder={`Hint ${index + 1}`}
            className="flex-1 bg-line/[.04] border border-line/[.09] rounded-[10px] px-3 py-2 text-sm text-ink outline-none"
          />
          <input
            type="number"
            value={hint.penalty}
            title="Points deducted from the team's score if they use this hint"
            onChange={(event) =>
              setHints((current) =>
                current.map((item, i) =>
                  i === index ? { ...item, penalty: Number(event.target.value) } : item
                )
              )
            }
            className="w-20 bg-line/[.04] border border-line/[.09] rounded-[10px] px-2 py-2 text-sm text-ink outline-none text-center"
          />
          <button
            onClick={() => setHints((current) => current.filter((_, i) => i !== index))}
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-dim hover:text-danger-soft hover:bg-line/[.06]"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={() => setHints((current) => [...current, { text: "", penalty: 0 }])}
        className="flex items-center justify-center gap-1.5 border-[1.5px] border-dashed border-line/[.14] rounded-[10px] py-2 text-mute-2 text-[11.5px] hover:border-accent hover:text-ink-2 cursor-pointer transition-colors"
      >
        <Icon name="plus" size={12} />
        Add hint
      </button>
    </div>
  );
}
