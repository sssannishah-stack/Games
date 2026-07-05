import { z } from "zod";
import {
  POWER_CARD_CATEGORIES,
  POWER_CARD_RARITIES,
  POWER_CARD_EFFECT_TYPES,
  PRICE_MODES,
} from "@/types/db";

export const createPowerCardSchema = z.object({
  name: z.string().min(1, "Card name is required").max(60),
  description: z.string().max(300).default(""),
  icon: z.string().min(1).default("sparkles"),
  category: z.enum(POWER_CARD_CATEGORIES),
  rarity: z.enum(POWER_CARD_RARITIES).default("COMMON"),
  effectType: z.enum(POWER_CARD_EFFECT_TYPES),
  price: z.number().int().min(0).default(0),
  // null/undefined = unlimited stock.
  stock: z.number().int().min(0).nullable().default(null),
  enabled: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  usesPerTeam: z.number().int().min(1).default(1),
  priceMode: z.enum(PRICE_MODES).default("FIXED"),
});

export const updatePowerCardSchema = createPowerCardSchema.partial();

export type CreatePowerCardInput = z.infer<typeof createPowerCardSchema>;
export type UpdatePowerCardInput = z.infer<typeof updatePowerCardSchema>;
