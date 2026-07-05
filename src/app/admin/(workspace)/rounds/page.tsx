import { requireUser } from "@/lib/auth/getCurrentUser";
import { getRoundsByOwner } from "@/data/queries/round.queries";
import { RoundLibraryBoard } from "@/components/round/RoundLibraryBoard";

export default async function AdminRoundsPage() {
  const user = await requireUser();
  const rounds = await getRoundsByOwner(user.id);

  return <RoundLibraryBoard rounds={rounds} />;
}
