import { redirect } from "next/navigation";

// Legacy path. Round/question management is now inline on the admin room
// dashboard (Rounds and Questions sections) rather than a dedicated page.
export default async function LegacyRoundPage({
  params,
}: {
  params: Promise<{ roomId: string; roundId: string }>;
}) {
  const { roomId } = await params;
  redirect(`/admin/rooms/${roomId}`);
}
