"use client";

import { useActionState } from "react";
import type { FormState } from "@/server/action-result";
import { createAnnouncementAction } from "@/app/admin/announcements/actions";
import { Alert } from "@/components/ui/notice";
import { Field, invalid } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function AnnouncementForm({ courses }: { courses: { id: string; name: string }[] }) {
  const [state, action] = useActionState<FormState, FormData>(createAnnouncementAction, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="card max-w-2xl space-y-5 p-6 sm:p-8" noValidate>
      <div>
        <h2 className="text-lg font-semibold">Post an announcement</h2>
        <p className="mt-1 text-sm text-muted">It appears at the top of the student dashboard until you hide or delete it.</p>
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field id="ann-title" label="Title" required error={e.title}>
        <input id="ann-title" name="title" defaultValue={state.values?.title ?? ""} required maxLength={120} placeholder="Mid-term schedule announced" className={`input ${invalid(e.title)}`} />
      </Field>
      <Field id="ann-body" label="Message" required error={e.body} hint="Plain text. Line breaks are kept.">
        <textarea id="ann-body" name="body" defaultValue={state.values?.body ?? ""} required maxLength={2000} rows={5} className={`textarea ${invalid(e.body)}`} />
      </Field>
      <Field id="ann-course" label="Who sees it" error={e.courseId}>
        <select id="ann-course" name="courseId" defaultValue={state.values?.courseId ?? ""} className="select">
          <option value="">Every student</option>
          {courses.map((c) => <option key={c.id} value={c.id}>Only {c.name} students</option>)}
        </select>
      </Field>
      <SubmitButton pendingText="Posting…">Post announcement</SubmitButton>
    </form>
  );
}
