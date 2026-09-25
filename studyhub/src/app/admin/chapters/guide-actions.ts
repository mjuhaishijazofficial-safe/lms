"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/server/auth/guards";
import { toFormState } from "@/server/action-result";
import { guideChapterSchema } from "@/server/validation/guides";
import { createChapterFromGuide } from "@/server/services/guides";

export type GuideChapterResult =
  | { ok: true; chapterId: string; chapterNumber: number; testId: string | null }
  | { ok: false; error: string };

/**
 * One study guide → one chapter (with its guide and test). The page calls this once per file, one after another,
 * so each request stays small (hosting caps request size) and each file reports its own success or problem.
 */
export async function createChapterFromGuideAction(formData: FormData): Promise<GuideChapterResult> {
  const parsed = guideChapterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Something was wrong with this guide." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "The guide file is missing." };
  try {
    const result = await createChapterFromGuide(await assertAdmin(), parsed.data, { name: file.name, data: Buffer.from(await file.arrayBuffer()) });
    revalidatePath("/admin", "layout");
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: toFormState(err).error ?? "Something went wrong." };
  }
}
