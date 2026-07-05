import { Icon } from "@/components/ui/Icon";
import type { PowerCardCategory, PowerCardRarity } from "@/types/db";

const CATEGORY_META: Record<PowerCardCategory, { icon: string; color: string }> = {
  HELP: { icon: "lightbulb", color: "#F5B93D" },
  DEFENSE: { icon: "shield", color: "#3DD68C" },
  BOOST: { icon: "zap", color: "#6C7BFA" },
  RISK: { icon: "dices", color: "#E36A8A" },
  ATTACK: { icon: "swords", color: "#FF6B6B" },
};

const RARITY_COLOR: Record<PowerCardRarity, string> = {
  COMMON: "#8A8F9C",
  RARE: "#5EC9E8",
  EPIC: "#B98AE8",
  LEGENDARY: "#F5B93D",
};

export function CategoryIcon({ category, size = 16 }: { category: PowerCardCategory; size?: number }) {
  const meta = CATEGORY_META[category];
  return <Icon name={meta.icon} size={size} style={{ color: meta.color }} />;
}

export function RarityBadge({ rarity }: { rarity: PowerCardRarity }) {
  const color = RARITY_COLOR[rarity];
  return (
    <span
      className="font-mono font-bold text-[8.5px] tracking-[.08em] rounded-[5px] px-1.5 py-0.5"
      style={{ color, background: `color-mix(in oklab, ${color} 16%, transparent)` }}
    >
      {rarity}
    </span>
  );
}

export { CATEGORY_META, RARITY_COLOR };
