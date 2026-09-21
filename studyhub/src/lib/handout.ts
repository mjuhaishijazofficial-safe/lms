// Turns the text of a handout into chapters. Pure (no I/O), so it can be unit tested against awkward real handouts.
//
// Written against a real handout (Virtual University ENG512), which taught three things a tidy example never would:
//  - it opens with a table of contents listing every lesson, which must not be mistaken for the lessons themselves;
//  - the lesson title sits on the line AFTER "Lesson-01", often in capitals and sometimes wrapped over two lines;
//  - every page repeats a watermark and a footer, which would otherwise be sent to the AI (and paid for) fifty times.
//
// Chapters are marked "Lesson 43", "Lesson-01", "Lecture 5", "Chapter 3" and so on. A heading only starts a NEW chapter
// when its number changes: the same number repeated is the running header of the chapter we are already in.

export type HandoutChapter = { number: number | null; title: string; text: string };

// PDFs that mix fonts inside one word come out as "Le sson-11", so stray spaces are allowed between the letters.
const KEYWORDS = ["lesson", "lecture", "chapter", "unit", "module"].map((w) => w.split("").join("\\s?")).join("|");
const HEADING = new RegExp(`^\\s*(${KEYWORDS})\\s*[-–—:.#]?\\s*(\\d{1,3})\\b[\\s:.\\-–—]*(.*)$`, "i");
const TOPIC_LINE = /^\s*topic\b/i;
const MAX_HEADING_CHARS = 120;
const MAX_TITLE_CHARS = 100;
/**
 * A heading followed by less text than this before the next heading is not a chapter: it is a table-of-contents entry
 * or a stray cross-reference. Real lessons are far longer.
 */
const MIN_CHAPTER_CHARS = 400;
/** With no headings at all, text is cut into parts about this long. */
const FALLBACK_PART_CHARS = 12_000;
/** A line that appears on at least this share of the pages (and at least MIN_REPEAT_PAGES of them) is page furniture. */
const REPEAT_SHARE = 0.3;
const MIN_REPEAT_PAGES = 3;
/** Table-of-contents entries found before the first real chapter: this many means the front matter is a contents page. */
const CONTENTS_ENTRIES = 3;

const clean = (s: string) => s.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "vs", "vs."]);

/** "DEFINITIONS AND GUIDING PRINCIPLES OF BILINGUALISM" -> "Definitions and Guiding Principles of Bilingualism". */
export function tidyTitle(raw: string): string {
  const title = raw.replace(/\s+/g, " ").replace(/^[\s:.\-–—]+|[\s:.\-–—]+$/g, "");
  if (/[a-z]/.test(title)) return title; // already mixed case: leave the author's capitals alone
  return title
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.replace(/^([("'“]*)([a-z])/, (_, pre: string, c: string) => pre + c.toUpperCase())))
    .join(" ")
    .replace(/([:–—-])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase()); // "needs:social", "self-regulation"
}

// ---------------------------------------------------------------------------------------------------------------------
// Page furniture

const normaliseLine = (l: string) => l.replace(/\s+/g, " ").trim().replace(/\d+/g, "#");

/**
 * Removes lines that repeat across the handout's pages: watermarks, running headers, footers, page numbers.
 * Digits are ignored when comparing, so "... 0326-0775533 4" and "... 0326-0775533 5" count as the same footer.
 * Chapter headings and "Topic No." lines are never removed: they repeat once per lesson, but they are structure, not furniture.
 */
export function stripPageFurniture(pages: string[]): string[] {
  const seenOn = new Map<string, number>();
  for (const page of pages) {
    const unique = new Set<string>();
    for (const raw of page.split("\n")) {
      const line = raw.trim();
      if (!line || line.length > 200 || HEADING.test(line) || TOPIC_LINE.test(line)) continue;
      unique.add(normaliseLine(line));
    }
    for (const key of unique) seenOn.set(key, (seenOn.get(key) ?? 0) + 1);
  }
  const needed = Math.max(MIN_REPEAT_PAGES, Math.ceil(pages.length * REPEAT_SHARE));
  const furniture = new Set([...seenOn].filter(([, n]) => n >= needed).map(([key]) => key));
  if (furniture.size === 0) return pages;
  return pages.map((page) =>
    page
      .split("\n")
      .filter((raw) => {
        const line = raw.trim();
        return !line || line.length > 200 || HEADING.test(line) || TOPIC_LINE.test(line) || !furniture.has(normaliseLine(line));
      })
      .join("\n"),
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Headings

type Mark = { line: number; number: number; title: string; /** last line taken up by the heading and its title */ end: number };

/** Title lines that follow a bare "Lesson-01": up to three short lines, ending before "Topic No. ..." or the body. */
function titleAfter(lines: string[], from: number): { title: string; end: number } {
  const parts: string[] = [];
  let end = from;
  for (let i = from + 1; i < lines.length && parts.length < 3; i++) {
    const text = lines[i].trim();
    if (!text) continue;
    if (TOPIC_LINE.test(text)) {
      end = i; // the "Topic No. 001-006" line belongs to the heading too
      break;
    }
    // A title is short and does not read like a sentence; anything else is already the body.
    if (text.length > MAX_TITLE_CHARS || /[.;]$/.test(text) || HEADING.test(text)) break;
    parts.push(text);
    end = i;
  }
  return { title: parts.join(" "), end };
}

function findHeadings(lines: string[]): Mark[] {
  const marks: Mark[] = [];
  lines.forEach((raw, line) => {
    const text = raw.trim();
    if (!text || text.length > MAX_HEADING_CHARS) return;
    const m = HEADING.exec(text);
    if (!m) return;
    const rest = m[3].trim();
    // A line like "Lesson 5 covers the following..." is prose, not a heading: real headings do not read as a sentence.
    if (/[a-z]{3,}.*\b(is|are|was|were|will|shall|covers|discusses)\b/i.test(rest) && rest.split(/\s+/).length > 8) return;
    const after = rest ? { title: rest, end: line } : titleAfter(lines, line);
    marks.push({ line, number: Number(m[2]), title: tidyTitle(after.title), end: after.end });
  });
  return marks;
}

/** Repeated running headers of one chapter collapse into a single mark; the longest title seen wins. */
function collapseRuns(marks: Mark[]): Mark[] {
  const out: Mark[] = [];
  for (const m of marks) {
    const last = out[out.length - 1];
    if (last && last.number === m.number) {
      if (m.title.length > last.title.length) last.title = m.title;
      continue;
    }
    out.push({ ...m });
  }
  return out;
}

/** Cuts text into pieces no longer than maxChars, at paragraph boundaries wherever possible. */
export function chunkText(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const para of paragraphs) {
    if (para.length > maxChars) {
      // One enormous paragraph (a pasted table, say): fall back to cutting at sentence ends, then hard.
      push();
      let rest = para;
      while (rest.length > maxChars) {
        const cut = Math.max(rest.lastIndexOf(". ", maxChars), rest.lastIndexOf("\n", maxChars));
        const at = cut > maxChars * 0.5 ? cut + 1 : maxChars;
        chunks.push(rest.slice(0, at).trim());
        rest = rest.slice(at);
      }
      current = rest;
      continue;
    }
    if (current && current.length + para.length + 2 > maxChars) push();
    current += (current ? "\n\n" : "") + para;
  }
  push();
  return chunks;
}

/**
 * Splits a handout, given as one string per page, into chapters. Falls back to even parts when the handout has no
 * recognisable headings, so a handout is never refused just because it is laid out differently.
 */
export function splitHandout(pages: string[]): HandoutChapter[] {
  const lines = stripPageFurniture(pages).join("\n").replace(/\r/g, "").split("\n");
  const candidates = collapseRuns(findHeadings(lines));

  if (candidates.length === 0) {
    const parts = chunkText(clean(lines.join("\n")), FALLBACK_PART_CHARS);
    return parts.map((text, i) => ({ number: null, title: `Part ${i + 1}`, text }));
  }

  // How much text each heading owns, up to the next heading. Table-of-contents entries own almost none.
  const owned = (i: number) => {
    const to = i + 1 < candidates.length ? candidates[i + 1].line : lines.length;
    return lines.slice(candidates[i].end + 1, to).join("\n").replace(/\s+/g, "").length;
  };
  const substantial = candidates.filter((_, i) => owned(i) >= MIN_CHAPTER_CHARS);

  // Numbers must not go backwards: a cross-reference to an earlier lesson in the middle of a chapter would.
  const marks: Mark[] = [];
  for (const m of substantial) {
    const last = marks[marks.length - 1];
    if (last && m.number <= last.number) continue;
    marks.push(m);
  }

  if (marks.length === 0) {
    const parts = chunkText(clean(lines.join("\n")), FALLBACK_PART_CHARS);
    return parts.map((text, i) => ({ number: null, title: `Part ${i + 1}`, text }));
  }

  const chapters: HandoutChapter[] = [];

  // Front matter: kept as an introduction unless it is a cover and contents page (several headings that own no text).
  const beforeFirst = candidates.filter((c) => c.line < marks[0].line && !substantial.includes(c));
  const preamble = clean(lines.slice(0, marks[0].line).join("\n"));
  if (preamble.replace(/\s+/g, "").length >= MIN_CHAPTER_CHARS && beforeFirst.length < CONTENTS_ENTRIES) {
    chapters.push({ number: null, title: "Introduction", text: preamble });
  }

  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].line : lines.length;
    // The heading and its title lines are dropped from the body, and so are running headers repeating this number.
    const body = lines
      .slice(mark.end + 1, end)
      .filter((l) => {
        const m = HEADING.exec(l.trim());
        return !(m && Number(m[2]) === mark.number && l.trim().length <= MAX_HEADING_CHARS);
      })
      .join("\n");
    chapters.push({ number: mark.number, title: mark.title, text: clean(body) });
  });
  return chapters;
}

/** A readable name for a chapter, used as the lesson title: "Lesson 43: Teaching Academic L2 Writing II". */
export function chapterLabel(c: HandoutChapter, word = "Lesson"): string {
  if (c.number === null) return c.title;
  return c.title ? `${word} ${c.number}: ${c.title}` : `${word} ${c.number}`;
}
