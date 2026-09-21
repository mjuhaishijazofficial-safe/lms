import { chunkText } from "@/lib/handout";
import { parseLesson } from "@/server/materials/lesson-sanitize";
import type { Lesson } from "@/lib/lesson";
import { AiError, type LlmClient, type LlmUsage } from "./openai";
import { MCQ_SCHEMA, MCQ_SYSTEM, NOTES_SCHEMA, NOTES_SYSTEM, mcqUser, notesUser } from "./lesson-prompts";

/**
 * Turns the text of one chapter into a lesson by asking the model for the notes and the questions separately.
 * The model's answers are never trusted: everything is checked, individual bad questions are dropped with a warning
 * instead of failing the whole chapter, and the finished lesson goes through the same validation and sanitising as
 * a lesson pasted in by hand.
 */

/** Longest stretch of chapter text sent in one request. Longer chapters are done in pieces and merged. */
export const MAX_CHARS_PER_REQUEST = 20_000;
const MAX_ATTEMPTS = 3;

export type GenerateOptions = {
  /** How many questions to aim for across the whole chapter. */
  mcqCount?: number;
  /** Replaceable so tests do not actually wait. */
  sleep?: (ms: number) => Promise<void>;
};
export type GenerateResult = { lesson: Lesson; usage: LlmUsage; warnings: string[] };

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Runs a request, trying again for the kinds of failure that usually pass on a second go. */
async function withRetries<T>(work: () => Promise<T>, sleep: (ms: number) => Promise<void>): Promise<T> {
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

function readNotes(data: unknown) {
  const d = rec(data);
  const topics = (Array.isArray(d.topics) ? d.topics : [])
    .map((t) => ({ title: text(rec(t).title), body: text(rec(t).body) }))
    .filter((t) => t.title && t.body);
  const definitions = (Array.isArray(d.definitions) ? d.definitions : [])
    .map((x) => ({ term: text(rec(x).term), definition: text(rec(x).definition), example: text(rec(x).example) }))
    .filter((x) => x.term && x.definition)
    .map((x) => ({ term: x.term, definition: x.definition, ...(x.example ? { example: x.example } : {}) }));
  if (topics.length === 0) throw new AiError("bad_output", "The model returned no usable topics.");
  return { subtitle: text(d.subtitle), topics, definitions };
}

/** Keeps the questions that make sense and reports how many did not, rather than losing the whole set. */
function readMcqs(data: unknown, warnings: string[]) {
  const raw = Array.isArray(rec(data).mcqs) ? (rec(data).mcqs as unknown[]) : [];
  const kept: Lesson["mcqs"] = [];
  let dropped = 0;
  for (const q of raw) {
    const r = rec(q);
    const options = (Array.isArray(r.options) ? r.options : []).map(text).filter(Boolean);
    const answer = r.answer;
    const ok =
      text(r.question) && options.length >= 2 && options.length <= 6 &&
      new Set(options.map((o) => o.toLowerCase())).size === options.length && // no two identical options
      typeof answer === "number" && Number.isInteger(answer) && answer >= 0 && answer < options.length;
    if (!ok) {
      dropped++;
      continue;
    }
    kept.push({ question: text(r.question), options, answer: answer as number, ...(text(r.explanation) ? { explanation: text(r.explanation) } : {}) });
  }
  if (dropped > 0) warnings.push(`${dropped} question${dropped === 1 ? " was" : "s were"} discarded because they were malformed.`);
  return kept;
}

const add = (a: LlmUsage, b: LlmUsage): LlmUsage => ({ inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens });

export async function generateLesson(
  client: LlmClient,
  chapter: { title: string; text: string },
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const { mcqCount = 10, sleep = realSleep } = options;
  const warnings: string[] = [];
  let usage: LlmUsage = { inputTokens: 0, outputTokens: 0 };

  const pieces = chunkText(chapter.text, MAX_CHARS_PER_REQUEST);
  if (pieces.length === 0) throw new AiError("bad_output", "This chapter has no text to work from.");

  // Notes, one request per piece of the chapter, merged in order.
  const subtitles: string[] = [];
  const topics: Lesson["topics"] = [];
  const definitions: NonNullable<Lesson["definitions"]> = [];
  const seenTerms = new Set<string>();
  for (const [i, piece] of pieces.entries()) {
    const label = pieces.length > 1 ? `${chapter.title} (part ${i + 1} of ${pieces.length})` : chapter.title;
    const result = await withRetries(async () => {
      const r = await client.complete({ system: NOTES_SYSTEM, user: notesUser(label, piece), schema: NOTES_SCHEMA });
      return { notes: readNotes(r.data), usage: r.usage };
    }, sleep);
    usage = add(usage, result.usage);
    if (result.notes.subtitle) subtitles.push(result.notes.subtitle);
    topics.push(...result.notes.topics);
    for (const d of result.notes.definitions) {
      const key = d.term.toLowerCase();
      if (!seenTerms.has(key)) {
        seenTerms.add(key);
        definitions.push(d);
      }
    }
  }

  // Questions: the count is shared between the pieces so a long chapter is covered end to end.
  const mcqs: Lesson["mcqs"] = [];
  const seenQuestions = new Set<string>();
  if (mcqCount > 0) {
    const perPiece = Math.max(3, Math.ceil(mcqCount / pieces.length));
    for (const [i, piece] of pieces.entries()) {
      const label = pieces.length > 1 ? `${chapter.title} (part ${i + 1} of ${pieces.length})` : chapter.title;
      try {
        const result = await withRetries(async () => {
          const r = await client.complete({ system: MCQ_SYSTEM, user: mcqUser(label, piece, perPiece), schema: MCQ_SCHEMA });
          return { list: readMcqs(r.data, warnings), usage: r.usage };
        }, sleep);
        usage = add(usage, result.usage);
        for (const q of result.list) {
          const key = q.question.toLowerCase();
          if (!seenQuestions.has(key)) {
            seenQuestions.add(key);
            mcqs.push(q);
          }
        }
      } catch (err) {
        // The notes are the lesson. A failure here (other than a key or credit problem) still leaves a usable
        // lesson, so it is reported rather than discarding the notes that were already paid for.
        if (err instanceof AiError && (err.kind === "auth" || err.kind === "quota" || err.kind === "config")) throw err;
        warnings.push("The practice questions could not be generated for this chapter. Generate the chapter again to retry them.");
      }
    }
  }

  const parsed = parseLesson({
    ...(subtitles.length ? { subtitle: subtitles[0] } : {}),
    topics,
    definitions,
    mcqs: mcqs.slice(0, Math.max(mcqCount, 0) + 5),
  });
  if (!parsed.ok) throw new AiError("bad_output", parsed.error);
  return { lesson: parsed.lesson, usage, warnings };
}
