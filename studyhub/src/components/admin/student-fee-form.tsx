"use client";

import { useActionState } from "react";
import type { FormState } from "@/server/action-result";
import { createFeeAction } from "@/app/admin/fees/actions";
import { Alert } from "@/components/ui/notice";
import { Field, invalid } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

/** Adds one fee for this one student — the bulk generator on /admin/fees/new is for charging many at once. */
export function StudentFeeForm({ studentId }: { studentId: string }) {
  const [state, action] = useActionState<FormState, FormData>(createFeeAction, {});
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4 border-t border-line pt-4">
      <input type="hidden" name="userId" value={studentId} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="amount" label="Amount" required error={e.amount}>
          <input id="amount" name="amount" type="number" min={1} defaultValue={state.values?.amount} required className={`input ${invalid(e.amount)}`} placeholder="500" />
        </Field>
        <Field id="period" label="Period" required error={e.period} hint='e.g. "September 2026".'>
          <input id="period" name="period" defaultValue={state.values?.period} required maxLength={60} className={`input ${invalid(e.period)}`} />
        </Field>
        <Field id="dueDate" label="Due date" error={e.dueDate} hint="Optional.">
          <input id="dueDate" name="dueDate" type="date" defaultValue={state.values?.dueDate} className={`input ${invalid(e.dueDate)}`} />
        </Field>
        <Field id="note" label="Note" error={e.note} hint="Optional.">
          <input id="note" name="note" defaultValue={state.values?.note} maxLength={300} className={`input ${invalid(e.note)}`} />
        </Field>
      </div>
      <SubmitButton variant="soft" pendingText="Adding…">Add fee</SubmitButton>
    </form>
  );
}
