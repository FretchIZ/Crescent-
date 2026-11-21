import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <AppShell user={user ? { name: user.name, email: user.email, role: user.role } : null}>
      {children}
    </AppShell>
  );
}
