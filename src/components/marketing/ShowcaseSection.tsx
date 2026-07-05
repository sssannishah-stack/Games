"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ScenePhone } from "@/components/competition/ScenePhone";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";
import { mockQuestions } from "@/data/mock/questions";
import { mockTeams } from "@/data/mock/teams";

/* A condensed, illustrative recreation of the real Host Console layout —
   scene flow + live preview + team rail — sized to sit in a 3-column showcase. */
function HostConsolePreview() {
  const scenes = [
    { label: "05 · Round intro", state: "done" },
    { label: "07 · Question 3", state: "live" },
    { label: "08 · Question 4", state: "next" },
  ] as const;

  return (
    <Card className="w-full max-w-[380px] rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.5)]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line/[.07] bg-line/[.015]">
        <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-[.1em] text-live bg-danger/10 border border-danger/30 rounded-full px-2.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-danger animate-enc-pulse" />
          LIVE
        </span>
        <span className="text-[11px] font-semibold text-ink-2">Sharma Family Game Night</span>
        <span className="ml-auto font-mono text-[10px] text-mute-2">00:42:18</span>
      </div>

      <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 p-3.5">
        <div className="flex flex-col gap-1.5">
          {scenes.map((s) => (
            <div
              key={s.label}
              className={`rounded-lg px-2 py-1.5 text-[9.5px] flex items-center gap-1 ${
                s.state === "live"
                  ? "bg-danger/10 border border-danger/30 text-ink font-semibold"
                  : s.state === "next"
                    ? "border border-success/25 bg-success/[.05] text-ink-3"
                    : "text-dim-2 line-through"
              }`}
            >
              {s.state === "live" && <span className="w-1 h-1 rounded-full bg-danger shrink-0" />}
              <span className="truncate">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="bg-elev border border-line/[.07] rounded-xl p-3 flex flex-col gap-1.5">
            <span className="text-[9px] font-mono text-mute-2">ROUND 2 · EMOJI QUIZ</span>
            <span className="text-[18px]">🍿🎬😱</span>
            <span className="text-[10.5px] font-semibold text-ink">Guess the movie</span>
          </div>
          <div className="flex gap-1.5">
            {["Mango", "Chai", "Ladoo"].map((t, i) => (
              <span
                key={t}
                className="flex-1 text-center text-[9px] rounded-md py-1 bg-line/[.05] text-ink-3"
              >
                {i === 0 ? "120" : i === 1 ? "115" : "90"}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-t border-line/[.06] bg-[rgba(13,14,20,.7)]">
        <div className="flex-1 bg-accent text-white text-[10px] font-bold rounded-lg py-2 text-center flex items-center justify-center gap-1">
          Next scene <Icon name="skip-forward" size={11} />
        </div>
        <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
          <Icon name="badge-plus" size={13} className="text-success" />
        </div>
        <div className="w-8 h-8 rounded-lg bg-line/[.05] flex items-center justify-center">
          <Icon name="crown" size={13} className="text-warn" />
        </div>
      </div>
    </Card>
  );
}

const columns = [
  { label: "HOST CONSOLE", caption: "Every screen, one control room." },
  { label: "PARTICIPANT PHONE", caption: "Exactly what every team sees." },
  { label: "LEADERBOARD", caption: "Ranks move the instant marks land." },
];

export function ShowcaseSection() {
  return (
    <section className="py-20 md:py-28 px-5">
      <div className="max-w-[1180px] mx-auto flex flex-col gap-12">
        <div className="flex flex-col items-center text-center gap-3">
          <span className="text-[11.5px] font-semibold tracking-[.14em] text-accent">
            SEE IT IN ACTION
          </span>
          <h2 className="text-[28px] md:text-[36px] font-bold text-ink tracking-[-.02em]">
            One system, every screen in sync
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {columns.map((col, i) => (
            <motion.div
              key={col.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: 0.1 * i, duration: 0.5, ease: [0.2, 0.9, 0.3, 1] }}
              className="flex flex-col items-center gap-4"
            >
              <SectionLabel className="text-[10.5px] tracking-[.14em]">{col.label}</SectionLabel>
              <div className="flex justify-center w-full">
                {i === 0 && <HostConsolePreview />}
                {i === 1 && (
                  <ScenePhone
                    question={mockQuestions[0]}
                    roundLabel="ROUND 2 · EMOJI QUIZ"
                    variant="builder"
                    live
                  />
                )}
                {i === 2 && (
                  <div className="w-full max-w-[340px] bg-card border border-line/[.08] rounded-2xl p-4 shadow-[0_30px_80px_rgba(0,0,0,.5)]">
                    <Leaderboard teams={mockTeams} />
                  </div>
                )}
              </div>
              <span className="text-[12.5px] text-mute-2 text-center">{col.caption}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
