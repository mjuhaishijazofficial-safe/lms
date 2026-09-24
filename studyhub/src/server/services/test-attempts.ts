import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { AuthError } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";
import { checkTestAccess, getStudentScope, studentTestWhere } from "./access";
import { publicQuestion, questionCount, scoreAnswers, testQuestionsSchema, type TestQuestion, type TestQuestionPublic } from "@/lib/test";

/**
 * Running a test attempt. The one rule that matters everywhere here: the server's own clock and the server's own
 * stored answers decide the score, never anything the browser sends at the moment of submitting. A slow network,
 * a refreshed tab or a tampered request cannot buy extra time or change what was actually answered in time.
 */

type Answers = (number | null)[];

const asAnswers = (v: unknown, len: number): Answers => {
  const arr = Array.isArray(v) ? v : [];
  return Array.from({ length: len }, (_, i) => (typeof arr[i] === "number" ? (arr[i] as number) : null));
};

const asQuestions = (v: unknown): TestQuestion[] => {
  const parsed = testQuestionsSchema.safeParse(v);
  return parsed.success ? parsed.data : [];
};

const deadlineOf = (startedAt: Date, durationMinutes: number) => new Date(startedAt.getTime() + durationMinutes * 60_000);

type AttemptRow = { id: string; startedAt: Date; submittedAt: Date | null; answers: Prisma.JsonValue; score: number | null };
type TestRow = { durationMinutes: number; questions: Prisma.JsonValue };

/** Returns the attempt unchanged while there's time left; once the deadline has passed, grades and locks it right
 *  here, so a student who never comes back to click Submit still ends up with a real, scored result. */
async function settle(attempt: AttemptRow, test: TestRow): Promise<AttemptRow> {
  if (attempt.submittedAt) return attempt;
  if (new Date() < deadlineOf(attempt.startedAt, test.durationMinutes)) return attempt;
  const questions = asQuestions(test.questions);
  const score = scoreAnswers(questions, asAnswers(attempt.answers, questions.length));
  return db.testAttempt.update({ where: { id: attempt.id }, data: { score, submittedAt: new Date() } });
}

export type AttemptView =
  | { access: "not-found" }
  | { access: "forbidden" }
  | ({
      access: "ok"; testId: string; title: string; description: string; durationMinutes: number;
      subjectName: string; courseName: string; totalQuestions: number;
    } & (
      | { phase: "not-started" }
      | { phase: "in-progress"; attemptId: string; deadline: string; questions: TestQuestionPublic[]; answers: Answers }
      | { phase: "done"; questions: TestQuestion[]; answers: Answers; score: number; submittedAt: string }
    ));

async function loadTest(testId: string) {
  return db.test.findUnique({
    where: { id: testId },
    select: {
      id: true, title: true, description: true, durationMinutes: true, questions: true,
      subject: { select: { name: true, course: { select: { name: true } } } },
    },
  });
}

export type StudentTestRow = {
  id: string; title: string; description: string; durationMinutes: number; totalQuestions: number;
  subjectName: string; courseName: string; status: "not-started" | "in-progress" | "expired" | "done"; score?: number;
};

/** Every test this student can see, with their own status on each — for their Tests list. */
export async function listStudentTests(user: SessionUser): Promise<StudentTestRow[]> {
  const scope = await getStudentScope(user.id);
  const tests = await db.test.findMany({
    where: studentTestWhere(scope),
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, title: true, description: true, durationMinutes: true, questions: true, subject: { select: { name: true, course: { select: { name: true } } } } },
  });
  if (tests.length === 0) return [];

  const attempts = await db.testAttempt.findMany({
    where: { userId: user.id, testId: { in: tests.map((t) => t.id) } },
    select: { testId: true, startedAt: true, submittedAt: true, score: true },
  });
  const byTest = new Map(attempts.map((a) => [a.testId, a]));

  return tests.map((t) => {
    const a = byTest.get(t.id);
    const status: StudentTestRow["status"] = !a
      ? "not-started"
      : a.submittedAt ? "done" : new Date() >= deadlineOf(a.startedAt, t.durationMinutes) ? "expired" : "in-progress";
    return {
      id: t.id, title: t.title, description: t.description, durationMinutes: t.durationMinutes,
      totalQuestions: questionCount(t.questions), subjectName: t.subject.name, courseName: t.subject.course.name,
      status, ...(status === "done" ? { score: a?.score ?? 0 } : {}),
    };
  });
}

export async function getAttemptView(user: SessionUser, testId: string): Promise<AttemptView> {
  const access = await checkTestAccess(user, testId);
  if (!access.exists) return { access: "not-found" };
  if (!access.allowed) return { access: "forbidden" };
  const test = await loadTest(testId);
  if (!test) return { access: "not-found" };

  const base = {
    access: "ok" as const, testId: test.id, title: test.title, description: test.description,
    durationMinutes: test.durationMinutes, subjectName: test.subject.name, courseName: test.subject.course.name,
    totalQuestions: questionCount(test.questions),
  };

  const existing = await db.testAttempt.findUnique({ where: { testId_userId: { testId, userId: user.id } } });
  if (!existing) return { ...base, phase: "not-started" };

  const attempt = await settle(existing, test);
  const questions = asQuestions(test.questions);
  if (attempt.submittedAt) {
    return { ...base, phase: "done", questions, answers: asAnswers(attempt.answers, questions.length), score: attempt.score ?? 0, submittedAt: attempt.submittedAt.toISOString() };
  }
  return {
    ...base, phase: "in-progress", attemptId: attempt.id, deadline: deadlineOf(attempt.startedAt, test.durationMinutes).toISOString(),
    questions: questions.map(publicQuestion), answers: asAnswers(attempt.answers, questions.length),
  };
}

/** Creates the one attempt this student gets. Safe to call again: it just finds the attempt already made. */
export async function startAttempt(user: SessionUser, testId: string): Promise<void> {
  const access = await checkTestAccess(user, testId);
  if (!access.exists) throw new AuthError("This test no longer exists.");
  if (!access.allowed) throw new AuthError("This test is not available to you.");
  try {
    await db.testAttempt.create({ data: { testId, userId: user.id } });
  } catch (err) {
    // Unique (testId, userId) violation: an attempt already exists (double click, a second tab). That is fine.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }
}

async function ownedAttempt(user: SessionUser, attemptId: string) {
  const attempt = await db.testAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, startedAt: true, submittedAt: true, answers: true, score: true, test: { select: { durationMinutes: true, questions: true } } },
  });
  if (!attempt || attempt.userId !== user.id) throw new AuthError("This test attempt was not found.");
  return attempt;
}

/** Records one answer. Silently does nothing once the attempt is submitted or its time is up, rather than erroring
 *  on a student who kept a tab open past the deadline — settle()/submitAttempt() decide the actual outcome. */
export async function answerQuestion(user: SessionUser, attemptId: string, questionIndex: number, optionIndex: number | null): Promise<void> {
  const attempt = await ownedAttempt(user, attemptId);
  if (attempt.submittedAt) return;
  if (new Date() >= deadlineOf(attempt.startedAt, attempt.test.durationMinutes)) return;
  const total = questionCount(attempt.test.questions);
  if (questionIndex < 0 || questionIndex >= total) return;
  const answers = asAnswers(attempt.answers, total);
  answers[questionIndex] = optionIndex !== null && optionIndex >= 0 && optionIndex < 6 ? optionIndex : null;
  await db.testAttempt.update({ where: { id: attemptId }, data: { answers } });
}

/** Grades and locks the attempt from whatever is already stored server-side — nothing the client sends here is
 *  trusted for scoring. Idempotent, so the auto-submit-on-timeout and a manual Submit click can both call it. */
export async function submitAttempt(user: SessionUser, attemptId: string): Promise<{ score: number; total: number }> {
  const attempt = await ownedAttempt(user, attemptId);
  const questions = asQuestions(attempt.test.questions);
  if (attempt.submittedAt) return { score: attempt.score ?? 0, total: questions.length };
  const score = scoreAnswers(questions, asAnswers(attempt.answers, questions.length));
  await db.testAttempt.update({ where: { id: attemptId }, data: { score, submittedAt: new Date() } });
  return { score, total: questions.length };
}
