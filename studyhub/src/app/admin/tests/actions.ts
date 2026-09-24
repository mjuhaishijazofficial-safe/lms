"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/server/auth/guards";
import { formValues, fromZodError, toFormState, type FormState } from "@/server/action-result";
import { handleDelete, handleStatus } from "@/server/action-helpers";
import { createTestSchema, updateTestSchema } from "@/server/validation/tests";
import { createTest, deleteTest, setTestStatus, updateTest } from "@/server/services/tests";

export async function createTestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = createTestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  try {
    await createTest(await assertAdmin(), parsed.data);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/tests?subject=${parsed.data.subjectId}&notice=test-created`);
}

export async function updateTestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = updateTestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  try {
    await updateTest(await assertAdmin(), parsed.data);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/tests?subject=${parsed.data.subjectId}&notice=test-updated`);
}

export async function setTestStatusAction(formData: FormData) {
  await handleStatus("test", formData, setTestStatus, "/admin/tests");
}
export async function deleteTestAction(formData: FormData) {
  await handleDelete("test", formData, deleteTest, "/admin/tests", "test-deleted");
}
