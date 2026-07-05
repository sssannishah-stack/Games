"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { RoomCodeInput } from "@/components/room/RoomCodeInput";

function formatCode(code: string) {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function JoinCodeRedirect() {
  const [code, setCode] = useState("");
  const [navigating, setNavigating] = useState(false);
  const router = useRouter();

  function go(finalCode?: string) {
    const target = finalCode ?? code;
    if (target.length < 6) return;
    setNavigating(true);
    router.push(`/play/${formatCode(target)}`);
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-xl font-bold text-ink tracking-[-.01em]">Join a room</span>
        <span className="text-[13px] text-mute-2">Enter the code your host shared</span>
      </div>

      <RoomCodeInput value={code} onChange={setCode} onComplete={go} autoFocus />

      <AnimatePresence>
        {navigating && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[12.5px] text-accent font-medium flex items-center gap-1.5"
          >
            <Icon name="loader-circle" size={13} className="animate-spin" />
            Finding your room…
          </motion.span>
        )}
      </AnimatePresence>

      <Button
        variant="primary"
        size="lg"
        onClick={() => go()}
        disabled={code.length < 6 || navigating}
        className="w-full justify-center min-h-12 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue
        <Icon name="arrow-right" size={15} />
      </Button>

      <div className="flex items-center gap-3 w-full">
        <span className="flex-1 h-px bg-line/[.08]" />
        <span className="text-[11px] text-dim uppercase tracking-[.1em]">or</span>
        <span className="flex-1 h-px bg-line/[.08]" />
      </div>

      <div className="flex items-center gap-2.5 text-[12.5px] text-mute-2 bg-line/[.03] border border-line/[.07] rounded-xl px-4 py-3 w-full">
        <Icon name="scan-line" size={16} className="text-accent shrink-0" />
        Scan the QR code your host is showing — it opens your room instantly.
      </div>
    </div>
  );
}
