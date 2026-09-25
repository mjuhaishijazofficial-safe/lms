import "server-only";
import type { z } from "zod";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import type { quickCourseSchema, vuImportSchema } from "@/server/validation/admin";
import { findVuProgram } from "@/lib/vu-catalog";
import { existingCodes, iconForCode, planVuImport } from "@/lib/vu-import";
import { TERMS } from "@/lib/terms";
import { ensureAdmin, nextOrder } from "./_shared";
import { createSubject } from "./subjects";

// The Programs area of the admin: program → its semesters → the courses (subjects) of each semester, on one page.

const ORDER = [{ order: "asc" as const }, { createdAt: "asc" as const }];

/** Every program with the numbers shown on its card. */
export function programCards() {
  return db.course.findMany({
    orderBy: ORDER,
    select: { id: true, name: true, description: true, status: true, _count: { select: { semesters: true, subjects: true, enrollments: true } } },
  });
}

const courseRow = {
  id: true, name: true, icon: true, status: true,
  _count: { select: { chapters: true, students: true } },
} as const;

/** One program laid out the way the admin thinks about it: each semester with its courses inside. */
export function programStructure(id: string) {
  return db.course.findUnique({
    where: { id },
    select: {
      id: true, name: true, description: true, status: true,
      _count: { select: { subjects: true, enrollments: true } },
      semesters: {
        orderBy: ORDER,
        select: {
          id: true, name: true, order: true,
          _count: { select: { subjects: true, enrollments: true } },
          subjects: { orderBy: ORDER, select: courseRow },
        },
      },
      // Courses made before every course needed a semester. Listed on the program page until the admin places them.
      subjects: { where: { semesterId: null }, orderBy: ORDER, select: courseRow },
    },
  });
}
export type ProgramStructure = NonNullable<Awaited<ReturnType<typeof programStructure>>>;

/** The course codes every program already has, so the VU picker can mark them "already added" as the target changes. */
export async function programCodes(): Promise<{ id: string; name: string; codes: string[] }[]> {
  const rows = await db.course.findMany({ orderBy: ORDER, select: { id: true, name: true, subjects: { select: { name: true } } } });
  return rows.map((r) => ({ id: r.id, name: r.name, codes: [...existingCodes(r.subjects.map((s) => s.name))] }));
}

/** The "add a course" box in a semester: just a name. The icon is guessed from the code; it starts visible. */
export function quickAddCourse(actor: SessionUser, input: z.infer<typeof quickCourseSchema>) {
  return createSubject(actor, { ...input, description: "", icon: iconForCode(input.name), status: "PUBLISHED" });
}

/**
 * Deletes every empty semester of a program (no courses and no students) — whether made in advance at the end
 * (Semester 5-8 while students are only in Semester 3) or left behind in the middle (Semester 1, once its students
 * and subjects moved on). A semester with courses or students, wherever it sits, is never touched. Returns how many
 * were removed.
 */
export async function removeEmptySemesters(actor: SessionUser, courseId: string) {
  ensureAdmin(actor);
  return db.$transaction(async (tx) => {
    const semesters = await tx.semester.findMany({
      where: { courseId },
      select: { id: true, _count: { select: { subjects: true, enrollments: true } } },
    });
    const empty = semesters.filter((s) => !s._count.subjects && !s._count.enrollments).map((s) => s.id);
    // Keep at least one semester: a program whose semesters are all empty is just being set up.
    if (!empty.length || empty.length === semesters.length) return 0;
    await tx.semester.deleteMany({ where: { id: { in: empty }, subjects: { none: {} }, enrollments: { none: {} } } });
    return empty.length;
  });
}

/**
 * Puts courses that have no semester into the semester the admin picked for each. Only courses of this program that
 * still have no semester are touched, and only semesters of this program are accepted; anything else is ignored.
 * Each course goes to the end of its new semester. Returns how many were placed.
 */
export async function assignSemesters(actor: SessionUser, courseId: string, picks: { subjectId: string; semesterId: string }[]) {
  ensureAdmin(actor);
  if (!picks.length) return 0;
  return db.$transaction(async (tx) => {
    const semesters = new Set((await tx.semester.findMany({ where: { courseId }, select: { id: true } })).map((s) => s.id));
    const waiting = new Set((await tx.subject.findMany({ where: { courseId, semesterId: null, id: { in: picks.map((p) => p.subjectId) } }, select: { id: true } })).map((s) => s.id));
    const maxima = await tx.subject.groupBy({ by: ["semesterId"], where: { courseId }, _max: { order: true } });
    const nextIn = new Map(maxima.map((m) => [m.semesterId, nextOrder(m._max.order)]));
    let placed = 0;
    for (const { subjectId, semesterId } of picks) {
      if (!waiting.has(subjectId) || !semesters.has(semesterId)) continue;
      const order = nextIn.get(semesterId) ?? 0;
      nextIn.set(semesterId, order + 1);
      await tx.subject.update({ where: { id: subjectId }, data: { semesterId, order } });
      waiting.delete(subjectId);
      placed++;
    }
    return placed;
  });
}

/**
 * Adds the chosen courses of a VU scheme to a program (creating the program first when target is "new"), each in
 * its VU semester. Only the semesters those courses need are created (not the degree's full count) — running the
 * import again later, once more courses are ticked, adds any further semesters. Courses the program already has are
 * skipped, never duplicated.
 */
export async function importVuCourses(actor: SessionUser, input: z.infer<typeof vuImportSchema>) {
  ensureAdmin(actor);
  const vu = findVuProgram(input.slug);
  if (!vu) throw new ServiceError("That VU program isn't in the list any more.", "slug");

  return db.$transaction(async (tx) => {
    let courseId: string;
    if (input.target === "new") {
      const max = await tx.course.aggregate({ _max: { order: true } });
      courseId = (await tx.course.create({ data: { name: vu.name, order: nextOrder(max._max.order) }, select: { id: true } })).id;
    } else {
      const found = await tx.course.findUnique({ where: { id: input.target }, select: { id: true } });
      if (!found) throw new ServiceError(`This ${TERMS.programLower} no longer exists.`, undefined, "not-found");
      courseId = found.id;
    }

    const have = await tx.subject.findMany({ where: { courseId }, select: { name: true } });
    const { create, skipped } = planVuImport(vu, input.codes, have.map((s) => s.name));

    let semesters = await tx.semester.findMany({ where: { courseId }, orderBy: ORDER, select: { id: true, order: true } });
    // Only as many semesters as the ticked courses actually need — not the degree's full count. An admin whose
    // students are in semester 3 shouldn't see empty semester 5-8 cards; running this again later adds them.
    const needed = create.reduce((n, c) => Math.max(n, c.semesterIndex + 1), 0);
    if (semesters.length < needed) {
      const start = nextOrder(semesters.at(-1)?.order);
      await tx.semester.createMany({
        data: Array.from({ length: needed - semesters.length }, (_, i) => ({ courseId, name: `${TERMS.semester} ${semesters.length + i + 1}`, order: start + i })),
      });
      semesters = await tx.semester.findMany({ where: { courseId }, orderBy: ORDER, select: { id: true, order: true } });
    }

    // New courses go after whatever each semester already has.
    const maxima = await tx.subject.groupBy({ by: ["semesterId"], where: { courseId }, _max: { order: true } });
    const nextIn = new Map(maxima.map((m) => [m.semesterId, nextOrder(m._max.order)]));
    const data = create.map((c) => {
      const semesterId = semesters[c.semesterIndex].id;
      const order = nextIn.get(semesterId) ?? 0;
      nextIn.set(semesterId, order + 1);
      return { courseId, semesterId, name: c.name, icon: c.icon, status: input.status, order };
    });
    if (data.length) await tx.subject.createMany({ data });
    return { courseId, added: data.length, skipped };
  }, { timeout: 30_000 });
}
