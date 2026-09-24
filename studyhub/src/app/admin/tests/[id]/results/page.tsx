import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTest, testResults } from "@/server/services/tests";
import { questionCount } from "@/lib/test";
import { idSchema } from "@/server/validation/common";
import { formatDate, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableCard, Td, Th, Tr } from "@/components/ui/data-table";
import { BarChart3 } from "lucide-react";

export const metadata: Metadata = { title: "Test results" };

const minutes = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));

export default async function TestResultsPage({ params }: PageProps<"/admin/tests/[id]/results">) {
  const { id } = await params;
  const valid = idSchema.safeParse(id).success;
  const [test, attempts] = await Promise.all([valid ? getTest(id) : null, valid ? testResults(id) : []]);
  if (!test) notFound();

  const total = questionCount(test.questions);
  const submitted = attempts.filter((a) => a.submittedAt && a.score !== null);
  const average = submitted.length ? submitted.reduce((n, a) => n + (a.score ?? 0), 0) / submitted.length : null;

  return (
    <>
      <PageHeader
        title={`Results: ${test.title}`}
        description={`${test.subject.name} · ${test.durationMinutes} min · ${total} question${total === 1 ? "" : "s"}`}
        crumbs={[{ label: "Tests", href: "/admin/tests" }, { label: test.title, href: `/admin/tests/${test.id}` }, { label: "Results" }]}
      />

      {attempts.length === 0 ? (
        <div className="card">
          <EmptyState icon={BarChart3} title="No one has attempted this test yet" description="Results will appear here as soon as a student starts." />
        </div>
      ) : (
        <>
          {average !== null && (
            <p className="mb-4 text-sm text-muted">
              {submitted.length} of {attempts.length} student{attempts.length === 1 ? "" : "s"} finished · average score {average.toFixed(1)} / {total}
            </p>
          )}
          <TableCard>
            <Table caption="Test results">
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Score</Th>
                  <Th className="hidden md:table-cell">Time taken</Th>
                  <Th className="hidden md:table-cell">Started</Th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <Tr key={a.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={a.user.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{a.user.name}</p>
                          <p className="truncate text-muted">{a.user.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {a.submittedAt && a.score !== null ? (
                        <span className="font-semibold">{a.score} / {total}</span>
                      ) : <span className="text-muted">In progress…</span>}
                    </Td>
                    <Td className="hidden md:table-cell text-muted">
                      {a.submittedAt ? `${minutes(a.startedAt, a.submittedAt)} min` : "—"}
                    </Td>
                    <Td className="hidden whitespace-nowrap text-muted md:table-cell"><span title={formatDate(a.startedAt)}>{timeAgo(a.startedAt)}</span></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableCard>
        </>
      )}
    </>
  );
}
