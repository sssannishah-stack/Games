"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

const LENGTH = 6; // 4 letters + 2 digits, e.g. "MNGO42" (rendered with a visual dash)

interface RoomCodeInputProps {
  value: string; // always uppercase, alphanumeric, no dash, length <= 6
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
}

/** Six-box segmented code entry — bigger tap targets and a lot more inviting than a plain text field. */
export function RoomCodeInput({ value, onChange, onComplete, autoFocus }: RoomCodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.padEnd(LENGTH, " ").split("").slice(0, LENGTH);

  function setChar(index: number, char: string) {
    const clean = char.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-1);
    const next = value.split("");
    next[index] = clean || "";
    const joined = next.join("").replace(/\s/g, "").slice(0, LENGTH);
    onChange(joined);

    if (clean && index < LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
    if (joined.length === LENGTH) {
      onComplete?.(joined);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !chars[index].trim() && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < LENGTH - 1) refs.current[index + 1]?.focus();
    if (e.key === "Enter" && value.length === LENGTH) onComplete?.(value);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, LENGTH);
    onChange(pasted);
    if (pasted.length === LENGTH) {
      onComplete?.(pasted);
      refs.current[LENGTH - 1]?.focus();
    } else {
      refs.current[pasted.length]?.focus();
    }
  }

  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
      {chars.slice(0, 4).map((char, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={char.trim()}
          onChange={(e) => setChar(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          autoFocus={autoFocus && i === 0}
          inputMode="text"
          maxLength={1}
          className={cn(
            "w-[15%] max-w-12 aspect-square rounded-xl bg-line/[.05] border text-center font-mono font-bold text-xl sm:text-2xl text-ink outline-none transition-colors",
            char.trim() ? "border-accent/60 bg-accent/[.08]" : "border-line/[.12] focus:border-accent/50"
          )}
        />
      ))}
      <span className="text-mute-2 text-xl font-bold px-0.5">–</span>
      {chars.slice(4, 6).map((char, offset) => {
        const i = offset + 4;
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={char.trim()}
            onChange={(e) => setChar(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            maxLength={1}
            className={cn(
              "w-[15%] max-w-12 aspect-square rounded-xl bg-line/[.05] border text-center font-mono font-bold text-xl sm:text-2xl text-ink outline-none transition-colors",
              char.trim() ? "border-accent/60 bg-accent/[.08]" : "border-line/[.12] focus:border-accent/50"
            )}
          />
        );
      })}
    </div>
  );
}
