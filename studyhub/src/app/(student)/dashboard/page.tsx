import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarRange, FileText, Layers, TrendingUp } from "lucide-react";
import { requireStudent } from "@/server/auth/guards";
import { listRecentMaterials, loadLibrary } from "@/server/services/library";
import { announcementsForStudent } from "@/server/services/announcements";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { Notice } from "@/components/ui/notice";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { AnnouncementsCard } from "@/components/student/announcements-card";
import { SubjectCard } from "@/components/student/subject-card";
import { RecentMaterialCard } from "@/components/student/recent-material-card";

export const metadata: Metadata = { title: "Dashboard" };

function SectionHeading({ title, note, href, label }: { title: string; note?: string; href?: string; label?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <h2 className="section-title">{title}{note && <span className="ml-2 text-sm font-normal text-muted">{note}</span>}</h2>
      {href && <Link href={href} className="link">{label ?? "View all"}<ArrowRight className="size-4" aria-hidden /></Link>}
    </div>
  );
}

export default async function StudentDashboard({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireStudent();
  const [library, recent, announcements] = await Promise.all([loadLibrary(user.id), listRecentMaterials(user.id, 1, 5), announcementsForStudent(user.id)]);
  const course = library.courses[0];
  const current = course?.currentSemester ?? null;
  // The dashboard puts this semester's subjects first; earlier semesters are one click away on the Subjects page.
  const focus = (course?.subjects ?? []).filter((s) => !current || !s.semester || s.semester.id === current.id);
  const earlier = (course?.subjects.length ?? 0) - focus.length;
  const { progress } = library;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">Hi, {user.name.split(" ")[0]}!</h1>
      </header>
      <Notice searchParams={await searchParams} />
      <AnnouncementsCard items={announcements} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarRange} tile="tile-blue" label={TERMS.semester} value={current?.name ?? "—"}
          hint={course?.name} href={course ? `/courses/${course.id}` : undefined}
        />
        <StatCard icon={BookOpen} tile="tile-amber" label="Subjects" value={library.subjectCount} hint={earlier > 0 ? `incl. ${earlier} earlier` : undefined} href="/subjects" />
        <StatCard icon={FileText} tile="tile-blue" label="Total Materials" value={library.materialCount} href="/recent" />
        <StatCard
          icon={TrendingUp} tile="tile-green" label="Your progress" value={`${progress.percent}%`}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          <div className="card divide-y divide-line">
            {recent.rows.map((m) => <RecentMaterialCard key={m.id} material={m} />)}
          </div>
        )}
      </section>
    </>
  );
}
