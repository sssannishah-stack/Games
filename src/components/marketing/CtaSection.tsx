"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";

/** Closing call-to-action — the page shouldn't fizzle out into the footer. */
export function CtaSection() {
  return (
    <section className="py-14 md:py-24 px-4 md:px-5">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.55, ease: [0.2, 0.9, 0.3, 1] }}
        className="relative overflow-hidden max-w-[1080px] mx-auto rounded-[28px] border border-accent/25 px-6 py-12 md:px-12 md:py-16 text-center flex flex-col items-center gap-5"
        style={{
          background:
            "radial-gradient(600px 300px at 50% 0%, rgba(108,123,250,.22), transparent 70%), linear-gradient(180deg, color-mix(in oklab, var(--color-accent) 7%, transparent), transparent)",
        }}
      >
        <span
          aria-hidden
          className="absolute inset-x-16 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(108,123,250,.7), transparent)" }}
        />
        <span className="text-3xl">🎉</span>
        <h2 className="text-[26px] md:text-[38px] font-bold text-ink tracking-[-.02em] leading-tight max-w-[560px]">
          Ready to run your first live event?
        </h2>
        <p className="text-[14px] md:text-[15.5px] text-mute-2 max-w-[460px] leading-relaxed">
          Set up rounds and teams in minutes. Your participants only need a phone and the room code.
        </p>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
          <Link
            href="/admin"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-accent text-white text-[14.5px] font-bold rounded-[12px] px-7 py-4 sm:py-3.5 shadow-[0_10px_30px_rgba(108,123,250,.4)] hover:brightness-110 transition"
          >
            <Icon name="radio" size={16} />
            Start Hosting — it&apos;s free
          </Link>
          <Link
            href="/join"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-line/[.04] border border-line/[.1] text-ink-2 text-[14.5px] font-bold rounded-[12px] px-7 py-4 sm:py-3.5 hover:bg-line/[.08] transition"
          >
            <Icon name="qr-code" size={16} />
            Join with a code
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
