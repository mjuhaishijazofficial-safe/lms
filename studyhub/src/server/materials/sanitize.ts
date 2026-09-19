import sanitizeHtml from "sanitize-html";

// Text notes are authored as HTML by an editor, so they are sanitized when saved AND when displayed.
// Only simple formatting survives: no scripts, styles, event handlers, images, iframes or forms.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "a"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: { href: attribs.href ?? "", target: "_blank", rel: "noopener noreferrer nofollow" } }),
  },
};

export const sanitizeNoteHtml = (html: string) => sanitizeHtml(html, OPTIONS);

/** Visible text of a note, used to reject notes that are empty once formatting is stripped. */
export const noteText = (html: string) => sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;|\s+/g, " ").trim();
