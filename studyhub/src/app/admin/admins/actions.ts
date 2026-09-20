"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/auth/guards";
import { formValues, fromZodError, toFormState, type FormState } from "@/server/action-result";
import { runAdminAction } from "@/server/action-helpers";
import { adminPasswordSchema, createAdminSchema } from "@/server/validation/admin";
import { idSchema } from "@/server/validation/common";
import { createAdmin, resetAdminPassword, setAdminStatus } from "@/server/services/admins";

export async function createAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = createAdminSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  try {
    await createAdmin(await assertAdmin(), parsed.data);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/admins?notice=admin-created");
}

const toggleSchema = z.object({ id: idSchema, status: z.enum(["ACTIVE", "INACTIVE"]) });

export async function setAdminStatusAction(formData: FormData) {
  const parsed = toggleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/admins?error=failed");
  const { id, status } = parsed.data;
  const actor = await assertAdmin();
  if (id === actor.id && status === "INACTIVE") redirect("/admin/admins?error=admin-self");
  await runAdminAction("student", "/admin/admins", status === "ACTIVE" ? "admin-activated" : "admin-deactivated",
    (a) => setAdminStatus(a, id, status));
}

export async function resetAdminPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = adminPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await resetAdminPassword(await assertAdmin(), parsed.data.id, parsed.data.password);
  } catch (err) {
    return toFormState(err);
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/admins?notice=admin-password-reset");
}
