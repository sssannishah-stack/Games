import { redirect } from "next/navigation";

// Legacy path. Competitions now live exclusively under /admin/*.
export default async function LegacyCompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/competitions/${id}`);
}
