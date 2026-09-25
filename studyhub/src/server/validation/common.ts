import { z } from "zod";

export const idSchema = z.string().regex(/^[a-z0-9]{20,40}$/i, "Invalid id.");

export const contentStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"], { error: "Choose a status." });

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(200, "Password is too long.");

export const trimmed = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} must be ${max} characters or fewer.`);

export const optionalText = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer.`).default("");

/**
 * A scheduled publish time. The client always sends this as a full ISO string with a timezone (built from an
 * `<input type="datetime-local">` value via `new Date(local).toISOString()`, see components/admin/schedule-field),
 * so "8am" means the admin's own 8am wherever this server happens to run — never blank means "not scheduled".
 */
export const publishAtSchema = z.string().optional().transform((raw, ctx): Date | null => {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: "custom", message: "Enter a valid date and time." });
    return z.NEVER;
  }
  return d;
});

export const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1);
