"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { ReactNode } from "react";

interface JoinPageShellProps {
  children: ReactNode;
  eyebrow?: string;
}

/**
 * Shared branded chrome for the public join flow (/join and /join/[code]) —
 * animated glow background, floating logo mark, motion-in card. Mobile-first:
 * fills the viewport edge-to-edge on phones, centers as a card on larger screens.
 */
export function JoinPageShell({ children, eyebrow = "LIVE COMPETITION OS" }: JoinPageShellProps) {
  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center px-4 py-8 sm:py-12 overflow-hidden">
      {/* ambient glow, layered like the marketing hero */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(720px_460px_at_50%_-8%,rgba(108,123,250,.22),transparent_62%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(520px_360px_at_85%_105%,rgba(47,191,167,.1),transparent_60%)]" />
      <div className="absolute inset-0 -z-10 enc-dot-grid opacity-[.35]" />

      <ThemeToggle className="fixed top-4 right-4 z-50 w-9 h-9 backdrop-blur-lg" />

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.9, 0.3, 1] }}
        className="w-full max-w-[420px] flex flex-col items-center gap-5"
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          className="w-14 h-14 rounded-[16px] bg-[linear-gradient(135deg,#6C7BFA,#4E96D8)] flex items-center justify-center shadow-[0_10px_34px_rgba(108,123,250,.5)]"
        >
          <Icon name="sparkles" size={24} className="text-white" />
        </motion.div>

        <span className="text-[10px] font-semibold tracking-[.18em] text-accent bg-accent/10 border border-accent/25 rounded-full px-3 py-1.5">
          {eyebrow}
        </span>

        <div className="w-full bg-card/90 backdrop-blur-xl border border-line/[.09] rounded-[22px] p-6 sm:p-7 flex flex-col items-center gap-5 shadow-[0_30px_90px_rgba(0,0,0,.5)]">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
