"use client";

import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Kbd } from "@/components/ui/Kbd";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ScenePhone } from "@/components/competition/ScenePhone";
import { mockQuestions } from "@/data/mock/questions";
import { mockTimeline } from "@/data/mock/live";
import { useLiveStore } from "@/stores/liveStore";

/* CENTER panel — live program monitor + up-next, host notes and timeline. */
export function LivePreview() {
  const { phonesInSync, teamsQueued, totalTeams, timerSeconds } = useLiveStore();

  return (
    <div className="flex flex-col items-center px-4 xl:px-6 pt-4 pb-3 gap-3 bg-[radial-gradient(600px_420px_at_50%_30%,#0C0D13,#08090C)] min-w-0 overflow-y-auto">
      <div className="flex items-center gap-2.5 self-stretch flex-wrap">
        <span className="font-mono font-bold text-[10px] tracking-[.14em] text-live flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-danger" />
          LIVE ON {phonesInSync} PHONES
        </span>
        <span className="text-[11.5px] text-mute-2 flex items-center gap-1.5">
          <Icon name="users" size={12} />
          {teamsQueued} of {totalTeams} teams queued for host
        </span>
        <span className="ml-auto text-[11.5px] text-dim hidden xl:flex items-center gap-1.5">
          <Icon name="keyboard" size={13} />
          every control has a key — hover to learn
        </span>
      </div>

      <div className="flex gap-5 items-stretch flex-1 min-h-0 flex-wrap justify-center">
        <ScenePhone
          question={mockQuestions[0]}
          roundLabel="ROUND 2 · EMOJI QUIZ"
          variant="host"
          timer={timerSeconds}
          live
          footerLeft="host awards marks"
          footerRight="power cards require approval"
        />

        <div className="flex flex-col gap-3 w-[250px]">
          {/* up next */}
          <Card className="px-3.5 py-[13px] flex items-center gap-[11px]">
            <div className="w-[38px] h-[66px] rounded-lg bg-[linear-gradient(160deg,#1A1D28,#12141C)] border border-success/40 flex items-center justify-center text-[11px]">
              😀
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono font-semibold text-[8.5px] tracking-[.12em] text-success">
                UP NEXT
              </span>
              <span className="text-[12.5px] font-semibold text-ink-2">08 · Question 4</span>
              <span className="text-[10.5px] text-dim">manual · 20s · host judged</span>
            </div>
            <Kbd className="ml-auto">Space</Kbd>
          </Card>

          {/* host notes */}
          <Card className="px-3.5 py-[13px] flex flex-col gap-2">
            <SectionLabel>
              <Icon name="sticky-note" size={12} className="text-warn" />
              HOST NOTES · SCENE 07
            </SectionLabel>
            <span className="text-xs text-ink-3 leading-normal">
              Play the song clip only <b>after</b> reveal. Hand the mic to Ba for the next one —
              she asked twice.
            </span>
          </Card>

          {/* timeline */}
          <Card className="px-3.5 py-[13px] flex flex-col gap-2 flex-1">
            <SectionLabel>
              <Icon name="history" size={12} />
              TIMELINE
              <span className="ml-auto font-medium text-dim-2 tracking-normal">view all</span>
            </SectionLabel>
            <div className="flex flex-col gap-[7px] text-[11px] text-mute-2">
              {mockTimeline.map((e) => (
                <span key={e.id} className="flex gap-2">
                  <span className="font-mono font-medium text-[9.5px] text-label pt-px">
                    {e.time}
                  </span>
                  <span>
                    {e.bold && <b className="text-ink-3">{e.bold}</b>} {e.text}
                  </span>
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
