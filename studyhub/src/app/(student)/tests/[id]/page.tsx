import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStudent } from "@/server/auth/guards";
import { getAttemptView } from "@/server/services/test-attempts";
import { idSchema } from "@/server/validation/common";
import { PageHeader } from "@/components/ui/page-header";
import { TestRunner } from "@/components/student/test-runner";

export const metadata: Metadata = { title: "Test" };

export default async function StudentTestPage({ params }: PageProps<"/tests/[id]">) {
  const user = await requireStudent();
  const { id } = await params;
  const view = idSchema.safeParse(id).success ? await getAttemptView(user, id) : ({ access: "not-found" } as const);
  // A test the student cannot see behaves exactly like one that does not exist — it never confirms which.
  if (view.access !== "ok") notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={view.title}
        description={`${view.subjectName} · ${view.courseName}`}
        crumbs={[{ label: "Tests", href: "/tests" }, { label: view.title }]}
      />
      <TestRunner initial={view} />
    </div>
  );
}
