"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

export function CopyLinkButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-[12px] font-medium text-ink-3 bg-line/[.04] border border-line/[.09] rounded-[9px] px-3 py-[7px] hover:bg-line/[.08] cursor-pointer"
    >
      <Icon name={copied ? "check-check" : "copy"} size={13} className={copied ? "text-success" : undefined} />
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
