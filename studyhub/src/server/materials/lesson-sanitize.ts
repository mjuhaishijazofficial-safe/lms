import sanitizeHtml from "sanitize-html";
import { LESSON_BODY_CLASSES, lessonSchema, type Lesson } from "@/lib/lesson";

// A lesson body is written by a model, so it is treated exactly like any other untrusted HTML: sanitised when
// saved AND when displayed. On top of what notes allow, lessons may use tables and the template's own layout
// classes, because that is what the content needs. Class names cannot execute anything; scripts, styles,
// event handlers, iframes, images and links to other schemes are all discarded.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "h4", "h5", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "a", "span", "div",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: { a: ["href", "target", "rel"], "*": ["class"] },
  allowedClasses: { "*": [...LESSON_BODY_CLASSES] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: { href: attribs.href ?? "", target: "_blank", rel: "noopener noreferrer nofollow" } }),
  },
};

export const sanitizeLessonBody = (html: string) => sanitizeHtml(html, OPTIONS);

/** Visible text, used to reject a topic that is empty once the markup is stripped. */
export const lessonBodyText = (html: string) =>
  sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;|\s+/g, " ").trim();

/**
 * Validates lesson content and cleans every piece of HTML in it. Returns the lesson to store, or the reason
 * it was rejected. Anything reaching the database has already been through this.
 */
export function parseLesson(input: unknown): { ok: true; lesson: Lesson } | { ok: false; error: string } {
  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "This lesson is not in the expected format." };

  const topics = parsed.data.topics.map((t) => ({ ...t, body: sanitizeLessonBody(t.body) }));
  const empty = topics.find((t) => !lessonBodyText(t.body));
  if (empty) return { ok: false, error: `The topic "${empty.title}" has no content once formatting is removed.` };

  return { ok: true, lesson: { ...parsed.data, topics } };
}
