"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";

export function FinalCta() {
  return (
    <section className="py-14 md:py-32 px-4 md:px-5">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.2, 0.9, 0.3, 1] }}
        className="relative max-w-[820px] mx-auto rounded-xl md:rounded-2xl border border-accent/25 bg-[linear-gradient(135deg,rgba(108,123,250,.16),rgba(47,191,167,.06))] px-5 md:px-8 py-10 md:py-16 flex flex-col items-center text-center gap-5 md:gap-6 overflow-hidden"
      >
        <h2 className="relative text-[26px] md:text-[38px] font-bold text-ink tracking-[-.02em]">
          Have a room code?
        </h2>
        <p className="relative text-[14.5px] text-mute-2 max-w-[420px]">
          Ask your host for a room code or scan the QR to enter the live competition.
        </p>
        <Link
          href="/join"
          className="relative w-full sm:w-auto flex items-center justify-center gap-2 bg-accent text-white text-[15px] font-bold rounded-[13px] px-7 py-4 shadow-[0_12px_36px_rgba(108,123,250,.45)] hover:brightness-110 transition"
        >
          <Icon name="qr-code" size={17} />
          Join Competition
        </Link>
      </motion.div>
    </section>
  );
}
