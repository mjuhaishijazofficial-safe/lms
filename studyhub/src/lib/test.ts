import { z } from "zod";
import { mcqSchema, type Mcq } from "./lesson";

/**
 * A test: a set of MCQ questions an admin writes by hand for one subject (e.g. a weekly test). It reuses the
 * same question shape as a lesson's practice MCQs, since both are "a question, some options, one correct
 * answer" — there is no reason for two schemas to say the same thing differently.
 */
export const testQuestionSchema = mcqSchema;
export type TestQuestion = Mcq;

export const testQuestionsSchema = z
  .array(testQuestionSchema)
  .min(1, "Add at least one question.")
  .max(100, "That is a lot of questions for one test — split it into more than one.");

/** What a student in the middle of a test is sent: never the answer, or they could read it from the network tab. */
export type TestQuestionPublic = { question: string; options: string[] };
export const publicQuestion = (q: TestQuestion): TestQuestionPublic => ({ question: q.question, options: q.options });

/** How many of a student's answers match the correct option. `answers[i]` is null for a question left blank. */
export function scoreAnswers(questions: TestQuestion[], answers: unknown[]): number {
  return questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
}

/** The number of questions in a stored test, without trusting its shape (it is validated again before use). */
export function questionCount(questions: unknown): number {
  return Array.isArray(questions) ? questions.length : 0;
}
