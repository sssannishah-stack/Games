import type { SceneRecord } from "@/data/queries/scene.queries";
import type {
  ReplayEvent,
  ReplayScoreEntry,
  ReplayCoinEntry,
  ReplayAuction,
} from "@/data/queries/replay.queries";

/** Everything fetched server-side, bundled for client-side scrubbing. */
export interface ReplayData {
  events: ReplayEvent[];
  scoreHistory: ReplayScoreEntry[];
  coinHistory: ReplayCoinEntry[];
  auctions: ReplayAuction[];
  scenes: SceneRecord[];
}

export interface ReconstructedState {
  cursorTime: number;
  currentScene: SceneRecord | null;
  teamScores: Map<string, number>;
  teamCoins: Map<string, number>;
  /** teamId -> powerCardId -> owned count, best-effort from event deltas (see replay.queries.ts). */
  teamPowerCards: Map<string, Map<string, number>>;
  storeOpen: boolean;
  activeAuction: ReplayAuction | null;
}

function applyCardDelta(map: Map<string, Map<string, number>>, teamId: string, cardId: string, delta: number) {
  const teamMap = map.get(teamId) ?? new Map<string, number>();
  teamMap.set(cardId, Math.max(0, (teamMap.get(cardId) ?? 0) + delta));
  map.set(teamId, teamMap);
}

/**
 * Reconstructs "what did the room look like at this point in time" purely
 * from the event-sourced ledgers — no server round-trip, so scrubbing feels
 * instant. `cursorIndex` indexes into `data.events` (the canonical timeline
 * the Timeline panel and playback loop both drive off of); every other
 * ledger is filtered by wall-clock time up to that event's timestamp.
 */
export function reconstructState(data: ReplayData, cursorIndex: number): ReconstructedState {
  const { events, scoreHistory, coinHistory, auctions, scenes } = data;
  const clampedIndex = Math.max(0, Math.min(cursorIndex, events.length - 1));
  const cursorTime = events[clampedIndex] ? new Date(events[clampedIndex].createdAt).getTime() : 0;

  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  let currentScene: SceneRecord | null = null;
  let storeOpen = false;
  const teamPowerCards = new Map<string, Map<string, number>>();

  for (const event of events) {
    const time = new Date(event.createdAt).getTime();
    if (time > cursorTime) break;
    const m = event.metadata;
    switch (event.type) {
      case "SCENE_CHANGED": {
        const sceneId = String(m.sceneId ?? "");
        currentScene = sceneById.get(sceneId) ?? currentScene;
        break;
      }
      case "STORE_OPENED":
        storeOpen = true;
        break;
      case "STORE_CLOSED":
        storeOpen = false;
        break;
      case "CARD_PURCHASED":
        applyCardDelta(teamPowerCards, String(m.teamId), String(m.powerCardId), 1);
        break;
      case "POWER_CARD_USED": {
        const teamId = String(m.teamId);
        const cardId = String(m.powerCardId);
        if (m.source === "HOST_GIFT") applyCardDelta(teamPowerCards, teamId, cardId, 1);
        else applyCardDelta(teamPowerCards, teamId, cardId, -1); // consumed in play, or HOST_REMOVED
        break;
      }
      default:
        break;
    }
  }

  // Mirrors score.actions.ts's recalculateRoomScores exactly: a reverted
  // original is excluded because it no longer counts, AND the undo row
  // itself is excluded too — the undo's only job is to mark the audit trail,
  // not to be separately summed (that would double-subtract the reversal).
  const teamScores = new Map<string, number>();
  for (const tx of scoreHistory) {
    if (tx.isReverted || tx.isUndo) continue;
    if (new Date(tx.createdAt).getTime() > cursorTime) break;
    teamScores.set(tx.teamId, (teamScores.get(tx.teamId) ?? 0) + tx.points);
  }

  const teamCoins = new Map<string, number>();
  for (const tx of coinHistory) {
    if (new Date(tx.createdAt).getTime() > cursorTime) break;
    teamCoins.set(tx.teamId, (teamCoins.get(tx.teamId) ?? 0) + tx.amount);
  }

  // An auction is "in progress" at the cursor if the cursor falls between its
  // creation and resolution time, regardless of its eventual status — before
  // resolution, replay shouldn't reveal the outcome yet.
  const activeAuction =
    auctions.find((a) => {
      const start = new Date(a.createdAt).getTime();
      const end = new Date(a.resolvedAt).getTime();
      return cursorTime >= start && cursorTime < end;
    }) ?? null;

  return { cursorTime, currentScene, teamScores, teamCoins, teamPowerCards, storeOpen, activeAuction };
}
