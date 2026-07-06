/**
 * Lucky Spin wheel config, shared by the host wheel UI and the server action so
 * the segment the wheel visually lands on is exactly the outcome the server
 * applied. The server picks the index (weighted); the client animates to it.
 */

export type SpinKind = "COINS" | "CARD" | "BONUS" | "NOTHING" | "PENALTY";

export interface SpinSegment {
  label: string;
  emoji: string;
  kind: SpinKind;
  /** Coins for COINS/PENALTY, points for BONUS, ignored otherwise. */
  amount: number;
  weight: number;
  color: string;
}

// Order is fixed — the wheel draws these clockwise from the top pointer.
export const SPIN_SEGMENTS: SpinSegment[] = [
  { label: "+300 coins", emoji: "🪙", kind: "COINS", amount: 300, weight: 3, color: "#E8C84A" },
  { label: "Surprise card", emoji: "🎁", kind: "CARD", amount: 0, weight: 2, color: "#6C7BFA" },
  { label: "+20 bonus", emoji: "⭐", kind: "BONUS", amount: 20, weight: 2, color: "#3DD68C" },
  { label: "Nothing", emoji: "💤", kind: "NOTHING", amount: 0, weight: 2, color: "#565B68" },
  { label: "-200 coins", emoji: "💥", kind: "PENALTY", amount: 200, weight: 1, color: "#FF6B6B" },
  { label: "+1000 coins", emoji: "💰", kind: "COINS", amount: 1000, weight: 1, color: "#2FBFA7" },
  { label: "+50 bonus", emoji: "⚡", kind: "BONUS", amount: 50, weight: 1, color: "#5EC9E8" },
  { label: "+500 coins", emoji: "🍀", kind: "COINS", amount: 500, weight: 2, color: "#E36A8A" },
];

/** Weighted-random segment index. Pure — safe to call server-side. */
export function pickSpinIndex(): number {
  const total = SPIN_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < SPIN_SEGMENTS.length; i++) {
    roll -= SPIN_SEGMENTS[i].weight;
    if (roll < 0) return i;
  }
  return SPIN_SEGMENTS.length - 1;
}
