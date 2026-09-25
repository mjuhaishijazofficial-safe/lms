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
import { SemesterSection, WholeProgramSection } from "@/components/admin/semester-section";
import { createSemesterAction, generateSemestersAction } from "../semester-actions";

export const metadata: Metadata = { title: TERMS.program };

export default async function ProgramPage({ params, searchParams }: PageProps<"/admin/courses/[id]">) {
  const { id } = await params;
  const program = idSchema.safeParse(id).success ? await programStructure(id) : null;
  if (!program) notFound();
  const semesters = program.semesters;
  const returnTo = `/admin/courses/${program.id}`;

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
            description={`Fill ${program.name} from Virtual University's scheme of study in one step, or add empty ${TERMS.semesters.toLowerCase()} and type the courses yourself.`}
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href={`/admin/courses/vu?program=${program.id}`} className="btn-primary"><Download className="size-4.5" aria-hidden /> Add VU courses</Link>
                <form action={generateSemestersAction} className="flex items-center gap-2">
                  <input type="hidden" name="courseId" value={program.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input type="hidden" name="count" value={8} />
                  <SubmitButton variant="soft" pendingText="Adding…">Add 8 empty {TERMS.semesters.toLowerCase()}</SubmitButton>
                </form>
              </div>
            }
          />
        </div>
      ) : (
        <div className="space-y-5">
          {semesters.length > 1 && (
            <nav aria-label={`Jump to a ${TERMS.semesterLower}`} className="sticky top-0 z-10 -mx-1 flex gap-2 overflow-x-auto bg-page/90 px-1 py-2 backdrop-blur">
              {semesters.map((s, i) => (
                <a key={s.id} href={`#semester-${i + 1}`} className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink transition hover:border-primary/40 hover:text-primary">
                  {s.name} <span className="text-muted">· {s.subjects.length}</span>
                </a>
              ))}
            </nav>
          )}

          <div className="grid items-start gap-5 xl:grid-cols-2">
            {semesters.map((s, i) => <SemesterSection key={s.id} courseId={program.id} semester={s} index={i} total={semesters.length} />)}
            {program.subjects.length > 0 && <WholeProgramSection courseId={program.id} courses={program.subjects} />}
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
