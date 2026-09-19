"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/server/auth/guards";
import { errorKey } from "@/server/action-result";
import { handleDelete, handleMove, runAdminAction, safeReturn } from "@/server/action-helpers";
import { generateSemestersSchema, semesterNameSchema, semesterRenameSchema } from "@/server/validation/admin";
import { idSchema } from "@/server/validation/common";
import { createSemester, deleteSemester, generateSemesters, moveSemester, promoteStudents, renameSemester } from "@/server/services/semesters";
import { TERMS } from "@/lib/terms";

const back = (courseId: string) => `/admin/courses/${courseId}`;
const failed = (to: string) => redirect(`${to.split("?")[0]}?error=failed`);

export async function createSemesterAction(formData: FormData) {
  const p = semesterNameSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return failed(safeReturn(formData.get("returnTo"), "/admin/courses"));
  await runAdminAction("semester", back(p.data.courseId), "semester-created", (actor) => createSemester(actor, p.data.courseId, p.data.name).then(() => undefined));
}

export async function generateSemestersAction(formData: FormData) {
  const p = generateSemestersSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return failed(safeReturn(formData.get("returnTo"), "/admin/courses"));
  await runAdminAction("semester", back(p.data.courseId), "semesters-generated", (actor) => generateSemesters(actor, p.data.courseId, p.data.count, TERMS.semester));
}

export async function renameSemesterAction(formData: FormData) {
  const returnTo = safeReturn(formData.get("returnTo"), "/admin/courses");
  const p = semesterRenameSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return failed(returnTo);
  await runAdminAction("semester", returnTo, "semester-renamed", (actor) => renameSemester(actor, p.data.id, p.data.name));
}

export async function moveSemesterAction(formData: FormData) {
  await handleMove("semester", formData, moveSemester, "/admin/courses");
}

export async function deleteSemesterAction(formData: FormData) {
  await handleDelete("semester", formData, deleteSemester, "/admin/courses", "semester-deleted");
}

/** Moves every active student in this semester to the next one. The count is passed back as a plain number for the message. */
export async function promoteSemesterAction(formData: FormData) {
  const returnTo = safeReturn(formData.get("returnTo"), "/admin/courses");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return failed(returnTo);

  let param: string;
  try {
    const { moved } = await promoteStudents(await assertAdmin(), id.data);
    param = `notice=students-promoted&n=${moved}`;
  } catch (err) {
    param = `error=${errorKey(err, "semester")}`;
  }
  revalidatePath("/admin", "layout");
  redirect(`${returnTo.split("?")[0]}?${param}`);
}
