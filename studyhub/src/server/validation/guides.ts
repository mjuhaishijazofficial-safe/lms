import { z } from "zod";
import { testQuestionsSchema, type TestQuestion } from "@/lib/test";
import { idSchema, optionalText, publishAtSchema, trimmed } from "./common";

/**
 * One chapter made from one study-guide HTML file: the chapter, the guide as its material, and (optionally) a
 * practice test from the MCQs the browser read out of the guide. The questions arrive as JSON and are validated
 * here exactly like a hand-written test's, so nothing unchecked reaches the database.
 */
export const guideChapterSchema = z
  .object({
    subjectId: idSchema,
    title: trimmed(120, "Chapter title"),
    description: optionalText(500),
    materialTitle: trimmed(160, "Guide title"),
    release: z.enum(["now", "scheduled", "hidden"], { error: "Choose when students get this chapter." }),
    publishAt: publishAtSchema,
    makeTest: z.preprocess((v) => v === "1" || v === "on" || v === "true", z.boolean()),
    durationMinutes: z.coerce.number({ error: "Enter a time limit." }).int().min(1, "Give at least 1 minute.").max(300, "Keep it under 5 hours."),
    questionsJson: z.string().max(300_000, "That's too many questions for one test.").optional(),
  })
  .transform((d, ctx) => {
    if (d.release === "scheduled" && !d.publishAt) {
      ctx.addIssue({ code: "custom", path: ["publishAt"], message: "Choose the date and time this chapter opens." });
      return z.NEVER;
    }
    let questions: TestQuestion[] = [];
    if (d.makeTest) {
      let raw: unknown;
      try { raw = JSON.parse(d.questionsJson ?? ""); } catch { raw = null; }
      const parsed = testQuestionsSchema.safeParse(raw);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", path: ["questionsJson"], message: parsed.error.issues[0]?.message ?? "This guide's questions could not be read." });
        return z.NEVER;
      }
      questions = parsed.data;
    }
    const { questionsJson: _unused, ...rest } = d;
    void _unused;
    return { ...rest, publishAt: d.release === "scheduled" ? d.publishAt : null, questions };
  });

export type GuideChapterInput = z.infer<typeof guideChapterSchema>;
