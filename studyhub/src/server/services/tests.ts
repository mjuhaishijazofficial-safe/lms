import "server-only";
import type { Prisma, ContentStatus } from "@prisma/client";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import type { CreateTestInput, UpdateTestInput } from "@/server/validation/tests";
import { ensureAdmin, PAGE_SIZE } from "./_shared";

// Newest first: a weekly test is almost always what an admin wants to see (and reuse) first.
const ORDER: Prisma.TestOrderByWithRelationInput[] = [{ createdAt: "desc" }];

const listInclude = {
  subject: { select: { id: true, name: true, course: { select: { id: true, name: true } }, semester: { select: { name: true } } } },
  _count: { select: { attempts: true } },
} satisfies Prisma.TestInclude;

export type TestFilter = { courseId?: string; subjectId?: string; status?: ContentStatus; q?: string; page: number };

export async function listTests(filter: TestFilter) {
  const where: Prisma.TestWhereInput = {
    ...(filter.subjectId ? { subjectId: filter.subjectId } : filter.courseId ? { subject: { courseId: filter.courseId } } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.q ? { title: { contains: filter.q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    db.test.findMany({ where, orderBy: ORDER, include: listInclude, skip: (filter.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.test.count({ where }),
  ]);
  return { items, total };
}

export function getTest(id: string) {
  return db.test.findUnique({ where: { id }, include: listInclude });
}

async function assertSubject(subjectId: string) {
  if (!(await db.subject.findUnique({ where: { id: subjectId }, select: { id: true } }))) {
    throw new ServiceError("Choose a subject that exists.", "subjectId");
  }
}

export async function createTest(actor: SessionUser, data: CreateTestInput) {
  ensureAdmin(actor);
  await assertSubject(data.subjectId);
  return db.test.create({
    data: {
      subjectId: data.subjectId, title: data.title, description: data.description,
      durationMinutes: data.durationMinutes, questions: data.questionsJson, status: data.status,
      createdById: actor.id,
    },
  });
}

export async function updateTest(actor: SessionUser, data: UpdateTestInput) {
  ensureAdmin(actor);
  const current = await db.test.findUnique({ where: { id: data.id }, select: { id: true } });
  if (!current) throw new ServiceError("This test no longer exists.", undefined, "not-found");
  await assertSubject(data.subjectId);
  return db.test.update({
    where: { id: data.id },
    data: {
      subjectId: data.subjectId, title: data.title, description: data.description,
      durationMinutes: data.durationMinutes, questions: data.questionsJson, status: data.status,
    },
  });
}

export async function setTestStatus(actor: SessionUser, id: string, status: ContentStatus) {
  ensureAdmin(actor);
  return db.test.update({ where: { id }, data: { status } });
}

export async function deleteTest(actor: SessionUser, id: string) {
  ensureAdmin(actor);
  const test = await db.test.findUnique({ where: { id }, select: { _count: { select: { attempts: true } } } });
  if (!test) throw new ServiceError("This test no longer exists.", undefined, "not-found");
  if (test._count.attempts > 0) throw new ServiceError("Students have already attempted this test. Archive it instead of deleting it.", undefined, "not-empty");
  await db.test.delete({ where: { id } });
}

/** Every attempt at this test, best score first, for the results page. */
export async function testResults(testId: string) {
  return db.testAttempt.findMany({
    where: { testId },
    orderBy: [{ score: "desc" }, { submittedAt: "asc" }],
    select: { id: true, score: true, startedAt: true, submittedAt: true, user: { select: { id: true, name: true, email: true } } },
  });
}
