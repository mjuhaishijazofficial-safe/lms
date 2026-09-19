import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2, UserRoundCheck, UserRoundX } from "lucide-react";
import { semesterTree } from "@/server/services/semesters";
import { getStudent } from "@/server/services/students";
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
  const [student, tree] = await Promise.all([idSchema.safeParse(id).success ? getStudent(id) : null, semesterTree()]);
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
          student={{
            id: student.id, name: student.name, email: student.email, status: student.status,
            studentId: student.studentProfile?.studentId ?? "", courseId: student.enrollments[0]?.course.id ?? "", semesterId: student.enrollments[0]?.semester?.id ?? "",
          }}
        />
        <ResetPasswordForm studentId={student.id} />
      </div>
    </>
  );
}
