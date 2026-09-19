import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { requireStudent } from "@/server/auth/guards";
import { groupBySemester, loadLibrary } from "@/server/services/library";
import { idSchema } from "@/server/validation/common";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressCard } from "@/components/student/progress-bar";
import { SemesterGroup } from "@/components/student/semester-group";

export const metadata: Metadata = { title: TERMS.program };

export default async function CoursePage({ params }: PageProps<"/courses/[id]">) {
  const user = await requireStudent();
  const { id } = await params;
  const { courses } = await loadLibrary(user.id);
  const course = idSchema.safeParse(id).success ? courses.find((c) => c.id === id) : undefined;
  if (!course) notFound();
  const groups = groupBySemester(course.subjects, course.currentSemester?.id);
  const summary = [course.currentSemester ? `Now in ${course.currentSemester.name}` : null, plural(course.subjectCount, "subject"), plural(course.materialCount, "material")].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        title={course.name}
        description={course.description ? `${course.description} — ${summary}` : summary}
        crumbs={[{ label: "My Courses", href: "/courses" }, { label: course.name }]}
        actions={<ProgressCard progress={course.progress} title={`${TERMS.program} progress`} />}
      />
      {groups.length === 0 ? (
        <div className="card">
          <EmptyState icon={Layers} title="No subjects have been added yet." description="Your subjects will appear here once your admin adds them." />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g, i) => <SemesterGroup key={g.key} group={g} defaultOpen={g.current || i === 0} />)}
        </div>
      )}
    </>
  );
}
