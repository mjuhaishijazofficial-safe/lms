import "server-only";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import type { subjectSchema } from "@/server/validation/admin";
import { ensureAdmin, moveInList, nextOrder } from "./_shared";
import { assertSemesterInCourse } from "./semesters";

type SubjectInput = z.infer<typeof subjectSchema>;

// Program, then semester (subjects for the whole program first), then the admin's manual order.
const ORDER: Prisma.SubjectOrderByWithRelationInput[] = [
  { course: { order: "asc" } },
  { course: { createdAt: "asc" } },
  { semester: { order: "asc" } },
  { order: "asc" },
  { createdAt: "asc" },
];

const listInclude = {
  course: { select: { id: true, name: true } },
  semester: { select: { id: true, name: true } },
  _count: { select: { chapters: true } },
} satisfies Prisma.SubjectInclude;

export function listSubjects(filter: { courseId?: string; semesterId?: string; q?: string }) {
  return db.subject.findMany({
    where: {
      ...(filter.courseId ? { courseId: filter.courseId } : {}),
      ...(filter.semesterId ? { semesterId: filter.semesterId } : {}),
      ...(filter.q ? { name: { contains: filter.q, mode: "insensitive" } } : {}),
    },
    orderBy: ORDER,
    include: listInclude,
  });
}

/** Subjects grouped by program and semester, for <optgroup> pickers. */
export async function subjectOptions() {
  const rows = await db.subject.findMany({
    orderBy: ORDER,
    select: { id: true, name: true, courseId: true, semesterId: true, course: { select: { name: true } }, semester: { select: { name: true } } },
  });
  const groups = new Map<string, { courseId: string; course: string; subjects: { id: string; name: string }[] }>();
  for (const s of rows) {
    const key = `${s.courseId}:${s.semesterId ?? ""}`;
    if (!groups.has(key)) groups.set(key, { courseId: s.courseId, course: s.semester ? `${s.course.name} · ${s.semester.name}` : s.course.name, subjects: [] });
    groups.get(key)!.subjects.push({ id: s.id, name: s.name });
  }
  return [...groups.entries()].map(([key, g]) => ({ key, ...g }));
}

export function getSubject(id: string) {
  return db.subject.findUnique({ where: { id }, include: listInclude });
}

async function appendOrder(courseId: string, semesterId: string | null) {
  const max = await db.subject.aggregate({ where: { courseId, semesterId }, _max: { order: true } });
  return nextOrder(max._max.order);
}

async function assertCourse(courseId: string) {
  if (!(await db.course.findUnique({ where: { id: courseId }, select: { id: true } }))) {
    throw new ServiceError("Choose a program that exists.", "courseId");
  }
}

export async function createSubject(actor: SessionUser, data: SubjectInput) {
  ensureAdmin(actor);
  await assertCourse(data.courseId);
  const semesterId = await assertSemesterInCourse(data.semesterId, data.courseId);
  return db.subject.create({ data: { ...data, semesterId, order: await appendOrder(data.courseId, semesterId) } });
}

export async function updateSubject(actor: SessionUser, id: string, data: SubjectInput) {
  ensureAdmin(actor);
  const current = await db.subject.findUnique({ where: { id }, select: { courseId: true, semesterId: true } });
  if (!current) throw new ServiceError("This subject no longer exists.", undefined, "not-found");
  await assertCourse(data.courseId);
  const semesterId = await assertSemesterInCourse(data.semesterId, data.courseId);
  const moved = current.courseId !== data.courseId || current.semesterId !== semesterId;
  return db.subject.update({ where: { id }, data: { ...data, semesterId, ...(moved ? { order: await appendOrder(data.courseId, semesterId) } : {}) } });
}

export async function moveSubject(actor: SessionUser, id: string, direction: "up" | "down") {
  ensureAdmin(actor);
  const subject = await db.subject.findUnique({ where: { id }, select: { courseId: true, semesterId: true } });
  if (!subject) return;
  // Subjects are ordered within their own semester.
  const siblings = await db.subject.findMany({ where: { courseId: subject.courseId, semesterId: subject.semesterId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const next = moveInList(siblings, id, direction);
  if (next) await db.$transaction(next.map((s, i) => db.subject.update({ where: { id: s.id }, data: { order: i } })));
}

export async function setSubjectStatus(actor: SessionUser, id: string, status: SubjectInput["status"]) {
  ensureAdmin(actor);
  return db.subject.update({ where: { id }, data: { status } });
}

export async function deleteSubject(actor: SessionUser, id: string) {
  ensureAdmin(actor);
  const subject = await getSubject(id);
  if (!subject) throw new ServiceError("This subject no longer exists.", undefined, "not-found");
  if (subject._count.chapters) throw new ServiceError("This subject still has chapters. Archive it instead, or delete its chapters first.", undefined, "not-empty");
  await db.subject.delete({ where: { id } });
}
