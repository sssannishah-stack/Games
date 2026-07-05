import { create } from "zustand";

/* Host-console UI state. Real-time sync (sockets) will hydrate this later. */

export type ControlTab = "Controls" | "Approvals" | "Teams" | "Timeline";

interface HostState {
  controlTab: ControlTab;
  marksOpen: boolean;
  teamDrawerId: string | null;
  markTeamId: string;
  markMemberId: string | null; // optional — host may credit a specific member
  markValue: number | null;
  markReason: string;
  setControlTab: (tab: ControlTab) => void;
  openMarks: (teamId?: string) => void;
  closeMarks: () => void;
  openTeamDrawer: (teamId: string) => void;
  closeTeamDrawer: () => void;
  setMarkTeam: (teamId: string) => void;
  setMarkMember: (memberId: string | null) => void;
  setMarkValue: (value: number | null) => void;
  setMarkReason: (reason: string) => void;
}

export const useHostStore = create<HostState>((set) => ({
  controlTab: "Controls",
  marksOpen: false,
  teamDrawerId: null,
  markTeamId: "chai",
  markMemberId: null,
  markValue: 10,
  markReason: "Correct",
  setControlTab: (controlTab) => set({ controlTab }),
  openMarks: (teamId) =>
    set((s) => ({
      marksOpen: true,
      markTeamId: teamId ?? s.markTeamId,
      // switching teams clears any previously chosen member
      markMemberId: teamId && teamId !== s.markTeamId ? null : s.markMemberId,
    })),
  closeMarks: () => set({ marksOpen: false }),
  openTeamDrawer: (teamDrawerId) => set({ teamDrawerId }),
  closeTeamDrawer: () => set({ teamDrawerId: null }),
  setMarkTeam: (markTeamId) => set({ markTeamId, markMemberId: null }),
  setMarkMember: (markMemberId) => set({ markMemberId }),
  setMarkValue: (markValue) => set({ markValue }),
  setMarkReason: (markReason) => set({ markReason }),
}));
