"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/server/auth/guards";
import { formValues, fromZodError, toFormState, type FormState } from "@/server/action-result";
import { runAdminAction, safeReturn } from "@/server/action-helpers";
import { createStudentSchema, resetPasswordSchema, updateStudentSchema } from "@/server/validation/admin";
import { idSchema } from "@/server/validation/common";
import { createStudent, deleteStudent, resetStudentPassword, setStudentStatus, updateStudent } from "@/server/services/students";
import { z } from "zod";

/** Object.fromEntries keeps only the last value of a repeated field, so the subject checkboxes are read separately. */
const studentFields = (formData: FormData) => ({
  ...Object.fromEntries(formData),
  // The picker also submits one empty value, so that clearing every box still reaches the server as an empty list.
  subjectIds: formData.getAll("subjectIds").filter((v) => typeof v === "string" && v !== ""),
});

export async function createStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = createStudentSchema.safeParse(studentFields(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  try {
    await createStudent(await assertAdmin(), parsed.data);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/students?notice=student-created");
}

export async function updateStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = updateStudentSchema.safeParse(studentFields(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  try {
    await updateStudent(await assertAdmin(), parsed.data);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/students?notice=student-updated");
}

export async function resetStudentPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await resetStudentPassword(await assertAdmin(), parsed.data.id, parsed.data.password);
  } catch (err) {
    return toFormState(err);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/students/${parsed.data.id}?notice=password-reset`);
}

const toggleSchema = z.object({ id: idSchema, status: z.enum(["ACTIVE", "INACTIVE"]) });

export async function setStudentStatusAction(formData: FormData) {
  const returnTo = safeReturn(formData.get("returnTo"), "/admin/students");
  const parsed = toggleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`${returnTo.split("?")[0]}?error=failed`);
  await runAdminAction("student", returnTo, parsed.data.status === "ACTIVE" ? "student-activated" : "student-deactivated",
    (actor) => setStudentStatus(actor, parsed.data.id, parsed.data.status));
}

export async function deleteStudentAction(formData: FormData) {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/students?error=failed");
  await runAdminAction("student", "/admin/students", "student-deleted", (actor) => deleteStudent(actor, id.data));
}
