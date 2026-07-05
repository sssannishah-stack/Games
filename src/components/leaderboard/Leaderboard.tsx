"use client";

import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import type { Team } from "@/types";

interface LeaderboardProps {
  teams: Team[];
  youTeamId?: string;
}

function Movement({ team }: { team: Team }) {
  if (team.previousRank == null || team.previousRank === team.rank)
    return <span className="text-[10.5px] text-dim">—</span>;
  const up = team.previousRank > team.rank;
  return (
    <span
      className={cn(
        "text-[10.5px] flex items-center",
        up ? "text-success" : "text-danger-soft"
      )}
    >
      <Icon name={up ? "chevron-up" : "chevron-down"} size={12} />
      {Math.abs(team.previousRank - team.rank)}
    </span>
  );
}

/* Ranked list with progress bars and rank-movement chevrons.
   Rows are motion layout items so live reorders animate. */
export function Leaderboard({ teams, youTeamId }: LeaderboardProps) {
  const sorted = [...teams].sort((a, b) => a.rank - b.rank);
  return (
    <div className="flex flex-col gap-[9px]">
      {sorted.map((team, i) => {
        const isYou = team.id === youTeamId;
        const isFirst = team.rank === 1;
        return (
          <motion.div
            key={team.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i, type: "spring", stiffness: 320, damping: 28 }}
            className={cn(
              "flex items-center gap-[11px] rounded-[14px] px-3.5 py-3 border",
              isFirst &&
                "bg-[linear-gradient(90deg,rgba(245,169,61,.14),rgba(255,255,255,.02))] border-[rgba(245,169,61,.4)]",
              isYou &&
                "bg-[color-mix(in_oklab,#C98A5E_8%,rgba(255,255,255,.02))] border-[1.5px] border-[rgba(201,138,94,.5)] shadow-[0_0_0_3px_rgba(201,138,94,.1)]",
              !isFirst && !isYou && "bg-line/[.02] border-line/[.08]",
              team.status === "offline" && "opacity-75"
            )}
          >
            <span
              className={cn(
                "font-mono font-bold text-sm",
                isFirst ? "text-warn" : "text-ink-3"
              )}
            >
              {team.rank}
            </span>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: team.color }} />
            <div className="flex flex-col gap-[3px] flex-1 min-w-0">
              <span
                className={cn(
                  "text-[13.5px]",
                  isFirst || isYou ? "font-bold text-ink" : "font-semibold text-ink-2"
                )}
              >
                {team.name}
                {isYou && (
                  <>
                    {" "}· you{" "}
                    {team.streak ? (
                      <span className="text-[9.5px] font-semibold text-[#C98A5E] bg-[rgba(201,138,94,.15)] rounded-full px-[7px] py-0.5 ml-1">
                        🔥 {team.streak} streak
                      </span>
                    ) : null}
                  </>
                )}
              </span>
              <div className="h-[5px] rounded-[3px] bg-line/[.07]">
                <motion.div
                  className="h-[5px] rounded-[3px]"
                  style={{ background: team.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${team.progress ?? 0}%` }}
                  transition={{ delay: 0.15 + 0.06 * i, duration: 0.5, ease: [0.2, 0.9, 0.3, 1] }}
                />
              </div>
            </div>
            <span className="font-mono font-bold text-base text-ink">{team.score}</span>
            <Movement team={team} />
          </motion.div>
        );
      })}
    </div>
  );
}
