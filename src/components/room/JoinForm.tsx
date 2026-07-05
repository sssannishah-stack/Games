"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { joinRoom } from "@/actions/room.actions";
import type { TeamRecord } from "@/data/queries/team.queries";

interface JoinFormProps {
  roomCode: string;
  teams: TeamRecord[];
  onJoined?: (participant: JoinedParticipant) => void;
}

export interface JoinedParticipant {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  teamColor?: string;
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function JoinForm({ roomCode, teams, onJoined }: JoinFormProps) {
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ team: string; color?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!name.trim()) return setError("Enter your name.");
    if (!teamId) return setError("Pick a team.");

    startTransition(async () => {
      try {
        const participant = await joinRoom({ roomCode, teamId, name: name.trim() });
        const team = teams.find((t) => t.id === teamId);
        onJoined?.({
          id: participant.id,
          name: participant.name,
          teamId: participant.teamId,
          teamName: team?.name ?? "your team",
          teamColor: team?.color,
        });
        setJoined({ team: team?.name ?? "your team", color: team?.color });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not join.");
      }
    });
  }

  if (joined) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className="flex flex-col items-center gap-4 text-center py-2"
      >
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: `color-mix(in oklab, ${joined.color ?? "#3DD68C"} 18%, transparent)`,
            border: `1.5px solid color-mix(in oklab, ${joined.color ?? "#3DD68C"} 45%, transparent)`,
          }}
        >
          <Icon name="circle-check" size={30} style={{ color: joined.color ?? "#3DD68C" }} />
        </motion.div>
        <div className="flex flex-col gap-1">
          <span className="text-xl font-bold text-ink">You&apos;re in, {name}!</span>
          <span className="text-[13.5px] text-mute-2">
            Joined <b className="text-ink-2">{joined.team}</b> — sit tight while the host gets
            ready.
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-dim mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-enc-pulse-slow" />
          Keep this tab open — the show starts here
        </div>
      </motion.div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 text-center py-2">
        <Icon name="users" size={22} className="text-mute-2" />
        <span className="text-sm text-mute-2 leading-relaxed">
          No teams have been created for this room yet. Ask the host to add teams first.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <label className="flex flex-col gap-[7px]">
        <span className="text-xs font-semibold text-ink-3">Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Moksh"
          autoFocus
          className="bg-line/[.05] border border-line/[.1] rounded-[13px] px-4 py-3.5 text-[15px] text-ink outline-none focus:border-accent/60 transition-colors"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-ink-3">Pick your team</span>
        <div className="grid grid-cols-2 gap-2">
          {teams.map((team) => {
            const selected = teamId === team.id;
            const color = team.color ?? "#6C7BFA";
            return (
              <button
                key={team.id}
                onClick={() => setTeamId(team.id)}
                className={`flex items-center gap-2.5 rounded-[14px] px-3 py-3 cursor-pointer border-[1.5px] transition text-left ${
                  selected ? "shadow-[0_0_0_3px_rgba(108,123,250,.1)]" : "border-line/[.09] hover:border-line/20"
                }`}
                style={
                  selected
                    ? {
                        borderColor: color,
                        background: `color-mix(in oklab, ${color} 14%, transparent)`,
                      }
                    : undefined
                }
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 55%, black))`,
                  }}
                >
                  {initial(team.name)}
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="text-[13px] font-semibold text-ink-2 truncate">{team.name}</span>
                  {team.members.length > 0 && (
                    <span className="text-[10.5px] text-dim truncate">
                      {team.members.length} member{team.members.length > 1 ? "s" : ""}
                    </span>
                  )}
                </span>
                {selected && (
                  <Icon name="check" size={14} className="ml-auto shrink-0" style={{ color }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.span
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[12.5px] text-danger-soft bg-danger/[.08] border border-danger/25 rounded-[10px] px-3 py-2"
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>

      <Button
        variant="primary"
        size="lg"
        onClick={submit}
        disabled={pending}
        className="justify-center min-h-12 disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join room"}
        {!pending && <Icon name="arrow-right" size={15} />}
      </Button>
    </div>
  );
}
