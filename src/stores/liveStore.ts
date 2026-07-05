import { create } from "zustand";

/* Live-show state — will be driven by the realtime channel later. */

interface LiveState {
  live: boolean;
  elapsed: string;
  timerSeconds: number;
  timerPaused: boolean;
  currentSceneId: string;
  teamsQueued: number;
  totalTeams: number;
  phonesInSync: number;
  roomCode: string;
  latencyMs: number;
  pauseTimer: () => void;
  resumeTimer: () => void;
  addSeconds: (n: number) => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  live: true,
  elapsed: "00:42:18",
  timerSeconds: 12,
  timerPaused: false,
  currentSceneId: "sc07",
  teamsQueued: 2,
  totalTeams: 6,
  phonesInSync: 23,
  roomCode: "MNGO-42",
  latencyMs: 38,
  pauseTimer: () => set({ timerPaused: true }),
  resumeTimer: () => set({ timerPaused: false }),
  addSeconds: (n) => set((s) => ({ timerSeconds: s.timerSeconds + n })),
}));
