import "server-only";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import type { chapterSchema } from "@/server/validation/admin";
import { ensureAdmin, moveInList, nextOrder, PAGE_SIZE } from "./_shared";

type ChapterInput = z.infer<typeof chapterSchema>;

const ORDER: Prisma.ChapterOrderByWithRelationInput[] = [
  { subject: { course: { order: "asc" } } },
  { subject: { order: "asc" } },
  { order: "asc" },
  { createdAt: "asc" },
];

export async function listChapters(filter: { courseId?: string; subjectId?: string; q?: string; page: number }) {
  const where: Prisma.ChapterWhereInput = {
    ...(filter.subjectId ? { subjectId: filter.subjectId } : filter.courseId ? { subject: { courseId: filter.courseId } } : {}),
    ...(filter.q ? { title: { contains: filter.q, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.chapter.findMany({
      where,
      orderBy: ORDER,
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        subject: { select: { id: true, name: true, semester: { select: { name: true } }, course: { select: { name: true } } } },
        _count: { select: { materials: true } },
      },
    }),
    db.chapter.count({ where }),
  ]);
  return { rows, total };
}

export function getChapter(id: string) {
  return db.chapter.findUnique({
    where: { id },
    include: { subject: { select: { id: true, name: true, semester: { select: { name: true } }, course: { select: { name: true } } } }, _count: { select: { materials: true } } },
  });
}

export async function nextChapterNumber(subjectId: string) {
  const max = await db.chapter.aggregate({ where: { subjectId }, _max: { chapterNumber: true } });
  return (max._max.chapterNumber ?? 0) + 1;
}

async function appendOrder(subjectId: string) {
  const max = await db.chapter.aggregate({ where: { subjectId }, _max: { order: true } });
  return nextOrder(max._max.order);
}

async function assertSubject(subjectId: string) {
  if (!(await db.subject.findUnique({ where: { id: subjectId }, select: { id: true } }))) {
    throw new ServiceError("Choose a subject that exists.", "subjectId");
  }
}

export async function createChapter(actor: SessionUser, data: ChapterInput) {
  ensureAdmin(actor);
  await assertSubject(data.subjectId);
  return db.chapter.create({ data: { ...data, order: await appendOrder(data.subjectId) } });
}

export async function updateChapter(actor: SessionUser, id: string, data: ChapterInput) {
  ensureAdmin(actor);
  const current = await db.chapter.findUnique({ where: { id }, select: { subjectId: true } });
  if (!current) throw new ServiceError("This chapter no longer exists.", undefined, "not-found");
  await assertSubject(data.subjectId);
  const moved = current.subjectId !== data.subjectId;
  return db.chapter.update({ where: { id }, data: { ...data, ...(moved ? { order: await appendOrder(data.subjectId) } : {}) } });
}

export async function moveChapter(actor: SessionUser, id: string, direction: "up" | "down") {
  ensureAdmin(actor);
  const chapter = await db.chapter.findUnique({ where: { id }, select: { subjectId: true } });
  if (!chapter) return;
  const siblings = await db.chapter.findMany({ where: { subjectId: chapter.subjectId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const next = moveInList(siblings, id, direction);
  if (next) await db.$transaction(next.map((c, i) => db.chapter.update({ where: { id: c.id }, data: { order: i } })));
}

export async function setChapterStatus(actor: SessionUser, id: string, status: ChapterInput["status"]) {
  ensureAdmin(actor);
  return db.chapter.update({ where: { id }, data: { status } });
}

/** Chapters with materials cannot be deleted, so uploaded files are never orphaned by accident. */
export async function deleteChapter(actor: SessionUser, id: string) {
  ensureAdmin(actor);
  const chapter = await getChapter(id);
  if (!chapter) throw new ServiceError("This chapter no longer exists.", undefined, "not-found");
  if (chapter._count.materials) throw new ServiceError("This chapter still has study materials. Archive it instead, or move or delete its materials first.", undefined, "not-empty");
  await db.chapter.delete({ where: { id } });
}
