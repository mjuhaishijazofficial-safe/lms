import { z } from "zod";
import { parseDuration, parseYouTubeId, safeExternalUrl } from "@/lib/media";
import { parseLesson } from "@/server/materials/lesson-sanitize";
import { contentStatusSchema, idSchema, optionalText, publishAtSchema, trimmed } from "./common";

const common = {
  chapterId: idSchema,
  title: trimmed(160, "Title"),
  description: optionalText(1000),
  status: contentStatusSchema,
  publishAt: publishAtSchema,
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

// The admin pastes lesson content as JSON; it is parsed, validated and sanitised here, so only a clean
// lesson object ever reaches the service layer.
const lessonJson = z.string().trim().max(400_000, "This lesson is too long.").transform((raw, ctx) => {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    ctx.addIssue({ code: "custom", message: "That is not valid JSON. Paste the whole block, including the outer { and }." });
    return z.NEVER;
  }
  const result = parseLesson(data);
  if (!result.ok) {
    ctx.addIssue({ code: "custom", message: result.error });
    return z.NEVER;
  }
  return result.lesson;
});

/** `extra` adds fields shared by every variant (the id, when editing). */
const build = <E extends z.ZodRawShape>(extra: E) =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("FILE"), ...common, ...extra }),
    z.object({ type: z.literal("YOUTUBE"), ...common, ...extra, youtubeUrl, duration }),
    z.object({ type: z.literal("LINK"), ...common, ...extra, externalUrl }),
    z.object({ type: z.literal("TEXT"), ...common, ...extra, textContent }),
    z.object({ type: z.literal("LESSON"), ...common, ...extra, lessonJson }),
  ]);

export const createMaterialSchema = build({});
export const updateMaterialSchema = build({ id: idSchema });

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
