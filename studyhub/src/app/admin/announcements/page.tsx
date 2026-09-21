import type { Metadata } from "next";
import { Eye, EyeOff, Megaphone, Trash2 } from "lucide-react";
import { assertAdmin } from "@/server/auth/guards";
import { courseOptions } from "@/server/services/courses";
import { listAnnouncements } from "@/server/services/announcements";
import { timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AnnouncementForm } from "@/components/admin/announcement-form";
import { deleteAnnouncementAction, setAnnouncementActiveAction } from "./actions";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage({ searchParams }: PageProps<"/admin/announcements">) {
  const sp = await searchParams;
  const [items, courses] = await Promise.all([assertAdmin().then(listAnnouncements), courseOptions()]);

  return (
    <>
      <PageHeader title="Announcements" description="Messages that appear at the top of your students' dashboards." />
      <Notice searchParams={sp} />

      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon={Megaphone} title="No announcements yet." description="Post one below and students will see it the next time they open their dashboard." />
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="card flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{a.title}</h2>
                  <StatusBadge status={a.active ? "ACTIVE" : "INACTIVE"} />
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p>
                <p className="mt-2 text-xs text-muted">
                  {a.course ? `Only ${a.course.name} students` : "Every student"} · {timeAgo(a.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <form action={setAnnouncementActiveAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="active" value={a.active ? "false" : "true"} />
                  <button className="btn-ghost" aria-label={`${a.active ? "Hide" : "Show"} ${a.title}`}>
                    {a.active ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                    {a.active ? "Hide" : "Show"}
                  </button>
                </form>
                <ConfirmDialog
                  trigger={<><Trash2 className="size-4" aria-hidden /> Delete</>}
                  triggerClassName="btn-ghost hover:!text-red-600"
                  title="Delete this announcement?"
                  description="It is removed for everyone. To keep it for later, hide it instead."
                  confirmLabel="Delete announcement"
                  action={deleteAnnouncementAction}
                  fields={{ id: a.id }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8"><AnnouncementForm courses={courses} /></div>
    </>
  );
}
