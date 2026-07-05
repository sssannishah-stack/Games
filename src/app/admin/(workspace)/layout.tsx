import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { requireUser } from "@/lib/auth/getCurrentUser";

export default async function AdminWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return <WorkspaceShell user={user}>{children}</WorkspaceShell>;
}
