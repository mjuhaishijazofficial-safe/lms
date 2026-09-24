import { OPTION_LETTERS } from "./lesson";

/**
 * Turns the plain text of an MCQ document into draft test questions — no AI, just the shapes a real question
 * paper actually uses: a numbered question, lettered options, and the correct answer either written right after
 * the options or collected in an "Answer key" list at the end. Every word comes from the file; nothing is
 * invented. `needsReview` marks a question whose answer could not be found, so the admin can pick it by hand
 * instead of the question being silently wrong or silently dropped.
 */
export type ImportedQuestion = { question: string; options: string[]; answer: number; needsReview: boolean };
export type ImportResult = { questions: ImportedQuestion[]; skipped: number };

const QUESTION_START = /^(?:Q(?:uestion)?\.?\s*)?(\d{1,3})[.):]\s+(.*)$/i;
const OPTION_START = /^\(?([A-Fa-f])[.):]\s+(.*)$/;
const INLINE_ANSWER = /^(?:correct\s+)?ans(?:wer)?\s*[:\-]?\s*\(?([A-Fa-f])\)?\.?\s*$/i;
const ANSWER_KEY_HEADING = /answer\s*keys?/gi;
const ANSWER_KEY_ENTRY = /(\d{1,3})\s*[.):\-]?\s*\(?([A-Fa-f])\)?/g;

const letterIndex = (letter: string): number => OPTION_LETTERS.indexOf(letter.toUpperCase() as (typeof OPTION_LETTERS)[number]);

type RawQuestion = { number: number; question: string[]; options: string[][]; inlineAnswer: number | null };

/** Reads a trailing "Answer key" section (one entry per question number) if the document has one. */
function readAnswerKey(text: string): Map<number, number> {
  const map = new Map<number, number>();
  for (const m of text.matchAll(ANSWER_KEY_ENTRY)) map.set(Number(m[1]), letterIndex(m[2]));
  return map;
}

export function parseMcqText(text: string): ImportResult {
  // The real answer key sits at the end of the document; an earlier sentence like "answer key is on the last
  // page" also contains the words, so the LAST occurrence is the one that matters, not the first.
  const headingMatches = [...text.matchAll(ANSWER_KEY_HEADING)];
  const keyStart = headingMatches.length ? headingMatches[headingMatches.length - 1].index : -1;
  const mainText = keyStart === -1 ? text : text.slice(0, keyStart);
  const answerKey = keyStart === -1 ? new Map<number, number>() : readAnswerKey(text.slice(keyStart));

  const raw: RawQuestion[] = [];
  let current: RawQuestion | null = null;
  let inOption = false; // true once the current question has at least one option, so plain lines extend it

  for (const rawLine of mainText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const qMatch = QUESTION_START.exec(line);
    if (qMatch) {
      current = { number: Number(qMatch[1]), question: [qMatch[2]].filter(Boolean), options: [], inlineAnswer: null };
      raw.push(current);
      inOption = false;
      continue;
    }
    if (!current) continue; // text before the first recognisable question (a title, instructions) is ignored

    const ansMatch = INLINE_ANSWER.exec(line);
    if (ansMatch) {
      current.inlineAnswer = letterIndex(ansMatch[1]);
      continue;
    }
    const optMatch = OPTION_START.exec(line);
    if (optMatch) {
      current.options.push([optMatch[2]]);
      inOption = true;
      continue;
    }
    // A continuation line: still part of whichever the question is currently building (an option that wrapped
    // onto a second line, or the question text itself before its first option appears).
    if (inOption) current.options[current.options.length - 1].push(line);
    else current.question.push(line);
  }

  const questions: ImportedQuestion[] = [];
  let skipped = 0;
  for (const q of raw) {
    const options = q.options.map((lines) => lines.join(" ").trim()).filter(Boolean).slice(0, OPTION_LETTERS.length);
    const question = q.question.join(" ").trim();
    if (!question || options.length < 2) {
      skipped++;
      continue;
    }
    const answer = q.inlineAnswer ?? answerKey.get(q.number) ?? null;
    questions.push({ question, options, answer: answer !== null && answer >= 0 && answer < options.length ? answer : 0, needsReview: answer === null });
  }
  return { questions, skipped };
}
