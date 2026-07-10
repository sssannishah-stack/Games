"use client";

import { useState, type ReactNode } from "react";
import { PowerCardFace, getPowerCardTheme } from "@/components/power-card/PowerCardFace";

/**
 * Tap a power card to flip it over — the back explains what the card does,
 * when it can be played, and what you have left. Flipping is always allowed
 * (it's just reading); actually USING the card is a separate button outside
 * this component, gated by role + game moment.
 *
 * Pure CSS 3D flip (no motion lib) so it stays cheap in long card grids.
 */
export function FlippablePowerCard({
  name,
  effectType,
  rarity,
  icon,
  category,
  description,
  detailLines = [],
  hint,
  size = "md",
  footer,
  frontExtras,
  className = "",
}: {
  name: string;
  effectType?: string;
  rarity?: string;
  icon?: string;
  category?: string;
  /** What the card does — the main text on the back. */
  description: string;
  /** Small meta rows on the back (e.g. "2 uses left", "Price: 1200 🪙"). */
  detailLines?: string[];
  /** Availability note, e.g. "Cards can be played while a question is live." */
  hint?: string | null;
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
  /** Overlays that belong to the front face (ribbons, badges) and flip with it. */
  frontExtras?: ReactNode;
  className?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const theme = getPowerCardTheme(effectType, icon);

  return (
    <button
      type="button"
      onClick={() => setFlipped((value) => !value)}
      aria-label={flipped ? `Hide details for ${name}` : `Show details for ${name}`}
      className={`relative block w-full text-left cursor-pointer [perspective:1000px] ${className}`}
    >
      <div
        className={`relative w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* FRONT */}
        <div className="relative [backface-visibility:hidden]">
          <PowerCardFace
            name={name}
            effectType={effectType}
            rarity={rarity}
            icon={icon}
            category={category}
            size={size}
            footer={footer}
          />
          {frontExtras}
        </div>

        {/* BACK — the "what does this do" side. */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div
            className="h-full rounded-2xl p-3 flex flex-col gap-1.5 overflow-hidden"
            style={{
              background: `linear-gradient(180deg, color-mix(in oklab, ${theme.accent} 14%, #10121c), #0b0d14)`,
              border: `1.5px solid color-mix(in oklab, ${theme.accent} 40%, transparent)`,
            }}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none">{theme.glyph}</span>
              <span className="text-[11px] font-black uppercase tracking-[.06em] text-white truncate">{name}</span>
            </div>
            <p className="flex-1 text-[11px] leading-relaxed text-white/80 overflow-y-auto">{description}</p>
            {detailLines.map((line) => (
              <span key={line} className="text-[10px] font-semibold text-white/60">
                {line}
              </span>
            ))}
            {hint && (
              <span className="text-[10px] font-bold leading-snug" style={{ color: theme.accent }}>
                ⏳ {hint}
              </span>
            )}
            <span className="text-[9px] text-white/35">Tap to flip back</span>
          </div>
        </div>
      </div>
    </button>
  );
}
