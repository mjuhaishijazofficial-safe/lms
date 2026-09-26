import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { requireStudent } from "@/server/auth/guards";
import { loadLibrary } from "@/server/services/library";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTile } from "@/components/ui/icon-tile";
import { ProgressBar } from "@/components/student/progress-bar";

export const metadata: Metadata = { title: "My Courses" };

export default async function MyCoursesPage() {
  const user = await requireStudent();
  const { courses } = await loadLibrary(user.id);

  return (
    <>
      <PageHeader title="My Courses" />
      {courses.length === 0 ? (
        <div className="card">
          <EmptyState icon={GraduationCap} title={`You haven't been assigned to a ${TERMS.programLower} yet.`} description="Please contact your admin." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {courses.map((c) => (
            <Link key={c.id} href={`/courses/${c.id}`} className="group card block p-6 transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
              <div className="flex items-center gap-4">
                <IconTile icon={GraduationCap} size="lg" className="tile-blue" />
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold group-hover:text-primary">{c.name}</h2>
                  <p className="text-sm text-muted">
                    {c.currentSemester ? `${c.currentSemester.name} · ` : ""}{plural(c.subjectCount, "subject")} · {plural(c.materialCount, "material")}
                  </p>
                </div>
              </div>
              {c.description && <p className="mt-3 line-clamp-2 text-muted">{c.description}</p>}
              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-sm"><span className="text-muted">Progress</span><span className="font-medium">{c.progress.percent}%</span></div>
                <ProgressBar percent={c.progress.percent} label={`${c.name} progress`} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
