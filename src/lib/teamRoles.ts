import "server-only";
import { Participant } from "@/models";
import type { IParticipant } from "@/types/db";

/**
 * A phone counts as connected if its live poll (1s cadence) has been heard
 * from within this window. Generous enough to survive slow networks and tab
 * switches, small enough that a genuinely dropped captain frees up control
 * for the vice captain within seconds.
 */
export const CONNECTED_WINDOW_MS = 15_000;

export function isDeviceConnected(lastSeenAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  return now - new Date(lastSeenAt).getTime() <= CONNECTED_WINDOW_MS;
}

export interface TeamControlState {
  captain: IParticipant | null;
  viceCaptain: IParticipant | null;
  captainConnected: boolean;
  /**
   * The participant currently allowed to control team actions:
   * the captain while connected, otherwise the connected vice captain
   * (temporary captain). Null when neither controller is reachable —
   * the host can reassign roles from the console.
   */
  actingCaptainId: string | null;
}

/** Derive who controls the team right now from its connected devices. */
export function resolveTeamControl(devices: IParticipant[], now = Date.now()): TeamControlState {
  const captain = devices.find((d) => d.role === "CAPTAIN") ?? null;
  const viceCaptain = devices.find((d) => d.role === "VICE_CAPTAIN") ?? null;
  const captainConnected = captain ? isDeviceConnected(captain.lastSeenAt, now) : false;

  let actingCaptainId: string | null = null;
  if (captain && captainConnected) {
    actingCaptainId = captain._id.toString();
  } else if (viceCaptain && isDeviceConnected(viceCaptain.lastSeenAt, now)) {
    actingCaptainId = viceCaptain._id.toString();
  }

  return { captain, viceCaptain, captainConnected, actingCaptainId };
}

/**
 * Server-side gate for team actions (use/buy power cards, auction bids,
 * answer submission). Throws unless `participantId` identifies this team's
 * captain — or its vice captain while the captain is disconnected. Never
 * trust the phone's own claim; recompute from the database every time.
 */
export async function assertTeamController(teamId: string, participantId: string | undefined | null): Promise<IParticipant> {
  if (!participantId) throw new Error("Only the team captain can do this.");

  const devices = await Participant.find({ teamId }).lean<IParticipant[]>();
  const me = devices.find((d) => d._id.toString() === participantId);
  if (!me) throw new Error("You're not part of this team.");

  const control = resolveTeamControl(devices);
  if (control.actingCaptainId !== participantId) {
    throw new Error(
      me.role === "VICE_CAPTAIN"
        ? "The captain is connected — only the captain can do this."
        : "Only the team captain can do this."
    );
  }
  return me;
}
