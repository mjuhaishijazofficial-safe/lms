import { requireStudent } from "@/server/auth/guards";
import { getNotifications } from "@/server/services/library";
import { AppShell } from "@/components/layout/app-shell";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationsMenu } from "@/components/layout/notifications-menu";

// Every student page passes through this check; queries additionally filter by what this student may see.
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStudent();
  const { count, items } = await getNotifications(user.id);
  return (
    <AppShell
      user={user}
      variant="student"
      topbar={<GlobalSearch />}
      actions={
        <NotificationsMenu
          count={count}
          items={items.map((m) => ({ id: m.id, title: m.title, subject: m.chapter.subject.name, createdAt: m.createdAt.toISOString() }))}
        />
      }
    >
      {children}
    </AppShell>
  );
}
