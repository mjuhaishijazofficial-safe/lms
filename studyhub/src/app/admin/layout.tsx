import { requireAdmin } from "@/server/auth/guards";
import { AppShell } from "@/components/layout/app-shell";

// Every admin route passes through this check; individual actions and services re-check on their own.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <AppShell user={user} variant="admin" topbar={<p className="hidden text-sm font-medium text-muted sm:block">Admin console</p>}>
      {children}
    </AppShell>
  );
}
