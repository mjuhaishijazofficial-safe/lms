"use client";

import { useActionState } from "react";
import { Loader2, Lock, Mail } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink">Email or username</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            id="email" name="email" type="text" autoComplete="username" required autoFocus
            defaultValue={state.email}
            className="input pl-10"
            placeholder="you@school.com"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink">Password</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input pl-10" />
        </div>
      </div>

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
