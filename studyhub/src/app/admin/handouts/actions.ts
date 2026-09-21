"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/auth/guards";
import { ServiceError } from "@/server/action-result";
import { idSchema } from "@/server/validation/common";
import { AiError, type AiErrorKind } from "@/server/ai/openai";
import { getLlmClient } from "@/server/ai/client";
import { MAX_CHARS_PER_REQUEST, generateMcqsPart, generateNotesPart } from "@/server/ai/generate-lesson";
import { lessonStates, publishLessons, saveGeneratedLesson, type LessonState } from "@/server/services/handouts";
import type { NotesPart } from "@/lib/lesson-build";
import type { Lesson } from "@/lib/lesson";

/**
 * The admin screen builds a lesson from several small requests, one per action call, so that no request has to outlast
 * the hosting time limit. Every action checks the admin first: these calls spend real money.
 */

export type Usage = { inputTokens: number; outputTokens: number };
export type Failure = { ok: false; error: string; kind: AiErrorKind | "other" };
type Ok<T> = { ok: true } & T;

const piece = z.object({
  label: z.string().trim().min(1).max(300),
  // A hard cap well above what one request is meant to carry, so a hand-made request cannot run up a large bill.
  text: z.string().min(20, "There is no text to work from.").max(MAX_CHARS_PER_REQUEST + 5_000),
});

function failure(err: unknown): Failure {
  if (err instanceof AiError) return { ok: false, error: err.message, kind: err.kind };
  if (err instanceof ServiceError) return { ok: false, error: err.message, kind: "other" };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again.", kind: "other" };
}

export async function generateNotesAction(input: unknown): Promise<Ok<{ notes: NotesPart; usage: Usage }> | Failure> {
  try {
    await assertAdmin();
    const args = piece.parse(input);
    return { ok: true, ...(await generateNotesPart(getLlmClient(), args)) };
  } catch (err) {
    return failure(err instanceof z.ZodError ? new ServiceError(err.issues[0]?.message ?? "Invalid request.") : err);
  }
}

export async function generateMcqsAction(input: unknown): Promise<Ok<{ mcqs: Lesson["mcqs"]; dropped: number; usage: Usage }> | Failure> {
  try {
    await assertAdmin();
    const args = piece.extend({ count: z.number().int().min(1).max(40) }).parse(input);
    return { ok: true, ...(await generateMcqsPart(getLlmClient(), args)) };
  } catch (err) {
    return failure(err instanceof z.ZodError ? new ServiceError(err.issues[0]?.message ?? "Invalid request.") : err);
  }
}

const saveSchema = z.object({
  subjectId: idSchema,
  number: z.number().int().min(0).max(999),
  title: z.string().trim().min(1).max(200),
  lesson: z.unknown(),
});

export async function saveLessonAction(input: unknown): Promise<Ok<{ chapterId: string; materialId: string; replaced: boolean }> | Failure> {
  try {
    const actor = await assertAdmin();
    const args = saveSchema.parse(input);
    const saved = await saveGeneratedLesson(actor, args);
    revalidatePath("/admin", "layout");
    return { ok: true, ...saved };
  } catch (err) {
    return failure(err instanceof z.ZodError ? new ServiceError(err.issues[0]?.message ?? "Invalid request.") : err);
  }
}

export async function lessonStatesAction(subjectId: string): Promise<Ok<{ states: LessonState[] }> | Failure> {
  try {
    const actor = await assertAdmin();
    return { ok: true, states: await lessonStates(actor, idSchema.parse(subjectId)) };
  } catch (err) {
    return failure(err instanceof z.ZodError ? new ServiceError("Choose a subject first.") : err);
  }
}

export async function publishLessonsAction(subjectId: string, numbers: number[]): Promise<Ok<{ published: number }> | Failure> {
  try {
    const actor = await assertAdmin();
    const result = await publishLessons(actor, idSchema.parse(subjectId), z.array(z.number().int().min(0).max(999)).max(500).parse(numbers));
    revalidatePath("/admin", "layout");
    revalidatePath("/dashboard");
    return { ok: true, ...result };
  } catch (err) {
    return failure(err instanceof z.ZodError ? new ServiceError("Choose a subject and at least one lesson.") : err);
  }
}
