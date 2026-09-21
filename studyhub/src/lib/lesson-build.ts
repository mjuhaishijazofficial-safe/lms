// Turns the raw answers of the language model into lesson content. Pure (no I/O), shared by the server and the browser.
// The model's answers are never trusted: anything malformed is dropped here, and what is left is validated and
// sanitised again (parseLesson) before it is stored.

import type { Lesson } from "./lesson";

/** Longest stretch of chapter text sent in one request. Longer chapters are done in pieces and merged. */
export const MAX_CHARS_PER_REQUEST = 20_000;

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export type NotesPart = {
  subtitle: string;
  topics: { title: string; body: string }[];
  definitions: { term: string; definition: string; example?: string }[];
};

/** The notes the model wrote for one piece of a chapter, or null when it wrote nothing usable. */
export function readNotes(data: unknown): NotesPart | null {
  const d = rec(data);
  const topics = (Array.isArray(d.topics) ? d.topics : [])
    .map((t) => ({ title: text(rec(t).title), body: text(rec(t).body) }))
    .filter((t) => t.title && t.body);
  if (topics.length === 0) return null;
  const definitions = (Array.isArray(d.definitions) ? d.definitions : [])
    .map((x) => ({ term: text(rec(x).term), definition: text(rec(x).definition), example: text(rec(x).example) }))
    .filter((x) => x.term && x.definition)
    .map((x) => ({ term: x.term, definition: x.definition, ...(x.example ? { example: x.example } : {}) }));
  return { subtitle: text(d.subtitle), topics, definitions };
}

/** Keeps the questions that make sense and reports how many did not, rather than losing the whole set. */
export function readMcqs(data: unknown): { mcqs: Lesson["mcqs"]; dropped: number } {
  const raw = Array.isArray(rec(data).mcqs) ? (rec(data).mcqs as unknown[]) : [];
  const mcqs: Lesson["mcqs"] = [];
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
    mcqs.push({ question: text(r.question), options, answer: answer as number, ...(text(r.explanation) ? { explanation: text(r.explanation) } : {}) });
  }
  return { mcqs, dropped };
}

export const droppedWarning = (n: number) => `${n} question${n === 1 ? " was" : "s were"} discarded because they were malformed.`;

/** Combines the pieces of one chapter, in order, without repeating a term or a question. */
export function mergeLesson(parts: { notes: NotesPart[]; mcqs: Lesson["mcqs"][]; mcqCount: number }) {
  const topics: NotesPart["topics"] = [];
  const definitions: NotesPart["definitions"] = [];
  const seenTerms = new Set<string>();
  for (const n of parts.notes) {
    topics.push(...n.topics);
    for (const d of n.definitions) {
      const key = d.term.toLowerCase();
      if (!seenTerms.has(key)) {
        seenTerms.add(key);
        definitions.push(d);
      }
    }
  }
  const mcqs: Lesson["mcqs"] = [];
  const seenQuestions = new Set<string>();
  for (const list of parts.mcqs) {
    for (const q of list) {
      const key = q.question.toLowerCase();
      if (!seenQuestions.has(key)) {
        seenQuestions.add(key);
        mcqs.push(q);
      }
    }
  }
  const subtitle = parts.notes.find((n) => n.subtitle)?.subtitle;
  return {
    ...(subtitle ? { subtitle } : {}),
    topics,
    definitions,
    // A little over the target is kept: the model may give a few more than asked for and they are usually fine.
    mcqs: mcqs.slice(0, Math.max(parts.mcqCount, 0) + 5),
  };
}

/** How many questions each piece of a chapter should aim for, so a long chapter is covered end to end. */
export const questionsPerPiece = (mcqCount: number, pieces: number) => Math.max(3, Math.ceil(mcqCount / Math.max(pieces, 1)));
