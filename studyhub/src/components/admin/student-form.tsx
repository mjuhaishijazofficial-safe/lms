"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/server/action-result";
import type { SemesterTree } from "@/server/services/semesters";
import { createStudentAction, resetStudentPasswordAction, updateStudentAction } from "@/app/admin/students/actions";
import { TERMS } from "@/lib/terms";
import { Alert } from "@/components/ui/notice";
import { Field, invalid } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProgramSemesterFields } from "./program-semester-fields";

type Initial = { id: string; name: string; email: string; studentId: string; courseId: string; semesterId: string; status: string };

export function StudentForm({ student, tree }: { student?: Initial; tree: SemesterTree }) {
  const [state, action] = useActionState<FormState, FormData>(student ? updateStudentAction : createStudentAction, {});
  const v = (k: keyof Initial, fallback = "") => state.values?.[k] ?? student?.[k] ?? fallback;
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="card max-w-2xl space-y-5 p-6 sm:p-8" noValidate>
      {student && <input type="hidden" name="id" value={student.id} />}
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <Field id="name" label="Full name" required error={e.name}>
        <input id="name" name="name" defaultValue={v("name")} required maxLength={120} autoComplete="off" className={`input ${invalid(e.name)}`} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="email" label="Email or username" required error={e.email} hint="What the student types to sign in.">
          <input id="email" name="email" defaultValue={v("email")} required autoComplete="off" className={`input ${invalid(e.email)}`} />
        </Field>
        <Field id="studentId" label="Student ID / roll number" error={e.studentId} hint="Optional.">
          <input id="studentId" name="studentId" defaultValue={v("studentId")} maxLength={40} className={`input ${invalid(e.studentId)}`} />
        </Field>
      </div>

      <ProgramSemesterFields
        tree={tree} errors={e}
        courseId={v("courseId")} semesterId={v("semesterId")}
        noProgramLabel="Not assigned yet" noSemesterLabel={`First ${TERMS.semesterLower} (default)`}
        semesterHint={`The ${TERMS.semesterLower} the student is in now. They see its subjects and earlier ones.`}
      />

      <Field id="status" label="Status" error={e.status}>
        <select id="status" name="status" defaultValue={v("status", "ACTIVE")} className="select">
          <option value="ACTIVE">Active — can sign in</option>
          <option value="INACTIVE">Inactive — cannot sign in</option>
        </select>
      </Field>

      {!student && (
        <Field id="password" label="Temporary password" required error={e.password} hint="Share this with the student. They must choose their own password when they first sign in.">
          <input id="password" name="password" type="text" required minLength={8} autoComplete="new-password" className={`input font-mono ${invalid(e.password)}`} />
        </Field>
      )}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton pendingText="Saving…">{student ? "Save changes" : "Create student"}</SubmitButton>
        <Link href="/admin/students" className="btn-outline">Cancel</Link>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ studentId }: { studentId: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetStudentPasswordAction, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="card max-w-2xl space-y-5 p-6 sm:p-8" noValidate>
      <input type="hidden" name="id" value={studentId} />
      <div>
        <h2 className="text-lg font-semibold">Reset password</h2>
        <p className="mt-1 text-sm text-muted">Sets a temporary password, signs the student out everywhere, and makes them choose a new password at next sign-in.</p>
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="reset-password" label="Temporary password" required error={e.password}>
          <input id="reset-password" name="password" type="text" required minLength={8} autoComplete="new-password" className={`input font-mono ${invalid(e.password)}`} />
        </Field>
        <Field id="reset-confirm" label="Confirm" required error={e.confirm}>
          <input id="reset-confirm" name="confirm" type="text" required autoComplete="new-password" className={`input font-mono ${invalid(e.confirm)}`} />
        </Field>
      </div>
      <SubmitButton variant="soft" pendingText="Resetting…">Reset password</SubmitButton>
    </form>
  );
}
