"use client";

import { cn } from "@/lib/utils";
import type { Question } from "@/types";

type ScenePhoneVariant = "builder" | "host" | "mini";

interface ScenePhoneProps {
  question: Question;
  roundLabel: string;
  timer?: number;
  variant?: ScenePhoneVariant;
  live?: boolean; // red on-air ring
  footerLeft?: string;
  footerRight?: string;
  className?: string;
}

/* The phone-shaped scene rendering — "exactly what every phone will show".
   Three fidelity sizes: builder canvas, host program monitor, editor mini preview. */
export function ScenePhone({
  question,
  roundLabel,
  timer = 20,
  variant = "builder",
  live,
  footerLeft = "host awards marks",
  footerRight = "power cards by approval",
  className,
}: ScenePhoneProps) {
  const v = variant;
  return (
    <div
      className={cn(
        "bg-[linear-gradient(170deg,#151726,#0D0E15)] flex flex-col",
        v === "builder" &&
          "w-[308px] h-[640px] rounded-[38px] border border-line/[.12] shadow-[0_0_0_3px_rgba(108,123,250,.55),0_30px_70px_rgba(0,0,0,.6)] px-5 py-[22px] gap-4",
        v === "host" &&
          "w-[238px] rounded-[30px] px-[15px] py-4 gap-2.5 " +
            (live
              ? "border border-danger/40 shadow-[0_0_0_3px_rgba(255,92,92,.16),0_26px_60px_rgba(0,0,0,.65)]"
              : "border border-line/[.12] shadow-[0_26px_60px_rgba(0,0,0,.6)]"),
        v === "mini" &&
          "w-[164px] h-[340px] rounded-3xl border border-line/[.12] shadow-[0_16px_40px_rgba(0,0,0,.5)] px-3 py-3.5 gap-[9px]",
        className
      )}
    >
      <span
        className={cn(
          "self-center font-semibold text-accent bg-accent/15 rounded-full",
          v === "builder" && "text-[11px] tracking-[.1em] px-3 py-[5px]",
          v === "host" && "text-[8.5px] tracking-[.1em] px-[9px] py-[3px]",
          v === "mini" && "text-[7.5px] tracking-[.09em] px-2 py-[3px]"
        )}
      >
        {roundLabel}
      </span>

      {v !== "mini" && (
        <div className="self-center rounded-full flex items-center justify-center font-mono font-semibold text-ink"
          style={{
            width: v === "builder" ? 62 : 44,
            height: v === "builder" ? 62 : 44,
            border: `${v === "builder" ? 3.5 : 3}px solid var(--color-accent)`,
            borderRightColor: "rgba(255,255,255,.12)",
            fontSize: v === "builder" ? 20 : 14,
          }}
        >
          {timer}
        </div>
      )}

      <div
        className={cn(
          "text-center",
          v === "builder" && "text-[34px] tracking-[6px]",
          v === "host" && "text-[23px] tracking-[3px]",
          v === "mini" && "text-[17px] tracking-[2px]"
        )}
      >
        {question.emoji}🎬😱
      </div>
      <div
        className={cn(
          "text-center font-semibold text-ink",
          v === "builder" && "text-[17px] tracking-[-.01em]",
          v === "host" && "text-[12.5px]",
          v === "mini" && "text-[9.5px]"
        )}
      >
        Guess the movie
      </div>

      <div className={cn("flex flex-col", v === "builder" ? "gap-[9px] mt-1" : v === "host" ? "gap-1.5" : "gap-[5px]")}>
        {question.options?.map((o) => (
          <div
            key={o.key}
            className={cn(
              "border border-line/10 text-ink-3 flex items-center",
              v === "builder" && "gap-2.5 bg-line/[.03] rounded-[13px] px-3.5 py-3 text-[13.5px]",
              v === "host" && "rounded-[9px] px-2.5 py-[7px] text-[9.5px] gap-1.5",
              v === "mini" && "rounded-lg px-2 py-1.5 text-[8.5px] gap-1"
            )}
          >
            {v === "builder" ? (
              <>
                <span className="font-mono font-semibold text-[11px] text-dim">{o.key}</span>
                {o.label}
              </>
            ) : (
              <>{o.key} · {o.label}</>
            )}
          </div>
        ))}
      </div>

      <div
        className={cn(
          "mt-auto flex justify-between text-dim",
          v === "builder" && "text-[11px]",
          v === "host" && "text-[8.5px]",
          v === "mini" && "text-[7.5px] justify-center"
        )}
      >
        {v === "mini" ? (
          <span>manual · 20s · synced</span>
        ) : (
          <>
            <span>{footerLeft}</span>
            <span>{footerRight}</span>
          </>
        )}
      </div>
    </div>
  );
}
