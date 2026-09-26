import type { SessionUser } from "@/server/auth/session";
import { MobileMenu, Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";

/** Sidebar + top bar + content column, shared by the admin and student areas. */
export function AppShell({ user, variant, topbar, actions, children }: {
  user: SessionUser; variant: "admin" | "student"; topbar?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar variant={variant} />
      <div className="lg:pl-66">
        <div className="mx-auto max-w-360 px-4 sm:px-6 lg:px-8">
          <header className="flex items-center gap-3 py-3">
            <MobileMenu variant={variant} />
            <div className="min-w-0 flex-1">{topbar}</div>
            {actions}
            <UserMenu name={user.name} role={user.role} />
          </header>
          <main id="main" className="pb-12">{children}</main>
        </div>
      </div>
    </div>
  );
}
