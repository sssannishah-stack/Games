import type { PowerCardCategory, PowerCardRarity, PowerCardEffectType } from "@/types/db";

export interface DefaultPowerCard {
  id: string;
  icon: string;
  name: string;
  description: string;
  category: PowerCardCategory;
  rarity: PowerCardRarity;
  effectType: PowerCardEffectType;
  price: number;
}

/** The starter Power Card catalog offered in the competition wizard and seeded into a host's global catalog. */
export const DEFAULT_POWER_CARDS: DefaultPowerCard[] = [
  { id: "hint", icon: "💡", name: "Hint", description: "Reveal a clue", category: "HELP", rarity: "COMMON", effectType: "HINT", price: 1000 },
  { id: "extra-time", icon: "⏱", name: "Extra Time", description: "Add time to the clock", category: "HELP", rarity: "COMMON", effectType: "EXTRA_TIME", price: 1200 },
  { id: "double-guess", icon: "🎯", name: "Double Guess", description: "Get a second attempt", category: "HELP", rarity: "RARE", effectType: "SECOND_CHANCE", price: 1800 },
  { id: "peek", icon: "👁", name: "Peek", description: "Eliminate one wrong option (MCQ only)", category: "HELP", rarity: "RARE", effectType: "PEEK", price: 1300 },
  { id: "shield", icon: "🛡", name: "Shield", description: "Block negative marks on this question", category: "DEFENSE", rarity: "RARE", effectType: "BLOCK_NEGATIVE", price: 1500 },
  { id: "insurance", icon: "🩹", name: "Insurance", description: "Blocks negative marks for 3 questions", category: "DEFENSE", rarity: "EPIC", effectType: "INSURANCE", price: 2500 },
  { id: "double-points", icon: "🔥", name: "Double Points", description: "Double the score reward", category: "BOOST", rarity: "EPIC", effectType: "DOUBLE_SCORE", price: 2000 },
  { id: "gamble", icon: "🎲", name: "Gamble", description: "Bet your coins: double them if correct, lose them if wrong. Marks are unaffected.", category: "RISK", rarity: "EPIC", effectType: "GAMBLE", price: 1100 },
  { id: "mystery-box", icon: "🎁", name: "Mystery Box", description: "Random reward", category: "RISK", rarity: "RARE", effectType: "MYSTERY", price: 900 },
  { id: "freeze", icon: "❄", name: "Freeze", description: "Target team can't use any power card on their next turn", category: "ATTACK", rarity: "EPIC", effectType: "FREEZE", price: 1600 },
  { id: "time-drain", icon: "⏳", name: "Time Drain", description: "Cut 15 seconds off the answering team's clock", category: "ATTACK", rarity: "RARE", effectType: "TIME_DRAIN", price: 1400 },
  { id: "pass-question", icon: "🔄", name: "Pass the Question", description: "Hand your question to another team. They keep the points if right — but a wrong answer's penalty comes back to you.", category: "RISK", rarity: "EPIC", effectType: "PASS_QUESTION", price: 1700 },
  { id: "copycat", icon: "🪞", name: "Copycat", description: "Mirror the answering team's result onto your own score — their points if right, their penalty if wrong.", category: "RISK", rarity: "EPIC", effectType: "COPYCAT", price: 1500 },
];
