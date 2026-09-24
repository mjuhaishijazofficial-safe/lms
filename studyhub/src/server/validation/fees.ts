import { z } from "zod";
import { idSchema, optionalText, trimmed } from "./common";

const amount = z.coerce.number().int().min(1, "Enter an amount greater than 0.").max(10_000_000, "That amount is too large.");

const dueDate = z.string().optional().transform((raw, ctx): Date | null => {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: "custom", message: "Enter a valid date." });
    return z.NEVER;
  }
  return d;
});

const common = { amount, period: trimmed(60, "Period"), dueDate, note: optionalText(300) };

/** One fee for one named student, e.g. added from their profile page. */
export const singleFeeSchema = z.object({ userId: idSchema, ...common });

/** One fee created for every student matching the target — "generate this month's fee for everyone". */
export const bulkFeeSchema = z
  .object({ target: z.enum(["all", "course"]), courseId: z.string().optional(), ...common })
  .refine((v) => v.target !== "course" || idSchema.safeParse(v.courseId).success, { message: "Choose a program.", path: ["courseId"] });

export const feeStatusSchema = z.object({ id: idSchema, status: z.enum(["PENDING", "PAID", "WAIVED"]) });

export type SingleFeeInput = z.infer<typeof singleFeeSchema>;
export type BulkFeeInput = z.infer<typeof bulkFeeSchema>;
