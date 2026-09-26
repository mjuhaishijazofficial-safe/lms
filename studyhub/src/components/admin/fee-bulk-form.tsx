"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormState } from "@/server/action-result";
import { createFeesBulkAction } from "@/app/admin/fees/actions";
import { Alert } from "@/components/ui/notice";
import { Field, invalid } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { TERMS } from "@/lib/terms";

export function FeeBulkForm({ courses }: { courses: { id: string; name: string }[] }) {
  const [state, action] = useActionState<FormState, FormData>(createFeesBulkAction, {});
  const v = (k: string, fallback = "") => state.values?.[k] ?? fallback;
  const e = state.fieldErrors ?? {};
  const [target, setTarget] = useState(v("target", "all"));

  return (
    <form action={action} className="card max-w-2xl space-y-5 p-6 sm:p-8" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <Field id="target" label="Create this fee for" error={e.target}>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="target" value="all" checked={target === "all"} onChange={() => setTarget("all")} className="size-4 accent-[var(--color-primary)]" />
            Every active student
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="target" value="course" checked={target === "course"} onChange={() => setTarget("course")} className="size-4 accent-[var(--color-primary)]" />
            Students of one {TERMS.programLower}
          </label>
        </div>
      </Field>

      {target === "course" && (
        <Field id="courseId" label={TERMS.program} required error={e.courseId}>
          <select id="courseId" name="courseId" defaultValue={v("courseId")} required className={`select ${invalid(e.courseId)}`}>
            <option value="" disabled>Choose a {TERMS.programLower}…</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="amount" label="Amount" required error={e.amount} hint="In rupees, per student.">
          <input id="amount" name="amount" type="number" min={1} defaultValue={v("amount")} required className={`input ${invalid(e.amount)}`} placeholder="500" />
        </Field>
        <Field id="period" label="Period" required error={e.period} hint='e.g. "September 2026" or "Semester 1".'>
          <input id="period" name="period" defaultValue={v("period")} required maxLength={60} className={`input ${invalid(e.period)}`} placeholder="September 2026" />
        </Field>
      </div>

      <Field id="dueDate" label="Due date" error={e.dueDate} hint="Optional.">
        <input id="dueDate" name="dueDate" type="date" defaultValue={v("dueDate")} className={`input ${invalid(e.dueDate)}`} />
      </Field>
      <Field id="note" label="Note" error={e.note} hint="Optional — shown to the student alongside this fee.">
        <textarea id="note" name="note" defaultValue={v("note")} maxLength={300} className={`textarea ${invalid(e.note)}`} />
      </Field>

      <p className="text-sm text-muted">
        A student who already has a fee for this exact period is skipped, so this is safe to run again without double-charging anyone.
      </p>

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton pendingText="Creating…">Create fees</SubmitButton>
        <Link href="/admin/fees" className="btn-outline">Cancel</Link>
      </div>
    </form>
  );
}
