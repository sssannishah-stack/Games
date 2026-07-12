/**
 * Shop-wide rarity language — separate from PowerCardFace's frame colors
 * (which are subtle, in-card accents) because a shop needs a louder, more
 * "which shelf is this on" signal: a visible label chip and a stronger tile
 * border. COMMON/RARE/EPIC/LEGENDARY are the only rarities the catalog
 * actually stores today; MYTHIC is styled defensively (animated rainbow
 * border, per spec) so nothing breaks if it's ever added to the enum later —
 * it renders identically to LEGENDARY until then since no card can carry it.
 */
export type ShopRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";

export interface RarityTheme {
  label: string;
  chipBg: string;
  chipText: string;
  border: string;
  glow: string;
  /** Rainbow animated border — MYTHIC only. */
  rainbow?: boolean;
}

const THEMES: Record<ShopRarity, RarityTheme> = {
  COMMON: {
    label: "Common",
    chipBg: "bg-line/[.1]",
    chipText: "text-mute-2",
    border: "border-line/[.14]",
    glow: "transparent",
  },
  RARE: {
    label: "Rare",
    chipBg: "bg-info/15",
    chipText: "text-info",
    border: "border-info/40",
    glow: "rgba(94,201,232,.25)",
  },
  EPIC: {
    label: "Epic",
    chipBg: "bg-[#B98AE8]/15",
    chipText: "text-[#C99AF0]",
    border: "border-[#B98AE8]/45",
    glow: "rgba(185,138,232,.3)",
  },
  LEGENDARY: {
    label: "Legendary",
    chipBg: "bg-warn/15",
    chipText: "text-warn",
    border: "border-warn/50",
    glow: "rgba(232,200,74,.35)",
  },
  MYTHIC: {
    label: "Mythic",
    chipBg: "bg-[#F06A96]/15",
    chipText: "text-[#F06A96]",
    border: "border-transparent",
    glow: "rgba(240,106,150,.4)",
    rainbow: true,
  },
};

export function rarityTheme(rarity?: string | null): RarityTheme {
  const key = (rarity ?? "COMMON").toUpperCase();
  return THEMES[key as ShopRarity] ?? THEMES.COMMON;
}
