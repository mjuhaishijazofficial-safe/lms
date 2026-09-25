import type { Metadata } from "next";
import Link from "next/link";
import { FileCode2, ListOrdered, Plus } from "lucide-react";
import { courseOptions } from "@/server/services/courses";
import { listChapters } from "@/server/services/chapters";
import { subjectOptions } from "@/server/services/subjects";
import { PAGE_SIZE } from "@/server/services/_shared";
import { idParam, one, pageParam } from "@/lib/params";
import { effectiveStatus } from "@/lib/schedule";
import { formatDateTime, plural } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableCard, Td, Th, Tr } from "@/components/ui/data-table";
import { FilterBar, FilterSelect } from "@/components/admin/filter-bar";
import { MoveButtons, RowActions } from "@/components/admin/row-actions";
import { deleteChapterAction, moveChapterAction, setChapterStatusAction } from "./actions";
import { TERMS } from "@/lib/terms";

export const metadata: Metadata = { title: "Chapters" };

export default async function ChaptersPage({ searchParams }: PageProps<"/admin/chapters">) {
  const sp = await searchParams;
  const courseId = idParam(sp, "course");
  const subjectId = idParam(sp, "subject");
  const q = one(sp, "q");
  const page = pageParam(sp);

  const [courses, groups, { rows, total }] = await Promise.all([
    courseOptions(), subjectOptions(), listChapters({ courseId, subjectId, q, page }),
  ]);
  const hasSubjects = groups.length > 0;
  const filtered = !!(courseId || subjectId || q);
  const params = { course: courseId, subject: subjectId, q };
  const returnTo = "/admin/chapters" + (subjectId ? `?subject=${subjectId}` : "");

  return (
    <>
      <PageHeader
        title="Chapters"
        description="Chapters organise a subject's study materials."
        actions={hasSubjects && (
          <>
            <Link href={`/admin/chapters/guides${subjectId ? `?subject=${subjectId}` : ""}`} className="btn-outline"><FileCode2 className="size-4.5" aria-hidden /> From study guides</Link>
            <Link href={`/admin/chapters/new${subjectId ? `?subject=${subjectId}` : ""}`} className="btn-primary"><Plus className="size-4.5" aria-hidden /> New chapter</Link>
          </>
        )}
      />
      <Notice searchParams={sp} />

      {!hasSubjects ? (
        <div className="card">
          <EmptyState icon={ListOrdered} title="Create a subject first" description="Chapters live inside a subject, so add a subject before adding chapters."
            action={<Link href="/admin/subjects/new" className="btn-primary">Create a subject</Link>} />
        </div>
      ) : (
        <>
          <FilterBar basePath="/admin/chapters" q={q} placeholder="Search chapters…" active={filtered}>
            <FilterSelect name="course" label={TERMS.program} value={courseId}>
              <option value="">All {TERMS.programs.toLowerCase()}</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
            <FilterSelect name="subject" label="Subject" value={subjectId}>
              <option value="">All subjects</option>
              {groups.map((g) => (
                <optgroup key={g.courseId} label={g.course}>
                  {g.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              ))}
            </FilterSelect>
          </FilterBar>

          {rows.length === 0 ? (
            <div className="card">
              <EmptyState icon={ListOrdered} title={filtered ? "No chapters match your filters." : "No chapters have been added yet."}
                action={!filtered && <Link href="/admin/chapters/new" className="btn-primary">Create a chapter</Link>} />
            </div>
          ) : (
            <TableCard footer={<Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/chapters" params={params} />}>
              <Table caption="Chapters">
                <thead>
                  <tr><Th className="hidden md:table-cell">Order</Th><Th>No.</Th><Th>Chapter</Th><Th className="hidden md:table-cell">Subject</Th><Th className="hidden md:table-cell">Materials</Th><Th>Status</Th><Th><span className="sr-only">Actions</span></Th></tr>
                </thead>
                <tbody>
                  {rows.map((c, i) => (
                    <Tr key={c.id}>
                      <Td className="hidden md:table-cell">
                        <MoveButtons id={c.id} action={moveChapterAction} returnTo={returnTo} label={c.title}
                          first={i > 0 && rows[i - 1].subjectId !== c.subjectId} last={i < rows.length - 1 && rows[i + 1].subjectId !== c.subjectId} />
                      </Td>
                      <Td>
                        <span className="inline-flex size-8 items-center justify-center rounded-full bg-tile-blue text-sm font-semibold text-primary">{c.chapterNumber}</span>
                      </Td>
                      <Td>
                        <Link href={`/admin/chapters/${c.id}`} className="font-semibold hover:text-primary">{c.title}</Link>
                        {c.description && <p className="line-clamp-1 max-w-sm text-muted">{c.description}</p>}
                        <p className="mt-0.5 text-xs text-muted md:hidden">{c.subject.name} · {plural(c._count.materials, "material")}</p>
                      </Td>
                      <Td className="hidden whitespace-nowrap md:table-cell">
                        <p>{c.subject.name}</p>
                        <p className="text-muted">{[c.subject.course.name, c.subject.semester?.name].filter(Boolean).join(" · ")}</p>
                      </Td>
                      <Td className="hidden whitespace-nowrap md:table-cell"><Link href={`/admin/materials?chapter=${c.id}`} className="text-primary hover:underline">{plural(c._count.materials, "material")}</Link></Td>
                      <Td>
                        <StatusBadge status={effectiveStatus(c.status, c.publishAt)} />
                        {c.status === "DRAFT" && c.publishAt && new Date(c.publishAt) > new Date() && (
                          <p className="mt-1 whitespace-nowrap text-xs text-muted">{formatDateTime(c.publishAt)}</p>
                        )}
                      </Td>
                      <Td>
                        <RowActions id={c.id} name={c.title} status={c.status} editHref={`/admin/chapters/${c.id}`} returnTo={returnTo}
                          setStatus={setChapterStatusAction} remove={deleteChapterAction}
                          deleteHint="Only chapters with no study materials can be deleted." />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableCard>
          )}
        </>
      )}
    </>
  );
}
