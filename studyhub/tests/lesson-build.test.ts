import { describe, expect, it } from "vitest";
import { readMcqs, shuffleQuestion } from "@/lib/lesson-build";

const q = { question: "Q?", options: ["a", "b", "c", "d"], answer: 0 };

describe("shuffleQuestion", () => {
  it("keeps the same options and the same correct answer text", () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const s = shuffleQuestion(q, () => r);
      expect([...s.options].sort()).toEqual(["a", "b", "c", "d"]);
      expect(s.options[s.answer]).toBe("a");
    }
  });

  it("is deterministic for a given rng and moves the answer around", () => {
    const seen = new Set<number>();
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 60; i++) seen.add(shuffleQuestion(q, rng).answer);
    expect(seen.size).toBe(4);
    expect(shuffleQuestion(q, () => 0.5)).toEqual(shuffleQuestion(q, () => 0.5));
  });

  it("readMcqs keeps the right answer after shuffling", () => {
    const { mcqs } = readMcqs({ mcqs: [{ question: "Q?", options: ["x", "y", "z", "w"], answer: 2, explanation: "e" }] }, () => 0.1);
    expect(mcqs[0].options[mcqs[0].answer]).toBe("z");
  });
});
