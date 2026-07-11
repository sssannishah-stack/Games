"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function RoomResetModal({
  open,
  pending,
  onClose,
  onReset,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onReset: (removeTeams: boolean) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [removeTeams, setRemoveTeams] = useState(false);

  return (
    <Modal open={open} onClose={() => !pending && onClose()} className="max-w-[460px]">
      <div className="px-6 py-5 border-b border-line/[.07]">
        <span className="text-base font-bold text-ink">Reset this room?</span>
        <p className="mt-2 text-[12.5px] leading-relaxed text-mute-2">
          Scores, coins, purchases, power requests, achievements, auctions and the event timeline will be cleared.
          Rounds, questions and scenes stay. Every team&apos;s cards return to the room default loadout.
        </p>
      </div>
      <div className="px-6 py-5 flex flex-col gap-3">
        <label
          className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer ${
            removeTeams ? "border-danger/40 bg-danger/[.06]" : "border-line/[.08] bg-line/[.02]"
          }`}
        >
          <input
            type="checkbox"
            checked={removeTeams}
            onChange={(event) => setRemoveTeams(event.target.checked)}
            className="mt-0.5 accent-danger"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-[12.5px] font-semibold text-ink-2">Remove all teams too</span>
            <span className="text-[11.5px] leading-relaxed text-mute-2">
              Deletes every team and their rosters — for handing this room to a brand new group. Without this, the
              same teams stay and just go back to 0.
            </span>
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-3">Type RESET to confirm</span>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
            className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none focus:border-danger/60"
            autoFocus
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="plain" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => onReset(removeTeams)}
            disabled={pending || confirmation !== "RESET"}
            loading={pending}
          >
            {removeTeams ? "Reset & Remove Teams" : "Reset Room"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
