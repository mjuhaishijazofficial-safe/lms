import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { courseOptions } from "@/server/services/courses";
import { subjectOptions } from "@/server/services/subjects";
import { listTests } from "@/server/services/tests";
import { PAGE_SIZE } from "@/server/services/_shared";
import { idParam, one, pageParam } from "@/lib/params";
import { questionCount } from "@/lib/test";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTile } from "@/components/ui/icon-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { effectiveStatus } from "@/lib/schedule";
import { formatDateTime } from "@/lib/format";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableCard, Td, Th, Tr } from "@/components/ui/data-table";
import { FilterBar, FilterSelect } from "@/components/admin/filter-bar";
import { RowActions } from "@/components/admin/row-actions";
import { deleteTestAction, setTestStatusAction } from "./actions";
import { TERMS } from "@/lib/terms";

export const metadata: Metadata = { title: "Tests" };

export default async function TestsPage({ searchParams }: PageProps<"/admin/tests">) {
  const sp = await searchParams;
  const courseId = idParam(sp, "course");
  const subjectId = idParam(sp, "subject");
  const q = one(sp, "q");
  const statusRaw = one(sp, "status");
  const status = statusRaw === "DRAFT" || statusRaw === "PUBLISHED" || statusRaw === "ARCHIVED" ? statusRaw : undefined;
  const page = pageParam(sp);

  const [courses, subjectGroups, { items, total }] = await Promise.all([
    courseOptions(), subjectOptions(), listTests({ courseId, subjectId, status, q, page }),
  ]);
  const filtered = !!(courseId || subjectId || status || q);
  const params = { course: courseId, subject: subjectId, status, q };
  const hasSubjects = subjectGroups.length > 0;

  return (
    <>
      <PageHeader
        title="Tests"
        actions={hasSubjects && <Link href="/admin/tests/new" className="btn-primary"><Plus className="size-4.5" aria-hidden /> New test</Link>}
      />
      <Notice searchParams={sp} />

      {!hasSubjects ? (
        <div className="card">
          <EmptyState icon={ListChecks} title="Create a subject first" description="Every test belongs to a subject, so add a program and a subject before writing a test."
            action={<Link href="/admin/subjects/new" className="btn-primary">Create a subject</Link>} />
        </div>
      ) : (
        <>
          <FilterBar basePath="/admin/tests" q={q} placeholder="Search tests…" active={filtered}>
            <FilterSelect name="course" label={TERMS.program} value={courseId}>
              <option value="">All {TERMS.programs.toLowerCase()}</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
            <FilterSelect name="subject" label="Subject" value={subjectId}>
              <option value="">All subjects</option>
              {subjectGroups.map((g) => (
                <optgroup key={g.courseId} label={g.course}>{g.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
              ))}
            </FilterSelect>
            <FilterSelect name="status" label="Status" value={status}>
              <option value="">Any status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </FilterSelect>
          </FilterBar>

          {items.length === 0 ? (
            <div className="card">
              <EmptyState icon={ListChecks} title={filtered ? "No tests match your filters." : "No tests yet."}
                description={filtered ? "Try a different search or clear the filters." : "Write your first test: a title, a time limit, and as many questions as you like."}
                action={!filtered && <Link href="/admin/tests/new" className="btn-primary">Write your first test</Link>} />
            </div>
          ) : (
            <TableCard footer={<Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/tests" params={params} />}>
              <Table caption="Tests" className="lg:min-w-200">
                <thead>
                  <tr>
                    <Th>Test</Th>
                    <Th className="hidden md:table-cell">Subject</Th>
                    <Th className="hidden md:table-cell">Duration</Th>
                    <Th className="hidden md:table-cell">Status</Th>
                    <Th className="hidden md:table-cell">Attempts</Th>
                    <Th className="hidden md:table-cell"><span className="sr-only">Actions</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => {
                    const count = questionCount(t.questions);
                    const actions = (
                      <RowActions
                        id={t.id} name={t.title} status={t.status} editHref={`/admin/tests/${t.id}`} returnTo="/admin/tests"
                        setStatus={setTestStatusAction} remove={deleteTestAction}
                        deleteHint={t._count.attempts > 0 ? "Students have already attempted this test; deleting removes their results too." : "This can't be undone."}
                      />
                    );
                    return (
                      <Tr key={t.id}>
                        <Td className="md:min-w-64">
                          <div className="flex items-center gap-3">
                            <IconTile icon={ListChecks} size="sm" className="tile-purple" />
                            <div className="min-w-0">
                              <Link href={`/admin/tests/${t.id}`} className="font-semibold hover:text-primary">{t.title}</Link>
                              <p className="text-muted">{count} question{count === 1 ? "" : "s"}</p>
                              <div className="mt-1 md:hidden"><StatusBadge status={effectiveStatus(t.status, t.publishAt)} /></div>
                              <div className="-ml-2.5 mt-1 md:hidden [&>div]:justify-start">{actions}</div>
                            </div>
                          </div>
                        </Td>
                        <Td className="hidden md:table-cell">
                          <p className="whitespace-nowrap">{t.subject.name}</p>
                          <p className="text-muted">{[t.subject.course.name, t.subject.semester?.name].filter(Boolean).join(" · ")}</p>
                        </Td>
                        <Td className="hidden whitespace-nowrap md:table-cell">{t.durationMinutes} min</Td>
                        <Td className="hidden md:table-cell">
                          <StatusBadge status={effectiveStatus(t.status, t.publishAt)} />
                          {t.status === "DRAFT" && t.publishAt && new Date(t.publishAt) > new Date() && <p className="mt-1 whitespace-nowrap text-muted">{formatDateTime(t.publishAt)}</p>}
                        </Td>
                        <Td className="hidden md:table-cell">
                          {t._count.attempts > 0 ? (
                            <Link href={`/admin/tests/${t.id}/results`} className="text-primary hover:underline">{t._count.attempts} submitted</Link>
                          ) : <span className="text-muted">None yet</span>}
                        </Td>
                        <Td className="hidden md:table-cell">{actions}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableCard>
          )}
        </>
      )}
    </>
  );
}
