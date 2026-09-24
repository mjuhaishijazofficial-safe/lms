"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/server/auth/guards";
import { formValues, fromZodError, toFormState, type FormState } from "@/server/action-result";
import { handleDelete, runAdminAction, safeReturn } from "@/server/action-helpers";
import { bulkFeeSchema, feeStatusSchema, singleFeeSchema } from "@/server/validation/fees";
import { createFeeForStudent, createFeesBulk, deleteFee, setFeeStatus } from "@/server/services/fees";

export async function createFeeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = singleFeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  try {
    await createFeeForStudent(await assertAdmin(), parsed.data);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/students/${parsed.data.userId}?notice=fee-created`);
}

export async function createFeesBulkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = bulkFeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  let created = 0;
  try {
    ({ created } = await createFeesBulk(await assertAdmin(), parsed.data));
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/fees?notice=fees-created&n=${created}`);
}

export async function setFeeStatusAction(formData: FormData) {
  const returnTo = safeReturn(formData.get("returnTo"), "/admin/fees");
  const parsed = feeStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=failed`);
  return runAdminAction("fee", returnTo, "status-updated", async (actor) => {
    await setFeeStatus(actor, parsed.data.id, parsed.data.status);
  });
}

export async function deleteFeeAction(formData: FormData) {
  await handleDelete("fee", formData, deleteFee, "/admin/fees", "fee-deleted");
}
