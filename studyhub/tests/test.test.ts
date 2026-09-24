import { describe, expect, it } from "vitest";
import { publicQuestion, questionCount, scoreAnswers, testQuestionsSchema, type TestQuestion } from "@/lib/test";
import { createTestSchema } from "@/server/validation/tests";

const q = (answer: number): TestQuestion => ({ question: "Q?", options: ["a", "b", "c", "d"], answer });

describe("scoreAnswers", () => {
  it("counts only the questions answered correctly", () => {
    const questions = [q(0), q(1), q(2)];
    expect(scoreAnswers(questions, [0, 1, 2])).toBe(3);
    expect(scoreAnswers(questions, [0, 0, 0])).toBe(1);
    expect(scoreAnswers(questions, [])).toBe(0);
  });

  it("treats a blank (null) answer as wrong, never as a match", () => {
    expect(scoreAnswers([q(0)], [null])).toBe(0);
  });

  it("ignores extra answers beyond the number of questions", () => {
    expect(scoreAnswers([q(0)], [0, 0, 0])).toBe(1);
  });
});

describe("questionCount", () => {
  it("reads the length of a real array and treats anything else as zero", () => {
    expect(questionCount([q(0), q(1)])).toBe(2);
    expect(questionCount([])).toBe(0);
    expect(questionCount(null)).toBe(0);
    expect(questionCount("not an array")).toBe(0);
    expect(questionCount(undefined)).toBe(0);
  });
});

describe("publicQuestion", () => {
  it("drops the answer and any explanation, keeping only what an in-progress test may show", () => {
    const p = publicQuestion({ question: "Q?", options: ["a", "b"], answer: 1, explanation: "because" });
    expect(p).toEqual({ question: "Q?", options: ["a", "b"] });
    expect(p).not.toHaveProperty("answer");
    expect(p).not.toHaveProperty("explanation");
  });
});

describe("testQuestionsSchema", () => {
  it("accepts a normal set of questions", () => {
    expect(testQuestionsSchema.safeParse([q(0), q(1)]).success).toBe(true);
  });

  it("rejects an empty list and a list that is too long", () => {
    expect(testQuestionsSchema.safeParse([]).success).toBe(false);
    expect(testQuestionsSchema.safeParse(Array.from({ length: 101 }, () => q(0))).success).toBe(false);
  });

  it("rejects a question whose answer is not one of its options", () => {
    expect(testQuestionsSchema.safeParse([{ question: "Q", options: ["a", "b"], answer: 5 }]).success).toBe(false);
  });
});

describe("createTestSchema (the admin form's questionsJson field)", () => {
  const base = { subjectId: "a".repeat(24), title: "Week 1", description: "", durationMinutes: "20", status: "DRAFT" };

  it("parses valid JSON questions into a clean array", () => {
    const parsed = createTestSchema.safeParse({ ...base, questionsJson: JSON.stringify([q(0)]) });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.questionsJson).toHaveLength(1);
  });

  it("rejects text that is not valid JSON", () => {
    expect(createTestSchema.safeParse({ ...base, questionsJson: "{not json" }).success).toBe(false);
  });

  it("rejects JSON that does not match the question shape", () => {
    expect(createTestSchema.safeParse({ ...base, questionsJson: JSON.stringify([{ question: "Q" }]) }).success).toBe(false);
  });

  it("coerces the duration to a number and rejects one that is out of range", () => {
    const parsed = createTestSchema.safeParse({ ...base, questionsJson: JSON.stringify([q(0)]) });
    expect(parsed.success && parsed.data.durationMinutes).toBe(20);
    expect(createTestSchema.safeParse({ ...base, durationMinutes: "0", questionsJson: JSON.stringify([q(0)]) }).success).toBe(false);
  });
});
