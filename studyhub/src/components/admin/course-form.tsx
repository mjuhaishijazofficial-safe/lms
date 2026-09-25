"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/server/action-result";
import { createCourseAction, updateCourseAction } from "@/app/admin/courses/actions";
import { Alert } from "@/components/ui/notice";
import { Field, invalid } from "@/components/ui/field";
import { STATUS_OPTIONS } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { TERMS } from "@/lib/terms";

type Initial = { id: string; name: string; description: string; status: string };

export function CourseForm({ course }: { course?: Initial }) {
  const [state, action] = useActionState<FormState, FormData>(course ? updateCourseAction : createCourseAction, {});
  const v = (k: keyof Initial, fallback = "") => state.values?.[k] ?? course?.[k] ?? fallback;
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="card max-w-2xl space-y-5 p-6 sm:p-8" noValidate>
      {!course && <p className="text-sm text-muted">Next you&apos;ll add its {TERMS.semesters.toLowerCase()} and courses, or fill them from Virtual University&apos;s scheme of study.</p>}
      {course && <input type="hidden" name="id" value={course.id} />}
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <Field id="name" label={`${TERMS.program} name`} required error={e.name} hint="For example BS Computer Science, MBA or FSc Pre-Engineering.">
        <input id="name" name="name" defaultValue={v("name")} required maxLength={80} className={`input ${invalid(e.name)}`} />
      </Field>
      <Field id="description" label="Description" error={e.description}>
        <textarea id="description" name="description" defaultValue={v("description")} maxLength={500} className={`textarea ${invalid(e.description)}`} />
      </Field>
      <Field id="status" label="Status" error={e.status}>
        <select id="status" name="status" defaultValue={v("status", "PUBLISHED")} className="select">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton pendingText="Saving…">{course ? "Save changes" : `Create ${TERMS.programLower}`}</SubmitButton>
        <Link href={course ? `/admin/courses/${course.id}` : "/admin/courses"} className="btn-outline">Cancel</Link>
      </div>
    </form>
  );
}
