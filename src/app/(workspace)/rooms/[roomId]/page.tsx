import { redirect } from "next/navigation";

// Legacy path. Room setup now lives exclusively under /admin/*.
export default async function LegacyRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  redirect(`/admin/rooms/${roomId}`);
}
