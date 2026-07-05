import { notFound } from "next/navigation";
import { CompetitionBuilder } from "@/components/competition/CompetitionBuilder";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { getCompetitionById } from "@/data/queries/competition.queries";
import { getRoomsByCompetition } from "@/data/queries/room.queries";

export default async function AdminCompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const competition = await getCompetitionById(id, user.id);
  if (!competition) notFound();

  const rooms = await getRoomsByCompetition(id);

  return <CompetitionBuilder competition={competition} rooms={rooms} />;
}
