"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface TabItem {
  label: string;
  badge?: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange?: (label: string) => void;
  className?: string;
}

/* Underline tabs used in the console right rail and builder inspector. */
export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={cn("flex px-3 pt-2.5 gap-0.5 border-b border-line/[.06]", className)}>
      {tabs.map((tab) => {
        const isActive = tab.label === active;
        return (
          <button
            key={tab.label}
            onClick={() => onChange?.(tab.label)}
            className={cn(
              "text-[12.5px] px-3 py-2 flex items-center gap-1.5 cursor-pointer transition-colors",
              isActive
                ? "font-semibold text-ink border-b-2 border-accent"
                : "text-mute-2 hover:text-ink-2"
            )}
          >
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}
