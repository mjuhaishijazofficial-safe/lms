import "server-only";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import { ensureAdmin, moveInList, nextOrder } from "./_shared";

const ORDER = [{ order: "asc" as const }, { createdAt: "asc" as const }];

export function listSemesters(courseId: string) {
  return db.semester.findMany({
    where: { courseId },
    orderBy: ORDER,
    select: { id: true, name: true, order: true, _count: { select: { subjects: true, enrollments: true } } },
  });
}

/** Program → semesters, for the dependent pickers on the subject and student forms. */
export async function semesterTree() {
  const courses = await db.course.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, semesters: { orderBy: ORDER, select: { id: true, name: true } } },
  });
  return courses.map((c) => ({ id: c.id, name: c.name, semesters: c.semesters }));
}
export type SemesterTree = Awaited<ReturnType<typeof semesterTree>>;

async function assertCourse(courseId: string) {
  if (!(await db.course.findUnique({ where: { id: courseId }, select: { id: true } }))) throw new ServiceError("This program no longer exists.", undefined, "not-found");
}

/** A semester must belong to the program it is used with. Returns the id, or null when none is chosen. */
export async function assertSemesterInCourse(semesterId: string | null | undefined, courseId: string | null | undefined): Promise<string | null> {
  if (!semesterId) return null;
  if (!courseId) throw new ServiceError("Choose a program before choosing a semester.", "semesterId");
  const found = await db.semester.findFirst({ where: { id: semesterId, courseId }, select: { id: true } });
  if (!found) throw new ServiceError("Choose a semester that belongs to this program.", "semesterId");
  return found.id;
}

/** The semester students start in when nothing else is chosen: the program's first one. */
export async function firstSemesterId(courseId: string): Promise<string | null> {
  return (await db.semester.findFirst({ where: { courseId }, orderBy: ORDER, select: { id: true } }))?.id ?? null;
}

async function appendOrder(courseId: string) {
  const max = await db.semester.aggregate({ where: { courseId }, _max: { order: true } });
  return nextOrder(max._max.order);
}

export async function createSemester(actor: SessionUser, courseId: string, name: string) {
  ensureAdmin(actor);
  await assertCourse(courseId);
  return db.semester.create({ data: { courseId, name, order: await appendOrder(courseId) } });
}

/** Adds "Semester n" rows after the existing ones, so a whole degree can be set up in one step. */
export async function generateSemesters(actor: SessionUser, courseId: string, count: number, prefix: string) {
  ensureAdmin(actor);
  await assertCourse(courseId);
  const existing = await db.semester.count({ where: { courseId } });
  const start = await appendOrder(courseId);
  await db.semester.createMany({ data: Array.from({ length: count }, (_, i) => ({ courseId, name: `${prefix} ${existing + i + 1}`, order: start + i })) });
}

export async function renameSemester(actor: SessionUser, id: string, name: string) {
  ensureAdmin(actor);
  const { count } = await db.semester.updateMany({ where: { id }, data: { name } });
  if (!count) throw new ServiceError("This semester no longer exists.", undefined, "not-found");
}

export async function moveSemester(actor: SessionUser, id: string, direction: "up" | "down") {
  ensureAdmin(actor);
  const semester = await db.semester.findUnique({ where: { id }, select: { courseId: true } });
  if (!semester) return;
  const siblings = await db.semester.findMany({ where: { courseId: semester.courseId }, orderBy: ORDER, select: { id: true } });
  const next = moveInList(siblings, id, direction);
  if (next) await db.$transaction(next.map((s, i) => db.semester.update({ where: { id: s.id }, data: { order: i } })));
}

/** A semester in use can't be deleted: its subjects and students would silently change meaning. */
export async function deleteSemester(actor: SessionUser, id: string) {
  ensureAdmin(actor);
  const semester = await db.semester.findUnique({ where: { id }, select: { _count: { select: { subjects: true, enrollments: true } } } });
  if (!semester) throw new ServiceError("This semester no longer exists.", undefined, "not-found");
  if (semester._count.subjects || semester._count.enrollments) {
    throw new ServiceError("This semester still has subjects or students. Move them to another semester first.", undefined, "not-empty");
  }
  await db.semester.delete({ where: { id } });
}

/**
 * Moves every ACTIVE student currently in this semester up to the next one in the same program.
 * Returns how many moved. Inactive students stay where they are. Nothing happens in the last semester.
 */
export async function promoteStudents(actor: SessionUser, semesterId: string): Promise<{ moved: number; to: string }> {
  ensureAdmin(actor);
  const from = await db.semester.findUnique({ where: { id: semesterId }, select: { courseId: true, order: true } });
  if (!from) throw new ServiceError("This semester no longer exists.", undefined, "not-found");
  const next = await db.semester.findFirst({ where: { courseId: from.courseId, order: { gt: from.order } }, orderBy: ORDER, select: { id: true, name: true } });
  if (!next) throw new ServiceError("This is the last semester of the program, so there is nowhere to promote students to.", undefined, "last");
  const { count } = await db.enrollment.updateMany({
    where: { semesterId, courseId: from.courseId, user: { role: "STUDENT", status: "ACTIVE" } },
    data: { semesterId: next.id },
  });
  return { moved: count, to: next.name };
}
