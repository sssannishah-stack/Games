import { redirect } from "next/navigation";

export default async function LegacyJoinByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/play/${code}`);
}
