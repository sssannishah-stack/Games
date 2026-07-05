import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { JoinPageShell } from "@/components/room/JoinPageShell";
import { LivePlayClient } from "@/components/participant/LivePlayClient";
import { getRoomByCode } from "@/data/queries/room.queries";
import { getTeamsByRoom } from "@/data/queries/team.queries";

export default async function PlayByRoomCodePage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  const room = await getRoomByCode(roomCode);

  if (!room) {
    return (
      <JoinPageShell eyebrow="ROOM NOT FOUND">
        <div className="w-16 h-16 rounded-full bg-danger/10 border border-danger/25 flex items-center justify-center">
          <Icon name="search-x" size={28} className="text-danger-soft" />
        </div>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <span className="text-xl font-bold text-ink">We could not find that room</span>
          <span className="text-[13px] text-mute-2 leading-relaxed">
            Double-check the code <b className="font-mono text-ink-2">{roomCode.toUpperCase()}</b>{" "}
            with your host, or try again.
          </span>
        </div>
        <Link
          href="/join"
          className="flex items-center gap-2 bg-accent text-white text-[13.5px] font-bold rounded-[12px] px-5 py-3 w-full justify-center hover:brightness-110 transition"
        >
          <Icon name="arrow-left" size={14} />
          Try another code
        </Link>
      </JoinPageShell>
    );
  }

  const teams = await getTeamsByRoom(room.id);

  return <LivePlayClient room={room} teams={teams} />;
}
