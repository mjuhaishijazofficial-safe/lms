import type { Metadata } from "next";
import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import { courseOptions } from "@/server/services/courses";
import { semesterTree } from "@/server/services/semesters";
import { listSubjects } from "@/server/services/subjects";
import { idParam, one } from "@/lib/params";
import { subjectIcon } from "@/lib/subject-icons";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTile } from "@/components/ui/icon-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableCard, Td, Th, Tr } from "@/components/ui/data-table";
import { FilterBar, FilterSelect } from "@/components/admin/filter-bar";
import { MoveButtons, RowActions } from "@/components/admin/row-actions";
import { deleteSubjectAction, moveSubjectAction, setSubjectStatusAction } from "./actions";

export const metadata: Metadata = { title: "Subjects" };

export default async function SubjectsPage({ searchParams }: PageProps<"/admin/subjects">) {
  const sp = await searchParams;
  const courseId = idParam(sp, "course");
  const semesterId = idParam(sp, "semester");
  const q = one(sp, "q");
  const [courses, tree, subjects] = await Promise.all([courseOptions(), semesterTree(), listSubjects({ courseId, semesterId, q })]);
  const filtered = !!(courseId || semesterId || q);
  const returnTo = "/admin/subjects" + (semesterId ? `?semester=${semesterId}` : courseId ? `?course=${courseId}` : "");
  const sameGroup = (a: (typeof subjects)[number] | undefined, b: (typeof subjects)[number]) => a?.courseId === b.courseId && a?.semesterId === b.semesterId;

  return (
    <>
      <PageHeader
        title="Subjects"
        description={`Each subject belongs to one ${TERMS.programLower}, optionally to a ${TERMS.semesterLower}, and contains chapters.`}
        actions={courses.length > 0 && <Link href={`/admin/subjects/new${semesterId ? `?semester=${semesterId}` : ""}${!semesterId && courseId ? `?course=${courseId}` : ""}`} className="btn-primary"><Plus className="size-4.5" aria-hidden /> New subject</Link>}
      />
      <Notice searchParams={sp} />

      {courses.length === 0 ? (
        <div className="card">
          <EmptyState icon={Layers} title={`Create a ${TERMS.programLower} first`} description={`Subjects live inside a ${TERMS.programLower}, so add a ${TERMS.programLower} before adding subjects.`}
            action={<Link href="/admin/courses/new" className="btn-primary">Create a {TERMS.programLower}</Link>} />
        </div>
      ) : (
        <>
          <FilterBar basePath="/admin/subjects" q={q} placeholder="Search subjects…" active={filtered}>
            <FilterSelect name="course" label={TERMS.program} value={courseId}>
              <option value="">All {TERMS.programs.toLowerCase()}</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>
            <FilterSelect name="semester" label={TERMS.semester} value={semesterId}>
              <option value="">Any {TERMS.semesterLower}</option>
              {tree.filter((c) => c.semesters.length).map((c) => (
                <optgroup key={c.id} label={c.name}>{c.semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
              ))}
            </FilterSelect>
          </FilterBar>

          {subjects.length === 0 ? (
            <div className="card">
              <EmptyState icon={Layers} title={filtered ? "No subjects match your filters." : "No subjects have been added yet."}
                action={!filtered && <Link href="/admin/subjects/new" className="btn-primary">Create a subject</Link>} />
            </div>
          ) : (
            <TableCard>
              <Table caption="Subjects">
                <thead>
                  <tr><Th className="hidden md:table-cell">Order</Th><Th>Subject</Th><Th className="hidden md:table-cell">{TERMS.program}</Th><Th className="hidden md:table-cell">Chapters</Th><Th className="hidden md:table-cell">Students</Th><Th>Status</Th><Th><span className="sr-only">Actions</span></Th></tr>
                </thead>
                <tbody>
                  {subjects.map((s, i) => {
                    const icon = subjectIcon(s.icon);
                    return (
                      <Tr key={s.id}>
                        <Td className="hidden md:table-cell">
                          <MoveButtons id={s.id} action={moveSubjectAction} returnTo={returnTo} label={s.name}
                            first={i > 0 && !sameGroup(subjects[i - 1], s)} last={i < subjects.length - 1 && !sameGroup(subjects[i + 1], s)} />
                        </Td>
                        <Td>
                          <div className="flex items-center gap-3">
                            <IconTile icon={icon.icon} size="sm" className={icon.tile} />
                            <div className="min-w-0">
                              <Link href={`/admin/subjects/${s.id}`} className="font-semibold hover:text-primary">{s.name}</Link>
                              {s.description && <p className="line-clamp-1 max-w-sm text-muted">{s.description}</p>}
                              <p className="mt-0.5 text-xs text-muted md:hidden">{s.course.name} · {plural(s._count.chapters, "chapter")}</p>
                            </div>
                          </div>
                        </Td>
                        <Td className="hidden whitespace-nowrap md:table-cell">
                          <Link href={`/admin/courses/${s.course.id}`} className="hover:text-primary">{s.course.name}</Link>
                          <p className="text-muted">{s.semester?.name ?? `Every ${TERMS.semesterLower}`}</p>
                        </Td>
                        <Td className="hidden whitespace-nowrap md:table-cell"><Link href={`/admin/chapters?subject=${s.id}`} className="text-primary hover:underline">{plural(s._count.chapters, "chapter")}</Link></Td>
                        <Td className="hidden whitespace-nowrap md:table-cell">
                          <Link href={`/admin/subjects/${s.id}`} className="text-primary hover:underline" title="See which students take this subject">{plural(s._count.students, "student")}</Link>
                        </Td>
                        <Td><StatusBadge status={s.status} /></Td>
                        <Td>
                          <RowActions id={s.id} name={s.name} status={s.status} editHref={`/admin/subjects/${s.id}`} returnTo={returnTo}
                            setStatus={setSubjectStatusAction} remove={deleteSubjectAction}
                            deleteHint="Only subjects with no chapters can be deleted." />
                        </Td>
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
