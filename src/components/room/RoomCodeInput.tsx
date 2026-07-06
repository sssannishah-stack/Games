"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

const LENGTH = 4;

interface RoomCodeInputProps {
  value: string; // digits only, length <= 4
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
}

/** Four-box segmented code entry — bigger tap targets and a lot more inviting than a plain text field. */
export function RoomCodeInput({ value, onChange, onComplete, autoFocus }: RoomCodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.padEnd(LENGTH, " ").split("").slice(0, LENGTH);

  function setChar(index: number, char: string) {
    const clean = char.replace(/[^0-9]/g, "").slice(-1);
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
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, LENGTH);
    onChange(pasted);
    if (pasted.length === LENGTH) {
      onComplete?.(pasted);
      refs.current[LENGTH - 1]?.focus();
    } else {
      refs.current[pasted.length]?.focus();
    }
  }

  return (
    <div className="flex items-center justify-center gap-2.5 sm:gap-3">
      {chars.map((char, i) => (
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
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          className={cn(
            "w-16 h-16 sm:w-[70px] sm:h-[70px] rounded-xl bg-line/[.05] border text-center font-mono font-bold text-2xl sm:text-3xl text-ink outline-none transition-colors",
            char.trim() ? "border-accent/60 bg-accent/[.08]" : "border-line/[.12] focus:border-accent/50"
          )}
        />
      ))}
    </div>
  );
}
