import type { Prisma } from "@prisma/client";

/**
 * What a student is allowed to see, as pure query conditions (no database access, so they are easy to test).
 * Every student-facing query and file download builds on these, so content is only reachable when:
 *   - the student is active and enrolled in the program, and the program is published;
 *   - the subject, chapter and material are all published;
 *   - the subject is one the admin picked for this student; when none were picked, the semester rule applies
 *     instead: the subject is not tied to a semester, or belongs to their CURRENT semester or an EARLIER one.
 * Later semesters stay hidden until the student is moved up.
 */
export type ScopeEnrollment = {
  courseId: string;
  semester: { id: string; name: string; order: number } | null;
};
/** subjectIds: the subjects an admin picked for this student. Empty means "use the semester rule". */
export type StudentScope = { userId: string; enrollments: ScopeEnrollment[]; subjectIds?: string[] };

const hasPicked = (scope: StudentScope) => (scope.subjectIds?.length ?? 0) > 0;

const NOTHING = { id: { in: [] as string[] } };

/** With no enrolment (or an inactive student) every condition matches nothing: access fails closed. */
export function studentCourseWhere(scope: StudentScope): Prisma.CourseWhereInput {
  if (scope.enrollments.length === 0) return NOTHING;
  const enrolled = { id: { in: scope.enrollments.map((e) => e.courseId) } };
  // Picked subjects may sit under another program, so show those programs too.
  const where: Prisma.CourseWhereInput = hasPicked(scope)
    ? { OR: [enrolled, { subjects: { some: { id: { in: scope.subjectIds } } } }] }
    : enrolled;
  return { status: "PUBLISHED", ...where };
}

export function studentSubjectWhere(scope: StudentScope): Prisma.SubjectWhereInput {
  if (scope.enrollments.length === 0) return NOTHING;
  // Subjects picked for this student win outright, whichever program they belong to.
  if (hasPicked(scope)) return { status: "PUBLISHED", id: { in: scope.subjectIds }, course: { status: "PUBLISHED" } };
  return {
    status: "PUBLISHED",
    OR: scope.enrollments.map((e) => ({
      courseId: e.courseId,
      OR: [
        { semesterId: null },
        ...(e.semester ? [{ semester: { courseId: e.courseId, order: { lte: e.semester.order } } }] : []),
      ],
    })),
  };
}

/**
 * A chapter or material is visible once it is truly Published, or once its own scheduled `publishAt` time has
 * passed while it is still marked Draft — checked here, at read time, so a schedule takes effect on its own with
 * nothing needing to run in the background. An Archived item is never revealed this way.
 */
export function publishedWhere(now: Date = new Date()) {
  return { OR: [{ status: "PUBLISHED" as const }, { status: "DRAFT" as const, publishAt: { lte: now } }] };
}

export const studentChapterWhere = (scope: StudentScope, now: Date = new Date()): Prisma.ChapterWhereInput => ({ ...publishedWhere(now), subject: studentSubjectWhere(scope) });
export const studentMaterialWhere = (scope: StudentScope, now: Date = new Date()): Prisma.MaterialWhereInput => ({ ...publishedWhere(now), chapter: studentChapterWhere(scope, now) });
/** A test follows its subject's own visibility, same as a chapter does: no extra rule needed. */
export const studentTestWhere = (scope: StudentScope): Prisma.TestWhereInput => ({ status: "PUBLISHED", subject: studentSubjectWhere(scope) });
