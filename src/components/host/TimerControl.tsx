"use client";

import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Kbd } from "@/components/ui/Kbd";
import { TimerRing } from "@/components/ui/TimerRing";
import { useLiveStore } from "@/stores/liveStore";

/* Timer card — ring plus pause/+10s/+30s with key hints. */
export function TimerControl() {
  const { timerSeconds, timerPaused, pauseTimer, resumeTimer, addSeconds } = useLiveStore();

  const actions = [
    {
      key: "P",
      content: <Icon name={timerPaused ? "play" : "pause"} size={14} className="text-ink-2" />,
      onClick: timerPaused ? resumeTimer : pauseTimer,
    },
    { key: "T", content: <span className="text-[11px] font-semibold text-ink-2">+10s</span>, onClick: () => addSeconds(10) },
    { key: "⇧T", content: <span className="text-[11px] font-semibold text-ink-2">+30s</span>, onClick: () => addSeconds(30) },
  ];

  return (
    <Card className="px-3.5 py-3 flex items-center gap-3">
      <TimerRing value={timerSeconds} size={52} />
      <div className="flex gap-1.5 flex-1">
        {actions.map((a) => (
          <button
            key={a.key}
            onClick={a.onClick}
            className="flex-1 flex flex-col items-center gap-[3px] bg-line/[.05] border border-line/10 rounded-[9px] px-1 py-[7px] hover:bg-line/10 cursor-pointer"
          >
            {a.content}
            <Kbd className="bg-transparent px-0">{a.key}</Kbd>
          </button>
        ))}
      </div>
    </Card>
  );
}
