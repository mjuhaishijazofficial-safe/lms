"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/auth/guards";
import { formValues, fromZodError, toFormState, type FormState } from "@/server/action-result";
import { handleDelete, runAdminAction } from "@/server/action-helpers";
import { announcementSchema } from "@/server/validation/admin";
import { idSchema } from "@/server/validation/common";
import { createAnnouncement, deleteAnnouncement, setAnnouncementActive } from "@/server/services/announcements";

export async function createAnnouncementAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = announcementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  try {
    await createAnnouncement(await assertAdmin(), parsed.data);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard");
  redirect("/admin/announcements?notice=announcement-created");
}

const toggleSchema = z.object({ id: idSchema, active: z.enum(["true", "false"]) });

export async function setAnnouncementActiveAction(formData: FormData) {
  const parsed = toggleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/announcements?error=failed");
  const active = parsed.data.active === "true";
  await runAdminAction("announcement", "/admin/announcements", active ? "announcement-shown" : "announcement-hidden",
    async (actor) => {
      await setAnnouncementActive(actor, parsed.data.id, active);
      revalidatePath("/dashboard");
    });
}

export async function deleteAnnouncementAction(formData: FormData) {
  await handleDelete("announcement", formData, async (actor, id) => {
    await deleteAnnouncement(actor, id);
    revalidatePath("/dashboard");
  }, "/admin/announcements", "announcement-deleted");
}
