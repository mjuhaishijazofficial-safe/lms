import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import { hashPassword } from "@/server/auth/password";
import type { SessionUser } from "@/server/auth/session";
import { makePassword, makeUsername, matchSubject, parseStudentList } from "@/lib/student-import";
import { ensureAdmin } from "./_shared";
import { assertSemesterInCourse, firstSemesterId } from "./semesters";

const MAX_STUDENTS = 200;
const MAX_CHARS = 100_000;

export type ImportRow = {
  name: string;
  username: string;
  /** Subjects that were found, by the name they have in StudyHub. */
  subjects: string[];
  /** Codes from the list that match no subject: fix the spelling, or add the subject first. */
  unmatched: string[];
  /** Set when this student is not created, e.g. because someone with the same name exists. */
  skipped?: string;
};
export type ImportPlan = { rows: ImportRow[]; created: number };
export type CreatedStudent = { name: string; username: string; password: string; subjects: number };
export type FailedStudent = { name: string; reason: string };

/**
 * Works out what an import would do. With commit = false nothing is written, so the admin can check the plan first.
 * With commit = true the students are created and their temporary passwords are returned (they are shown once).
 */
export async function importStudents(
  actor: SessionUser,
  input: { text: string; courseId: string | null; semesterId: string | null; commit: boolean },
): Promise<{ plan: ImportPlan; credentials: CreatedStudent[]; failed: FailedStudent[] }> {
  ensureAdmin(actor);
  if (input.text.length > MAX_CHARS) throw new ServiceError("That list is too long. Import it in smaller parts.", "text");
  const parsed = parseStudentList(input.text);
  if (parsed.length === 0) throw new ServiceError("Paste at least one student: a name, then their subject codes.", "text");
  if (parsed.length > MAX_STUDENTS) throw new ServiceError(`Import at most ${MAX_STUDENTS} students at a time.`, "text");

  if (input.courseId && !(await db.course.findUnique({ where: { id: input.courseId }, select: { id: true } }))) {
    throw new ServiceError("Choose a program that exists.", "courseId");
  }
  const semesterId = input.courseId
    ? ((await assertSemesterInCourse(input.semesterId, input.courseId)) ?? (await firstSemesterId(input.courseId)))
    : null;

  const [subjects, users] = await Promise.all([
    db.subject.findMany({ where: { status: "PUBLISHED" }, select: { id: true, name: true, courseId: true }, orderBy: { createdAt: "asc" } }),
    db.user.findMany({ select: { email: true, name: true, role: true } }),
  ]);
  const taken = new Set(users.map((u) => u.email));
  const existingStudents = new Set(users.filter((u) => u.role === "STUDENT").map((u) => u.name.trim().toLowerCase()));
  const namesInThisList = new Set<string>();

  const rows: ImportRow[] = [];
  const toCreate: { row: ImportRow; subjectIds: string[] }[] = [];

  for (const student of parsed) {
    const key = student.name.toLowerCase();
    const matched = new Map<string, string>();
    const unmatched: string[] = [];
    for (const code of student.codes) {
      const s = matchSubject(code, subjects, input.courseId);
      if (s) matched.set(s.id, s.name);
      else unmatched.push(code);
    }

    let skipped: string | undefined;
    if (existingStudents.has(key)) skipped = "A student with this name already exists. Edit them instead.";
    else if (namesInThisList.has(key)) skipped = "This name appears twice in the list.";
    namesInThisList.add(key);

    const row: ImportRow = {
      name: student.name,
      username: skipped ? "" : makeUsername(student.name, taken),
      subjects: [...matched.values()],
      unmatched,
      skipped,
    };
    rows.push(row);
    if (!skipped) toCreate.push({ row, subjectIds: [...matched.keys()] });
  }

  const plan: ImportPlan = { rows, created: toCreate.length };
  if (!input.commit) return { plan, credentials: [], failed: [] };

  const credentials: CreatedStudent[] = [];
  const failed: FailedStudent[] = [];
  // One student failing must not lose the passwords of the ones already created, so each is its own attempt.
  for (const { row, subjectIds } of toCreate) {
    const password = makePassword(() => randomBytes(1)[0]);
    try {
      await db.user.create({
        data: {
          name: row.name,
          email: row.username,
          role: "STUDENT",
          status: "ACTIVE",
          mustChangePassword: true,
          passwordHash: await hashPassword(password),
          studentProfile: { create: {} },
          studentSubjects: { create: subjectIds.map((subjectId) => ({ subjectId })) },
          ...(input.courseId ? { enrollments: { create: { courseId: input.courseId, semesterId } } } : {}),
        },
        select: { id: true },
      });
      credentials.push({ name: row.name, username: row.username, password, subjects: subjectIds.length });
    } catch (err) {
      console.error("Student import failed for one row", err);
      failed.push({ name: row.name, reason: "Could not be created. Add this student by hand." });
    }
  }
  return { plan, credentials, failed };
}
