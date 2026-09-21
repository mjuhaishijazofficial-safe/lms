import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import type { SessionUser } from "@/server/auth/session";
import { studentMaterialWhere, type StudentScope } from "./visibility";

export { studentChapterWhere, studentCourseWhere, studentMaterialWhere, studentSubjectWhere } from "./visibility";
export type { StudentScope } from "./visibility";

/** The programs, current semesters and picked subjects of an active student. Cached for the length of a request. */
export const getStudentScope = cache(async (userId: string): Promise<StudentScope> => {
  const active = { status: "ACTIVE" as const, role: "STUDENT" as const };
  const [rows, picked] = await Promise.all([
    db.enrollment.findMany({
      where: { userId, user: active, course: { status: "PUBLISHED" } },
      orderBy: { createdAt: "asc" },
      select: { courseId: true, semester: { select: { id: true, name: true, order: true } } },
    }),
    db.studentSubject.findMany({ where: { userId, user: active }, select: { subjectId: true } }),
  ]);
  return { userId, enrollments: rows, subjectIds: picked.map((p) => p.subjectId) };
});

export type MaterialAccess = { exists: false } | { exists: true; allowed: boolean };

/** Admins may open anything; students only what studentMaterialWhere allows. */
export async function checkMaterialAccess(user: SessionUser, materialId: string): Promise<MaterialAccess> {
  const found = await db.material.findUnique({ where: { id: materialId }, select: { id: true } });
  if (!found) return { exists: false };
  if (user.role === "ADMIN") return { exists: true, allowed: true };
  if (user.role !== "STUDENT") return { exists: true, allowed: false };
  const scope = await getStudentScope(user.id);
  const visible = await db.material.count({ where: { id: materialId, ...studentMaterialWhere(scope) } });
  return { exists: true, allowed: visible > 0 };
}
