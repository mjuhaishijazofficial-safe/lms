import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarRange, Download, Pencil, Plus, Users } from "lucide-react";
import { programStructure } from "@/server/services/programs";
import { idSchema } from "@/server/validation/common";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { SemesterJump } from "@/components/admin/semester-jump";
import { SemesterSection, UnplacedCourses } from "@/components/admin/semester-section";
import { VU_PROGRAMS } from "@/lib/vu-catalog";
import { guessVuProgram, vuSemesterIndex } from "@/lib/vu-import";
import { createSemesterAction, generateSemestersAction } from "../semester-actions";
import { removeEmptySemestersAction } from "../program-actions";

export const metadata: Metadata = { title: TERMS.program };

export default async function ProgramPage({ params, searchParams }: PageProps<"/admin/courses/[id]">) {
  const { id } = await params;
  const program = idSchema.safeParse(id).success ? await programStructure(id) : null;
  if (!program) notFound();
  const semesters = program.semesters;
  const returnTo = `/admin/courses/${program.id}`;

  // Courses without a semester: pre-pick each one's semester from the VU degree this program follows, when known.
  const unplaced = program.subjects;
  const vu = unplaced.length ? guessVuProgram(VU_PROGRAMS, program.name, [...semesters.flatMap((s) => s.subjects), ...unplaced].map((c) => c.name)) : undefined;
  const suggested = Object.fromEntries(unplaced.map((c) => {
    const i = vu ? vuSemesterIndex(vu, c.name) : null;
    return [c.id, i === null ? undefined : semesters[i]?.id];
  }));

  // Empty semesters at the end (no courses, no students), e.g. made in advance. Offered for removal in one click,
  // but only when some earlier semester is in use — a brand-new program's first semester is left alone.
  const isEmpty = (s: (typeof semesters)[number]) => s.subjects.length === 0 && s._count.enrollments === 0;
  let firstTrailingEmpty = semesters.length;
  while (firstTrailingEmpty > 0 && isEmpty(semesters[firstTrailingEmpty - 1])) firstTrailingEmpty--;
  const trailingEmpty = firstTrailingEmpty > 0 ? semesters.slice(firstTrailingEmpty) : [];

  return (
    <>
      <PageHeader
        title={program.name}
        description={`${plural(semesters.length, TERMS.semesterLower)} · ${plural(program._count.subjects, "course")} · ${plural(program._count.enrollments, "student")}`}
        crumbs={[{ label: TERMS.programs, href: "/admin/courses" }, { label: program.name }]}
        actions={
          <>
            {program.status !== "PUBLISHED" && <StatusBadge status={program.status} />}
            <Link href={`/admin/students?course=${program.id}`} className="btn-outline"><Users className="size-4.5" aria-hidden /> Students</Link>
            <Link href={`/admin/courses/${program.id}/edit`} className="btn-outline"><Pencil className="size-4.5" aria-hidden /> Edit details</Link>
            <Link href={`/admin/courses/vu?program=${program.id}`} className="btn-primary"><Download className="size-4.5" aria-hidden /> Add VU courses</Link>
          </>
        }
      />
      <Notice searchParams={await searchParams} />

      {semesters.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarRange}
            title={`No ${TERMS.semesters.toLowerCase()} yet`}
            description={`Fill ${program.name} from Virtual University's scheme of study, or add ${TERMS.semesters.toLowerCase()} one at a time as your students need them.${unplaced.length ? ` ${plural(unplaced.length, "course")} already here will then ask for their ${TERMS.semesterLower}.` : ""}`}
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href={`/admin/courses/vu?program=${program.id}`} className="btn-primary"><Download className="size-4.5" aria-hidden /> Add VU courses</Link>
                <form action={generateSemestersAction} className="flex items-center gap-2">
                  <input type="hidden" name="courseId" value={program.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input type="hidden" name="count" value={1} />
                  <SubmitButton variant="soft" pendingText="Adding…"><Plus className="size-4.5" aria-hidden /> Add {TERMS.semester} 1</SubmitButton>
                </form>
              </div>
            }
          />
        </div>
      ) : (
        <div className="space-y-5">
          {unplaced.length > 0 && (
            <UnplacedCourses
              courseId={program.id} courses={unplaced} semesters={semesters.map((s) => ({ id: s.id, name: s.name }))}
              suggested={suggested} suggestedFrom={vu?.name}
            />
          )}

          {trailingEmpty.length > 0 && (
            <form action={removeEmptySemestersAction} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
              <input type="hidden" name="courseId" value={program.id} />
              <span className="text-muted">
                {trailingEmpty.length === 1
                  ? `${trailingEmpty[0].name} is empty (no courses, no students).`
                  : `${trailingEmpty[0].name} to ${trailingEmpty.at(-1)!.name} are empty (no courses, no students).`}
              </span>
              <button className="font-semibold text-primary hover:underline">{trailingEmpty.length === 1 ? "Remove it" : "Remove them"}</button>
            </form>
          )}

          {semesters.length > 2 && (
            <SemesterJump semesters={semesters.map((s) => ({ id: s.id, name: s.name, courseCount: s.subjects.length }))} />
          )}

          <div className="grid items-start gap-5 xl:grid-cols-2">
            {semesters.map((s, i) => <SemesterSection key={s.id} courseId={program.id} semester={s} index={i} total={semesters.length} />)}
          </div>

          <form action={createSemesterAction} className="card flex w-full flex-col gap-2 border-dashed p-4 sm:flex-row sm:items-center sm:gap-3 sm:p-5">
            <input type="hidden" name="courseId" value={program.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label htmlFor="new-semester" className="shrink-0 text-sm font-medium">Add a {TERMS.semesterLower}</label>
            <div className="flex w-full gap-2 sm:max-w-md">
              <input id="new-semester" name="name" required maxLength={60} defaultValue={`${TERMS.semester} ${semesters.length + 1}`} className="input min-w-0 flex-1 !py-2 text-sm" />
              <SubmitButton variant="soft" className="shrink-0 !py-2 text-sm"><Plus className="size-4" aria-hidden /> Add</SubmitButton>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
