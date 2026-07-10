"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ModalHeader, ErrorText } from "@/components/ui/FormFields";
import { createPowerCard } from "@/actions/powerCard.actions";
import { POWER_CARD_CATEGORIES, POWER_CARD_RARITIES, POWER_CARD_EFFECT_TYPES } from "@/types/db";
import type { PowerCardCategory, PowerCardRarity, PowerCardEffectType } from "@/types/db";

const inputClass =
  "bg-line/[.04] border border-line/[.1] rounded-[10px] px-3 py-2 text-[13px] text-ink outline-none focus:border-accent/60";

function emptyDraft() {
  return {
    name: "",
    description: "",
    icon: "sparkles",
    category: "HELP" as PowerCardCategory,
    rarity: "COMMON" as PowerCardRarity,
    effectType: "HINT" as PowerCardEffectType,
    price: 0,
    stock: "" as number | "",
    requiresApproval: false,
    usesPerTeam: 1,
  };
}

interface CreatePowerCardModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

/** Creates a card in the host's global Power Card catalog. */
export function CreatePowerCardModal({ open, onClose, onCreated }: CreatePowerCardModalProps) {
  const [draft, setDraft] = useState(emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    if (!draft.name.trim()) return setError("Card name is required.");

    startTransition(async () => {
      try {
        const { id } = await createPowerCard({
          name: draft.name.trim(),
          description: draft.description.trim(),
          icon: draft.icon,
          category: draft.category,
          rarity: draft.rarity,
          effectType: draft.effectType,
          price: draft.price,
          stock: draft.stock === "" ? null : draft.stock,
          enabled: true,
          requiresApproval: draft.requiresApproval,
          usesPerTeam: draft.usesPerTeam,
          priceMode: "FIXED",
        });
        setDraft(emptyDraft());
        onCreated?.(id);
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create card.");
      }
    });
  }

  return (
    <Modal open={open} onClose={() => !pending && onClose()} className="max-w-[520px]">
      <ModalHeader title="New power card" onClose={onClose} />
      <div className="p-5 flex flex-col gap-3">
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Card name — e.g. Shield"
          className={inputClass}
          autoFocus
        />
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="What does it do?"
          rows={2}
          className={`${inputClass} resize-none`}
        />
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-ink-3">Category</span>
            <select
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as PowerCardCategory }))}
              className={inputClass}
            >
              {POWER_CARD_CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-surface">
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-ink-3">Rarity</span>
            <select
              value={draft.rarity}
              onChange={(e) => setDraft((d) => ({ ...d, rarity: e.target.value as PowerCardRarity }))}
              className={inputClass}
            >
              {POWER_CARD_RARITIES.map((r) => (
                <option key={r} value={r} className="bg-surface">
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-ink-3">Effect</span>
            <select
              value={draft.effectType}
              onChange={(e) => setDraft((d) => ({ ...d, effectType: e.target.value as PowerCardEffectType }))}
              className={inputClass}
            >
              {POWER_CARD_EFFECT_TYPES.map((t) => (
                <option key={t} value={t} className="bg-surface">
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-ink-3">Price (coins)</span>
            <input
              type="number"
              min={0}
              value={draft.price}
              onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-ink-3">Stock (blank = ∞)</span>
            <input
              type="number"
              min={0}
              value={draft.stock}
              onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value === "" ? "" : Number(e.target.value) }))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-ink-3">Uses per team</span>
            <input
              type="number"
              min={1}
              value={draft.usesPerTeam}
              onChange={(e) => setDraft((d) => ({ ...d, usesPerTeam: Number(e.target.value) }))}
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-3">
          <input
            type="checkbox"
            checked={draft.requiresApproval}
            onChange={(e) => setDraft((d) => ({ ...d, requiresApproval: e.target.checked }))}
          />
          Requires host approval before it activates
        </label>
        <ErrorText error={error} />
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-line/[.07]">
        <Button variant="plain" size="md" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="md" onClick={submit} disabled={pending}>
          {pending ? "Adding…" : "Add card"}
        </Button>
      </div>
    </Modal>
  );
}
