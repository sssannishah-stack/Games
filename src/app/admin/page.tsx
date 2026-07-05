import { AuthForm } from "@/components/auth/AuthForm";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { loginAction } from "@/actions/auth.actions";

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user) {
    return (
      <WorkspaceShell user={user}>
        <AdminDashboard user={user} />
      </WorkspaceShell>
    );
  }

  return (
    <div className="flex-1 min-h-[100dvh] sm:min-h-0 flex items-center justify-center px-4 py-5 sm:p-6">
      <AuthForm
        action={loginAction}
        mode="login"
        showSwitch={false}
        title="Admin login"
        subtitle="Host access only"
      />
    </div>
  );
}
