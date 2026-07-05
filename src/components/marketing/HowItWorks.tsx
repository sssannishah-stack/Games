"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";

const STEPS = [
  {
    icon: "trophy",
    title: "Host Prepares Event",
    body: "The organizer sets up the competition, language and theme.",
  },
  {
    icon: "users",
    title: "Create Teams & Rounds",
    body: "Add teams with member names, then build rounds and questions.",
  },
  {
    icon: "qr-code",
    title: "Share QR Code",
    body: "Publish the room — teams join in seconds with a code or a scan.",
  },
  {
    icon: "play",
    title: "Host Live Event",
    body: "Step scene by scene, award marks, approve power cards, reveal the winner.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-14 md:py-28 px-4 md:px-5 bg-line/[.015] border-y border-line/[.05]">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-8 md:gap-12">
        <div className="flex flex-col items-center text-center gap-3">
          <span className="text-[10.5px] md:text-[11.5px] font-semibold tracking-[.14em] text-accent">
            HOW IT WORKS
          </span>
          <h2 className="text-[25px] md:text-[36px] font-bold text-ink tracking-[-.02em] leading-tight">
            From setup to live event in four steps
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-6 relative">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: 0.1 * i, duration: 0.45, ease: [0.2, 0.9, 0.3, 1] }}
              className="flex flex-row md:flex-col items-center text-left md:text-center gap-3 relative bg-card/60 border border-line/[.06] md:border-0 md:bg-transparent rounded-xl p-3 md:p-0"
            >
              {i < STEPS.length - 1 && (
                <span className="hidden md:block absolute top-6 left-[calc(50%+34px)] w-[calc(100%-40px)] h-px bg-line/10" />
              )}
              <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-full bg-card border border-accent/30 flex items-center justify-center z-10 shrink-0">
                <Icon name={step.icon} size={18} className="text-accent" />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
              </div>
              <div className="flex flex-col gap-1 md:contents">
                <span className="text-[14px] md:text-[14.5px] font-bold text-ink">{step.title}</span>
                <span className="text-[12.5px] text-mute-2 leading-relaxed max-w-[220px]">
                  {step.body}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
