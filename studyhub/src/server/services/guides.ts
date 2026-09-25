import "server-only";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import type { GuideChapterInput } from "@/server/validation/guides";
import { createMaterialSchema } from "@/server/validation/materials";
import { extensionOf } from "@/server/materials/upload";
import { ensureAdmin } from "./_shared";
import { createChapter, nextChapterNumber } from "./chapters";
import { createMaterial, deleteMaterial, type UploadedFile } from "./materials";
import { createTest } from "./tests";

/**
 * Turns one study-guide HTML file into a whole chapter: the next-numbered chapter in the subject, the guide as its
 * material, and a practice test from the guide's MCQs — all released together (now, at a scheduled time, or kept
 * hidden). If any step fails, what was already made is removed again, so a half-built chapter is never left behind.
 */
export async function createChapterFromGuide(actor: SessionUser, input: GuideChapterInput, file: UploadedFile) {
  ensureAdmin(actor);
  if (!["html", "htm"].includes(extensionOf(file.name))) throw new ServiceError("Choose an HTML study guide (a .html file).", "file");

  const status = input.release === "now" ? "PUBLISHED" : "DRAFT";
  const chapterNumber = await nextChapterNumber(input.subjectId);
  const chapter = await createChapter(actor, {
    subjectId: input.subjectId, title: input.title, chapterNumber, description: input.description, status, publishAt: input.publishAt,
  });

  try {
    // The guide itself is Published: it appears exactly when its chapter does.
    const material = createMaterialSchema.parse({ type: "FILE", chapterId: chapter.id, title: input.materialTitle, description: "", status: "PUBLISHED" });
    await createMaterial(actor, material, file);

    let testId: string | null = null;
    if (input.makeTest && input.questions.length) {
      const test = await createTest(actor, {
        subjectId: input.subjectId,
        title: `Chapter ${chapterNumber} test: ${input.title}`.slice(0, 160),
        description: `Practice MCQs for chapter ${chapterNumber}, ${input.title}.`.slice(0, 500),
        durationMinutes: input.durationMinutes,
        status, publishAt: input.publishAt,
        questionsJson: input.questions,
      });
      testId = test.id;
    }
    return { chapterId: chapter.id, chapterNumber, testId };
  } catch (err) {
    const made = await db.material.findMany({ where: { chapterId: chapter.id }, select: { id: true } });
    for (const m of made) await deleteMaterial(actor, m.id).catch((e) => console.error("Undo: could not remove material", m.id, e));
    await db.chapter.delete({ where: { id: chapter.id } }).catch((e) => console.error("Undo: could not remove chapter", chapter.id, e));
    throw err;
  }
}

/** The number the next chapter of each subject will get, for the preview before anything is created. */
export async function nextChapterNumbers(): Promise<Record<string, number>> {
  const rows = await db.chapter.groupBy({ by: ["subjectId"], _max: { chapterNumber: true } });
  return Object.fromEntries(rows.map((r) => [r.subjectId, (r._max.chapterNumber ?? 0) + 1]));
}
