"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/server/auth/guards";
import { formValues, fromZodError, toFormState, type FormState } from "@/server/action-result";
import { handleDelete, handleMove, handleStatus } from "@/server/action-helpers";
import { courseSchema, withId } from "@/server/validation/admin";
import { createCourse, deleteCourse, moveCourse, setCourseStatus, updateCourse } from "@/server/services/courses";

export async function createCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = courseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  try {
    await createCourse(await assertAdmin(), parsed.data);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/courses?notice=course-created");
}

export async function updateCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = withId(courseSchema).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error, values);
  const { id, ...data } = parsed.data;
  try {
    await updateCourse(await assertAdmin(), id, data);
  } catch (err) {
    return toFormState(err, values);
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/courses?notice=course-updated");
}

export async function moveCourseAction(formData: FormData) {
  await handleMove("course", formData, moveCourse, "/admin/courses");
}
export async function setCourseStatusAction(formData: FormData) {
  await handleStatus("course", formData, setCourseStatus, "/admin/courses");
}
export async function deleteCourseAction(formData: FormData) {
  await handleDelete("course", formData, deleteCourse, "/admin/courses", "course-deleted");
}
