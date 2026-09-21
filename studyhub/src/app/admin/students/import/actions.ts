"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/auth/guards";
import { ServiceError } from "@/server/action-result";
import { idSchema } from "@/server/validation/common";
import { importStudents, type CreatedStudent, type FailedStudent, type ImportPlan } from "@/server/services/student-import";

export type ImportState = {
  error?: string;
  plan?: ImportPlan;
  /** Shown once, straight after creating: passwords are not stored anywhere readable. */
  credentials?: CreatedStudent[];
  failed?: FailedStudent[];
};

const schema = z.object({
  text: z.string().max(100_000, "That list is too long. Import it in smaller parts."),
  courseId: z.preprocess((v) => (v === "" ? null : v), idSchema.nullable()),
  semesterId: z.preprocess((v) => (v === "" ? null : v), idSchema.nullable()),
  intent: z.enum(["preview", "create"]),
});

export async function importStudentsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  try {
    const { plan, credentials, failed } = await importStudents(await assertAdmin(), {
      text: parsed.data.text,
      courseId: parsed.data.courseId,
      semesterId: parsed.data.semesterId,
      commit: parsed.data.intent === "create",
    });
    if (parsed.data.intent === "create") revalidatePath("/admin", "layout");
    return { plan, credentials, failed };
  } catch (err) {
    if (err instanceof ServiceError) return { error: err.message };
    console.error(err);
    return { error: "Something went wrong. Please try again." };
  }
}
