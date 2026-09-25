"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/server/auth/guards";
import { errorKey, fromZodError, toFormState, type FormState } from "@/server/action-result";
import { quickCourseSchema, vuImportSchema } from "@/server/validation/admin";
import { assignSemesters, importVuCourses, quickAddCourse, removeEmptySemesters } from "@/server/services/programs";
import { idSchema } from "@/server/validation/common";

/** The "add a course" box inside a semester. Returns instead of redirecting so the page keeps its scroll position. */
export async function quickAddCourseAction(prev: FormState, formData: FormData): Promise<FormState> {
  const key = (prev.key ?? 0) + 1;
  const parsed = quickCourseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ...fromZodError(parsed.error), key };
  try {
    const subject = await quickAddCourse(await assertAdmin(), parsed.data);
    revalidatePath("/admin", "layout");
    return { success: `Added ${subject.name}.`, key };
  } catch (err) {
    return { ...toFormState(err, { name: parsed.data.name }), key };
  }
}

/**
 * The "these courses need a semester" form: one select per course, named `semester_<courseId>`. Selects left on
 * "Choose…" are skipped. Plain redirect, so it works without JavaScript.
 */
export async function assignSemestersAction(formData: FormData) {
  const courseId = idSchema.safeParse(formData.get("courseId"));
  if (!courseId.success) redirect("/admin/courses?error=failed");
  const back = `/admin/courses/${courseId.data}`;
  const picks: { subjectId: string; semesterId: string }[] = [];
  for (const [key, value] of formData) {
    if (!key.startsWith("semester_") || typeof value !== "string" || !value) continue;
    const subjectId = idSchema.safeParse(key.slice("semester_".length));
    const semesterId = idSchema.safeParse(value);
    if (subjectId.success && semesterId.success) picks.push({ subjectId: subjectId.data, semesterId: semesterId.data });
  }
  let param: string;
  try {
    param = `notice=semesters-assigned&n=${await assignSemesters(await assertAdmin(), courseId.data, picks)}`;
  } catch (err) {
    param = `error=${errorKey(err, "subject")}`;
  }
  revalidatePath("/admin", "layout");
  redirect(`${back}?${param}`);
}

/** The "Remove them" link for empty semesters at the end of a program. */
export async function removeEmptySemestersAction(formData: FormData) {
  const courseId = idSchema.safeParse(formData.get("courseId"));
  if (!courseId.success) redirect("/admin/courses?error=failed");
  let param: string;
  try {
    param = `notice=semesters-removed&n=${await removeEmptySemesters(await assertAdmin(), courseId.data)}`;
  } catch (err) {
    param = `error=${errorKey(err, "semester")}`;
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/courses/${courseId.data}?${param}`);
}

export async function importVuAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = vuImportSchema.safeParse({
    slug: formData.get("slug"),
    target: formData.get("target"),
    status: formData.get("status"),
    codes: formData.getAll("codes"),
  });
  // One plain sentence ("Tick at least one course."), rather than "fix the highlighted fields" on a page with none.
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Something was wrong with the form. Please try again." };
  let result: { courseId: string; added: number };
  try {
    result = await importVuCourses(await assertAdmin(), parsed.data);
  } catch (err) {
    return toFormState(err);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/courses/${result.courseId}?notice=vu-imported&n=${result.added}`);
}
