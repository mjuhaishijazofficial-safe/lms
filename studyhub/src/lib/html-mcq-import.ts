import { OPTION_LETTERS } from "./lesson";

/**
 * Reads the MCQs out of a study-guide HTML file (the kind built from NotebookLM notes): such files keep their
 * content as JavaScript lists — e.g. `const mcqs = [{q:"…", o:["…","…"], c:1, e:"…"}]` — and draw the page from
 * them. The browser side runs the file in a sandbox and hands those lists here; this part is pure, so it can be
 * tested: it recognises which list holds questions by its shape (not its name) and turns each item into a test
 * question. No AI and no guessing — the correct answer comes from the file itself.
 */

export type HtmlQuestion = { question: string; options: string[]; answer: number; explanation: string };

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

/** Plain text from a small piece of HTML: tags dropped, entities decoded, spaces tidied. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n: string) => NAMED[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** Every `const|let|var name = [` in the file's scripts: the lists worth reading. */
export function arrayNames(source: string): string[] {
  const names = new Set<string>();
  for (const m of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[/g)) names.add(m[1]);
  return [...names];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const pick = (o: Obj, keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined);

const QUESTION_KEYS = ["q", "question", "text", "prompt"];
const OPTION_KEYS = ["o", "options", "choices", "opts"];
const ANSWER_KEYS = ["c", "answer", "correct", "ans", "a"];
const EXPLAIN_KEYS = ["e", "explanation", "exp", "reason", "why"];

/** Looks like an MCQ: a question string and a list of at least two option strings. */
function isMcqItem(v: unknown): v is Obj {
  if (!isObj(v)) return false;
  const q = pick(v, QUESTION_KEYS);
  const o = pick(v, OPTION_KEYS);
  return typeof q === "string" && Array.isArray(o) && o.length >= 2 && o.every((x) => typeof x === "string");
}

/** The answer as a 0-based option index; letters and the option's own text work too. Null when it can't be told. */
function answerIndex(raw: unknown, options: string[], oneBased: boolean): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    const i = oneBased ? raw - 1 : raw;
    return i >= 0 && i < options.length ? i : null;
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    const letter = OPTION_LETTERS.indexOf(s.replace(/[().\s]/g, "").toUpperCase() as (typeof OPTION_LETTERS)[number]);
    if (/^\(?[A-Fa-f][).]?$/.test(s) && letter >= 0 && letter < options.length) return letter;
    if (/^\d+$/.test(s)) return answerIndex(Number(s), options, oneBased);
    const byText = options.findIndex((o) => htmlToText(o).toLowerCase() === htmlToText(s).toLowerCase());
    return byText >= 0 ? byText : null;
  }
  return null;
}

export type HtmlImportResult = { questions: HtmlQuestion[]; skipped: number };

/**
 * Picks the MCQ lists out of everything the file declared and converts them. Lists whose items don't look like
 * questions (the summary, the definitions) are ignored. A question whose answer can't be worked out is skipped
 * and counted, never saved with a guessed answer.
 */
export function questionsFromArrays(arrays: Record<string, unknown>): HtmlImportResult {
  const lists = Object.values(arrays).filter((v): v is unknown[] => Array.isArray(v) && v.length > 0 && v.filter(isMcqItem).length >= v.length / 2);
  const questions: HtmlQuestion[] = [];
  let skipped = 0;
  for (const list of lists) {
    const items = list.filter(isMcqItem);
    // Numbers are 0-based (as in `c:1`) unless one of them equals the option count, which only a 1-based list can do.
    const oneBased = items.some((it) => {
      const raw = pick(it, ANSWER_KEYS);
      const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
      return n === (pick(it, OPTION_KEYS) as string[]).length;
    });
    for (const it of items) {
      const options = (pick(it, OPTION_KEYS) as string[]).map(htmlToText).slice(0, OPTION_LETTERS.length);
      const question = htmlToText(pick(it, QUESTION_KEYS) as string);
      const answer = answerIndex(pick(it, ANSWER_KEYS), options, oneBased);
      if (!question || options.some((o) => !o) || answer === null) { skipped++; continue; }
      const e = pick(it, EXPLAIN_KEYS);
      questions.push({ question, options, answer, explanation: typeof e === "string" ? htmlToText(e) : "" });
    }
  }
  return { questions, skipped };
}
