import Link from "next/link";
import { ArrowUpRight, CalendarRange, Pencil, Plus, Trash2 } from "lucide-react";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { MoveButtons } from "./row-actions";
import {
  createSemesterAction, deleteSemesterAction, generateSemestersAction, moveSemesterAction, promoteSemesterAction, renameSemesterAction,
} from "@/app/admin/courses/semester-actions";

type Row = { id: string; name: string; order: number; _count: { subjects: number; enrollments: number } };

/**
 * The semesters of one program: add them (one at a time or a whole degree at once), rename, reorder,
 * and promote a whole cohort to the next semester. Plain forms, so it works without JavaScript.
 */
export function SemesterManager({ courseId, courseName, semesters }: { courseId: string; courseName: string; semesters: Row[] }) {
  const returnTo = `/admin/courses/${courseId}`;
  return (
    <section className="card max-w-3xl p-6 sm:p-8" aria-labelledby="semesters-heading">
      <h2 id="semesters-heading" className="text-lg font-semibold">{TERMS.semesters}</h2>
      <p className="mt-1 text-sm text-muted">
        Students see the subjects of their current {TERMS.semesterLower} and earlier ones. Later {TERMS.semesters.toLowerCase()} stay hidden until you promote students.
      </p>

      {semesters.length === 0 ? (
        <EmptyState icon={CalendarRange} title={`No ${TERMS.semesters.toLowerCase()} yet`} description={`Add the ${TERMS.semesters.toLowerCase()} of ${courseName}, for example eight for a four-year degree.`} />
      ) : (
        <ol className="mt-5 divide-y divide-line rounded-2xl border border-line">
          {semesters.map((s, i) => {
            const last = i === semesters.length - 1;
            return (
              <li key={s.id} className="flex items-start gap-3 px-3 py-3 sm:px-4">
                <div className="pt-0.5"><MoveButtons id={s.id} action={moveSemesterAction} returnTo={returnTo} first={i === 0} last={last} label={s.name} /></div>

                <div className="min-w-0 flex-1">
                  <form action={renameSemesterAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label className="sr-only" htmlFor={`sem-${s.id}`}>Name of {s.name}</label>
                    <input id={`sem-${s.id}`} name="name" defaultValue={s.name} maxLength={60} required className="input !py-1.5" />
                    <button className="btn-ghost shrink-0" aria-label={`Save name of ${s.name}`} title="Save name"><Pencil className="size-4" aria-hidden /></button>
                  </form>
                  <p className="mt-1.5 px-1 text-sm text-muted">
                    <Link href={`/admin/subjects?semester=${s.id}`} className="text-primary hover:underline">{plural(s._count.subjects, "subject")}</Link>
                    {" · "}
                    <Link href={`/admin/students?semester=${s.id}`} className="text-primary hover:underline">{plural(s._count.enrollments, "student")}</Link>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                  {!last && (
                    <ConfirmDialog
                      trigger={<><ArrowUpRight className="size-4" aria-hidden /> <span className="hidden sm:inline">Promote students</span></>}
                      triggerLabel={`Promote students from ${s.name} to the next ${TERMS.semesterLower}`}
                      triggerClassName="btn-ghost"
                      tone="primary"
                      title={`Move ${s.name} students up?`}
                      description={<>Every active student in {s.name} moves to the next {TERMS.semesterLower} and sees its subjects straight away. Inactive students stay where they are.</>}
                      confirmLabel="Move students up"
                      action={promoteSemesterAction}
                      fields={{ id: s.id, returnTo }}
                    />
                  )}
                  <ConfirmDialog
                    trigger={<Trash2 className="size-4" aria-hidden />}
                    triggerLabel={`Delete ${s.name}`}
                    triggerClassName="btn-ghost hover:!bg-red-50 hover:!text-red-600"
                    title={`Delete “${s.name}”?`}
                    description={<>Only a {TERMS.semesterLower} with no subjects and no students can be deleted. This can&apos;t be undone.</>}
                    confirmLabel="Delete"
                    action={deleteSemesterAction}
                    fields={{ id: s.id, returnTo }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <form action={createSemesterAction} className="space-y-2">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label htmlFor="new-semester" className="block text-sm font-medium">Add one {TERMS.semesterLower}</label>
          <div className="flex gap-2">
            <input id="new-semester" name="name" required maxLength={60} placeholder={`${TERMS.semester} ${semesters.length + 1}`} className="input" />
            <SubmitButton variant="soft" className="shrink-0"><Plus className="size-4.5" aria-hidden /> Add</SubmitButton>
          </div>
        </form>
        <form action={generateSemestersAction} className="space-y-2">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label htmlFor="gen-count" className="block text-sm font-medium">Add several at once</label>
          <div className="flex gap-2">
            <input id="gen-count" name="count" type="number" min={1} max={12} defaultValue={semesters.length === 0 ? 8 : 2} required className="input w-24" />
            <SubmitButton variant="soft" className="shrink-0" pendingText="Adding…">Add {TERMS.semesters.toLowerCase()}</SubmitButton>
          </div>
          <p className="text-xs text-muted">Named “{TERMS.semester} {semesters.length + 1}”, “{TERMS.semester} {semesters.length + 2}” and so on.</p>
        </form>
      </div>
    </section>
  );
}
