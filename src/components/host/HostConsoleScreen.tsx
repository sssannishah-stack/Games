"use client";

import { HostTopBar } from "@/components/host/HostTopBar";
import { SceneFlow } from "@/components/host/SceneFlow";
import { LivePreview } from "@/components/host/LivePreview";
import { ControlPanel } from "@/components/host/ControlPanel";
import { HostDock } from "@/components/layout/HostDock";
import { GiveMarksModal } from "@/components/host/GiveMarksModal";
import { TeamInventory } from "@/components/team/TeamInventory";
import { Drawer } from "@/components/ui/Drawer";
import { useHostStore } from "@/stores/hostStore";
import { getTeam } from "@/data/mock/teams";

/* Host control room: scene flow, live preview, control panel, and dock. */
export function HostConsoleScreen() {
  const { openMarks, teamDrawerId, closeTeamDrawer } = useHostStore();
  const drawerTeam = teamDrawerId ? getTeam(teamDrawerId) : undefined;

  return (
    <div className="h-screen bg-shell flex flex-col overflow-hidden">
      <HostTopBar
        title="Sharma Family Game Night"
        subtitle="Scene 07 of 24 - Round 2 - Emoji Quiz"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[264px_minmax(0,1fr)] xl:grid-cols-[264px_minmax(0,1fr)_344px] flex-1 min-h-0">
        <div className="hidden lg:flex flex-col min-h-0">
          <SceneFlow />
        </div>
        <LivePreview />
        <div className="hidden xl:flex flex-col min-h-0">
          <ControlPanel />
        </div>
      </div>

      <HostDock onGiveMarks={() => openMarks()} />

      <GiveMarksModal />

      <Drawer open={drawerTeam !== undefined} onClose={closeTeamDrawer}>
        {drawerTeam && (
          <TeamInventory
            team={drawerTeam}
            onClose={closeTeamDrawer}
            onGiveMarks={() => {
              closeTeamDrawer();
              openMarks(drawerTeam.id);
            }}
          />
        )}
      </Drawer>
    </div>
  );
}
