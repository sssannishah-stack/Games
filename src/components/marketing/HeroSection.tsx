"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.5, ease: [0.2, 0.9, 0.3, 1] as const },
  }),
};

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-14 pb-16 md:pt-28 md:pb-36 px-4 md:px-5">
      {/* Layered backdrop: main glow + two soft drifting color orbs + a faint grid. */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(900px_500px_at_50%_-10%,rgba(108,123,250,.18),transparent_65%)]" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[.35]"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in oklab, var(--color-ink) 4%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--color-ink) 4%, transparent) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(720px 420px at 50% 8%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(720px 420px at 50% 8%, black, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="absolute -z-10 top-24 left-[8%] w-56 h-56 rounded-full blur-[90px] animate-enc-float"
        style={{ background: "rgba(108,123,250,.2)" }}
      />
      <div
        aria-hidden
        className="absolute -z-10 top-40 right-[10%] w-48 h-48 rounded-full blur-[90px] animate-enc-float"
        style={{ background: "rgba(61,214,140,.14)", animationDelay: "1.2s" }}
      />

      <div className="max-w-[860px] mx-auto flex flex-col items-center text-center gap-5 md:gap-6">
        <motion.span
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={0}
          className="flex items-center gap-1.5 text-[10px] md:text-[11.5px] font-semibold tracking-[.14em] text-accent bg-accent/10 border border-accent/25 rounded-full px-3 py-1.5 md:px-3.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-enc-pulse" />
          LIVE COMPETITION OPERATING SYSTEM
        </motion.span>

        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className="text-[36px] sm:text-[52px] md:text-[62px] font-bold text-ink tracking-[-.02em] leading-[1.04]"
        >
          Run unforgettable
          <br />
          <span className="bg-clip-text text-transparent bg-[linear-gradient(100deg,#6C7BFA,#9BA6FF_45%,#4E96D8)]">
            live competitions
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={2}
          className="text-[14.5px] md:text-[17px] text-mute-2 max-w-[560px] leading-relaxed"
        >
          Create rounds, control questions, manage teams, power cards, scoring and leaderboards from
          one powerful host console.
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={3}
          className="w-full sm:w-auto flex flex-col sm:flex-row items-center justify-center gap-3 mt-2"
        >
          <Link
            href="/admin"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-accent text-white text-[14.5px] font-bold rounded-[12px] px-6 py-4 sm:py-3.5 shadow-[0_10px_30px_rgba(108,123,250,.4)] hover:brightness-110 transition"
          >
            <Icon name="radio" size={16} />
            Start Hosting
          </Link>
          <Link
            href="/join"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-line/[.04] border border-line/[.1] text-ink-2 text-[14.5px] font-bold rounded-[12px] px-6 py-4 sm:py-3.5 hover:bg-line/[.08] transition"
          >
            <Icon name="qr-code" size={16} />
            Join Event
          </Link>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={4}
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-3 text-[12px] text-mute-2"
        >
          <span className="flex items-center gap-1.5">
            <Icon name="smartphone" size={13} className="text-accent" />
            No app to install
          </span>
          <span className="hidden sm:inline text-dim">·</span>
          <span className="flex items-center gap-1.5">
            <Icon name="zap" size={13} className="text-warn" />
            Real-time on every phone
          </span>
          <span className="hidden sm:inline text-dim">·</span>
          <span className="flex items-center gap-1.5">
            <Icon name="crown" size={13} className="text-success" />
            Host controls everything
          </span>
        </motion.div>
      </div>
    </section>
  );
}
