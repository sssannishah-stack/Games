import { Sidebar } from "@/components/layout/Sidebar";
import { countCompetitionsByOwner } from "@/data/queries/competition.queries";
import type { CurrentUser } from "@/lib/auth/getCurrentUser";

export async function WorkspaceShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const competitionsCount = await countCompetitionsByOwner(user.id);

  return (
    <div className="flex flex-1 min-h-screen">
      <Sidebar user={user} competitionsCount={competitionsCount} />
      <main className="flex-1 min-w-0 px-5 py-6 md:px-9 md:py-7 flex flex-col gap-6">
        {children}
      </main>
    </div>
  );
}
