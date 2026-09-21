import "server-only";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import type { subjectSchema } from "@/server/validation/admin";
import { normalizeCode } from "@/lib/student-import";
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
  _count: { select: { chapters: true, students: true } },
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

/**
 * Two subjects with the same code in one program are almost always a mistake ("Cs301" and "CS 301" are the same
 * subject), and each copy would need its own chapters and files. Students are given subjects one by one, so a subject
 * from another program never needs a duplicate.
 */
async function assertNoDuplicate(courseId: string, name: string, exceptId?: string) {
  const key = normalizeCode(name);
  const others = await db.subject.findMany({ where: { courseId, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { name: true } });
  const clash = others.find((o) => normalizeCode(o.name) === key);
  if (clash) throw new ServiceError(`This program already has a subject called "${clash.name}". Use that one, or choose a different name.`, "name");
}

export async function createSubject(actor: SessionUser, data: SubjectInput) {
  ensureAdmin(actor);
  await assertCourse(data.courseId);
  await assertNoDuplicate(data.courseId, data.name);
  const semesterId = await assertSemesterInCourse(data.semesterId, data.courseId);
  return db.subject.create({ data: { ...data, semesterId, order: await appendOrder(data.courseId, semesterId) } });
}

export async function updateSubject(actor: SessionUser, id: string, data: SubjectInput) {
  ensureAdmin(actor);
  const current = await db.subject.findUnique({ where: { id }, select: { courseId: true, semesterId: true, name: true } });
  if (!current) throw new ServiceError("This subject no longer exists.", undefined, "not-found");
  await assertCourse(data.courseId);
  // Only when the code or program changes: an existing duplicate must stay editable so it can be tidied up.
  if (current.courseId !== data.courseId || normalizeCode(current.name) !== normalizeCode(data.name)) {
    await assertNoDuplicate(data.courseId, data.name, id);
  }
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

/** Every published subject, grouped by program, for the per-student subject picker. */
export async function subjectCatalogue() {
  const rows = await db.subject.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ course: { order: "asc" } }, { semester: { order: "asc" } }, { order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, course: { select: { id: true, name: true } }, semester: { select: { name: true } } },
  });
  const groups = new Map<string, { id: string; name: string; subjects: { id: string; name: string; semester: string | null }[] }>();
  for (const r of rows) {
    const g = groups.get(r.course.id) ?? { id: r.course.id, name: r.course.name, subjects: [] };
    g.subjects.push({ id: r.id, name: r.name, semester: r.semester?.name ?? null });
    groups.set(r.course.id, g);
  }
  return [...groups.values()];
}

export type SubjectCatalogue = Awaited<ReturnType<typeof subjectCatalogue>>;

/**
 * Folds one subject into another: its chapters (with their materials) move to the end of the target, every student
 * who had it (or bookmarked it) gets the target instead, and the emptied subject is deleted. Used to clean up copies.
 */
export async function mergeSubject(actor: SessionUser, sourceId: string, targetId: string) {
  ensureAdmin(actor);
  if (sourceId === targetId) throw new ServiceError("Choose a different subject to merge into.", "targetId");
  const [source, target] = await Promise.all([
    db.subject.findUnique({ where: { id: sourceId }, select: { id: true } }),
    db.subject.findUnique({ where: { id: targetId }, select: { id: true } }),
  ]);
  if (!source || !target) throw new ServiceError("This subject no longer exists.", undefined, "not-found");

  await db.$transaction(async (tx) => {
    const last = await tx.chapter.aggregate({ where: { subjectId: targetId }, _max: { chapterNumber: true, order: true } });
    let number = last._max.chapterNumber ?? 0;
    let order = nextOrder(last._max.order);
    const chapters = await tx.chapter.findMany({ where: { subjectId: sourceId }, orderBy: [{ order: "asc" }, { chapterNumber: "asc" }], select: { id: true } });
    for (const c of chapters) {
      await tx.chapter.update({ where: { id: c.id }, data: { subjectId: targetId, chapterNumber: ++number, order: order++ } });
    }

    const picks = await tx.studentSubject.findMany({ where: { subjectId: sourceId }, select: { userId: true } });
    await tx.studentSubject.createMany({ data: picks.map((p) => ({ userId: p.userId, subjectId: targetId })), skipDuplicates: true });
    const marks = await tx.subjectBookmark.findMany({ where: { subjectId: sourceId }, select: { userId: true } });
    await tx.subjectBookmark.createMany({ data: marks.map((m) => ({ userId: m.userId, subjectId: targetId })), skipDuplicates: true });

    await tx.subject.delete({ where: { id: sourceId } }); // its remaining picks and bookmarks go with it
  });
}

/** Students who have this subject picked for them, for the subject's page. */
export async function studentsTakingSubject(subjectId: string) {
  const rows = await db.studentSubject.findMany({
    where: { subjectId, user: { role: "STUDENT" } },
    orderBy: { user: { name: "asc" } },
    select: { user: { select: { id: true, name: true, email: true, status: true } } },
  });
  return rows.map((r) => r.user);
}
