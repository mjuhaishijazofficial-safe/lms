import "server-only";
import { Prisma, type FeeStatus } from "@prisma/client";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import type { BulkFeeInput, SingleFeeInput } from "@/server/validation/fees";
import { ensureAdmin, PAGE_SIZE } from "./_shared";

// This is bookkeeping only: no money moves through the app. An admin records what a student owes for a period
// and marks it Paid once it is settled off-platform (cash, bank transfer, WhatsApp).

const ORDER: Prisma.FeeOrderByWithRelationInput[] = [{ createdAt: "desc" }];

const listInclude = {
  user: { select: { id: true, name: true, email: true, enrollments: { take: 1, orderBy: { createdAt: "asc" }, select: { course: { select: { name: true } } } } } },
} satisfies Prisma.FeeInclude;

export type FeeFilter = { courseId?: string; status?: FeeStatus; q?: string; page: number };

export async function listFees(filter: FeeFilter) {
  const userWhere: Prisma.UserWhereInput = {
    ...(filter.courseId ? { enrollments: { some: { courseId: filter.courseId } } } : {}),
    ...(filter.q ? { name: { contains: filter.q, mode: "insensitive" } } : {}),
  };
  const where: Prisma.FeeWhereInput = {
    ...(Object.keys(userWhere).length ? { user: userWhere } : {}),
    ...(filter.status ? { status: filter.status } : {}),
  };
  const [items, total] = await Promise.all([
    db.fee.findMany({ where, orderBy: ORDER, include: listInclude, skip: (filter.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.fee.count({ where }),
  ]);
  return { items, total };
}

/** Every fee a student has, newest first — for their own page and their profile in admin. */
export function studentFees(userId: string) {
  return db.fee.findMany({ where: { userId }, orderBy: ORDER });
}

export async function createFeeForStudent(actor: SessionUser, data: SingleFeeInput) {
  ensureAdmin(actor);
  const student = await db.user.findFirst({ where: { id: data.userId, role: "STUDENT" }, select: { id: true } });
  if (!student) throw new ServiceError("This student no longer exists.", undefined, "not-found");
  try {
    return await db.fee.create({ data: { userId: data.userId, amount: data.amount, period: data.period, dueDate: data.dueDate, note: data.note } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ServiceError(`This student already has a fee for "${data.period}".`, "period");
    }
    throw err;
  }
}

/** Creates one fee per matching active student for the period, skipping anyone who already has one for it. */
export async function createFeesBulk(actor: SessionUser, data: BulkFeeInput): Promise<{ created: number; skipped: number }> {
  ensureAdmin(actor);
  const where: Prisma.UserWhereInput = { role: "STUDENT", status: "ACTIVE", ...(data.target === "course" ? { enrollments: { some: { courseId: data.courseId } } } : {}) };
  const students = await db.user.findMany({ where, select: { id: true } });
  if (students.length === 0) throw new ServiceError("No active students match that.", "target");
  const result = await db.fee.createMany({
    data: students.map((s) => ({ userId: s.id, amount: data.amount, period: data.period, dueDate: data.dueDate, note: data.note })),
    skipDuplicates: true,
  });
  return { created: result.count, skipped: students.length - result.count };
}

export async function setFeeStatus(actor: SessionUser, id: string, status: FeeStatus) {
  ensureAdmin(actor);
  return db.fee.update({ where: { id }, data: { status, paidAt: status === "PAID" ? new Date() : null } });
}

export async function deleteFee(actor: SessionUser, id: string) {
  ensureAdmin(actor);
  const fee = await db.fee.findUnique({ where: { id }, select: { id: true } });
  if (!fee) throw new ServiceError("This fee no longer exists.", undefined, "not-found");
  await db.fee.delete({ where: { id } });
}
