"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * The "Oh! Store is open!" moment — a bottom-slide notification the instant
 * the host flips the store open, instead of the store just silently becoming
 * clickable. Purely a presentation layer over the existing `storeOpen`
 * boolean; the caller decides when to show/hide it (see the open<->closed
 * transition watcher in LivePlayClient).
 */
export function StoreOpenNotification({
  open,
  flashSale,
  onOpenStore,
  onDismiss,
}: {
  open: boolean;
  /** Real countdown when a flash sale is live — we don't fabricate a fake
   *  "store closes in" timer when there isn't an actual scheduled close. */
  flashSale?: { percent: number; endsAt: string | null } | null;
  onOpenStore: () => void;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[68] flex items-end justify-center pointer-events-none"
        >
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[1.5px]" />
          <motion.div
            initial={{ y: 140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 140, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="relative w-full max-w-[480px] mb-[86px] mx-4 pointer-events-auto"
          >
            <div
              className="relative overflow-hidden rounded-[24px] border border-warn/45 p-4 flex items-center gap-3.5 shadow-[0_20px_60px_rgba(0,0,0,.55)]"
              style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--color-warn) 16%, var(--color-card)), var(--color-card))" }}
            >
              <span
                aria-hidden
                className="absolute inset-x-8 top-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(232,163,61,.7), transparent)" }}
              />
              <motion.span
                animate={{ scale: [1, 1.12, 1], rotate: [0, -6, 6, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.6 }}
                className="text-3xl shrink-0"
              >
                🛍
              </motion.span>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[13.5px] font-black text-ink">Store Open!</span>
                <span className="text-[11.5px] text-mute-2">
                  {flashSale?.percent ? `Flash Sale — ${flashSale.percent}% off. ` : ""}
                  Spend your coins wisely.
                </span>
              </div>
              <button
                onClick={onOpenStore}
                className="shrink-0 rounded-xl bg-warn text-black px-3.5 py-2 text-[12px] font-black cursor-pointer active:scale-95"
              >
                Open
              </button>
              <button
                onClick={onDismiss}
                aria-label="Dismiss"
                className="shrink-0 w-6 h-6 rounded-lg bg-line/[.08] text-mute-2 flex items-center justify-center text-[13px] cursor-pointer"
              >
                ✕
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
