"use client";

import { useActionState } from "react";
import type { FormState } from "@/server/action-result";
import { createAdminAction } from "@/app/admin/admins/actions";
import { Alert } from "@/components/ui/notice";
import { Field, invalid } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function AdminForm() {
  const [state, action] = useActionState<FormState, FormData>(createAdminAction, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="card max-w-2xl space-y-5 p-6 sm:p-8" noValidate>
      <div>
        <h2 className="text-lg font-semibold">Add an admin</h2>
        <p className="mt-1 text-sm text-muted">Admins can manage students, programs and study material. Share the temporary password with them; they choose their own at first sign-in.</p>
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field id="admin-name" label="Full name" required error={e.name}>
        <input id="admin-name" name="name" defaultValue={state.values?.name ?? ""} required maxLength={120} autoComplete="off" className={`input ${invalid(e.name)}`} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="admin-email" label="Email or username" required error={e.email} hint="What they type to sign in.">
          <input id="admin-email" name="email" defaultValue={state.values?.email ?? ""} required autoComplete="off" className={`input ${invalid(e.email)}`} />
        </Field>
        <Field id="admin-password" label="Temporary password" required error={e.password}>
          <input id="admin-password" name="password" type="text" required minLength={8} autoComplete="new-password" className={`input font-mono ${invalid(e.password)}`} />
        </Field>
      </div>
      <SubmitButton pendingText="Creating…">Create admin</SubmitButton>
    </form>
  );
}
