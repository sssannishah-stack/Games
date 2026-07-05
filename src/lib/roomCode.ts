/** Room-code helpers (pure, no DB) used by the room server actions. */

// Avoids ambiguous characters (0/O, 1/I) for codes read aloud in a room.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Generate a room code like "MNGO-42". */
export function generateRoomCode(): string {
  let letters = "";
  for (let i = 0; i < 4; i++) {
    letters += ALPHABET[Math.floor(Math.random() * 24)]; // letters slice
  }
  const digits = String(Math.floor(Math.random() * 90) + 10); // 10–99
  return `${letters}-${digits}`;
}
