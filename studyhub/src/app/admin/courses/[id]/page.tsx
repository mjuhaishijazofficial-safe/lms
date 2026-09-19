import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse } from "@/server/services/courses";
import { listSemesters } from "@/server/services/semesters";
import { idSchema } from "@/server/validation/common";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { CourseForm } from "@/components/admin/course-form";
import { SemesterManager } from "@/components/admin/semester-manager";

export const metadata: Metadata = { title: `Edit ${TERMS.programLower}` };

export default async function EditCoursePage({ params, searchParams }: PageProps<"/admin/courses/[id]">) {
  const { id } = await params;
  const valid = idSchema.safeParse(id).success;
  const [course, semesters] = await Promise.all([valid ? getCourse(id) : null, valid ? listSemesters(id) : []]);
  if (!course) notFound();

  return (
    <>
      <PageHeader
        title={course.name}
        description={`${plural(semesters.length, TERMS.semesterLower)} · ${plural(course._count.subjects, "subject")} · ${plural(course._count.enrollments, "student")}`}
        crumbs={[{ label: TERMS.programs, href: "/admin/courses" }, { label: course.name }]}
        actions={
          <>
            <Link href={`/admin/subjects?course=${course.id}`} className="btn-outline">View subjects</Link>
            <Link href={`/admin/students?course=${course.id}`} className="btn-outline">View students</Link>
          </>
        }
      />
      <Notice searchParams={await searchParams} />
      <div className="space-y-6">
        <CourseForm course={{ id: course.id, name: course.name, description: course.description, status: course.status }} />
        <SemesterManager courseId={course.id} courseName={course.name} semesters={semesters} />
      </div>
    </>
  );
}
