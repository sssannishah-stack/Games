/**
 * Shared store-pricing helpers (pure, no DB) used by both the purchase action
 * and the live API so the price a team sees is exactly the price they're
 * charged. A flash sale only counts while active *and* not yet expired.
 */

export interface FlashSaleFields {
  flashSaleActive?: boolean;
  flashSalePercent?: number;
  flashSaleEndsAt?: Date | string | null;
}

export function flashSaleLive(live: FlashSaleFields | null | undefined): boolean {
  if (!live?.flashSaleActive || !live.flashSaleEndsAt) return false;
  return new Date(live.flashSaleEndsAt).getTime() > Date.now();
}

/** The price after any live flash-sale discount, floored at 0 and rounded. */
export function effectivePrice(price: number, live: FlashSaleFields | null | undefined): number {
  if (!flashSaleLive(live)) return price;
  const percent = Math.min(90, Math.max(0, live?.flashSalePercent ?? 0));
  return Math.max(0, Math.round(price * (1 - percent / 100)));
}
