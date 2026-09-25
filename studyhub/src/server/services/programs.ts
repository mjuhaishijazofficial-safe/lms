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
      // Courses that apply to the whole program rather than one semester.
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
 * Adds the chosen courses of a VU scheme to a program (creating the program first when target is "new"), each in
 * its VU semester. Missing semesters are created; courses the program already has are skipped, never duplicated.
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
