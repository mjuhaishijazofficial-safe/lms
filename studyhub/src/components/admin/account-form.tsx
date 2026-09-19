"use client";

import { useActionState } from "react";
import type { FormState } from "@/server/action-result";
import { updateAccountAction } from "@/app/admin/settings/actions";
import { Alert } from "@/components/ui/notice";
import { Field, invalid } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function AccountForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState<FormState, FormData>(updateAccountAction, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="card max-w-2xl space-y-5 p-6 sm:p-8" noValidate>
      <h2 className="text-lg font-semibold">Account</h2>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field id="name" label="Name" required error={e.name}>
        <input id="name" name="name" defaultValue={state.values?.name ?? name} required maxLength={120} className={`input ${invalid(e.name)}`} />
      </Field>
      <Field id="email" label="Sign-in email" hint="Contact your developer to change this.">
        <input id="email" value={email} readOnly disabled className="input bg-page text-muted" />
      </Field>
      <SubmitButton pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}
