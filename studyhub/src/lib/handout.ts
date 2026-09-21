// Turns the text of a handout into chapters. Pure (no I/O), so it can be unit tested against awkward real handouts.
//
// Handouts mark their chapters as "Lesson 43", "Lecture 5", "Chapter 3" and so on, and usually repeat that in the
// header of every page. So a heading only starts a NEW chapter when its number changes; the same number appearing
// again is the running header of the chapter we are already in.

export type HandoutChapter = { number: number | null; title: string; text: string };

const HEADING = /^\s*(lesson|lecture|chapter|unit|module)\s*[-–—:.#]?\s*(\d{1,3})\b[\s:.\-–—]*(.*)$/i;
const MAX_HEADING_CHARS = 120;
/** A chapter shorter than this is a stray heading (a table of contents line, a cross-reference), not a chapter. */
const MIN_CHAPTER_CHARS = 400;
/** With no headings at all, text is cut into parts about this long. */
const FALLBACK_PART_CHARS = 12_000;

const clean = (s: string) => s.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

type Mark = { line: number; number: number; title: string };

function findHeadings(lines: string[]): Mark[] {
  const marks: Mark[] = [];
  lines.forEach((raw, line) => {
    const text = raw.trim();
    if (!text || text.length > MAX_HEADING_CHARS) return;
    const m = HEADING.exec(text);
    if (!m) return;
    const number = Number(m[2]);
    // A line like "Lesson 5 covers the following..." is prose, not a heading: real headings do not end a sentence.
    const rest = m[3].trim();
    if (/[a-z]{3,}.*\b(is|are|was|were|will|shall|covers|discusses)\b/i.test(rest) && rest.split(/\s+/).length > 8) return;
    marks.push({ line, number, title: rest.replace(/[.:\-–—\s]+$/, "") });
  });
  return marks;
}

/** Repeated running headers collapse into the first, and numbers must not go backwards (a cross-reference would). */
function newChapterMarks(marks: Mark[]): Mark[] {
  const out: Mark[] = [];
  for (const m of marks) {
    const last = out[out.length - 1];
    if (last && m.number === last.number) {
      // Same chapter: keep the longest title we have seen, since the first header line is sometimes just "Lesson 43".
      if (m.title.length > last.title.length) last.title = m.title;
      continue;
    }
    if (last && m.number < last.number) continue;
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
  const lines = pages.join("\n").replace(/\r/g, "").split("\n");
  const marks = newChapterMarks(findHeadings(lines));

  if (marks.length === 0) {
    const parts = chunkText(clean(lines.join("\n")), FALLBACK_PART_CHARS);
    return parts.map((text, i) => ({ number: null, title: `Part ${i + 1}`, text }));
  }

  const chapters: HandoutChapter[] = [];
  const preamble = clean(lines.slice(0, marks[0].line).join("\n"));
  if (preamble.length >= MIN_CHAPTER_CHARS) chapters.push({ number: null, title: "Introduction", text: preamble });

  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].line : lines.length;
    // The heading line itself is dropped from the body; running headers inside the chapter are dropped too.
    const body = lines
      .slice(mark.line + 1, end)
      .filter((l) => {
        const m = HEADING.exec(l.trim());
        return !(m && Number(m[2]) === mark.number && l.trim().length <= MAX_HEADING_CHARS);
      })
      .join("\n");
    chapters.push({ number: mark.number, title: mark.title, text: clean(body) });
  });

  // A very short "chapter" is a stray heading: fold its text into the chapter before it.
  const merged: HandoutChapter[] = [];
  for (const c of chapters) {
    if (c.text.length < MIN_CHAPTER_CHARS && merged.length > 0) {
      merged[merged.length - 1].text = clean(`${merged[merged.length - 1].text}\n\n${c.title}\n${c.text}`);
    } else {
      merged.push(c);
    }
  }
  return merged;
}

/** A readable name for a chapter, used as the lesson title: "Lesson 43: Teaching Academic L2 Writing II". */
export function chapterLabel(c: HandoutChapter, word = "Lesson"): string {
  if (c.number === null) return c.title;
  return c.title ? `${word} ${c.number}: ${c.title}` : `${word} ${c.number}`;
}
