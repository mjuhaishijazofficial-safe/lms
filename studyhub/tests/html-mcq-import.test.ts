import { describe, expect, it } from "vitest";
import { arrayNames, htmlToText, questionsFromArrays } from "@/lib/html-mcq-import";

// Shaped exactly like the admin's NotebookLM study guides (PSY101 Lesson 1, ECO401 Lecture 2).
const summary = [{ n: 1, lesson: "Topic 1", title: "Definition &amp; Nature of Psychology", html: "<p>Psychology is…</p>" }];
const defs = [{ term: "Psychology", def: "The scientific study of behavior.", ex: "Exam anxiety." }];
const mcqs = [
  { q: "Which type of behavior is manifest, obvious, and easy to study directly?", o: ["Covert behavior", "Overt behavior", "Latent behavior", "Implicit behavior"], c: 1, e: "Overt behaviors are external actions." },
  { q: "Systematically watching behavior fulfills which goal?", o: ["Control", "Explanation", "Observation", "Prediction"], c: 2, e: "Observation gathers facts." },
  { q: "Definition &amp; nature: what is <strong>psychology</strong>?", o: ["A &lt;science&gt;", "An art"], c: 0 },
];

describe("questionsFromArrays", () => {
  it("finds the MCQ list by its shape and ignores the summary and definitions", () => {
    const { questions, skipped } = questionsFromArrays({ summary, defs, mcqs });
    expect(skipped).toBe(0);
    expect(questions).toHaveLength(3);
    expect(questions[0]).toEqual({
      question: "Which type of behavior is manifest, obvious, and easy to study directly?",
      options: ["Covert behavior", "Overt behavior", "Latent behavior", "Implicit behavior"],
      answer: 1,
      explanation: "Overt behaviors are external actions.",
    });
    expect(questions[1].answer).toBe(2);
  });

  it("turns HTML bits and entities into plain text, and allows a missing explanation", () => {
    const q = questionsFromArrays({ mcqs }).questions[2];
    expect(q.question).toBe("Definition & nature: what is psychology?");
    expect(q.options).toEqual(["A <science>", "An art"]);
    expect(q.explanation).toBe("");
  });

  it("does not care what the list is called", () => {
    expect(questionsFromArrays({ quizItems: mcqs }).questions).toHaveLength(3);
  });

  it("understands other ways of writing the answer: a letter, the option's text, or 1-based numbers", () => {
    const letters = [{ question: "2+2?", options: ["3", "4", "5"], answer: "B" }];
    expect(questionsFromArrays({ letters }).questions[0].answer).toBe(1);
    const byText = [{ question: "Capital of Pakistan?", options: ["Lahore", "Islamabad"], correct: "Islamabad" }];
    expect(questionsFromArrays({ byText }).questions[0].answer).toBe(1);
    // "3" is only possible 1-based with three options, so the whole list is read as 1-based.
    const oneBased = [
      { q: "a?", o: ["x", "y", "z"], answer: 3 },
      { q: "b?", o: ["x", "y", "z"], answer: 1 },
    ];
    expect(questionsFromArrays({ oneBased }).questions.map((q) => q.answer)).toEqual([2, 0]);
  });

  it("skips a question whose answer can't be told, instead of guessing", () => {
    const bad = [
      { q: "ok?", o: ["a", "b"], c: 0 },
      { q: "no answer?", o: ["a", "b"] },
      { q: "out of range?", o: ["a", "b"], c: 7 },
    ];
    const r = questionsFromArrays({ bad });
    expect(r.questions.map((q) => q.question)).toEqual(["ok?"]);
    expect(r.skipped).toBe(2);
  });

  it("finds nothing in a file with no questions", () => {
    expect(questionsFromArrays({ summary, defs })).toEqual({ questions: [], skipped: 0 });
    expect(questionsFromArrays({})).toEqual({ questions: [], skipped: 0 });
  });
});

describe("arrayNames", () => {
  it("lists every array a script declares", () => {
    const src = "let readCount = 0;\nconst palette = ['#6C4AB6'];\nconst summary = [\n{n:1}];\nconst terms=[{}];\nvar mcqs = [];\nconst x = 5;";
    expect(arrayNames(src)).toEqual(["palette", "summary", "terms", "mcqs"]);
  });
});

describe("htmlToText", () => {
  it("strips tags and decodes entities", () => {
    expect(htmlToText("Rs. 1,000 &amp; <em>more</em>&nbsp;&#39;x&#39; &#x2014; y")).toBe("Rs. 1,000 & more 'x' — y");
  });
});
