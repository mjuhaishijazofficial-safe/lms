import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import { parseLesson } from "@/server/materials/lesson-sanitize";
import { ensureAdmin, nextOrder } from "./_shared";

/**
 * Generated lessons are stored as Drafts: a chapter for the lesson, with one Lesson material inside. Nothing reaches
 * students until the admin has looked at it and published it, because these are what students revise from before an
 * exam and a wrong answer marked correct would teach them something false.
 */

const MATERIAL_TITLE = "Study guide";

async function assertSubject(subjectId: string) {
  if (!(await db.subject.findUnique({ where: { id: subjectId }, select: { id: true } }))) {
    throw new ServiceError("Choose a subject that exists.", "subjectId");
  }
}

export type LessonState = { number: number; chapterId: string; materialId: string | null; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" };

/** Which lesson numbers of a subject already have a generated lesson, so a run can skip or redo them. */
export async function lessonStates(actor: SessionUser, subjectId: string): Promise<LessonState[]> {
  ensureAdmin(actor);
  const chapters = await db.chapter.findMany({
    where: { subjectId, materials: { some: { type: "LESSON" } } },
    select: { id: true, chapterNumber: true, materials: { where: { type: "LESSON" }, select: { id: true, status: true }, take: 1 } },
  });
  return chapters.map((c) => ({ number: c.chapterNumber, chapterId: c.id, materialId: c.materials[0]?.id ?? null, status: c.materials[0]?.status ?? "DRAFT" }));
}

/**
 * Stores one generated lesson. The chapter for that lesson number is created if it does not exist; if the lesson
 * already has a study guide, its content is replaced (so a lesson can be regenerated) and its status is kept.
 */
export async function saveGeneratedLesson(
  actor: SessionUser,
  input: { subjectId: string; number: number; title: string; lesson: unknown },
) {
  ensureAdmin(actor);
  await assertSubject(input.subjectId);
  const parsed = parseLesson(input.lesson);
  if (!parsed.ok) throw new ServiceError(parsed.error);
  const data = parsed.lesson as unknown as Prisma.InputJsonValue;

  const existing = await db.chapter.findFirst({
    where: { subjectId: input.subjectId, chapterNumber: input.number },
    select: { id: true, materials: { where: { type: "LESSON" }, select: { id: true }, take: 1 } },
  });

  return db.$transaction(async (tx) => {
    let chapterId = existing?.id;
    if (!chapterId) {
      const last = await tx.chapter.aggregate({ where: { subjectId: input.subjectId }, _max: { order: true } });
      chapterId = (
        await tx.chapter.create({
          data: { subjectId: input.subjectId, title: input.title, chapterNumber: input.number, order: nextOrder(last._max.order), status: "DRAFT" },
          select: { id: true },
        })
      ).id;
    }
    const materialId = existing?.materials[0]?.id;
    if (materialId) {
      await tx.material.update({ where: { id: materialId }, data: { lessonData: data } });
      return { chapterId, materialId, replaced: true };
    }
    const last = await tx.material.aggregate({ where: { chapterId }, _max: { order: true } });
    const material = await tx.material.create({
      data: {
        chapterId, type: "LESSON", title: MATERIAL_TITLE, description: "", status: "DRAFT",
        order: nextOrder(last._max.order), lessonData: data, uploadedById: actor.id,
      },
      select: { id: true },
    });
    return { chapterId, materialId: material.id, replaced: false };
  });
}

/** Makes the reviewed lessons visible to students: both the chapter and its study guide. */
export async function publishLessons(actor: SessionUser, subjectId: string, numbers: number[]) {
  ensureAdmin(actor);
  if (numbers.length === 0) return { published: 0 };
  const chapters = await db.chapter.findMany({
    where: { subjectId, chapterNumber: { in: numbers }, materials: { some: { type: "LESSON" } } },
    select: { id: true },
  });
  const ids = chapters.map((c) => c.id);
  await db.$transaction([
    db.chapter.updateMany({ where: { id: { in: ids } }, data: { status: "PUBLISHED" } }),
    db.material.updateMany({ where: { chapterId: { in: ids }, type: "LESSON" }, data: { status: "PUBLISHED" } }),
  ]);
  return { published: ids.length };
}
