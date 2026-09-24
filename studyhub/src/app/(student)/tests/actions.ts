"use server";

import { assertStudent, AuthError } from "@/server/auth/guards";
import { idSchema } from "@/server/validation/common";
import { answerQuestion, getAttemptView, startAttempt, submitAttempt, type AttemptView } from "@/server/services/test-attempts";

/** Called directly from client components (not a <form>), so results come back as plain data, not a redirect. */
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function safeMessage(err: unknown): string {
  if (err instanceof AuthError) return err.message;
  console.error(err);
  return "Something went wrong. Please try again.";
}

export async function startTestAction(testId: string): Promise<Result<AttemptView>> {
  try {
    if (!idSchema.safeParse(testId).success) return { ok: false, error: "That test could not be found." };
    const user = await assertStudent();
    await startAttempt(user, testId);
    return { ok: true, data: await getAttemptView(user, testId) };
  } catch (err) {
    return { ok: false, error: safeMessage(err) };
  }
}

/** Fire-and-forget from the student's point of view: a failed autosave should not interrupt them mid-test. */
export async function answerTestAction(attemptId: string, questionIndex: number, optionIndex: number | null): Promise<Result<true>> {
  try {
    if (!idSchema.safeParse(attemptId).success) return { ok: false, error: "That attempt could not be found." };
    const user = await assertStudent();
    await answerQuestion(user, attemptId, questionIndex, optionIndex);
    return { ok: true, data: true };
  } catch (err) {
    return { ok: false, error: safeMessage(err) };
  }
}

export async function submitTestAction(testId: string, attemptId: string): Promise<Result<AttemptView>> {
  try {
    if (!idSchema.safeParse(attemptId).success) return { ok: false, error: "That attempt could not be found." };
    const user = await assertStudent();
    await submitAttempt(user, attemptId);
    return { ok: true, data: await getAttemptView(user, testId) };
  } catch (err) {
    return { ok: false, error: safeMessage(err) };
  }
}
