"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/server/auth/guards";
import { formValues, fromZodError, toFormState, type FormState } from "@/server/action-result";
import { accountSchema } from "@/server/validation/admin";
import { updateOwnName } from "@/server/services/account";

export async function updateAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  try {
    await updateOwnName(await assertAdmin(), parsed.data.name);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/settings?notice=account-updated");
}
