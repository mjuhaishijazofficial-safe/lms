import { z } from "zod";
import { parseDuration, parseYouTubeId, safeExternalUrl } from "@/lib/media";
import { contentStatusSchema, idSchema, optionalText, trimmed } from "./common";

const common = {
  chapterId: idSchema,
  title: trimmed(160, "Title"),
  description: optionalText(1000),
  status: contentStatusSchema,
};

// Each of these validates a form input and outputs the value we store instead:
// `youtubeUrl` becomes the 11-character video id, and `duration` becomes seconds (or null).
const youtubeUrl = z.string().trim().transform((value, ctx) => {
  const id = parseYouTubeId(value);
  if (!id) ctx.addIssue({ code: "custom", message: "Enter a valid YouTube link, for example https://www.youtube.com/watch?v=…" });
  return id ?? z.NEVER;
});

const externalUrl = z.string().trim().transform((value, ctx) => {
  const url = safeExternalUrl(value);
  if (!url) ctx.addIssue({ code: "custom", message: "Enter a full web address starting with https:// (or http://)." });
  return url ?? z.NEVER;
});

const duration = z.string().optional().transform((raw, ctx): number | null => {
  const value = (raw ?? "").trim();
  if (value === "") return null;
  const seconds = parseDuration(value);
  if (seconds === null) ctx.addIssue({ code: "custom", message: "Use minutes:seconds, for example 24:15." });
  return seconds ?? z.NEVER;
});

const textContent = z.string().max(200_000, "This note is too long.");

/** `extra` adds fields shared by every variant (the id, when editing). */
const build = <E extends z.ZodRawShape>(extra: E) =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("FILE"), ...common, ...extra }),
    z.object({ type: z.literal("YOUTUBE"), ...common, ...extra, youtubeUrl, duration }),
    z.object({ type: z.literal("LINK"), ...common, ...extra, externalUrl }),
    z.object({ type: z.literal("TEXT"), ...common, ...extra, textContent }),
  ]);

export const createMaterialSchema = build({});
export const updateMaterialSchema = build({ id: idSchema });

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
