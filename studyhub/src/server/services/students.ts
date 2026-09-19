import "server-only";
import type { Prisma, UserStatus } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import { hashPassword } from "@/server/auth/password";
import { destroyAllSessions, type SessionUser } from "@/server/auth/session";
import type { createStudentSchema, updateStudentSchema } from "@/server/validation/admin";
import { ensureAdmin, PAGE_SIZE } from "./_shared";
import { assertSemesterInCourse, firstSemesterId } from "./semesters";

// Never select passwordHash into anything that could reach a page.
const studentSelect = {
  id: true, name: true, email: true, status: true, createdAt: true, lastLoginAt: true, mustChangePassword: true,
  studentProfile: { select: { studentId: true } },
  enrollments: { select: { course: { select: { id: true, name: true } }, semester: { select: { id: true, name: true } } }, take: 1, orderBy: { createdAt: "asc" } },
} satisfies Prisma.UserSelect;

export type StudentRow = Prisma.UserGetPayload<{ select: typeof studentSelect }>;

export async function listStudents(filter: { q?: string; courseId?: string; semesterId?: string; status?: UserStatus; page: number }) {
  const where: Prisma.UserWhereInput = {
    role: "STUDENT",
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.semesterId
      ? { enrollments: { some: { semesterId: filter.semesterId } } }
      : filter.courseId === "none" ? { enrollments: { none: {} } } : filter.courseId ? { enrollments: { some: { courseId: filter.courseId } } } : {}),
    ...(filter.q
      ? {
          OR: [
            { name: { contains: filter.q, mode: "insensitive" } },
            { email: { contains: filter.q, mode: "insensitive" } },
            { studentProfile: { studentId: { contains: filter.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({ where, select: studentSelect, orderBy: { createdAt: "desc" }, skip: (filter.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.user.count({ where }),
  ]);
  return { rows, total };
}

export function getStudent(id: string) {
  return db.user.findFirst({ where: { id, role: "STUDENT" }, select: studentSelect });
}

async function assertCourse(courseId: string | null) {
  if (courseId && !(await db.course.findUnique({ where: { id: courseId }, select: { id: true } }))) {
    throw new ServiceError("Choose a program that exists.", "courseId");
  }
}

/**
 * The semester to store for an enrolment. An explicit choice must belong to the program. When none is chosen the
 * student starts in the program's first semester, so they see something as soon as they sign in.
 */
async function resolveSemester(courseId: string | null, semesterId: string | null): Promise<string | null> {
  if (!courseId) return null;
  return (await assertSemesterInCourse(semesterId, courseId)) ?? (await firstSemesterId(courseId));
}

export async function createStudent(actor: SessionUser, data: z.infer<typeof createStudentSchema>) {
  ensureAdmin(actor);
  await assertCourse(data.courseId);
  const semesterId = await resolveSemester(data.courseId, data.semesterId);
  return db.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: "STUDENT",
      status: data.status,
      mustChangePassword: true,
      passwordHash: await hashPassword(data.password),
      studentProfile: { create: { studentId: data.studentId } },
      ...(data.courseId ? { enrollments: { create: { courseId: data.courseId, semesterId } } } : {}),
    },
    select: { id: true },
  });
}

export async function updateStudent(actor: SessionUser, data: z.infer<typeof updateStudentSchema>) {
  ensureAdmin(actor);
  const existing = await getStudent(data.id);
  if (!existing) throw new ServiceError("This student no longer exists.", undefined, "not-found");
  await assertCourse(data.courseId);
  const semesterId = await resolveSemester(data.courseId, data.semesterId);

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: data.id }, data: { name: data.name, email: data.email, status: data.status } });
    await tx.studentProfile.upsert({
      where: { userId: data.id },
      create: { userId: data.id, studentId: data.studentId },
      update: { studentId: data.studentId },
    });
    // V1: one program per student. Replace any existing enrolment.
    await tx.enrollment.deleteMany({ where: { userId: data.id, ...(data.courseId ? { NOT: { courseId: data.courseId } } : {}) } });
    if (data.courseId) {
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: data.id, courseId: data.courseId } },
        create: { userId: data.id, courseId: data.courseId, semesterId },
        update: { semesterId },
      });
    }
  });
  if (data.status === "INACTIVE") await destroyAllSessions(data.id);
}

export async function setStudentStatus(actor: SessionUser, id: string, status: UserStatus) {
  ensureAdmin(actor);
  const { count } = await db.user.updateMany({ where: { id, role: "STUDENT" }, data: { status } });
  if (!count) throw new ServiceError("This student no longer exists.", undefined, "not-found");
  if (status === "INACTIVE") await destroyAllSessions(id);
}

/** Admin sets a temporary password; the student must replace it at next sign-in. All their sessions end. */
export async function resetStudentPassword(actor: SessionUser, id: string, password: string) {
  ensureAdmin(actor);
  const { count } = await db.user.updateMany({
    where: { id, role: "STUDENT" },
    data: { passwordHash: await hashPassword(password), mustChangePassword: true },
  });
  if (!count) throw new ServiceError("This student no longer exists.", undefined, "not-found");
  await destroyAllSessions(id);
}

export async function deleteStudent(actor: SessionUser, id: string) {
  ensureAdmin(actor);
  const { count } = await db.user.deleteMany({ where: { id, role: "STUDENT" } });
  if (!count) throw new ServiceError("This student no longer exists.", undefined, "not-found");
}
