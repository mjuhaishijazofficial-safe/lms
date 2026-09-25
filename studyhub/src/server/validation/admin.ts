import { z } from "zod";
import { SUBJECT_ICON_KEYS } from "@/lib/subject-icons";
import { contentStatusSchema, idSchema, optionalText, passwordSchema, publishAtSchema, trimmed } from "./common";

/** Login handle: an email address or a simple username. Stored lower-case. */
export const loginHandleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters.")
  .max(254)
  .refine(
    (v) => z.email().safeParse(v).success || /^[a-z0-9._-]{3,40}$/.test(v),
    "Enter an email address, or a username using letters, numbers, dots, dashes or underscores.",
  );

// A missing field, an empty one, and null all mean "not chosen". (A disabled <select> is not submitted at all, so absence must be allowed.)
const emptyToNull = (v: unknown) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v);

const studentBase = {
  name: trimmed(120, "Full name"),
  email: loginHandleSchema,
  studentId: z.preprocess(emptyToNull, z.string().trim().max(40, "Student ID must be 40 characters or fewer.").nullable()),
  courseId: z.preprocess(emptyToNull, idSchema.nullable()),
  semesterId: z.preprocess(emptyToNull, idSchema.nullable()),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  // Checkbox values arrive as a list; an empty list means "fall back to the semester rule".
  subjectIds: z.array(idSchema).default([]),
};

export const announcementSchema = z.object({
  title: trimmed(120, "Title"),
  body: trimmed(2000, "Message"),
  // Empty means every student.
  courseId: z.preprocess(emptyToNull, idSchema.nullable()),
});
export const createAdminSchema = z.object({ name: trimmed(120, "Full name"), email: loginHandleSchema, password: passwordSchema });
export const adminPasswordSchema = z.object({ id: idSchema, password: passwordSchema });
export const createStudentSchema = z.object({ ...studentBase, password: passwordSchema });
export const updateStudentSchema = z.object({ id: idSchema, ...studentBase });
export const resetPasswordSchema = z
  .object({ id: idSchema, password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match.", path: ["confirm"] });

export const courseSchema = z.object({
  name: trimmed(80, "Name"),
  description: optionalText(500),
  status: contentStatusSchema,
});

/**
 * Every course (subject) sits in one semester: the admin always gives students a semester, so a course "for every
 * semester" only caused confusion. The database still allows none, for courses made before this rule; the program page
 * lists those until the admin places them (see assignSemesters).
 */
const requiredSemester = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string({ error: "Choose a semester." }).regex(/^[a-z0-9]{20,40}$/i, "Choose a semester."),
);

export const subjectSchema = z.object({
  courseId: idSchema,
  semesterId: requiredSemester,
  // 120, not 80: VU course names with their code in front run to about 90 characters.
  name: trimmed(120, "Subject name"),
  description: optionalText(500),
  icon: z.enum(SUBJECT_ICON_KEYS, { error: "Choose an icon." }),
  status: contentStatusSchema,
});

export const chapterSchema = z.object({
  subjectId: idSchema,
  title: trimmed(120, "Chapter title"),
  chapterNumber: z.coerce.number({ error: "Enter a number." }).int("Use a whole number.").min(0).max(999),
  description: optionalText(500),
  status: contentStatusSchema,
  publishAt: publishAtSchema,
});

export const withId = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) => schema.extend({ id: idSchema });

export const moveSchema = z.object({ id: idSchema, direction: z.enum(["up", "down"]) });
export const statusChangeSchema = z.object({ id: idSchema, status: contentStatusSchema });
export const accountSchema = z.object({ name: trimmed(120, "Name") });
export const changePasswordSchema = z
  .object({ current: z.string().min(1, "Enter your current password."), password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match.", path: ["confirm"] })
  .refine((d) => d.password !== d.current, { message: "Choose a password different from the current one.", path: ["password"] });

/** The one-line "add a course" box inside a semester on the program page. */
export const quickCourseSchema = z.object({
  courseId: idSchema,
  semesterId: requiredSemester,
  name: trimmed(120, "Course name"),
});

/** Adding courses from a VU scheme: into an existing program, or a new one ("new"). Codes are checked against the catalog. */
export const vuImportSchema = z.object({
  slug: z.string().trim().min(1).max(60),
  target: z.union([z.literal("new"), idSchema]),
  status: z.enum(["PUBLISHED", "DRAFT"]),
  codes: z.array(z.string().trim().min(1).max(20)).min(1, "Tick at least one course.").max(400),
});

export const semesterNameSchema =z.object({ courseId: idSchema, name: trimmed(60, "Semester name") });
export const semesterRenameSchema = z.object({ id: idSchema, name: trimmed(60, "Semester name") });
export const generateSemestersSchema = z.object({
  courseId: idSchema,
  count: z.coerce.number({ error: "Enter how many semesters." }).int("Use a whole number.").min(1, "Add at least 1.").max(12, "Add at most 12 at a time."),
});
