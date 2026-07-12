"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Confetti } from "@/components/motion/Confetti";
import { PowerCardFace } from "@/components/power-card/PowerCardFace";

export interface CelebrationPayload {
  id: string;
  name: string;
  icon: string;
  effectType?: string;
  rarity?: string;
  ownedAfter: number;
}

/**
 * The payoff moment right after a purchase confirms: the card flips up,
 * glows, confetti pops, then settles into a "Added ×N owned" toast. This is
 * purely a celebration layer — the purchase itself already happened server
 * side by the time this shows (see purchasePowerCard in LivePlayClient).
 * Sound hook: fire a "purchase-success" chime here once an audio pipeline
 * exists — no asset/player wired up yet.
 */
export function PurchaseCelebration({ payload, onDone }: { payload: CelebrationPayload | null; onDone: () => void }) {
  return (
    <AnimatePresence onExitComplete={onDone}>
      {payload && (
        <motion.div
          key={payload.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[76] flex items-center justify-center pointer-events-none"
        >
          <Confetti count={60} />
          <motion.div
            initial={{ scale: 0.3, rotateY: 90, opacity: 0 }}
            animate={{ scale: 1, rotateY: 0, opacity: 1 }}
            exit={{ scale: 0.7, y: -40, opacity: 0, transition: { duration: 0.35 } }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.05 }}
            style={{ transformPerspective: 900 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="w-[150px]" style={{ filter: "drop-shadow(0 0 40px rgba(255,255,255,.25))" }}>
              <PowerCardFace name={payload.name} effectType={payload.effectType} rarity={payload.rarity} icon={payload.icon} size="md" />
            </div>
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="rounded-full border border-success/40 bg-success/[.14] px-4 py-1.5 flex items-center gap-2"
            >
              <span className="text-success text-[13px] font-black">{payload.icon} {payload.name} Added</span>
              <span className="text-[11px] font-bold text-ink-3">×{payload.ownedAfter} Owned</span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
