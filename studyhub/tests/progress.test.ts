import { describe, expect, it } from "vitest";
import { computeProgress, isChapterComplete } from "@/lib/progress";

const ch = (id: string, ...materialIds: string[]) => ({ id, materialIds });
const done = (...ids: string[]) => new Set(ids);

describe("chapter completion", () => {
  it("needs every material completed", () => {
    expect(isChapterComplete(ch("c1", "a", "b"), done("a", "b"))).toBe(true);
    expect(isChapterComplete(ch("c1", "a", "b"), done("a"))).toBe(false);
    expect(isChapterComplete(ch("c1", "a", "b"), done())).toBe(false);
  });
  it("an empty chapter can never be complete", () => {
    expect(isChapterComplete(ch("c1"), done("a"))).toBe(false);
  });
  it("ignores completed materials that belong to other chapters", () => {
    expect(isChapterComplete(ch("c1", "a"), done("x", "y"))).toBe(false);
  });
});

describe("computeProgress", () => {
  it("counts completed chapters out of chapters that have material", () => {
    const chapters = [ch("1", "a"), ch("2", "b", "c"), ch("3", "d"), ch("4", "e")];
    expect(computeProgress(chapters, done("a", "b", "c", "d"))).toEqual({ completedChapters: 3, totalChapters: 4, percent: 75 });
  });
  it("matches the reference example: 3 of 12 chapters is 25%", () => {
    const chapters = Array.from({ length: 12 }, (_, i) => ch(String(i), `m${i}`));
    const p = computeProgress(chapters, done("m0", "m1", "m2"));
    expect(p).toEqual({ completedChapters: 3, totalChapters: 12, percent: 25 });
  });
  it("leaves chapters without material out of the total", () => {
    const chapters = [ch("1", "a"), ch("2"), ch("3")];
    expect(computeProgress(chapters, done("a"))).toEqual({ completedChapters: 1, totalChapters: 1, percent: 100 });
  });
  it("is 0% (not NaN) when there is nothing to study", () => {
    expect(computeProgress([], done())).toEqual({ completedChapters: 0, totalChapters: 0, percent: 0 });
    expect(computeProgress([ch("1")], done())).toEqual({ completedChapters: 0, totalChapters: 0, percent: 0 });
  });
  it("partial work inside a chapter does not count", () => {
    expect(computeProgress([ch("1", "a", "b")], done("a")).percent).toBe(0);
  });
  it("rounds to a whole percent", () => {
    const chapters = [ch("1", "a"), ch("2", "b"), ch("3", "c")];
    expect(computeProgress(chapters, done("a")).percent).toBe(33);
    expect(computeProgress(chapters, done("a", "b")).percent).toBe(67);
  });
});
