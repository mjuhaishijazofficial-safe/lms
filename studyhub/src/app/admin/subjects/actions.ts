"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/server/auth/guards";
import { formValues, fromZodError, toFormState, type FormState } from "@/server/action-result";
import { z } from "zod";
import { handleDelete, handleMove, handleStatus, runAdminAction } from "@/server/action-helpers";
import { idSchema } from "@/server/validation/common";
import { subjectSchema, withId } from "@/server/validation/admin";
import { createSubject, deleteSubject, mergeSubject, moveSubject, setSubjectStatus, updateSubject } from "@/server/services/subjects";

export async function createSubjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = subjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  try {
    await createSubject(await assertAdmin(), parsed.data);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/subjects?course=${parsed.data.courseId}&notice=subject-created`);
}

export async function updateSubjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = withId(subjectSchema).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  const { id, ...data } = parsed.data;
  try {
    await updateSubject(await assertAdmin(), id, data);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/subjects?course=${data.courseId}&notice=subject-updated`);
}

export async function moveSubjectAction(formData: FormData) {
  await handleMove("subject", formData, moveSubject, "/admin/subjects");
}
export async function setSubjectStatusAction(formData: FormData) {
  await handleStatus("subject", formData, setSubjectStatus, "/admin/subjects");
}
export async function deleteSubjectAction(formData: FormData) {
  await handleDelete("subject", formData, deleteSubject, "/admin/subjects", "subject-deleted");
}

const mergeSchema = z.object({ id: idSchema, targetId: idSchema });

export async function mergeSubjectAction(formData: FormData) {
  const parsed = mergeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/subjects?error=failed");
  const { id, targetId } = parsed.data;
  await runAdminAction("subject", `/admin/subjects/${targetId}`, "subject-merged", (actor) => mergeSubject(actor, id, targetId));
}
