"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";

const USE_CASES = [
  { icon: "flower-2", title: "Jain Pathshala Competition", body: "Antakshari, Chitra Thi Geet and scripture quizzes for the whole community." },
  { icon: "graduation-cap", title: "School Quiz", body: "Inter-house or inter-class competitions with teacher-judged scoring." },
  { icon: "house-heart", title: "Family Game Night", body: "Antakshari, charades and drawing rounds for the whole family." },
  { icon: "users", title: "Community Events", body: "Festivals, camps and gatherings that need a shared big screen and phones." },
  { icon: "briefcase-business", title: "Corporate Events", body: "Team offsites and townhalls with real-time leaderboards." },
];

export function UseCases() {
  return (
    <section id="use-cases" className="py-14 md:py-28 px-4 md:px-5 bg-line/[.015] border-y border-line/[.05]">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-8 md:gap-12">
        <div className="flex flex-col items-center text-center gap-3">
          <span className="text-[10.5px] md:text-[11.5px] font-semibold tracking-[.14em] text-accent">
            WHO IT&apos;S FOR
          </span>
          <h2 className="text-[25px] md:text-[36px] font-bold text-ink tracking-[-.02em] leading-tight">
            Built for real rooms full of real people
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {USE_CASES.map((u, i) => (
            <motion.div
              key={u.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: 0.06 * i, duration: 0.4, ease: [0.2, 0.9, 0.3, 1] }}
              className="bg-card border border-line/[.07] rounded-xl md:rounded-2xl p-4 md:p-5 flex flex-col gap-3 hover:border-accent/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-[10px] bg-accent/10 flex items-center justify-center">
                <Icon name={u.icon} size={16} className="text-accent" />
              </div>
              <span className="text-[13.5px] font-bold text-ink leading-snug">{u.title}</span>
              <span className="text-[12px] text-mute-2 leading-relaxed">{u.body}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
