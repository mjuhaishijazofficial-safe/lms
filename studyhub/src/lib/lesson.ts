import { z } from "zod";

/**
 * A lesson: the study guide for one chapter, stored as content rather than as a finished page.
 * StudyHub renders it for students, and builds the downloadable .html file from the same data,
 * so the two can never drift apart. Generated lessons are validated against this before being saved.
 */

/** Class names the lesson body may use. They only select styling that the template already defines. */
export const LESSON_BODY_CLASSES = [
  "data-table", "example-box", "flow-row", "flow-box", "step-grid", "step-box",
  "c0", "c1", "c2", "c3", "c4", "c5",
] as const;

export const topicSchema = z.object({
  /** A label shown in the topic's badge, e.g. "248" or "241-242". Optional: the position is used otherwise. */
  ref: z.string().trim().max(24).optional(),
  title: z.string().trim().min(1, "Each topic needs a title.").max(200),
  /** A small HTML subset; sanitised on save and again on display. */
  body: z.string().trim().min(1, "Each topic needs some content.").max(20_000),
});

export const definitionSchema = z.object({
  term: z.string().trim().min(1, "Each definition needs a term.").max(200),
  definition: z.string().trim().min(1, "Each definition needs an explanation.").max(2000),
  /** The everyday example shown under the definition. */
  example: z.string().trim().max(2000).optional(),
});

export const mcqSchema = z
  .object({
    question: z.string().trim().min(1, "Each question needs text.").max(1000),
    options: z.array(z.string().trim().min(1, "Options cannot be blank.").max(500)).min(2, "Give at least two options.").max(6),
    /** Index into options. */
    answer: z.number().int().min(0),
    explanation: z.string().trim().max(2000).optional(),
  })
  .refine((q) => q.answer < q.options.length, {
    message: "The answer must be one of the options.",
    path: ["answer"],
  });

export const lessonSchema = z
  .object({
    subtitle: z.string().trim().max(500).optional(),
    topics: z.array(topicSchema).max(60).default([]),
    definitions: z.array(definitionSchema).max(120).default([]),
    mcqs: z.array(mcqSchema).max(120).default([]),
  })
  .refine((l) => l.topics.length + l.definitions.length + l.mcqs.length > 0, {
    message: "A lesson needs at least one topic, definition or question.",
  });

export type Topic = z.infer<typeof topicSchema>;
export type Definition = z.infer<typeof definitionSchema>;
export type Mcq = z.infer<typeof mcqSchema>;
export type Lesson = z.infer<typeof lessonSchema>;

/** Which tabs a lesson actually has: a lesson with no MCQs should not show an empty MCQ tab. */
export const lessonTabs = (lesson: Lesson) =>
  ([
    ["summary", "Summary", lesson.topics.length],
    ["definitions", "Definitions", lesson.definitions.length],
    ["mcqs", "MCQs", lesson.mcqs.length],
  ] as const).filter(([, , count]) => count > 0);

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
