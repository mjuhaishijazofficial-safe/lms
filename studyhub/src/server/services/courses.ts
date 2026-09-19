import "server-only";
import type { z } from "zod";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import type { courseSchema } from "@/server/validation/admin";
import { ensureAdmin, moveInList, nextOrder } from "./_shared";
import { TERMS } from "@/lib/terms";

type CourseInput = z.infer<typeof courseSchema>;

const ORDER = [{ order: "asc" as const }, { createdAt: "asc" as const }];

export function listCourses() {
  return db.course.findMany({
    orderBy: ORDER,
    include: { _count: { select: { subjects: true, enrollments: true } } },
  });
}

export function courseOptions() {
  return db.course.findMany({ orderBy: ORDER, select: { id: true, name: true, status: true } });
}

export function getCourse(id: string) {
  return db.course.findUnique({ where: { id }, include: { _count: { select: { subjects: true, enrollments: true } } } });
}

export async function createCourse(actor: SessionUser, data: CourseInput) {
  ensureAdmin(actor);
  const max = await db.course.aggregate({ _max: { order: true } });
  return db.course.create({ data: { ...data, order: nextOrder(max._max.order) } });
}

export async function updateCourse(actor: SessionUser, id: string, data: CourseInput) {
  ensureAdmin(actor);
  return db.course.update({ where: { id }, data });
}

export async function setCourseStatus(actor: SessionUser, id: string, status: CourseInput["status"]) {
  ensureAdmin(actor);
  return db.course.update({ where: { id }, data: { status } });
}

export async function moveCourse(actor: SessionUser, id: string, direction: "up" | "down") {
  ensureAdmin(actor);
  const siblings = await db.course.findMany({ orderBy: ORDER, select: { id: true } });
  const next = moveInList(siblings, id, direction);
  if (next) await db.$transaction(next.map((c, i) => db.course.update({ where: { id: c.id }, data: { order: i } })));
}

/** Only empty courses can be deleted; otherwise archive, so no student or content is lost by accident. */
export async function deleteCourse(actor: SessionUser, id: string) {
  ensureAdmin(actor);
  const course = await getCourse(id);
  if (!course) throw new ServiceError(`This ${TERMS.programLower} no longer exists.`, undefined, "not-found");
  if (course._count.subjects || course._count.enrollments) {
    throw new ServiceError(`This ${TERMS.programLower} still has subjects or students. Archive it instead, or remove them first.`, undefined, "not-empty");
  }
  await db.course.delete({ where: { id } });
}
