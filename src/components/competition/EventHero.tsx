"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { QrPlaceholder } from "@/components/ui/QrPlaceholder";

export interface EventHeroData {
  name: string;
  countdown: string;
  facts: { icon: string; label: string }[];
  readiness: { ok: boolean; label: string }[];
  roomCode: string;
  joined: number;
}

/* Dashboard "next event" hero with readiness chips and join QR. */
export function EventHero({ event }: { event: EventHeroData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.9, 0.3, 1] }}
      className="relative rounded-2xl border border-accent/30 bg-[linear-gradient(120deg,rgba(108,123,250,.12),#101218_55%)] p-7 md:px-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_240px] gap-7 overflow-hidden"
    >
      <div className="absolute -right-20 -bottom-32 w-[340px] h-[340px] rounded-full bg-[radial-gradient(circle,rgba(108,123,250,.18),transparent_70%)] pointer-events-none" />

      <div className="flex flex-col gap-3.5 relative">
        <div className="flex items-center gap-2.5">
          <Badge variant="accent" size="sm" className="tracking-[.14em] text-[10.5px]">
            NEXT EVENT
          </Badge>
          <span className="text-xs text-mute-2">{event.countdown}</span>
        </div>
        <span className="text-[30px] font-bold text-ink tracking-[-.025em] leading-tight">
          {event.name}
        </span>
        <div className="flex items-center gap-4 text-[13px] text-mute flex-wrap">
          {event.facts.map((f) => (
            <span key={f.label} className="flex items-center gap-1.5">
              <Icon name={f.icon} size={14} className="text-dim" />
              {f.label}
            </span>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap mt-0.5">
          {event.readiness.map((r) => (
            <Badge key={r.label} variant={r.ok ? "success" : "warn"} size="md">
              <Icon name={r.ok ? "check" : "triangle-alert"} size={13} />
              {r.label}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2.5 mt-2.5 flex-wrap">
          <Button variant="white" size="lg">
            <Icon name="play" size={15} />
            Rehearse
          </Button>
          <Button variant="ghost" size="lg">
            <Icon name="pencil-ruler" size={15} />
            Edit scenes
          </Button>
          <Button variant="ghost" size="lg">
            <Icon name="user-plus" size={15} />
            Invite teams
          </Button>
        </div>
      </div>

      <div className="relative bg-line/[.035] border border-line/[.09] rounded-[14px] p-4.5 flex flex-col items-center gap-2.5 backdrop-blur-lg">
        <QrPlaceholder size={120} />
        <span className="font-mono font-semibold text-xl tracking-[.22em] text-ink">
          {event.roomCode}
        </span>
        <span className="text-[11.5px] text-mute-2 flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full bg-success animate-enc-pulse-slow" />
          Waiting room open · {event.joined} joined
        </span>
        <Button variant="ghost" size="sm" className="px-3.5">
          <Icon name="share-2" size={13} />
          Share join link
        </Button>
      </div>
    </motion.div>
  );
}
