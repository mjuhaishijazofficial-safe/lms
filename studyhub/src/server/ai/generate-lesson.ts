import { chunkText } from "@/lib/handout";
import { MAX_CHARS_PER_REQUEST, droppedWarning, mergeLesson, questionsPerPiece, readMcqs, readNotes, type NotesPart } from "@/lib/lesson-build";
import { parseLesson } from "@/server/materials/lesson-sanitize";
import type { Lesson } from "@/lib/lesson";
import { AiError, type LlmClient, type LlmUsage } from "./openai";
import { MCQ_SCHEMA, MCQ_SYSTEM, NOTES_SCHEMA, NOTES_SYSTEM, mcqUser, notesUser } from "./lesson-prompts";

/**
 * Asks the model for one piece of a lesson. The admin screen calls these one at a time, so that no single request has
 * to outlast the hosting time limit; generateLesson below runs the whole thing in one go (used by the tests and by
 * any script). The model's answers are never trusted: see lib/lesson-build.ts.
 */

export { MAX_CHARS_PER_REQUEST };
const MAX_ATTEMPTS = 3;

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Runs a request, trying again for the kinds of failure that usually pass on a second go. */
export async function withRetries<T>(work: () => Promise<T>, sleep: (ms: number) => Promise<void> = realSleep): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await work();
    } catch (err) {
      last = err;
      if (!(err instanceof AiError) || !err.retryable || attempt === MAX_ATTEMPTS) throw err;
      await sleep(attempt * 1500);
    }
  }
  throw last;
}

/** The notes for one piece of a chapter. */
export async function generateNotesPart(client: LlmClient, args: { label: string; text: string }, sleep?: (ms: number) => Promise<void>): Promise<{ notes: NotesPart; usage: LlmUsage }> {
  return withRetries(async () => {
    const r = await client.complete({ system: NOTES_SYSTEM, user: notesUser(args.label, args.text), schema: NOTES_SCHEMA });
    const notes = readNotes(r.data);
    if (!notes) throw new AiError("bad_output", "The model returned no usable topics.");
    return { notes, usage: r.usage };
  }, sleep);
}

/** The practice questions for one piece of a chapter. */
export async function generateMcqsPart(
  client: LlmClient,
  args: { label: string; text: string; count: number },
  sleep?: (ms: number) => Promise<void>,
): Promise<{ mcqs: Lesson["mcqs"]; dropped: number; usage: LlmUsage }> {
  return withRetries(async () => {
    const r = await client.complete({ system: MCQ_SYSTEM, user: mcqUser(args.label, args.text, args.count), schema: MCQ_SCHEMA });
    return { ...readMcqs(r.data), usage: r.usage };
  }, sleep);
}

export type GenerateOptions = {
  /** How many questions to aim for across the whole chapter. */
  mcqCount?: number;
  /** Replaceable so tests do not actually wait. */
  sleep?: (ms: number) => Promise<void>;
};
export type GenerateResult = { lesson: Lesson; usage: LlmUsage; warnings: string[] };

const add = (a: LlmUsage, b: LlmUsage): LlmUsage => ({ inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens });

export async function generateLesson(client: LlmClient, chapter: { title: string; text: string }, options: GenerateOptions = {}): Promise<GenerateResult> {
  const { mcqCount = 10, sleep } = options;
  const warnings: string[] = [];
  let usage: LlmUsage = { inputTokens: 0, outputTokens: 0 };

  const pieces = chunkText(chapter.text, MAX_CHARS_PER_REQUEST);
  if (pieces.length === 0) throw new AiError("bad_output", "This chapter has no text to work from.");
  const labelFor = (i: number) => (pieces.length > 1 ? `${chapter.title} (part ${i + 1} of ${pieces.length})` : chapter.title);

  const notes: NotesPart[] = [];
  for (const [i, piece] of pieces.entries()) {
    const r = await generateNotesPart(client, { label: labelFor(i), text: piece }, sleep);
    usage = add(usage, r.usage);
    notes.push(r.notes);
  }

  const mcqs: Lesson["mcqs"][] = [];
  if (mcqCount > 0) {
    const count = questionsPerPiece(mcqCount, pieces.length);
    for (const [i, piece] of pieces.entries()) {
      try {
        const r = await generateMcqsPart(client, { label: labelFor(i), text: piece, count }, sleep);
        usage = add(usage, r.usage);
        if (r.dropped > 0) warnings.push(droppedWarning(r.dropped));
        mcqs.push(r.mcqs);
      } catch (err) {
        // The notes are the lesson. A failure here (other than a key or credit problem) still leaves a usable
        // lesson, so it is reported rather than discarding the notes that were already paid for.
        if (err instanceof AiError && (err.kind === "auth" || err.kind === "quota" || err.kind === "config")) throw err;
        warnings.push("The practice questions could not be generated for this chapter. Generate the chapter again to retry them.");
      }
    }
  }

  const parsed = parseLesson(mergeLesson({ notes, mcqs, mcqCount }));
  if (!parsed.ok) throw new AiError("bad_output", parsed.error);
  return { lesson: parsed.lesson, usage, warnings };
}
