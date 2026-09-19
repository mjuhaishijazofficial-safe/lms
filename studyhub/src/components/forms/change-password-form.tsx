"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/(auth)/change-password/actions";
import type { FormState } from "@/server/action-result";
import { Alert } from "@/components/ui/notice";
import { Field, invalid } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function ChangePasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field id="current" label="Current password" required error={e.current}>
        <input id="current" name="current" type="password" autoComplete="current-password" required className={`input ${invalid(e.current)}`} />
      </Field>
      <Field id="password" label="New password" required hint="At least 8 characters." error={e.password}>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={`input ${invalid(e.password)}`} />
      </Field>
      <Field id="confirm" label="Confirm new password" required error={e.confirm}>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className={`input ${invalid(e.confirm)}`} />
      </Field>
      <SubmitButton pendingText="Saving…">Change password</SubmitButton>
    </form>
  );
}
