import type { Prisma } from "@prisma/client";

/**
 * What a student is allowed to see, as pure query conditions (no database access, so they are easy to test).
 * Every student-facing query and file download builds on these, so content is only reachable when:
 *   - the student is active and enrolled in the program, and the program is published;
 *   - the subject, chapter and material are all published;
 *   - the subject is not tied to a semester, or belongs to the student's CURRENT semester or an EARLIER one.
 * Later semesters stay hidden until the student is moved up.
 */
export type ScopeEnrollment = {
  courseId: string;
  semester: { id: string; name: string; order: number } | null;
};
export type StudentScope = { userId: string; enrollments: ScopeEnrollment[] };

const NOTHING = { id: { in: [] as string[] } };

/** With no enrolment (or an inactive student) every condition matches nothing: access fails closed. */
export function studentCourseWhere(scope: StudentScope): Prisma.CourseWhereInput {
  if (scope.enrollments.length === 0) return NOTHING;
  return { status: "PUBLISHED", id: { in: scope.enrollments.map((e) => e.courseId) } };
}

export function studentSubjectWhere(scope: StudentScope): Prisma.SubjectWhereInput {
  if (scope.enrollments.length === 0) return NOTHING;
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

export const studentChapterWhere = (scope: StudentScope): Prisma.ChapterWhereInput => ({ status: "PUBLISHED", subject: studentSubjectWhere(scope) });
export const studentMaterialWhere = (scope: StudentScope): Prisma.MaterialWhereInput => ({ status: "PUBLISHED", chapter: studentChapterWhere(scope) });
