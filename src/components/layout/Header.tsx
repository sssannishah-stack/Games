"use client";

import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import type { ReactNode } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/* Page-level heading row with bell + primary action slot. */
export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex flex-col gap-0.5">
        <span className="text-[22px] font-bold text-ink-2 tracking-[-.02em]">{title}</span>
        {subtitle && <span className="text-[13px] text-mute-2">{subtitle}</span>}
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        <button className="w-9 h-9 rounded-[10px] bg-line/[.04] border border-line/[.08] flex items-center justify-center relative cursor-pointer hover:bg-line/[.08]">
          <Icon name="bell" size={16} className="text-mute" />
          <span className="absolute top-2 right-2 w-[7px] h-[7px] rounded-full bg-accent" />
        </button>
        {actions}
      </div>
    </div>
  );
}

export { Button as HeaderButton };
