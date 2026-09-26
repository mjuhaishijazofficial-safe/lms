import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/guards";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { AccountForm } from "@/components/admin/account-form";
import { ChangePasswordForm } from "@/components/forms/change-password-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  const user = await requireAdmin();
  return (
    <>
      <PageHeader title="Settings" />
      <Notice searchParams={await searchParams} />
      <div className="space-y-6">
        <AccountForm name={user.name} email={user.email} />
        <section className="card max-w-2xl p-6 sm:p-8">
          <h2 className="mb-1 text-lg font-semibold">Change password</h2>
          <p className="mb-5 text-sm text-muted">You&apos;ll stay signed in here; other devices are signed out.</p>
          <ChangePasswordForm />
        </section>
      </div>
    </>
  );
}
