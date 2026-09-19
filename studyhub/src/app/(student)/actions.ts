"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertStudent } from "@/server/auth/guards";
import { idSchema } from "@/server/validation/common";
import { safeReturnPath } from "@/lib/params";
import { toggleMaterialBookmark, toggleSubjectBookmark } from "@/server/services/bookmarks";
import { toggleCompleted } from "@/server/services/progress";

/**
 * Shared tail for every toggle below: refresh everything a student might soft-navigate to next (progress
 * percentages and bookmark lists appear on several pages), then send them back to where they clicked from.
 */
function afterToggle(returnToRaw: FormDataEntryValue | null, fallback: string): never {
  revalidatePath("/", "layout");
  redirect(safeReturnPath(returnToRaw, fallback));
}

export async function toggleSubjectBookmarkAction(formData: FormData) {
  const user = await assertStudent();
  const id = idSchema.safeParse(formData.get("subjectId"));
  if (id.success) {
    try {
      await toggleSubjectBookmark(user, id.data);
    } catch {
      // The subject is no longer visible to this student; nothing to toggle. Fall through and just navigate back.
    }
  }
  afterToggle(formData.get("returnTo"), id.success ? `/subjects/${id.data}` : "/dashboard");
}

export async function toggleMaterialBookmarkAction(formData: FormData) {
  const user = await assertStudent();
  const id = idSchema.safeParse(formData.get("materialId"));
  if (id.success) {
    try {
      await toggleMaterialBookmark(user, id.data);
    } catch {
      // No longer visible; nothing to toggle.
    }
  }
  afterToggle(formData.get("returnTo"), id.success ? `/materials/${id.data}` : "/dashboard");
}

export async function toggleCompletedAction(formData: FormData) {
  const user = await assertStudent();
  const id = idSchema.safeParse(formData.get("materialId"));
  if (id.success) {
    try {
      await toggleCompleted(user, id.data);
    } catch {
      // No longer visible; nothing to toggle.
    }
  }
  afterToggle(formData.get("returnTo"), id.success ? `/materials/${id.data}` : "/dashboard");
}
