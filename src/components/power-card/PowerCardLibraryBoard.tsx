"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { ModalHeader, ErrorText } from "@/components/ui/FormFields";
import { CategoryIcon, RarityBadge } from "@/components/power-card/PowerCardBadge";
import { CreatePowerCardModal } from "@/components/power-card/CreatePowerCardModal";
import { deletePowerCard, updatePowerCard } from "@/actions/powerCard.actions";
import {
  POWER_CARD_CATEGORIES,
  POWER_CARD_EFFECT_TYPES,
  POWER_CARD_RARITIES,
  type PowerCardCategory,
  type PowerCardEffectType,
  type PowerCardRarity,
} from "@/types/db";
import type { PowerCardRecord } from "@/data/queries/powerCard.queries";

const inputClass =
  "bg-line/[.04] border border-line/[.1] rounded-[10px] px-3 py-2 text-[13px] text-ink outline-none focus:border-accent/60";

interface PowerCardLibraryBoardProps {
  cards: PowerCardRecord[];
}

export function PowerCardLibraryBoard({ cards }: PowerCardLibraryBoardProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<PowerCardRecord | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = cards.filter((card) => {
    const text = `${card.name} ${card.description} ${card.effectType}`.toLowerCase();
    return (
      text.includes(query.toLowerCase()) &&
      (categoryFilter === "ALL" || card.category === categoryFilter)
    );
  });

  function remove(card: PowerCardRecord) {
    startTransition(async () => {
      await deletePowerCard(card.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[22px] font-bold text-ink-2 tracking-[-.02em]">Power Cards</span>
          <span className="text-[13px] text-mute-2">
            Reusable card library. Rounds only select which cards are allowed.
          </span>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={14} />
          Create Card
        </Button>
      </div>

      {cards.length > 0 && (
        <Card className="rounded-2xl p-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cards"
            className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-3 py-2 text-sm text-ink outline-none"
          />
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-2 py-2 text-sm text-ink outline-none"
          >
            <option value="ALL" className="bg-surface">All categories</option>
            {POWER_CARD_CATEGORIES.map((category) => (
              <option key={category} value={category} className="bg-surface">
                {category}
              </option>
            ))}
          </select>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-14 h-14 rounded-[18px] bg-accent/10 border border-dashed border-accent/45 flex items-center justify-center">
            <Icon name="sparkles" size={24} className="text-accent" />
          </div>
          <span className="text-[15px] font-bold text-ink">
            {cards.length === 0 ? "No power cards yet" : "No power cards match your filters"}
          </span>
          {cards.length === 0 && (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              Create First Card
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((card) => (
            <Card key={card.id} className="rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <CategoryIcon category={card.category} />
                <div className="flex flex-col min-w-0">
                  <span className="text-[15px] font-bold text-ink-2 truncate">{card.name}</span>
                  <span className="text-[11.5px] text-mute-2">
                    {card.effectType.replace(/_/g, " ")} - {card.price} coins - {card.usesPerTeam} use{card.usesPerTeam === 1 ? "" : "s"}
                  </span>
                </div>
                <RarityBadge rarity={card.rarity} />
              </div>
              <span className="text-[12px] text-mute-2 leading-relaxed line-clamp-2">
                {card.description || "No description."}
              </span>
              <div className="flex flex-wrap gap-2 mt-auto">
                <Button variant="subtle" size="sm" onClick={() => setEditingCard(card)}>
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => remove(card)} disabled={pending}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreatePowerCardModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editingCard && (
        <EditPowerCardModal
          card={editingCard}
          open={editingCard !== null}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}

function EditPowerCardModal({
  card,
  open,
  onClose,
}: {
  card: PowerCardRecord;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(card.name);
  const [description, setDescription] = useState(card.description);
  const [icon, setIcon] = useState(card.icon);
  const [category, setCategory] = useState<PowerCardCategory>(card.category);
  const [rarity, setRarity] = useState<PowerCardRarity>(card.rarity);
  const [effectType, setEffectType] = useState<PowerCardEffectType>(card.effectType);
  const [price, setPrice] = useState(card.price);
  const [stock, setStock] = useState<number | "">(card.stock ?? "");
  const [enabled, setEnabled] = useState(card.enabled);
  const [requiresApproval, setRequiresApproval] = useState(card.requiresApproval);
  const [usesPerTeam, setUsesPerTeam] = useState(card.usesPerTeam);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    if (!name.trim()) return setError("Card name is required.");
    startTransition(async () => {
      try {
        await updatePowerCard({
          powerCardId: card.id,
          changes: {
            name: name.trim(),
            description: description.trim(),
            icon: icon.trim() || "sparkles",
            category,
            rarity,
            effectType,
            price,
            stock: stock === "" ? null : stock,
            enabled,
            requiresApproval,
            usesPerTeam,
            priceMode: "FIXED",
          },
        });
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update card.");
      }
    });
  }

  return (
    <Modal open={open} onClose={() => !pending && onClose()} className="max-w-[560px]">
      <ModalHeader title="Edit power card" onClose={onClose} />
      <div className="p-5 flex flex-col gap-3">
        <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          className={`${inputClass} resize-none`}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input value={icon} onChange={(event) => setIcon(event.target.value)} className={inputClass} aria-label="Icon" />
          <select value={category} onChange={(event) => setCategory(event.target.value as PowerCardCategory)} className={inputClass}>
            {POWER_CARD_CATEGORIES.map((item) => <option key={item} value={item} className="bg-surface">{item}</option>)}
          </select>
          <select value={rarity} onChange={(event) => setRarity(event.target.value as PowerCardRarity)} className={inputClass}>
            {POWER_CARD_RARITIES.map((item) => <option key={item} value={item} className="bg-surface">{item}</option>)}
          </select>
        </div>
        <select value={effectType} onChange={(event) => setEffectType(event.target.value as PowerCardEffectType)} className={inputClass}>
          {POWER_CARD_EFFECT_TYPES.map((item) => (
            <option key={item} value={item} className="bg-surface">
              {item.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input type="number" min={0} value={price} onChange={(event) => setPrice(Number(event.target.value))} className={inputClass} aria-label="Price" />
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(event) => setStock(event.target.value === "" ? "" : Number(event.target.value))}
            className={inputClass}
            aria-label="Stock"
          />
          <input type="number" min={1} value={usesPerTeam} onChange={(event) => setUsesPerTeam(Number(event.target.value))} className={inputClass} aria-label="Uses per team" />
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-3">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          Enabled
        </label>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-3">
          <input type="checkbox" checked={requiresApproval} onChange={(event) => setRequiresApproval(event.target.checked)} />
          Requires host approval
        </label>
        <ErrorText error={error} />
      </div>
      <div className="flex justify-end gap-2 px-5 py-4 border-t border-line/[.07]">
        <Button variant="plain" onClick={onClose} disabled={pending}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={pending}>{pending ? "Saving..." : "Save card"}</Button>
      </div>
    </Modal>
  );
}
