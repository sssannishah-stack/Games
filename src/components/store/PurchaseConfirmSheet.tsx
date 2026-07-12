"use client";

import { motion, AnimatePresence } from "framer-motion";
import { PowerCardFace } from "@/components/power-card/PowerCardFace";
import type { ShopCard } from "@/components/store/PowerCardShopTile";

/**
 * "Click Buy" no longer purchases instantly — it opens this confirm step
 * first (price, coins-after, Cancel/Buy) so a tap can't accidentally spend
 * team coins. Insufficient funds shakes the price line and explains the
 * shortfall instead of letting the server error surface as a raw toast.
 */
export function PurchaseConfirmSheet({
  card,
  coins,
  pending,
  onCancel,
  onConfirm,
}: {
  card: ShopCard | null;
  coins: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!card) return null;
  const canAfford = coins >= card.price;
  const after = coins - card.price;

  return (
    <AnimatePresence>
      {card && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[75] flex items-center justify-center px-6"
        >
          <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" onClick={() => !pending && onCancel()} />
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            className="relative w-full max-w-[300px] rounded-[26px] border border-line/[.12] bg-card p-5 flex flex-col items-center gap-3 shadow-[0_30px_90px_rgba(0,0,0,.6)]"
          >
            <span className="text-[10px] font-bold tracking-[.18em] text-mute-2">CONFIRM PURCHASE</span>
            <div className="w-[120px]">
              <PowerCardFace name={card.name} effectType={card.effectType} rarity={card.rarity} icon={card.icon} size="sm" />
            </div>
            <span className="text-[15px] font-black text-ink text-center">Buy {card.name}?</span>

            <div className="w-full rounded-2xl border border-line/[.09] bg-line/[.03] px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-mute-2">Price</span>
                <motion.span
                  animate={!canAfford ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  className={`font-mono font-black ${canAfford ? "text-warn" : "text-danger-soft"}`}
                >
                  {card.price} 🪙
                </motion.span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-mute-2">Coins after</span>
                <span className={`font-mono font-black ${canAfford ? "text-ink" : "text-danger-soft"}`}>
                  {canAfford ? after : coins}
                </span>
              </div>
            </div>

            {!canAfford && (
              <span className="text-[11.5px] font-semibold text-danger-soft text-center">
                You need {card.price - coins} more coins.
              </span>
            )}

            <div className="grid grid-cols-2 gap-2 w-full mt-1">
              <button
                onClick={onCancel}
                disabled={pending}
                className="rounded-xl border border-line/[.12] bg-line/[.04] py-2.5 text-[12.5px] font-bold text-ink-3 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={pending || !canAfford}
                className={`rounded-xl py-2.5 text-[12.5px] font-black transition ${
                  canAfford
                    ? "bg-accent text-white cursor-pointer active:scale-95"
                    : "bg-line/[.08] text-dim-2 cursor-not-allowed"
                }`}
              >
                {pending ? "Buying…" : "Buy"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
