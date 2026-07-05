import "server-only";
import { networkInterfaces } from "os";
import { headers } from "next/headers";

/** Best-effort absolute origin for the current request (used to build join links/QRs). */
export async function getBaseUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * True when the current request's Host header is localhost/127.0.0.1 — a
 * join link built from it will only work on this machine, not on any
 * participant's phone.
 */
export function isLocalHost(host: string): boolean {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/.test(host);
}

/**
 * Best-guess LAN IPv4 address for this machine (e.g. "192.168.1.42"), so a
 * host running `npm run dev` can share a join link that actually reaches
 * phones on the same Wi-Fi. Returns null if none is found (e.g. no network).
 */
export function getLanAddress(): string | null {
  const interfaces = networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }
  return null;
}
