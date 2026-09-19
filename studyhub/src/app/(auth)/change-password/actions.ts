"use server";

import { redirect } from "next/navigation";
import { assertUser, homeFor } from "@/server/auth/guards";
import { fromZodError, toFormState, type FormState } from "@/server/action-result";
import { changePasswordSchema } from "@/server/validation/admin";
import { changeOwnPassword } from "@/server/services/account";

/** Used both for the forced first-login change and for voluntary changes from Profile / Settings. */
export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  let home = "/";
  try {
    const user = await assertUser({ allowPasswordChange: true });
    await changeOwnPassword(user, parsed.data.current, parsed.data.password);
    home = homeFor(user);
  } catch (err) {
    return toFormState(err);
  }
  redirect(`${home === "/admin" ? "/admin/settings" : "/dashboard"}?notice=password-changed`);
}
