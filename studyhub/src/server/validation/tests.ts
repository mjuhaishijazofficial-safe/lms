import { z } from "zod";
import { testQuestionsSchema } from "@/lib/test";
import { contentStatusSchema, idSchema, optionalText, publishAtSchema, trimmed } from "./common";

// The question builder keeps its own state client-side and serialises it into this one hidden field, the same
// way the lesson content textarea works — so only a clean, validated question list ever reaches the service.
const questionsJson = z.string().trim().max(300_000, "That's too much content for one test.").transform((raw, ctx) => {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    ctx.addIssue({ code: "custom", message: "Something went wrong building the question list. Please try again." });
    return z.NEVER;
  }
  const parsed = testQuestionsSchema.safeParse(data);
  if (!parsed.success) {
    ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Check the questions below." });
    return z.NEVER;
  }
  return parsed.data;
});

const common = {
  subjectId: idSchema,
  title: trimmed(160, "Title"),
  description: optionalText(500),
  durationMinutes: z.coerce.number().int().min(1, "Give at least 1 minute.").max(300, "Keep it under 5 hours."),
  status: contentStatusSchema,
  publishAt: publishAtSchema,
  questionsJson,
};

export const createTestSchema = z.object(common);
export const updateTestSchema = z.object({ ...common, id: idSchema });

export type CreateTestInput = z.infer<typeof createTestSchema>;
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
