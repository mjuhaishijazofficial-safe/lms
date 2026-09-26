import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getCourse } from "@/server/services/courses";
import { idSchema } from "@/server/validation/common";
import { TERMS } from "@/lib/terms";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CourseForm } from "@/components/admin/course-form";
import { deleteCourseAction } from "../../actions";

export const metadata: Metadata = { title: `Edit ${TERMS.programLower}` };

export default async function EditProgramPage({ params, searchParams }: PageProps<"/admin/courses/[id]/edit">) {
  const { id } = await params;
  const course = idSchema.safeParse(id).success ? await getCourse(id) : null;
  if (!course) notFound();
  const empty = !course._count.subjects && !course._count.enrollments;

  return (
    <>
      <PageHeader
        title={`Edit ${course.name}`}
        crumbs={[{ label: TERMS.programs, href: "/admin/courses" }, { label: course.name, href: `/admin/courses/${course.id}` }, { label: "Edit" }]}
      />
      <Notice searchParams={await searchParams} />
      <div className="max-w-2xl space-y-6">
        <CourseForm course={{ id: course.id, name: course.name, description: course.description, status: course.status }} />

        <section className="card p-6 sm:p-8" aria-labelledby="delete-h">
          <h2 id="delete-h" className="font-semibold">Delete this {TERMS.programLower}</h2>
          <p className="mt-1 text-sm text-muted">
            {empty
              ? `It has no courses and no students, so it can be deleted.`
              : `It still has courses or students, so it can't be deleted. To hide it from students instead, set its status to Archived above.`}
          </p>
          {empty && (
            <div className="mt-4">
              <ConfirmDialog
                trigger={<><Trash2 className="size-4" aria-hidden /> Delete {TERMS.programLower}</>}
                triggerClassName="btn-outline-danger"
                title={`Delete “${course.name}”?`}
                description={<>Its {TERMS.semesters.toLowerCase()} are deleted with it. This can&apos;t be undone.</>}
                confirmLabel="Delete"
                action={deleteCourseAction}
                fields={{ id: course.id, returnTo: "/admin/courses" }}
              />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
