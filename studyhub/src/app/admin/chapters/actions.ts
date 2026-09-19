"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/server/auth/guards";
import { formValues, fromZodError, toFormState, type FormState } from "@/server/action-result";
import { handleDelete, handleMove, handleStatus } from "@/server/action-helpers";
import { chapterSchema, withId } from "@/server/validation/admin";
import { createChapter, deleteChapter, moveChapter, setChapterStatus, updateChapter } from "@/server/services/chapters";

export async function createChapterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = chapterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  try {
    await createChapter(await assertAdmin(), parsed.data);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/chapters?subject=${parsed.data.subjectId}&notice=chapter-created`);
}

export async function updateChapterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = withId(chapterSchema).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  const { id, ...data } = parsed.data;
  try {
    await updateChapter(await assertAdmin(), id, data);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/chapters?subject=${data.subjectId}&notice=chapter-updated`);
}

export async function moveChapterAction(formData: FormData) {
  await handleMove("chapter", formData, moveChapter, "/admin/chapters");
}
export async function setChapterStatusAction(formData: FormData) {
  await handleStatus("chapter", formData, setChapterStatus, "/admin/chapters");
}
export async function deleteChapterAction(formData: FormData) {
  await handleDelete("chapter", formData, deleteChapter, "/admin/chapters", "chapter-deleted");
}
