import { LESSON_BODY_CLASSES } from "@/lib/lesson";

/**
 * What the model is asked for, and the exact shape it must answer in. Each chapter is generated in two short
 * requests (notes, then questions) rather than one long one: a long answer can outlast the hosting time limit, and
 * when one piece fails only that piece has to be repeated.
 */

export const NOTES_SCHEMA = {
  name: "lesson_notes",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["subtitle", "topics", "definitions"],
    properties: {
      subtitle: { type: "string" },
      topics: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "body"],
          properties: { title: { type: "string" }, body: { type: "string" } },
        },
      },
      definitions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["term", "definition", "example"],
          properties: { term: { type: "string" }, definition: { type: "string" }, example: { type: "string" } },
        },
      },
    },
  },
} as const;

export const MCQ_SCHEMA = {
  name: "lesson_mcqs",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["mcqs"],
    properties: {
      mcqs: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "options", "answer", "explanation"],
          properties: {
            question: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            /** Position in options, counting from 0. */
            answer: { type: "integer" },
            explanation: { type: "string" },
          },
        },
      },
    },
  },
} as const;

const ALLOWED_HTML = `Write each topic body as simple HTML using only: <p>, <strong>, <em>, <ul>, <ol>, <li>, <h4>, <br>, and tables (<table class="data-table"><thead><tr><th>…</th></tr></thead><tbody><tr><td>…</td></tr></tbody></table>) when the source has tabular data. You may wrap a short worked example in <div class="example-box">…</div>. Allowed class names are exactly: ${LESSON_BODY_CLASSES.join(", ")}. No scripts, styles, images, links or other tags.`;

const GROUNDING = `Use ONLY the text you are given. Do not add facts, examples, names, dates or figures that are not in it. If the text does not cover something, leave it out rather than filling the gap from memory. Write in the same language as the source text.`;

export const NOTES_SYSTEM = `You turn one chapter of a university handout into a study guide for students revising before an exam.
${GROUNDING}
Break the chapter into topics that follow its own structure, in the order the handout teaches them. Each topic has a short clear title and a body that keeps the specifics a student needs to remember: definitions, named people and dates, lists, steps, comparisons and distinctions. Prefer a well-organised list or table over a long paragraph when the material is a list or a comparison.
${ALLOWED_HTML}
State facts directly, as the subject itself: never write "the text says", "the chapter explains" or "according to the handout".
Also list the key terms of the chapter. For each give a plain-English definition taken from the text. Fill "example" only when the text itself gives an example of that term; otherwise leave "example" as an empty string. Never invent an example. Treat singular/plural or other trivial variants of a term as one term.
The subtitle is one sentence saying what the chapter covers.`;

export const MCQ_SYSTEM = `You write revision multiple-choice questions from one chapter of a university handout.
${GROUNDING}
Every question must be answerable from the text. Give exactly four options, exactly one of them correct. The three wrong options must be plausible to a student who half-remembers the material and clearly wrong to a student who studied it: every wrong option must come from the same topic and be a believable mistake, and none may also be arguably correct. Never use joke answers, "all of the above" or "none of the above". Do not write "according to the text" in questions. "answer" is the position of the correct option counting from 0. The explanation says in one or two sentences why the answer is right, using the text.
Cover the whole chapter rather than clustering on one section, and favour points a lecturer would test: definitions, distinctions, named people and their claims, lists and figures.`;

export const notesUser = (title: string, text: string) =>
  `Chapter: ${title}\n\nWrite the study guide for this chapter.\n\n--- CHAPTER TEXT ---\n${text}`;

export const mcqUser = (title: string, text: string, count: number) =>
  `Chapter: ${title}\n\nWrite ${count} multiple-choice questions for this chapter.\n\n--- CHAPTER TEXT ---\n${text}`;
