import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, FileText, GraduationCap, Layers, ListOrdered, UserCheck, Users } from "lucide-react";
import { getAdminStats, recentlyModified, recentStudents, recentUploads } from "@/server/services/dashboard";
import { requireAdmin } from "@/server/auth/guards";
import { MATERIAL_TYPES } from "@/lib/material-types";
import { timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTile } from "@/components/ui/icon-tile";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Notice } from "@/components/ui/notice";
import { TERMS } from "@/lib/terms";

export const metadata: Metadata = { title: "Admin dashboard" };

function Panel({ title, href, hrefLabel, children }: { title: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col">
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {href && <Link href={href} className="text-sm font-medium text-primary hover:underline">{hrefLabel ?? "View all"}</Link>}
      </div>
      <div className="flex-1 p-2 pt-3">{children}</div>
    </section>
  );
}

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const user = await requireAdmin();
  const [stats, students, uploads, modified] = await Promise.all([getAdminStats(), recentStudents(), recentUploads(), recentlyModified()]);

  return (
    <>
      <PageHeader title={`Hi, ${user.name}!`} description="Here's what's in your study library." />
      <Notice searchParams={await searchParams} />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Users} tile="bg-tile-blue text-primary" label="Total students" value={stats.students} href="/admin/students" />
        <StatCard icon={UserCheck} tile="bg-tile-blue text-primary" label="Active students" value={stats.activeStudents} hint={stats.students ? `${stats.students - stats.activeStudents} inactive` : undefined} href="/admin/students?status=ACTIVE" />
        <StatCard icon={GraduationCap} tile="bg-tile-blue text-primary" label={TERMS.programs} value={stats.courses} href="/admin/courses" />
        <StatCard icon={Layers} tile="bg-tile-blue text-primary" label="Subjects" value={stats.subjects} href="/admin/subjects" />
        <StatCard icon={ListOrdered} tile="bg-sky-100 text-sky-600" label="Chapters" value={stats.chapters} href="/admin/chapters" />
        <StatCard icon={FileText} tile="bg-tile-blue text-primary" label="Study materials" value={stats.materials} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <Panel title="Recent uploads">
          {uploads.length === 0 ? (
            <EmptyState icon={FileText} title="No study material yet" description="Materials you add will show up here." />
          ) : (
            <ul>
              {uploads.map((m) => {
                const t = MATERIAL_TYPES[m.type];
                return (
                  <li key={m.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                    <IconTile icon={t.icon} size="sm" className={t.tile} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.title}</p>
                      <p className="truncate text-sm text-muted">{m.chapter.subject.name} · {m.chapter.title}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(m.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Recently added students" href="/admin/students">
          {students.length === 0 ? (
            <EmptyState icon={Users} title="No students yet" description="Add your first student to get started." action={<Link href="/admin/students/new" className="btn-primary">Add student</Link>} />
          ) : (
            <ul>
              {students.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/students/${s.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-page">
                    <Avatar name={s.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="truncate text-sm text-muted">{s.enrollments[0] ? [s.enrollments[0].course.name, s.enrollments[0].semester?.name].filter(Boolean).join(" · ") : `No ${TERMS.programLower} assigned`}</p>
                    </div>
                    <StatusBadge status={s.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recently modified">
          {modified.length === 0 ? (
            <EmptyState icon={BookOpen} title="Nothing here yet" description={`${TERMS.programs}, subjects and chapters you edit will appear here.`} />
          ) : (
            <ul>
              {modified.map((m) => (
                <li key={`${m.kind}-${m.id}`}>
                  <Link href={m.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-page">
                    <span className="w-20 shrink-0 rounded-md bg-page px-2 py-0.5 text-center text-xs font-medium text-muted">{m.kind}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.name}</p>
                      <p className="truncate text-sm text-muted">{m.context}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(m.updatedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
