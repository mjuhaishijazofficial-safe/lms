import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, Trash2 } from "lucide-react";
import { getTest } from "@/server/services/tests";
import { chapterPickerTree } from "@/server/services/materials";
import { testQuestionsSchema } from "@/lib/test";
import { idSchema } from "@/server/validation/common";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TestForm } from "@/components/admin/test-form";
import { deleteTestAction } from "../actions";

export const metadata: Metadata = { title: "Edit test" };

export default async function EditTestPage({ params, searchParams }: PageProps<"/admin/tests/[id]">) {
  const { id } = await params;
  const valid = idSchema.safeParse(id).success;
  const [test, tree] = await Promise.all([valid ? getTest(id) : null, chapterPickerTree()]);
  if (!test) notFound();

  const parsedQuestions = testQuestionsSchema.safeParse(test.questions);
  const attemptCount = test._count.attempts;

  return (
    <>
      <PageHeader
        title={test.title}
        crumbs={[{ label: "Tests", href: "/admin/tests" }, { label: test.title }]}
        actions={
          <>
            {attemptCount > 0 && (
              <Link href={`/admin/tests/${test.id}/results`} className="btn-outline">
                <BarChart3 className="size-4.5" aria-hidden /> Results ({attemptCount})
              </Link>
            )}
            <ConfirmDialog
              trigger={<><Trash2 className="size-4.5" aria-hidden /> Delete</>}
              triggerClassName="btn-outline hover:!border-red-300 hover:!text-red-600"
              title={`Delete "${test.title}"?`}
              description={attemptCount > 0 ? "Students have already attempted this test; deleting it removes their results too. This can't be undone." : "This can't be undone."}
              confirmLabel="Delete test"
              action={deleteTestAction}
              fields={{ id: test.id, returnTo: "/admin/tests" }}
            />
          </>
        }
      />
      <Notice searchParams={await searchParams} />
      <TestForm
        tree={tree}
        questions={parsedQuestions.success ? parsedQuestions.data : []}
        attemptCount={attemptCount}
        test={{
          id: test.id, subjectId: test.subjectId, title: test.title, description: test.description,
          durationMinutes: test.durationMinutes, status: test.status,
        }}
      />
    </>
  );
}
