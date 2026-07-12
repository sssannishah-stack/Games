"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PowerCardFace, getPowerCardTheme } from "@/components/power-card/PowerCardFace";
import { rarityTheme } from "@/components/store/rarityTheme";

export interface ShopCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  effectType?: string;
  category?: string;
  rarity?: string;
  price: number;
  basePrice?: number;
  onSale?: boolean;
  isMystery?: boolean;
  limited?: boolean;
  stock: number | null;
  remainingUses: number;
}

/**
 * A shop shelf tile — everything visible without a tap (icon, name,
 * description, price, stock, owned count, Buy), unlike the flip-to-read
 * inventory card. Rarity sets the border/glow language; a press gives a
 * light 3D tilt + lift instead of a full pointer-tracking tilt rig (keeps
 * this cheap in a grid of a dozen+ tiles).
 */
export function PowerCardShopTile({
  card,
  size = "md",
  canBuy,
  onBuy,
  featured = false,
}: {
  card: ShopCard;
  size?: "md" | "lg";
  canBuy: boolean;
  onBuy: () => void;
  featured?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const theme = getPowerCardTheme(card.effectType, card.icon);
  const rarity = rarityTheme(card.rarity);
  const soldOut = card.limited && (card.stock ?? 0) <= 0;

  return (
    <motion.div
      whileTap={canBuy && !soldOut ? { scale: 0.97, rotateX: 4 } : undefined}
      onTapStart={() => setPressed(true)}
      onTap={() => setPressed(false)}
      onTapCancel={() => setPressed(false)}
      className={`relative flex flex-col overflow-hidden rounded-[22px] border bg-card/90 transition-shadow ${
        rarity.rainbow ? "border-2" : "border"
      } ${rarity.rainbow ? "" : rarity.border} ${featured ? "shadow-[0_18px_50px_rgba(0,0,0,.4)]" : ""}`}
      style={{
        transformPerspective: 700,
        boxShadow:
          rarity.glow !== "transparent"
            ? `0 8px 26px ${pressed ? "transparent" : `color-mix(in oklab, ${rarity.glow} 70%, transparent)`}`
            : undefined,
      }}
    >
      {rarity.rainbow && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-[22px] p-[2px] pointer-events-none animate-[encRainbow_3s_linear_infinite]"
          style={{
            background: "conic-gradient(from 0deg, #F06A96, #E8C84A, #3DD68C, #5EC9E8, #B98AE8, #F06A96)",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
      )}
      {/* Featured tiles get a slow diagonal light sweep — a "premium shelf" cue. */}
      {featured && !soldOut && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/3 z-[1]"
          initial={{ x: "-140%" }}
          animate={{ x: "440%" }}
          transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
          style={{ background: "linear-gradient(105deg, transparent, rgba(255,255,255,.12), transparent)" }}
        />
      )}

      <div className={`relative px-2.5 pt-2.5 ${soldOut ? "opacity-45 saturate-50" : ""}`}>
        <PowerCardFace
          name={card.name}
          effectType={card.effectType}
          rarity={card.rarity}
          icon={card.icon}
          category={featured ? card.category : undefined}
          size={size}
        />
        {/* Rarity chip, top-right — the shop's own louder label vs. the card's subtle gem. */}
        <span
          className={`absolute top-4 right-4 rounded-full px-1.5 py-0.5 text-[8px] font-black tracking-[.08em] ${rarity.chipBg} ${rarity.chipText}`}
        >
          {rarity.label.toUpperCase()}
        </span>
        {card.limited && (
          <span
            className={`absolute top-4 left-4 rounded-full px-2 py-0.5 text-[8.5px] font-bold tracking-[.06em] ${
              soldOut ? "bg-black/70 text-mute-2" : "bg-pink/85 text-white"
            }`}
          >
            {soldOut ? "SOLD OUT" : `${card.stock} LEFT`}
          </span>
        )}
        {card.onSale && !card.limited && (
          <span className="absolute top-4 left-4 rounded-full bg-warn/90 text-black px-2 py-0.5 text-[8.5px] font-black tracking-[.06em]">
            SALE
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 px-3 pb-3 pt-2">
        <p className="text-[11px] leading-snug text-mute-2 line-clamp-2 min-h-[28px]">{card.description}</p>

        <div className="flex items-center justify-between text-[10px] text-dim">
          {card.remainingUses > 0 && (
            <span className="font-semibold" style={{ color: theme.accent }}>
              Owned ×{card.remainingUses}
            </span>
          )}
          {!card.limited && card.stock === null && card.remainingUses === 0 && <span>Unlimited stock</span>}
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <span className="flex items-baseline gap-1 font-mono font-black text-[13px] text-ink">
            {card.onSale && card.basePrice != null && (
              <span className="text-[10px] font-bold text-dim-2 line-through">{card.basePrice}</span>
            )}
            {card.price}
            <span className="text-[10px] font-bold text-warn">🪙</span>
          </span>
          <button
            type="button"
            disabled={!canBuy || soldOut}
            onClick={onBuy}
            className={`ml-auto rounded-xl px-3.5 py-1.5 text-[11px] font-black tracking-[.02em] transition active:scale-95 ${
              !canBuy || soldOut
                ? "bg-line/[.08] text-dim-2 cursor-not-allowed"
                : "text-white cursor-pointer"
            }`}
            style={
              canBuy && !soldOut
                ? { background: `linear-gradient(135deg, ${theme.accent}, color-mix(in oklab, ${theme.accent} 60%, black))` }
                : undefined
            }
          >
            {soldOut ? "SOLD OUT" : "BUY"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
