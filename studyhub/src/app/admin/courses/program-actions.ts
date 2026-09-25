"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/server/auth/guards";
import { fromZodError, toFormState, type FormState } from "@/server/action-result";
import { quickCourseSchema, vuImportSchema } from "@/server/validation/admin";
import { importVuCourses, quickAddCourse } from "@/server/services/programs";

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
