"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/** Animated flash-sale countdown — real time, backed by the actual
 *  `flashSale.endsAt` the host set (never a fabricated timer). */
export function FlashSaleBanner({ percent, endsAt }: { percent: number; endsAt: string | null }) {
  const [remaining, setRemaining] = useState(() =>
    endsAt ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)) : 0
  );
  useEffect(() => {
    if (!endsAt) return;
    const interval = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [endsAt]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-2 rounded-xl border border-warn/40 bg-warn/[.12] px-3 py-2"
    >
      <span className="text-base animate-enc-pulse">⚡</span>
      <span className="text-[12px] font-bold text-warn">FLASH SALE — {percent}% OFF</span>
      <span className="ml-auto font-mono text-[12px] font-bold text-ink tabular-nums">
        {mm}:{ss}
      </span>
    </motion.div>
  );
}
