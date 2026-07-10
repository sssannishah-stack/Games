import { Schema, model, models, type Model } from "mongoose";
import {
  type IPowerCard,
  POWER_CARD_CATEGORIES,
  POWER_CARD_RARITIES,
  POWER_CARD_EFFECT_TYPES,
  PRICE_MODES,
} from "@/types/db";

/**
 * The unified Power Card catalog — one engine for Simple Mode (host assigns
 * directly) and Economy Mode (teams buy from the store). Global per host:
 * every competition/room that host runs shares the same catalog. Rounds
 * decide which cards are allowed via `Round.allowedPowerCards`.
 */
const PowerCardSchema = new Schema<IPowerCard>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "sparkles" },
    category: { type: String, enum: [...POWER_CARD_CATEGORIES], required: true },
    rarity: { type: String, enum: [...POWER_CARD_RARITIES], default: "COMMON", required: true },
    effectType: { type: String, enum: [...POWER_CARD_EFFECT_TYPES], required: true },
    price: { type: Number, default: 0 },
    // null = unlimited stock.
    stock: { type: Number, default: null },
    enabled: { type: Boolean, default: true },
    // Instant use by default — "Use Power" activates immediately. A host can
    // opt a card back into the approval flow from the card editor.
    requiresApproval: { type: Boolean, default: false },
    usesPerTeam: { type: Number, default: 1 },
    // Prepared for future dynamic pricing (demand-based price changes) — no
    // logic reads this yet beyond storing the mode.
    priceMode: { type: String, enum: [...PRICE_MODES], default: "FIXED" },
  },
  { timestamps: true }
);

export const PowerCard: Model<IPowerCard> =
  models.PowerCard || model<IPowerCard>("PowerCard", PowerCardSchema);
export default PowerCard;
