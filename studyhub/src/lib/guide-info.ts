import { htmlToText } from "./html-mcq-import";
import { titleFromFileName } from "./filename";

/**
 * The chapter title and a one-line description, read from a study guide's own markup (no scripts run): the page's
 * main heading, else its <title>, else the file name; and the short paragraph right under that heading, if any.
 */
export function guideInfo(source: string, fileName: string): { title: string; description: string } {
  const h1 = source.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const titleTag = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = (h1 && htmlToText(h1[1])) || (titleTag && htmlToText(titleTag[1])) || titleFromFileName(fileName);

  // Only a paragraph that directly follows the heading counts, so an unrelated one is never picked up.
  const after = h1 ? source.slice((h1.index ?? 0) + h1[0].length) : "";
  const sub = after.match(/^\s*<p\b[^>]*>([\s\S]*?)<\/p>/i);
  const description = sub ? htmlToText(sub[1]) : "";

  return { title: title.slice(0, 120), description: description.slice(0, 500) };
}

/** "Lesson 2" before "Lesson 10": the order files are listed and numbered in. */
export const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
