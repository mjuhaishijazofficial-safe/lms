import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser, homeFor } from "@/server/auth/guards";
import { Logo } from "@/components/layout/logo";
import { ChangePasswordForm } from "@/components/forms/change-password-form";
import { logoutAction } from "@/app/(auth)/login/actions";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  if (!user.mustChangePassword) redirect(homeFor(user));

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card p-8">
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="mt-1 mb-7 text-muted">Your admin set a temporary password. Pick your own to continue.</p>
          <ChangePasswordForm />
        </div>
        <form action={logoutAction} className="mt-6 text-center">
          <button className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">Sign out</button>
        </form>
      </div>
    </main>
  );
}
