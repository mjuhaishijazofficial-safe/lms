import { describe, expect, it } from "vitest";
import { parseMcqText } from "@/lib/mcq-import";

describe("parseMcqText", () => {
  it("reads a question with the answer written right after its options", () => {
    const { questions, skipped } = parseMcqText(
      "1. What is 2 + 2?\nA. 3\nB. 4\nC. 5\nD. 6\nAnswer: B\n\n2. Capital of France?\nA. Rome\nB. Paris\nAns: B\n",
    );
    expect(skipped).toBe(0);
    expect(questions).toEqual([
      { question: "What is 2 + 2?", options: ["3", "4", "5", "6"], answer: 1, needsReview: false },
      { question: "Capital of France?", options: ["Rome", "Paris"], answer: 1, needsReview: false },
    ]);
  });

  it("reads answers from a trailing answer key when there is no inline answer", () => {
    const { questions } = parseMcqText(
      "1. What is 2 + 2?\nA. 3\nB. 4\nC. 5\n\n2. Capital of France?\nA. Rome\nB. Paris\n\nAnswer Key\n1. B\n2. B\n",
    );
    expect(questions[0]).toMatchObject({ answer: 1, needsReview: false });
    expect(questions[1]).toMatchObject({ answer: 1, needsReview: false });
  });

  it("reads a compact one-line answer key (\"1.B 2.A 3.C\")", () => {
    const { questions } = parseMcqText("1. Q1?\nA. x\nB. y\n\n2. Q2?\nA. x\nB. y\n\nANSWER KEY: 1.B 2.A\n");
    expect(questions.map((q) => q.answer)).toEqual([1, 0]);
  });

  it("flags a question for review instead of guessing when no answer is found anywhere", () => {
    const { questions } = parseMcqText("1. A mystery question?\nA. one\nB. two\nC. three\n");
    expect(questions[0]).toMatchObject({ answer: 0, needsReview: true });
  });

  it("joins a question or option that wraps onto a second line", () => {
    const { questions } = parseMcqText(
      "1. This question is quite long and\nwraps onto a second line?\nA. A short option\nB. An option that also\nwraps onto another line\nAnswer: A\n",
    );
    expect(questions[0].question).toBe("This question is quite long and wraps onto a second line?");
    expect(questions[0].options[1]).toBe("An option that also wraps onto another line");
  });

  it("accepts (A), A) and Q1) style numbering", () => {
    const { questions } = parseMcqText("Q1) A question?\n(A) one\nB) two\nAnswer: A\n");
    expect(questions).toHaveLength(1);
    expect(questions[0].options).toEqual(["one", "two"]);
  });

  it("skips a detected question that ends up with fewer than two options, and ignores text before the first question", () => {
    const { questions, skipped } = parseMcqText("Instructions: answer everything.\n\n1. Broken question\nA. only one option\n\n2. Fine one\nA. x\nB. y\nAnswer: A\n");
    expect(skipped).toBe(1);
    expect(questions).toHaveLength(1);
    expect(questions[0].question).toBe("Fine one");
  });

  it("returns nothing found for text with no recognisable questions", () => {
    expect(parseMcqText("Just a paragraph of prose with no numbered questions at all.")).toEqual({ questions: [], skipped: 0 });
  });

  it("ignores an early mention of 'answer key' in the instructions and uses the real one at the end", () => {
    // "Answer key is provided at the end." on its own would wrongly look like the heading if the FIRST
    // mention were used — it has to be the LAST one, since that is where the real list actually is.
    const { questions } = parseMcqText([
      "Biology Quiz",
      "Choose the best answer for each question. Answer key is provided at the end.",
      "1. Powerhouse of the cell?",
      "A) Nucleus",
      "B) Mitochondrion",
      "C) Ribosome",
      "2. Basic unit of life?",
      "A) Tissue",
      "B) Cell",
      "",
      "Answer Key",
      "Answers to all 2 questions",
      "1. B",
      "2. B",
    ].join("\n"));
    expect(questions).toEqual([
      { question: "Powerhouse of the cell?", options: ["Nucleus", "Mitochondrion", "Ribosome"], answer: 1, needsReview: false },
      { question: "Basic unit of life?", options: ["Tissue", "Cell"], answer: 1, needsReview: false },
    ]);
  });

  it("reads a real 20-question paper spread across several pages, with an option split across a page break", () => {
    const page1 = [
      "Biology — 20 Multiple Choice Questions",
      "Choose the best answer for each question. Answer key is provided at the end.",
      "1. Which organelle is known as the powerhouse of the cell?",
      "A) Nucleus", "B) Mitochondrion", "C) Ribosome", "D) Golgi apparatus",
      "2. What is the basic unit of life?",
      "A) Tissue", "B) Organ", "C) Cell", "D) Organ system",
    ].join("\n");
    const page2 = [
      "3. Which kingdom includes organisms such as mushrooms and yeasts?",
      "A) Plantae", "B) Animalia", "C) Fungi",
    ].join("\n");
    // Option D of question 3 is the very first line of the next page — a real page break landing mid-question.
    const page3 = [
      "D) Protista",
      "4. Which component of blood is mainly responsible for clotting?",
      "A) Platelets", "B) Red blood cells", "C) White blood cells", "D) Plasma",
    ].join("\n");
    const page4 = ["Answer Key", "Answers to all 4 questions", "1. B", "2. C", "3. D", "4. A"].join("\n");

    const { questions, skipped } = parseMcqText([page1, page2, page3, page4].join("\n"));
    expect(skipped).toBe(0);
    expect(questions).toHaveLength(4);
    expect(questions.every((q) => !q.needsReview)).toBe(true);
    expect(questions[2]).toEqual({ question: "Which kingdom includes organisms such as mushrooms and yeasts?", options: ["Plantae", "Animalia", "Fungi", "Protista"], answer: 3, needsReview: false });
    expect(questions.map((q) => q.answer)).toEqual([1, 2, 3, 0]);
  });
});
