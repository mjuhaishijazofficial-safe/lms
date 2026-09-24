"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/server/auth/guards";
import { formValues, fromZodError, toFormState, type FormState } from "@/server/action-result";
import { handleDelete, handleMove, handleStatus } from "@/server/action-helpers";
import { createMaterialSchema, updateMaterialSchema } from "@/server/validation/materials";
import { createMaterial, deleteMaterial, moveMaterial, setMaterialStatus, updateMaterial, type UploadedFile } from "@/server/services/materials";

/** The uploaded file, if the admin chose one. Its contents are validated in the service, not here. */
async function readFile(formData: FormData): Promise<UploadedFile | null> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return { name: file.name, data: Buffer.from(await file.arrayBuffer()) };
}

export async function createMaterialAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = createMaterialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  try {
    await createMaterial(await assertAdmin(), parsed.data, await readFile(formData));
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/materials?chapter=${parsed.data.chapterId}&notice=material-created`);
}

export async function updateMaterialAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = updateMaterialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  try {
    await updateMaterial(await assertAdmin(), parsed.data, await readFile(formData));
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/materials?chapter=${parsed.data.chapterId}&notice=material-updated`);
}

export type BulkUploadResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Creates one FILE material from one file. Called directly (not bound to a form) once per file from the bulk
 * upload page, so a folder of files becomes a folder of materials instead of one form submission each.
 */
export async function bulkUploadMaterialAction(formData: FormData): Promise<BulkUploadResult> {
  const parsed = createMaterialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Something was wrong with this file." };
  try {
    const material = await createMaterial(await assertAdmin(), parsed.data, await readFile(formData));
    revalidatePath("/admin", "layout");
    return { ok: true, id: material.id };
  } catch (err) {
    return { ok: false, error: toFormState(err).error ?? "Something went wrong." };
  }
}

export async function moveMaterialAction(formData: FormData) {
  await handleMove("material", formData, moveMaterial, "/admin/materials");
}
export async function setMaterialStatusAction(formData: FormData) {
  await handleStatus("material", formData, setMaterialStatus, "/admin/materials");
}
export async function deleteMaterialAction(formData: FormData) {
  await handleDelete("material", formData, deleteMaterial, "/admin/materials", "material-deleted");
}
