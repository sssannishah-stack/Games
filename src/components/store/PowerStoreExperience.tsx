"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { purchasePowerCard } from "@/actions/powerCard.actions";
import { NumberTicker } from "@/components/motion/NumberTicker";
import { useSound } from "@/lib/sound/useSound";
import { PowerCardShopTile, type ShopCard } from "@/components/store/PowerCardShopTile";
import { FlashSaleBanner } from "@/components/store/FlashSaleBanner";
import { PurchaseConfirmSheet } from "@/components/store/PurchaseConfirmSheet";
import { PurchaseCelebration, type CelebrationPayload } from "@/components/store/PurchaseCelebration";
import { MysteryReveal, type MysteryPhase } from "@/components/store/MysteryReveal";

const RARITY_RANK: Record<string, number> = { LEGENDARY: 3, EPIC: 2, RARE: 1, COMMON: 0 };

type Tab = "FEATURED" | "CARDS" | "MYSTERY" | "SPECIAL" | "INVENTORY";
const TABS: { id: Tab; label: string }[] = [
  { id: "FEATURED", label: "Featured" },
  { id: "CARDS", label: "Power Cards" },
  { id: "MYSTERY", label: "Mystery" },
  { id: "SPECIAL", label: "Special" },
  { id: "INVENTORY", label: "Inventory" },
];

export interface StoreLiveProps {
  cards: ShopCard[];
  coins: number;
  flashSale: { active: boolean; percent: number; endsAt: string | null };
  feed: Array<{ id: string; type: string; text: string }>;
  roomId: string;
  teamId: string;
  participantId: string;
  canControl: boolean;
  /** The existing team-inventory view (unchanged), rendered under the
   *  Inventory tab — passed in as a slot so this file never needs to import
   *  from LivePlayClient.tsx (which imports this component back), avoiding
   *  a circular module dependency. */
  inventoryContent: ReactNode;
}

/**
 * The redesigned store: a tabbed shop instead of one flat "list of cards"
 * page, with a confirm step and a real celebration on every purchase. All
 * purchases still go through the exact same `purchasePowerCard` server
 * action the old store used — this file only owns presentation/sequencing.
 */
export function PowerStoreExperience({
  cards,
  coins,
  flashSale,
  feed,
  roomId,
  teamId,
  participantId,
  canControl,
  inventoryContent,
}: StoreLiveProps) {
  const [tab, setTab] = useState<Tab>("FEATURED");
  const [confirmCard, setConfirmCard] = useState<ShopCard | null>(null);
  const [buying, setBuying] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);
  const [mysteryPhase, setMysteryPhase] = useState<MysteryPhase>(null);
  const [error, setError] = useState<string | null>(null);
  const play = useSound();

  const lastSeenFeedId = useRef<string | null>(feed[0]?.id ?? null);
  const awaitingMysteryFor = useRef<string | null>(null);

  // Mystery Box resolves entirely server-side with no reward payload back to
  // the client — the live feed is the only place the outcome ever shows up.
  // Once a fresh "You: Mystery Box -> ..." entry lands, swap the "opening"
  // anticipation for the real reveal.
  useEffect(() => {
    if (!awaitingMysteryFor.current) return;
    const newest = feed[0];
    if (!newest || newest.id === lastSeenFeedId.current) return;
    lastSeenFeedId.current = newest.id;
    if (newest.type === "REWARD_DROP" && newest.text.startsWith("You: Mystery Box")) {
      const reward = newest.text.split("→")[1]?.trim() || "a reward";
      awaitingMysteryFor.current = null;
      setMysteryPhase({ reward });
      play("coin");
    }
  }, [feed, play]);

  const nonMystery = useMemo(() => cards.filter((c) => !c.isMystery), [cards]);
  const mysteryCards = useMemo(() => cards.filter((c) => c.isMystery), [cards]);
  const featured = useMemo(() => {
    return [...nonMystery]
      .sort((a, b) => {
        const rank = (c: ShopCard) => (c.onSale ? 3 : 0) + (RARITY_RANK[c.rarity ?? "COMMON"] ?? 0);
        return rank(b) - rank(a) || b.price - a.price;
      })
      .slice(0, 4);
  }, [nonMystery]);
  const specialOffers = useMemo(
    () => nonMystery.filter((c) => c.onSale || (c.limited && (c.stock ?? 0) <= 5)),
    [nonMystery]
  );

  function openConfirm(card: ShopCard) {
    setError(null);
    setConfirmCard(card);
  }

  async function confirmPurchase() {
    if (!confirmCard) return;
    const card = confirmCard;
    setBuying(true);
    setError(null);
    try {
      if (card.isMystery) {
        awaitingMysteryFor.current = card.id;
        setMysteryPhase("opening");
        play("spin");
      }
      await purchasePowerCard(roomId, teamId, card.id, participantId);
      setConfirmCard(null);
      if (!card.isMystery) {
        play("purchase");
        setCelebration({
          id: `${card.id}-${Date.now()}`,
          name: card.name,
          icon: card.icon,
          effectType: card.effectType,
          rarity: card.rarity,
          ownedAfter: card.remainingUses + 1,
        });
      }
    } catch (err) {
      awaitingMysteryFor.current = null;
      setMysteryPhase(null);
      play("wrong");
      setError(err instanceof Error ? err.message : "Could not complete purchase.");
    } finally {
      setBuying(false);
    }
  }

  const canBuy = canControl;
  const grid = (list: ShopCard[], featuredSize = false) =>
    list.length === 0 ? (
      <div className="col-span-2 rounded-2xl border border-dashed border-line/[.14] bg-line/[.02] px-4 py-8 text-center text-[12.5px] text-mute-2">
        Nothing here right now.
      </div>
    ) : (
      list.map((card) => (
        <PowerCardShopTile
          key={card.id}
          card={card}
          size={featuredSize ? "lg" : "md"}
          canBuy={canBuy}
          featured={featuredSize}
          onBuy={() => openConfirm(card)}
        />
      ))
    );

  return (
    <div className="flex flex-col gap-3">
      {/* Header: coins ticker (animates on every purchase automatically) +
          flash sale countdown, when one's actually running. */}
      <div className="relative overflow-hidden flex items-center gap-2.5 rounded-2xl border border-warn/25 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-warn)_10%,transparent),transparent)] px-3.5 py-2.5">
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -left-6 -top-6 h-16 w-16 rounded-full"
          animate={{ opacity: [0.25, 0.5, 0.25] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--color-warn) 45%, transparent), transparent 70%)" }}
        />
        <span className="relative text-lg">🪙</span>
        <div className="flex flex-col">
          <span className="text-[9.5px] font-bold tracking-[.14em] text-mute-2">COINS AVAILABLE</span>
          <NumberTicker value={coins} className="font-mono text-[17px] font-black text-warn leading-none" />
        </div>
        {flashSale.active && (
          <button
            onClick={() => setTab("SPECIAL")}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-warn/15 border border-warn/35 px-2.5 py-1 text-[10.5px] font-black text-warn cursor-pointer animate-enc-pulse"
          >
            ⚡ {flashSale.percent}% OFF
          </button>
        )}
        {!canControl && (
          <span className="ml-auto text-[10px] text-mute-2 shrink-0">👑 Captain buys</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-bold whitespace-nowrap transition cursor-pointer ${
              tab === t.id ? "text-white" : "bg-line/[.06] text-mute-2 hover:text-ink-3"
            }`}
          >
            {tab === t.id && (
              <motion.span
                layoutId="storeTabPill"
                aria-hidden
                className="absolute inset-0 rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
              />
            )}
            <span className="relative">
              {t.label}
              {t.id === "INVENTORY" && cards.some((c) => c.remainingUses > 0) && (
                <span className="ml-1.5">· {cards.reduce((sum, c) => sum + (c.remainingUses > 0 ? 1 : 0), 0)}</span>
              )}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <span className="rounded-xl border border-danger/30 bg-danger/[.08] px-3 py-2 text-[11.5px] font-semibold text-danger-soft">
          {error}
        </span>
      )}

      {/* Tab content, staggered in. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "FEATURED" && (
            <div className="flex flex-col gap-2.5">
              <span className="flex items-center gap-1.5 text-[11px] font-black tracking-[.1em] text-warn">
                🔥 FEATURED TODAY
              </span>
              <div className="grid grid-cols-2 gap-2.5">{grid(featured, true)}</div>
            </div>
          )}
          {tab === "CARDS" && <div className="grid grid-cols-2 gap-2.5">{grid(nonMystery)}</div>}
          {tab === "MYSTERY" && (
            <div className="flex flex-col gap-2.5">
              <span className="text-[11px] text-mute-2 leading-relaxed">
                🎁 One buy, one gamble — a random Hint, Shield, coins, Double Points… or nothing at all.
              </span>
              <div className="grid grid-cols-2 gap-2.5">{grid(mysteryCards)}</div>
            </div>
          )}
          {tab === "SPECIAL" && (
            <div className="flex flex-col gap-2.5">
              {flashSale.active && <FlashSaleBanner percent={flashSale.percent} endsAt={flashSale.endsAt} />}
              {specialOffers.length === 0 && !flashSale.active ? (
                <div className="rounded-2xl border border-dashed border-line/[.14] bg-line/[.02] px-4 py-8 text-center text-[12.5px] text-mute-2">
                  No special offers right now — check back later.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">{grid(specialOffers)}</div>
              )}
            </div>
          )}
          {tab === "INVENTORY" && inventoryContent}
        </motion.div>
      </AnimatePresence>

      <PurchaseConfirmSheet card={confirmCard} coins={coins} pending={buying} onCancel={() => setConfirmCard(null)} onConfirm={confirmPurchase} />
      <PurchaseCelebration payload={celebration} onDone={() => setCelebration(null)} />
      <MysteryReveal phase={mysteryPhase} onDone={() => setMysteryPhase(null)} />
    </div>
  );
}
