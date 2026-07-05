"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";

const FEATURES = [
  {
    emoji: "🎮",
    icon: "radio",
    title: "Host Controlled Events",
    body: "The host controls every screen in real time — nothing advances until they say so.",
  },
  {
    emoji: "🃏",
    icon: "sparkles",
    title: "Power Card Economy",
    body: "Teams earn coins, buy Shield, Hint, Freeze or Double Points cards, and manage resources like real strategists.",
  },
  {
    emoji: "🏆",
    icon: "crown",
    title: "Live Leaderboards",
    body: "Animated ranking updates the instant marks are given, visible on every phone in the room.",
  },
  {
    emoji: "⚡",
    icon: "clapperboard",
    title: "Scene Based Flow",
    body: "Run events like a presentation — waiting room, rules, questions, reveal, winner.",
  },
  {
    emoji: "📱",
    icon: "smartphone",
    title: "Phone Participation",
    body: "Participants join using a QR code or room code — no app to install.",
  },
  {
    emoji: "🎨",
    icon: "pencil",
    title: "Drawing Challenges",
    body: "Live drawing rounds sync to every phone in under 50ms, with one-tap scoring.",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.06 * i, duration: 0.4, ease: [0.2, 0.9, 0.3, 1] as const },
  }),
};

export function FeatureGrid() {
  return (
    <section id="features" className="py-14 md:py-28 px-4 md:px-5">
      <div className="max-w-[1080px] mx-auto flex flex-col gap-8 md:gap-12">
        <div className="flex flex-col items-center text-center gap-3">
          <span className="text-[10.5px] md:text-[11.5px] font-semibold tracking-[.14em] text-accent">
            EVERYTHING YOU NEED
          </span>
          <h2 className="text-[25px] md:text-[36px] font-bold text-ink tracking-[-.02em] leading-tight">
            Built for the way live events actually run
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              variants={cardVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              custom={i}
              className="bg-card border border-line/[.07] rounded-xl md:rounded-2xl p-4 md:p-6 flex flex-col gap-3 hover:border-line/[.14] transition-colors"
            >
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-[12px] bg-accent/10 border border-accent/20 flex items-center justify-center text-lg">
                {f.emoji}
              </div>
              <span className="text-[15px] font-bold text-ink flex items-center gap-2">
                <Icon name={f.icon} size={15} className="text-accent" />
                {f.title}
              </span>
              <span className="text-[13px] text-mute-2 leading-relaxed">{f.body}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
