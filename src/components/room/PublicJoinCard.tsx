import { JoinPageShell } from "@/components/room/JoinPageShell";
import { JoinCodeRedirect } from "@/components/room/JoinCodeRedirect";

/** The public "/join" landing — room code entry, wrapped in the branded shell. */
export function PublicJoinCard() {
  return (
    <JoinPageShell>
      <JoinCodeRedirect />
    </JoinPageShell>
  );
}
