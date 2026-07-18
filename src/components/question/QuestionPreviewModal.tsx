"use client";

import { Modal } from "@/components/ui/Modal";
import { ModalHeader } from "@/components/ui/FormFields";
import type { QuestionRecord } from "@/data/queries/question.queries";

/**
 * A quick "how players see it" preview of a library question, in a phone-ish
 * frame — the question, media, options and reward chips exactly as they render
 * on a participant's screen, plus a clearly-separated host-only strip showing
 * the answer/rationale (which participants never see) so the host can sanity
 * check a question before going live.
 */
export function QuestionPreviewModal({
  question,
  onClose,
}: {
  question: QuestionRecord | null;
  onClose: () => void;
}) {
  const q = question;
  const pos = q?.positiveMarks ?? 10;
  const neg = Math.abs(q?.negativeMarks ?? 5);

  return (
    <Modal open={q !== null} onClose={onClose} className="max-w-[420px]">
      <ModalHeader title="Preview — how players see it" onClose={onClose} />
      {q && (
        <div className="px-5 py-5 flex flex-col gap-4 max-h-[74dvh] overflow-y-auto">
          {/* Phone-ish participant frame. */}
          <div
            data-theme="dark"
            className="rounded-[26px] border border-line/[.12] bg-[linear-gradient(180deg,#0C0D13,#08090C)] p-4 flex flex-col gap-3.5"
          >
            <div className="flex items-center justify-center">
              <span className="flex flex-col items-center justify-center w-[74px] h-[74px] rounded-full border-[5px] border-accent/40 text-accent">
                <span className="text-[22px] font-black tabular-nums leading-none">{q.timer}</span>
                <span className="text-[7.5px] font-bold tracking-[.2em] text-mute-2 mt-0.5">SEC</span>
              </span>
            </div>

            {q.media?.url && (
              <div className="rounded-2xl overflow-hidden border border-line/[.08] bg-line/[.04]">
                {q.media.type === "IMAGE" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={q.media.url} alt={q.media.name} className="w-full max-h-40 object-cover" />
                )}
                {q.media.type === "AUDIO" && <audio controls src={q.media.url} className="w-full p-2" />}
                {q.media.type === "VIDEO" && <video controls src={q.media.url} className="w-full max-h-44" />}
              </div>
            )}

            <h1 className="text-center text-[19px] leading-tight font-black text-ink">
              {q.question || q.media?.name || "Untitled"}
            </h1>

            {q.isMCQ && q.options.length > 0 ? (
              <div className="flex flex-col gap-2">
                {q.options.map((option, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 rounded-2xl border border-line/[.08] bg-line/[.04] px-3.5 py-2.5"
                  >
                    <span className="w-6 h-6 rounded-full border border-line/[.12] bg-line/[.06] flex items-center justify-center text-[11px] font-bold text-ink-3 shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-[13px] font-semibold text-ink">{option}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-[12px] text-mute-2">Discuss with your team. The host gives marks.</p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-success/30 bg-success/[.1] px-2.5 py-1 text-[11px] font-bold text-success">
                ✓ Correct +{pos}
              </span>
              {neg > 0 && (
                <span className="rounded-full border border-danger/30 bg-danger/[.08] px-2.5 py-1 text-[11px] font-bold text-danger-soft">
                  ✗ Wrong −{neg}
                </span>
              )}
            </div>
          </div>

          {/* Host-only strip — the answer + rationale players never see. */}
          <div className="rounded-2xl border border-warn/25 bg-warn/[.06] p-3.5 flex flex-col gap-2">
            <span className="text-[9.5px] font-mono font-semibold tracking-[.12em] text-warn">
              HOST ONLY — HIDDEN FROM PLAYERS
            </span>
            <span className="text-[14px] font-bold text-ink">Answer: {q.answer}</span>
            {q.isMCQ && q.optionRationales.some((r) => r) && (
              <div className="flex flex-col gap-1 mt-0.5">
                {q.options.map((option, i) =>
                  q.optionRationales[i] ? (
                    <span key={i} className="text-[11px] text-mute-2 leading-snug">
                      <b className={option === q.answer ? "text-success" : "text-ink-3"}>
                        {String.fromCharCode(65 + i)}.
                      </b>{" "}
                      {q.optionRationales[i]}
                    </span>
                  ) : null
                )}
              </div>
            )}
            {q.hints.length > 0 && (
              <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-line/[.08]">
                <span className="text-[9.5px] font-semibold tracking-[.1em] text-label">
                  HINTS (unlocked with the Hint card)
                </span>
                {q.hints.map((hint, i) => (
                  <span key={i} className="text-[11.5px] text-ink-3">
                    {i + 1}. {hint.text} <span className="text-mute-2">(−{hint.penalty})</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
