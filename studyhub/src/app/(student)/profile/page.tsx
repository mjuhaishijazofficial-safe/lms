import type { Metadata } from "next";
import { requireStudent } from "@/server/auth/guards";
import { getStudentProfile } from "@/server/services/library";
import { formatDate } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Notice } from "@/components/ui/notice";
import { ChangePasswordForm } from "@/components/forms/change-password-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const user = await requireStudent();
  const profile = await getStudentProfile(user.id);

  const rows: [string, string][] = [
    ["Name", profile?.name ?? user.name],
    ["Sign-in", profile?.email ?? user.email],
    ["Student ID", profile?.studentProfile?.studentId ?? "—"],
    [TERMS.program, profile?.enrollments[0]?.course.name ?? "Not assigned yet"],
    [TERMS.semester, profile?.enrollments[0]?.semester?.name ?? "—"],
    ["Member since", profile ? formatDate(profile.createdAt) : "—"],
  ];

  return (
    <>
      <PageHeader title="Profile" description="Your details. Ask your admin if anything needs changing." />
      <Notice searchParams={await searchParams} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="card p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-4">
            <Avatar name={user.name} size="lg" />
            <div>
              <p className="text-xl font-semibold">{user.name}</p>
              <p className="text-muted">Student</p>
            </div>
          </div>
          <dl className="divide-y divide-line">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-3">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="card p-6 sm:p-8">
          <h2 className="mb-1 text-lg font-semibold">Change password</h2>
          <p className="mb-5 text-sm text-muted">You&apos;ll stay signed in here; other devices are signed out.</p>
          <ChangePasswordForm />
        </section>
      </div>
    </>
  );
}
