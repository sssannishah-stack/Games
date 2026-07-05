"use client";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";

function EmptyState({
  icon,
  iconColor,
  title,
  body,
  actions,
  label,
}: {
  icon: string;
  iconColor: string;
  title: string;
  body: string;
  actions: { label: string; icon?: string; primary?: boolean }[];
  label: string;
}) {
  return (
    <Card className="rounded-2xl px-6 py-7 flex flex-col items-center gap-3 text-center">
      <div
        className="w-14 h-14 rounded-[18px] flex items-center justify-center border border-dashed"
        style={{
          background: `color-mix(in oklab, ${iconColor} 10%, transparent)`,
          borderColor: `color-mix(in oklab, ${iconColor} 45%, transparent)`,
        }}
      >
        <Icon name={icon} size={24} style={{ color: iconColor }} />
      </div>
      <div className="flex flex-col gap-[3px]">
        <span className="text-[15px] font-bold text-ink">{title}</span>
        <span className="text-xs text-mute-2 leading-relaxed max-w-[260px]">{body}</span>
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        {actions.map((a) => (
          <Button key={a.label} variant={a.primary ? "primary" : "subtle"} size="md">
            {a.icon && <Icon name={a.icon} size={13} />}
            {a.label}
          </Button>
        ))}
      </div>
      <span className="font-mono font-medium text-[9.5px] text-label mt-1">{label}</span>
    </Card>
  );
}

function SkeletonRow({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-[11px] enc-shimmer" style={{ animationDelay: `${delay}s` }} />
      <div className="flex flex-col gap-1.5 flex-1">
        <div className="h-[11px] rounded-md w-3/5 enc-shimmer" style={{ animationDelay: `${delay}s` }} />
        <div className="h-[9px] rounded-md w-2/5 enc-shimmer" style={{ animationDelay: `${delay}s` }} />
      </div>
    </div>
  );
}

const CONNECTION_STATES = [
  {
    icon: "wifi-off",
    tone: "255,131,131",
    spinner: false,
    title: "Host offline",
    detail: "timers auto-paused · phones show “one moment”",
  },
  {
    icon: "",
    tone: "245,185,61",
    spinner: true,
    title: "2 participants reconnecting",
    detail: "Stars · Diya — answers held safely",
  },
  {
    icon: "refresh-cw",
    tone: "61,214,140",
    spinner: false,
    title: "Back online — synced",
    detail: "3 offline answers merged · scores recomputed",
  },
];

const TOASTS = [
  { icon: "circle-check", color: "#3DD68C", border: "rgba(61,214,140,.35)", text: "+10 to Chai · Correct", bold: "+10 to Chai", action: "Undo" },
  { icon: "megaphone", color: "#6C7BFA", border: "rgba(255,255,255,.12)", text: "Broadcast sent to 23 phones", action: "now" },
  { icon: "timer-off", color: "#F5B93D", border: "rgba(245,185,61,.3)", text: "Timer paused on all phones", action: "Resume" },
];

const KEYS = [
  { k: "Space", label: "Next scene" },
  { k: "R", label: "Reveal answer" },
  { k: "M", label: "Marks pad" },
  { k: "L", label: "Leaderboard" },
  { k: "P", label: "Pause timer" },
  { k: "B", label: "Broadcast" },
  { k: ".", label: "Black screen" },
  { k: "⌘Z", label: "Undo anything" },
];

/* V2-09 · System states — empty, loading, error, toasts (the unglamorous 80%). */
export function SystemStates() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <EmptyState
        icon="trophy"
        iconColor="#6C7BFA"
        title="No competitions yet"
        body="Your first show is 10 minutes away. Start from a template — Antakshari, School Quiz, Family Night…"
        actions={[
          { label: "New competition", icon: "plus", primary: true },
          { label: "Browse templates" },
        ]}
        label="EMPTY · COMPETITIONS"
      />
      <EmptyState
        icon="users"
        iconColor="#3DD68C"
        title="No teams yet"
        body="Share the room QR and teams appear here as families join — or pre-create them with names and colors."
        actions={[{ label: "Show join QR", icon: "qr-code" }, { label: "Add team" }]}
        label="EMPTY · TEAMS"
      />

      {/* loading skeleton */}
      <Card className="rounded-2xl px-6 py-[22px] flex flex-col gap-3">
        <span className="font-mono font-medium text-[9.5px] text-label">LOADING · SKELETON</span>
        <SkeletonRow />
        <SkeletonRow delay={0.2} />
        <div className="border-t border-line/[.06] pt-3 flex flex-col gap-[7px]">
          <span className="font-mono font-medium text-[9.5px] text-label">SYNC PROGRESS</span>
          <div className="flex items-center gap-2.5">
            <div className="flex-1 h-1.5 rounded-[3px] bg-line/[.06]">
              <div className="w-[68%] h-1.5 rounded-[3px] bg-[linear-gradient(90deg,var(--color-accent),color-mix(in_oklab,var(--color-accent)_60%,#3DD68C))]" />
            </div>
            <span className="font-mono font-semibold text-[11px] text-ink-3">68%</span>
          </div>
          <span className="text-[11px] text-dim">caching 24 scenes + media for offline…</span>
        </div>
      </Card>

      {/* connection states */}
      <Card className="rounded-2xl px-6 py-[22px] flex flex-col gap-2.5">
        <span className="font-mono font-medium text-[9.5px] text-label">LIVE CONNECTION STATES</span>
        {CONNECTION_STATES.map((s) => (
          <div
            key={s.title}
            className="flex items-center gap-2.5 rounded-[11px] px-3 py-2.5 border"
            style={{
              background: `rgba(${s.tone},.07)`,
              borderColor: `rgba(${s.tone},.28)`,
            }}
          >
            {s.spinner ? (
              <div
                className="w-[13px] h-[13px] rounded-full animate-spin"
                style={{ border: `2px solid rgb(${s.tone})`, borderTopColor: "transparent" }}
              />
            ) : (
              <Icon name={s.icon} size={14} style={{ color: `rgb(${s.tone})` }} />
            )}
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-ink">{s.title}</span>
              <span className="text-[10.5px] text-mute">{s.detail}</span>
            </div>
          </div>
        ))}
      </Card>

      {/* toasts */}
      <Card className="rounded-2xl px-6 py-[22px] flex flex-col gap-2.5">
        <span className="font-mono font-medium text-[9.5px] text-label">TOASTS</span>
        {TOASTS.map((t) => (
          <div
            key={t.text}
            className="flex items-center gap-2.5 bg-[rgba(20,22,30,.97)] rounded-xl px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,.4)] border"
            style={{ borderColor: t.border }}
          >
            <Icon name={t.icon} size={15} style={{ color: t.color }} />
            <span className="text-xs text-ink-2">
              {t.bold ? (
                <>
                  <b>{t.bold}</b>
                  {t.text.replace(t.bold, "")}
                </>
              ) : (
                t.text
              )}
            </span>
            <span className="ml-auto text-[11px] font-semibold text-mute-2 hover:text-ink-2 cursor-pointer">
              {t.action}
            </span>
          </div>
        ))}
      </Card>

      {/* keyboard map */}
      <Card className="rounded-2xl px-6 py-[22px] flex flex-col gap-2.5">
        <span className="font-mono font-medium text-[9.5px] text-label">
          KEYBOARD MAP · ACCESSIBILITY
        </span>
        <div className="grid grid-cols-2 gap-[7px] text-[11.5px] text-mute">
          {KEYS.map((key) => (
            <span key={key.k} className="flex items-center gap-[7px]">
              <Kbd className="text-[10px] bg-line/[.07] text-ink-2">{key.k}</Kbd>
              {key.label}
            </span>
          ))}
        </div>
        <span className="text-[11px] text-dim border-t border-line/[.06] pt-2.5">
          all hit targets ≥ 44px · body text ≥ 12px · WCAG AA contrast on dark
        </span>
      </Card>
    </div>
  );
}
