"use client";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  time?: string;
  wifiOff?: boolean;
  className?: string; // inner screen extras (gradient overrides)
  label?: string; // caption below frame
}

/* Participant phone shell with status bar, per the design's mobile mocks. */
export function PhoneFrame({ children, time = "8:04", wifiOff, className, label }: PhoneFrameProps) {
  return (
    <div className="flex flex-col gap-3 items-center w-full sm:w-auto">
      <div className="w-full min-h-[100dvh] bg-card flex sm:w-[320px] sm:h-[660px] sm:min-h-0 sm:rounded-[46px] sm:border sm:border-line/[.12] sm:shadow-[0_30px_80px_rgba(0,0,0,.6)] sm:p-2.5">
        <div
          className={cn(
            "flex-1 bg-[linear-gradient(180deg,#0C0D13,#08090C)] flex flex-col px-4 pt-3.5 pb-4 overflow-hidden relative sm:rounded-[38px]",
            className
          )}
        >
          <div className="flex items-center justify-between font-mono font-medium text-[11px] text-mute-2 relative z-10">
            <span>{time}</span>
            <span className="w-16 h-[18px] rounded-full bg-black" />
            <span className="flex gap-1 items-center">
              {wifiOff ? (
                <Icon name="wifi-off" size={11} className="text-danger-soft" />
              ) : (
                <Icon name="wifi" size={11} />
              )}
              <Icon name="battery-medium" size={13} />
            </span>
          </div>
          {children}
        </div>
      </div>
      {label && (
        <span className="hidden sm:inline font-mono font-medium text-[11px] text-dim-2 uppercase">{label}</span>
      )}
    </div>
  );
}
