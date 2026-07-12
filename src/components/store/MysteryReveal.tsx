"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Confetti } from "@/components/motion/Confetti";

export type MysteryPhase = "opening" | { reward: string } | null;

/**
 * The Mystery Box is the one purchase whose outcome the backend decides
 * server-side, with no reward payload returned to the client — only the
 * live activity feed eventually says what landed (already human-readable
 * text like "Shield" or "+500 coins", reused as-is; see the feed-watcher in
 * LivePlayClient that flips `opening` -> `{ reward }` once that entry shows
 * up). So: click Buy -> lid animation plays immediately for anticipation ->
 * once the real result arrives, lights flash and the actual prize appears.
 */
export function MysteryReveal({ phase, onDone }: { phase: MysteryPhase; onDone: () => void }) {
  return (
    <AnimatePresence>
      {phase && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[77] flex items-center justify-center px-6"
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-[4px]" />

          {/* Radiating light rays while we wait for / reveal the result. */}
          <motion.div
            aria-hidden
            className="absolute w-[520px] h-[520px]"
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            style={{
              background: "repeating-conic-gradient(rgba(255,255,255,.08) 0deg 8deg, transparent 8deg 22deg)",
              maskImage: "radial-gradient(circle, black 0%, transparent 65%)",
              WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 65%)",
            }}
          />

          {phase === "opening" ? (
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative flex flex-col items-center gap-4"
            >
              <motion.span
                animate={{ rotate: [-8, 8, -8], scale: [1, 1.08, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-7xl"
                style={{ filter: "drop-shadow(0 0 40px rgba(201,154,240,.6))" }}
              >
                🎁
              </motion.span>
              <span className="text-[13px] font-black tracking-[.14em] text-[#C99AF0]">OPENING…</span>
            </motion.div>
          ) : (
            <motion.div
              key="reveal"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 16 }}
              className="relative flex flex-col items-center gap-4"
            >
              <Confetti count={90} />
              <motion.span
                initial={{ rotate: -15 }}
                animate={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="text-7xl"
                style={{ filter: "drop-shadow(0 0 50px rgba(201,154,240,.75))" }}
              >
                ✨
              </motion.span>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-bold tracking-[.18em] text-mute-2">YOU GOT</span>
                <span className="text-2xl font-black text-white text-center max-w-[240px]">{phase.reward}</span>
              </div>
              <button
                onClick={onDone}
                className="mt-2 rounded-xl bg-white/10 border border-white/15 px-5 py-2 text-[12px] font-bold text-white cursor-pointer active:scale-95"
              >
                Nice!
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
