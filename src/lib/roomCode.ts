/** Room-code helpers (pure, no DB) used by the room server actions. */

/** Generate a 4-digit room code like "4821" — short and fast to type on a phone. */
export function generateRoomCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}
