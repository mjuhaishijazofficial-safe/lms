"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormState } from "@/server/action-result";
import type { PickerTree } from "@/server/services/materials";
import type { TestQuestion } from "@/lib/test";
import { createTestAction, updateTestAction } from "@/app/admin/tests/actions";
import { Alert } from "@/components/ui/notice";
import { Field, invalid } from "@/components/ui/field";
import { STATUS_OPTIONS } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { SubjectFieldPicker } from "./subject-field-picker";
import { ScheduleField } from "./schedule-field";
import { TestQuestionsEditor } from "./test-questions-editor";

type Initial = { id: string; subjectId: string; title: string; description: string; durationMinutes: number; status: string; publishAt: string | null };

export function TestForm({ test, tree, questions, attemptCount }: {
  test?: Initial; tree: PickerTree; questions: TestQuestion[]; attemptCount?: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(test ? updateTestAction : createTestAction, {});
  const v = (k: keyof Initial, fallback = "") => state.values?.[k] ?? test?.[k]?.toString() ?? fallback;
  const e = state.fieldErrors ?? {};
  const [status, setStatus] = useState(v("status", "DRAFT"));

  return (
    <form action={action} className="space-y-6">
      {test && <input type="hidden" name="id" value={test.id} />}

      <div className="card max-w-2xl space-y-5 p-6 sm:p-8">
        {state.error && <Alert tone="error">{state.error}</Alert>}
        {!!attemptCount && (
          <div className="rounded-xl bg-page p-4 text-sm text-muted" role="status">
            {attemptCount} student{attemptCount === 1 ? " has" : "s have"} already attempted this test. Changing the questions won&apos;t change scores already given.
          </div>
        )}

        <SubjectFieldPicker tree={tree} initialSubjectId={v("subjectId")} error={e.subjectId} />

        <Field id="title" label="Title" required error={e.title}>
          <input id="title" name="title" defaultValue={v("title")} required maxLength={160} className={`input ${invalid(e.title)}`} placeholder="Week 3 test" />
        </Field>
        <Field id="description" label="Description" error={e.description} hint="Shown to students before they start.">
          <textarea id="description" name="description" defaultValue={v("description")} maxLength={500} className={`textarea ${invalid(e.description)}`} />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="durationMinutes" label="Time limit (minutes)" required error={e.durationMinutes} hint="Students are auto-submitted when time runs out.">
            <input id="durationMinutes" name="durationMinutes" type="number" min={1} max={300} defaultValue={v("durationMinutes", "20")} required className={`input ${invalid(e.durationMinutes)}`} />
          </Field>
          <Field id="status" label="Status" error={e.status}>
            <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="select">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <ScheduleField status={status} initial={state.values?.publishAt ?? test?.publishAt} error={e.publishAt} />
      </div>

      <div className="card max-w-2xl space-y-4 p-6 sm:p-8">
        <div>
          <h2 className="font-semibold">Questions</h2>
          <p className="mt-1 text-sm text-muted">Each student gets one attempt and sees their score right after submitting.</p>
        </div>
        <TestQuestionsEditor initial={questions} />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">{test ? "Save changes" : "Create test"}</SubmitButton>
        <Link href="/admin/tests" className="btn-outline">Cancel</Link>
      </div>
    </form>
  );
}
