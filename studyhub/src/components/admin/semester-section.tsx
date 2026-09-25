import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronUp, Layers, Pencil, Trash2 } from "lucide-react";
import type { ProgramStructure } from "@/server/services/programs";
import { subjectIcon } from "@/lib/subject-icons";
import { plural } from "@/lib/format";
import { TERMS } from "@/lib/terms";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconTile } from "@/components/ui/icon-tile";
import { Menu } from "@/components/ui/menu";
import { menuItem } from "@/components/ui/menu-item";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { QuickAddCourse } from "./quick-add-course";
import {
  deleteSemesterAction, moveSemesterAction, promoteSemesterAction, renameSemesterAction,
} from "@/app/admin/courses/semester-actions";

type Semester = ProgramStructure["semesters"][number];
type CourseRow = Semester["subjects"][number];

/** "CS101 - Introduction to Computing" → code chip + title. Names without a leading code are shown whole. */
function splitName(name: string): { code: string | null; title: string } {
  const m = name.match(/^([A-Za-z]{2,5}\s?\d{3,4}[A-Za-z]{0,2})\s*[-–—:]\s*(.+)$/);
  return m ? { code: m[1].toUpperCase(), title: m[2] } : { code: null, title: name };
}

function CourseItem({ c }: { c: CourseRow }) {
  const icon = subjectIcon(c.icon);
  const { code, title } = splitName(c.name);
  return (
    <li className="group flex items-center gap-3 px-4 py-2.5 sm:px-5">
      <IconTile icon={icon.icon} size="sm" className={icon.tile} />
      <div className="min-w-0 flex-1">
        <Link href={`/admin/subjects/${c.id}`} className="flex min-w-0 items-baseline gap-2 font-medium hover:text-primary">
          {code && <span className="shrink-0 rounded-md bg-page px-1.5 py-0.5 font-mono text-xs font-semibold text-muted">{code}</span>}
          <span className="truncate">{title}</span>
        </Link>
        <p className="text-xs text-muted">
          {plural(c._count.chapters, "chapter")}{c._count.students ? ` · ${plural(c._count.students, "student")}` : ""}
        </p>
      </div>
      {c.status !== "PUBLISHED" && <StatusBadge status={c.status} />}
      <Link href={`/admin/chapters?subject=${c.id}`} className="btn-ghost hidden sm:inline-flex" title="See its chapters">
        <Layers className="size-4" aria-hidden /> Chapters
      </Link>
      <Link href={`/admin/subjects/${c.id}`} className="btn-ghost" aria-label={`Edit ${c.name}`} title="Edit">
        <Pencil className="size-4" aria-hidden />
      </Link>
    </li>
  );
}

function CourseList({ courses }: { courses: CourseRow[] }) {
  if (!courses.length) return <p className="px-4 py-5 text-sm text-muted sm:px-5">No courses yet. Add the first one below.</p>;
  return <ul className="divide-y divide-line">{courses.map((c) => <CourseItem key={c.id} c={c} />)}</ul>;
}

/** One semester of a program: its courses, a box to add another, and a ⋯ menu for the rarer semester actions. */
export function SemesterSection({ courseId, semester, index, total }: { courseId: string; semester: Semester; index: number; total: number }) {
  const s = semester;
  const returnTo = `/admin/courses/${courseId}`;
  const last = index === total - 1;
  const move = (dir: "up" | "down", disabled: boolean) => (
    <form action={moveSemesterAction}>
      <input type="hidden" name="id" value={s.id} />
      <input type="hidden" name="direction" value={dir} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button className={menuItem} disabled={disabled}>
        {dir === "up" ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />} Move {dir}
      </button>
    </form>
  );

  return (
    <section id={`semester-${index + 1}`} aria-labelledby={`sem-h-${s.id}`} className="card scroll-mt-24">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-tile-blue text-sm font-bold text-primary" aria-hidden>{index + 1}</span>
        <div className="min-w-0 flex-1">
          <h2 id={`sem-h-${s.id}`} className="truncate font-semibold">{s.name}</h2>
          <p className="text-sm text-muted">
            {plural(s.subjects.length, "course")}
            {" · "}
            <Link href={`/admin/students?semester=${s.id}`} className="hover:text-primary hover:underline">{plural(s._count.enrollments, "student")}</Link>
          </p>
        </div>
        <Menu label={`More actions for ${s.name}`}>
          <form action={renameSemesterAction} className="border-b border-line px-1 pb-2.5 pt-1">
            <input type="hidden" name="id" value={s.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label htmlFor={`sem-${s.id}`} className="mb-1 block px-2 text-xs font-medium text-muted">Rename</label>
            <div className="flex gap-1.5">
              <input id={`sem-${s.id}`} name="name" defaultValue={s.name} maxLength={60} required className="input !px-3 !py-1.5 text-sm" />
              <SubmitButton variant="soft" className="!px-3 !py-1.5 text-sm">Save</SubmitButton>
            </div>
          </form>
          <div className="pt-1.5">
            {move("up", index === 0)}
            {move("down", last)}
            {!last && (
              <ConfirmDialog
                trigger={<><ArrowUpRight className="size-4" aria-hidden /> Promote students</>}
                triggerClassName={menuItem}
                tone="primary"
                title={`Move ${s.name} students up?`}
                description={<>Every active student in {s.name} moves to the next {TERMS.semesterLower} and sees its courses straight away. Inactive students stay where they are.</>}
                confirmLabel="Move students up"
                action={promoteSemesterAction}
                fields={{ id: s.id, returnTo }}
              />
            )}
            <ConfirmDialog
              trigger={<><Trash2 className="size-4" aria-hidden /> Delete {TERMS.semesterLower}</>}
              triggerClassName={`${menuItem} !text-red-600 hover:!bg-red-50`}
              title={`Delete “${s.name}”?`}
              description={<>Only a {TERMS.semesterLower} with no courses and no students can be deleted. This can&apos;t be undone.</>}
              confirmLabel="Delete"
              action={deleteSemesterAction}
              fields={{ id: s.id, returnTo }}
            />
          </div>
        </Menu>
      </header>
      <CourseList courses={s.subjects} />
      <div className="rounded-b-card border-t border-line bg-page/60 px-4 py-3 sm:px-5">
        <QuickAddCourse courseId={courseId} semesterId={s.id} semesterName={s.name} />
      </div>
    </section>
  );
}

/** Courses that belong to the whole program instead of one semester. Only shown when there are some. */
export function WholeProgramSection({ courseId, courses }: { courseId: string; courses: CourseRow[] }) {
  return (
    <section aria-labelledby="whole-program-h" className="card">
      <header className="border-b border-line px-4 py-3.5 sm:px-5">
        <h2 id="whole-program-h" className="font-semibold">Every {TERMS.semesterLower}</h2>
        <p className="text-sm text-muted">Not tied to one {TERMS.semesterLower}: students see these from their first {TERMS.semesterLower}. To move one into a {TERMS.semesterLower}, edit it.</p>
      </header>
      <CourseList courses={courses} />
      <div className="rounded-b-card border-t border-line bg-page/60 px-4 py-3 sm:px-5">
        <QuickAddCourse courseId={courseId} semesterId={null} semesterName={`every ${TERMS.semesterLower}`} />
      </div>
    </section>
  );
}
