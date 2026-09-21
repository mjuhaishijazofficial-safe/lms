import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2, UserRoundCheck, UserRoundX } from "lucide-react";
import { semesterTree } from "@/server/services/semesters";
import { getStudent, studentPresets } from "@/server/services/students";
import { studentView } from "@/server/services/student-view";
import { subjectCatalogue } from "@/server/services/subjects";
import { idSchema } from "@/server/validation/common";
import { formatDate, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ResetPasswordForm, StudentForm } from "@/components/admin/student-form";
import { deleteStudentAction, setStudentStatusAction } from "../actions";

export const metadata: Metadata = { title: "Edit student" };

export default async function EditStudentPage({ params, searchParams }: PageProps<"/admin/students/[id]">) {
  const { id } = await params;
  const valid = idSchema.safeParse(id).success;
  const [student, tree, catalogue, presets, view] = await Promise.all([
    valid ? getStudent(id) : null, semesterTree(), subjectCatalogue(), valid ? studentPresets(id) : [], valid ? studentView(id) : null,
  ]);
  if (!student) notFound();
  const active = student.status === "ACTIVE";
  const here = `/admin/students/${student.id}`;

  return (
    <>
      <PageHeader
        title={student.name}
        crumbs={[{ label: "Students", href: "/admin/students" }, { label: student.name }]}
        actions={
          <>
            <form action={setStudentStatusAction}>
              <input type="hidden" name="id" value={student.id} />
              <input type="hidden" name="status" value={active ? "INACTIVE" : "ACTIVE"} />
              <input type="hidden" name="returnTo" value={here} />
              <button className="btn-outline">
                {active ? <UserRoundX className="size-4.5" aria-hidden /> : <UserRoundCheck className="size-4.5" aria-hidden />}
                {active ? "Deactivate" : "Reactivate"}
              </button>
            </form>
            <ConfirmDialog
              trigger={<><Trash2 className="size-4.5" aria-hidden /> Delete</>}
              triggerClassName="btn-outline hover:!border-red-300 hover:!text-red-600"
              title={`Delete ${student.name}?`}
              description="Their account, bookmarks and progress are permanently removed. To keep the record, deactivate instead."
              confirmLabel="Delete student"
              action={deleteStudentAction}
              fields={{ id: student.id }}
            />
          </>
        }
      />
      <Notice searchParams={await searchParams} />

      <div className="card mb-6 flex max-w-2xl flex-wrap items-center gap-4 p-5">
        <Avatar name={student.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{student.name}</p>
          <p className="truncate text-sm text-muted">{student.email}</p>
        </div>
        <div className="text-right text-sm text-muted">
          <StatusBadge status={student.status} />
          <p className="mt-1.5">Added {formatDate(student.createdAt)}</p>
          <p>Last sign-in {student.lastLoginAt ? timeAgo(student.lastLoginAt) : "never"}</p>
        </div>
      </div>

      <div className="space-y-6">
        <StudentForm
          tree={tree}
          catalogue={catalogue}
          presets={presets}
          subjectIds={student.studentSubjects.map((s) => s.subjectId)}
          student={{
            id: student.id, name: student.name, email: student.email, status: student.status,
            studentId: student.studentProfile?.studentId ?? "", courseId: student.enrollments[0]?.course.id ?? "", semesterId: student.enrollments[0]?.semester?.id ?? "",
          }}
        />
        <ResetPasswordForm studentId={student.id} />

        <section className="card max-w-2xl p-5">
          <h2 className="font-semibold">What {student.name} sees</h2>
          <p className="mt-1 text-sm text-muted">
            {!active
              ? "This student is deactivated, so they can see nothing."
              : view && view.subjects.length > 0
                ? view.usesPicked ? "Only the subjects you picked for them." : "Subjects from their semester (no subjects picked). Published content only."
                : "Nothing yet. Pick subjects above, or check that their program, semester and content are published."}
          </p>
          {active && view?.subjects.map((s) => (
            <details key={s.id} className="mt-3 rounded-lg border border-line p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {s.name}
                <span className="ml-2 font-normal text-muted">
                  {s.semester ? `${s.semester} · ` : ""}{s.picked ? "picked · " : ""}{s.chapters.length} chapters · {s.materialCount} materials
                </span>
              </summary>
              <ul className="mt-2 space-y-2 text-sm">
                {s.chapters.map((c) => (
                  <li key={c.id}>
                    <p className="font-medium">{c.title}</p>
                    <ul className="ml-4 list-disc text-muted">
                      {c.materials.map((m) => <li key={m.id}>{m.title} <span className="text-xs">({m.type.toLowerCase()})</span></li>)}
                      {c.materials.length === 0 && <li>No published materials</li>}
                    </ul>
                  </li>
                ))}
                {s.chapters.length === 0 && <li className="text-muted">No published chapters</li>}
              </ul>
            </details>
          ))}
        </section>
      </div>
    </>
  );
}
