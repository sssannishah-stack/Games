"use client";

import type { ReactNode } from "react";

/**
 * The face of a Power Card — every effect type has its own look (big glyph,
 * color world, corner pips, slanted ring), the way a card game's deck makes
 * a +2 instantly readable across the table. Rarity decides the frame:
 * COMMON plain · RARE cool glow · EPIC violet glow · LEGENDARY gold shimmer.
 * Purely visual — buttons/prices live outside (or in the `footer` slot).
 */

export type PowerCardRarityName = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

interface EffectTheme {
  /** Deep base color the card fades into. */
  deep: string;
  /** Accent used for glyph glow, band and pips. */
  accent: string;
  /** Big central glyph — typographic where that reads punchier than emoji. */
  glyph: string;
  /** Tiny label under the name, e.g. "SHIELD". */
  tag: string;
  /** Glyph rendered as text (needs font styling) instead of emoji. */
  typographic?: boolean;
}

const EFFECT_THEMES: Record<string, EffectTheme> = {
  HINT: { deep: "#4a3505", accent: "#F5C64D", glyph: "💡", tag: "REVEAL A CLUE" },
  EXTRA_TIME: { deep: "#053e3a", accent: "#3DD6C8", glyph: "⏱", tag: "MORE SECONDS" },
  BLOCK_NEGATIVE: { deep: "#1d3050", accent: "#9BC0EF", glyph: "🛡", tag: "NO MINUS" },
  INSURANCE: { deep: "#123a44", accent: "#6FD3C6", glyph: "🩹", tag: "3-QUESTION COVER" },
  DOUBLE_SCORE: { deep: "#4a1505", accent: "#FF9A3D", glyph: "2×", tag: "DOUBLE POINTS", typographic: true },
  SECOND_CHANCE: { deep: "#0b3d26", accent: "#3DD68C", glyph: "↩", tag: "TRY AGAIN", typographic: true },
  MYSTERY: { deep: "#31174f", accent: "#C99AF0", glyph: "?", tag: "RANDOM REWARD", typographic: true },
  GAMBLE: { deep: "#48122a", accent: "#F06A96", glyph: "🎲", tag: "HIGH STAKES" },
  FREEZE: { deep: "#0e3346", accent: "#6ED3F2", glyph: "❄", tag: "STOP RIVALS" },
  STEAL: { deep: "#241a45", accent: "#A79BFF", glyph: "🥷", tag: "TAKE THEIRS" },
  PEEK: { deep: "#0e2f3d", accent: "#5EC9E8", glyph: "👁", tag: "RULE ONE OUT" },
};

const FALLBACK_THEME: EffectTheme = { deep: "#24283b", accent: "#8EA0B8", glyph: "✦", tag: "POWER", typographic: true };

/** Resolve the color/glyph world for an effect — shared with the flip-side info panel. */
export function getPowerCardTheme(effectType?: string, icon?: string): EffectTheme {
  return (
    EFFECT_THEMES[effectType ?? ""] ?? { ...FALLBACK_THEME, glyph: icon || FALLBACK_THEME.glyph, typographic: !icon }
  );
}

const RARITY_FRAME: Record<PowerCardRarityName, { border: string; glow: string; gem: string }> = {
  COMMON: { border: "rgba(160,172,196,.28)", glow: "transparent", gem: "#8EA0B8" },
  RARE: { border: "rgba(94,201,232,.55)", glow: "rgba(94,201,232,.22)", gem: "#5EC9E8" },
  EPIC: { border: "rgba(185,138,232,.6)", glow: "rgba(185,138,232,.28)", gem: "#B98AE8" },
  LEGENDARY: { border: "rgba(232,200,74,.7)", glow: "rgba(232,200,74,.32)", gem: "#E8C84A" },
};

type FaceSize = "sm" | "md" | "lg";

const SIZE_STYLES: Record<
  FaceSize,
  { radius: string; glyph: string; glyphText: string; pip: string; name: string; tag: string; pad: string }
> = {
  sm: { radius: "rounded-xl", glyph: "text-3xl", glyphText: "text-[30px]", pip: "text-[9px]", name: "text-[9.5px]", tag: "text-[7px]", pad: "p-1.5" },
  md: { radius: "rounded-2xl", glyph: "text-5xl", glyphText: "text-[46px]", pip: "text-[11px]", name: "text-[12px]", tag: "text-[8.5px]", pad: "p-2.5" },
  lg: { radius: "rounded-[26px]", glyph: "text-8xl", glyphText: "text-[86px]", pip: "text-[16px]", name: "text-[19px]", tag: "text-[12px]", pad: "p-4" },
};

export function PowerCardFace({
  name,
  effectType,
  rarity = "COMMON",
  icon,
  category,
  size = "md",
  footer,
  className = "",
}: {
  name: string;
  effectType?: string;
  rarity?: string;
  /** Catalog emoji — used when the effect has no theme of its own. */
  icon?: string;
  /** Optional category caption shown along the top edge (md/lg only). */
  category?: string;
  size?: FaceSize;
  /** Optional slot pinned inside the card's bottom edge (price chip, uses badge). */
  footer?: ReactNode;
  className?: string;
}) {
  const theme = getPowerCardTheme(effectType, icon);
  const frame = RARITY_FRAME[(rarity as PowerCardRarityName) in RARITY_FRAME ? (rarity as PowerCardRarityName) : "COMMON"];
  const s = SIZE_STYLES[size];
  const legendary = rarity === "LEGENDARY";

  return (
    <div
      className={`relative aspect-[5/7] overflow-hidden select-none ${s.radius} ${s.pad} flex flex-col ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 50% 0%, color-mix(in oklab, ${theme.accent} 26%, ${theme.deep}) 0%, ${theme.deep} 46%, #0b0d14 100%)`,
        border: `1.5px solid ${frame.border}`,
        boxShadow: `0 10px 30px rgba(0,0,0,.45)${frame.glow !== "transparent" ? `, 0 0 22px ${frame.glow}` : ""}`,
      }}
    >
      {/* Encore emblem: concentric rotated-square frames behind the glyph —
          our own mark, deliberately not a card-game oval. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[42%] w-[64%] aspect-square -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[16%]"
        style={{ border: `2px solid color-mix(in oklab, ${theme.accent} 42%, transparent)`, opacity: 0.55 }}
      />
      <div
        aria-hidden
        className="absolute left-1/2 top-[42%] w-[46%] aspect-square -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[16%]"
        style={{ border: `1px solid color-mix(in oklab, ${theme.accent} 30%, transparent)`, opacity: 0.45 }}
      />
      {/* Top gloss. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,.09), transparent 30%)" }}
      />
      {/* Legendary: animated shine sweep. */}
      {legendary && (
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-y-0 w-1/3 animate-[encShine_2.6s_ease-in-out_infinite]"
            style={{ background: "linear-gradient(105deg, transparent, rgba(255,240,190,.22), transparent)" }}
          />
        </div>
      )}

      {/* Corner chip — small squared tag with the glyph, top-left. */}
      <span
        className={`absolute top-1.5 left-1.5 rounded-md px-1 py-0.5 font-black leading-none ${s.pip}`}
        style={{
          color: theme.accent,
          background: `color-mix(in oklab, ${theme.accent} 14%, transparent)`,
          border: `1px solid color-mix(in oklab, ${theme.accent} 32%, transparent)`,
        }}
      >
        {theme.glyph}
      </span>
      {/* Category caption along the top edge. */}
      {category && size !== "sm" && (
        <span
          className="absolute top-2 left-1/2 -translate-x-1/2 text-[7.5px] font-bold tracking-[.26em]"
          style={{ color: theme.accent, opacity: 0.85 }}
        >
          {category}
        </span>
      )}
      {/* Rarity gem. */}
      <span
        aria-hidden
        className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
        style={{ background: frame.gem, boxShadow: `0 0 6px ${frame.gem}` }}
      />

      {/* Central glyph. */}
      <div className="relative flex-1 flex items-center justify-center">
        <span
          className={`${theme.typographic ? `font-black italic tracking-[-.04em] ${s.glyphText}` : s.glyph} leading-none`}
          style={
            theme.typographic
              ? { color: "#fff", textShadow: `0 0 24px ${theme.accent}, 0 3px 0 color-mix(in oklab, ${theme.accent} 55%, black)` }
              : { filter: `drop-shadow(0 0 14px ${theme.accent})` }
          }
        >
          {theme.glyph}
        </span>
      </div>

      {/* Name plate. Skip the tag when it would just repeat the card's name
          (e.g. a card literally called "Double Points"). */}
      <div className="relative text-center pb-0.5">
        <span className={`block font-black uppercase tracking-[.06em] text-white leading-tight ${s.name}`}>{name}</span>
        {theme.tag !== name.trim().toUpperCase() && (
          <span className={`block font-bold tracking-[.18em] mt-0.5 ${s.tag}`} style={{ color: theme.accent }}>
            {theme.tag}
          </span>
        )}
        <span
          aria-hidden
          className="mx-auto mt-1 block h-[2px] w-7 rounded-full"
          style={{ background: `color-mix(in oklab, ${theme.accent} 70%, transparent)` }}
        />
        {footer && <div className="mt-1.5 flex items-center justify-center">{footer}</div>}
      </div>
    </div>
  );
}
