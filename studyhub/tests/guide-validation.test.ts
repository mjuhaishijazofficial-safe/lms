import { describe, expect, it } from "vitest";
import { guideChapterSchema } from "@/server/validation/guides";

const ID = "cmabcdefghijklmnopqrstuvw";
const base = { subjectId: ID, title: "What is Psychology?", description: "", materialTitle: "PSY101 Lesson 1", durationMinutes: "30" };
const questions = JSON.stringify([{ question: "2+2?", options: ["3", "4"], answer: 1, explanation: "Sums." }]);

describe("guideChapterSchema", () => {
  it("a scheduled chapter needs its opening time, and keeps it", () => {
    expect(guideChapterSchema.safeParse({ ...base, release: "scheduled", publishAt: "", makeTest: "" }).success).toBe(false);
    const ok = guideChapterSchema.parse({ ...base, release: "scheduled", publishAt: "2026-10-01T03:00:00.000Z", makeTest: "" });
    expect(ok.publishAt?.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("'now' and 'hidden' carry no opening time, even if one was sent", () => {
    for (const release of ["now", "hidden"]) {
      expect(guideChapterSchema.parse({ ...base, release, publishAt: "2026-10-01T03:00:00.000Z", makeTest: "" }).publishAt).toBeNull();
    }
  });

  it("with a test, the questions are validated like any hand-written test", () => {
    const r = guideChapterSchema.parse({ ...base, release: "now", makeTest: "1", questionsJson: questions });
    expect(r.makeTest).toBe(true);
    expect(r.questions).toEqual([{ question: "2+2?", options: ["3", "4"], answer: 1, explanation: "Sums." }]);
    const bad = JSON.stringify([{ question: "x", options: ["a", "b"], answer: 5 }]);
    expect(guideChapterSchema.safeParse({ ...base, release: "now", makeTest: "1", questionsJson: bad }).success).toBe(false);
    expect(guideChapterSchema.safeParse({ ...base, release: "now", makeTest: "1", questionsJson: "not json" }).success).toBe(false);
    expect(guideChapterSchema.safeParse({ ...base, release: "now", makeTest: "1", questionsJson: "[]" }).success).toBe(false);
  });

  it("without a test, questions are ignored", () => {
    expect(guideChapterSchema.parse({ ...base, release: "now", makeTest: "", questionsJson: "garbage" }).questions).toEqual([]);
  });

  it("rejects an unknown release option and a silly time limit", () => {
    expect(guideChapterSchema.safeParse({ ...base, release: "tomorrow", makeTest: "" }).success).toBe(false);
    expect(guideChapterSchema.safeParse({ ...base, durationMinutes: "0", release: "now", makeTest: "" }).success).toBe(false);
  });
});
