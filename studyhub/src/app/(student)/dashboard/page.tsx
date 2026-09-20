import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarRange, FileText, Layers, TrendingUp } from "lucide-react";
import { requireStudent } from "@/server/auth/guards";
import { listRecentMaterials, loadLibrary } from "@/server/services/library";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { Notice } from "@/components/ui/notice";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubjectCard } from "@/components/student/subject-card";
import { RecentMaterialCard } from "@/components/student/recent-material-card";

export const metadata: Metadata = { title: "Dashboard" };

function SectionHeading({ title, note, href, label }: { title: string; note?: string; href?: string; label?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-xl font-semibold">{title}{note && <span className="ml-2 text-base font-normal text-muted">{note}</span>}</h2>
      {href && <Link href={href} className="text-sm font-medium text-primary hover:underline">{label ?? "View all"}</Link>}
    </div>
  );
}

export default async function StudentDashboard({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireStudent();
  const [library, recent] = await Promise.all([loadLibrary(user.id), listRecentMaterials(user.id, 1, 5)]);
  const course = library.courses[0];
  const current = course?.currentSemester ?? null;
  // The dashboard puts this semester's subjects first; earlier semesters are one click away on the Subjects page.
  const focus = (course?.subjects ?? []).filter((s) => !current || !s.semester || s.semester.id === current.id);
  const earlier = (course?.subjects.length ?? 0) - focus.length;
  const { progress } = library;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Hi, {user.name.split(" ")[0]}!</h1>
        <p className="mt-1 text-muted">Keep learning, keep growing.</p>
      </header>
      <Notice searchParams={await searchParams} />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarRange} tile="bg-tile-blue text-primary" label={TERMS.semester} value={current?.name ?? "—"}
          hint={course?.name} href={course ? `/courses/${course.id}` : undefined}
        />
        <StatCard icon={BookOpen} tile="bg-tile-blue text-primary" label="Subjects" value={library.subjectCount} hint={earlier > 0 ? `incl. ${earlier} earlier` : undefined} href="/subjects" />
        <StatCard icon={FileText} tile="bg-tile-blue text-primary" label="Total Materials" value={library.materialCount} href="/recent" />
        <StatCard
          icon={TrendingUp} tile="bg-tile-blue text-primary" label="Your progress" value={`${progress.percent}%`}
          hint={progress.totalChapters === 0 ? "Nothing to study yet" : progress.completedChapters === 0 ? "Start with any chapter" : `${plural(progress.completedChapters, "chapter")} completed. Keep going!`}
        />
      </div>

      <section className="mt-9">
        <SectionHeading title="My subjects" note={current?.name} href={library.subjectCount ? "/subjects" : undefined} label={earlier > 0 ? `View all, including earlier ${TERMS.semesters.toLowerCase()}` : "View all"} />
        {focus.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Layers}
              title={library.courses.length === 0 ? `You haven't been assigned to a ${TERMS.programLower} yet.` : "No subjects have been added yet."}
              description={library.courses.length === 0 ? "Please contact your admin." : "Your subjects will appear here once your admin adds them."}
            />
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {focus.slice(0, 6).map((s) => <SubjectCard key={s.id} subject={s} />)}
          </div>
        )}
      </section>

      <section className="mt-9">
        <SectionHeading title="Recently added" href={recent.total ? "/recent" : undefined} />
        {recent.rows.length === 0 ? (
          <div className="card">
            <EmptyState icon={FileText} title="No study material has been added yet." description="New material will show up here as soon as your admin adds it." />
          </div>
        ) : (
          <div className="space-y-3">
            {recent.rows.map((m) => <RecentMaterialCard key={m.id} material={m} />)}
          </div>
        )}
      </section>
    </>
  );
}
