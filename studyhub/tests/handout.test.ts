import { describe, expect, it } from "vitest";
import { chapterLabel, chunkText, splitHandout } from "@/lib/handout";

const filler = (topic: string, n = 12) =>
  Array.from({ length: n }, (_, i) => `${topic} sentence ${i + 1} explains a point about the subject in enough words to count.`).join(" ");

describe("splitHandout", () => {
  it("splits on 'Lesson N' headings and takes the title from the heading line", () => {
    const pages = [
      `Lesson 43\nTeaching Academic L2 Writing II\n${filler("cause")}`,
      `Lesson 44\nTeaching Reading & Writing in the Pakistani ELT Context\n${filler("stratification")}`,
      `Lesson 45\nIntegrating Receptive and Productive Skills\n${filler("skills")}`,
    ];
    const chapters = splitHandout(pages);
    expect(chapters.map((c) => c.number)).toEqual([43, 44, 45]);
    expect(chapters[0].text).toContain("cause sentence 1");
    expect(chapters[0].text).not.toContain("stratification");
  });

  it("does not start a new chapter for a running header repeated on every page", () => {
    const pages = [
      `Lesson 43\n${filler("alpha")}`,
      `Lesson 43\n${filler("beta")}`, // running header of page 2
      `Lesson 43\n${filler("gamma")}`,
      `Lesson 44\n${filler("delta")}`,
      `Lesson 44\n${filler("epsilon")}`,
    ];
    const chapters = splitHandout(pages);
    expect(chapters.map((c) => c.number)).toEqual([43, 44]);
    expect(chapters[0].text).toContain("alpha sentence 1");
    expect(chapters[0].text).toContain("gamma sentence 1");
    expect(chapters[0].text).not.toMatch(/^Lesson 43$/m); // the repeated headers are removed from the body
    expect(chapters[1].text).toContain("epsilon sentence 1");
  });

  it("recognises Lecture, Chapter and Unit headings with different punctuation", () => {
    for (const word of ["Lecture", "Chapter", "Unit", "LESSON"]) {
      const chapters = splitHandout([`${word} 1: Introduction\n${filler("one")}\n${word} - 2 - Methods\n${filler("two")}`]);
      expect(chapters.map((c) => c.number), word).toEqual([1, 2]);
    }
    expect(splitHandout([`Lesson 7 - The Sandwich Approach\n${filler("x")}`])[0].title).toBe("The Sandwich Approach");
  });

  it("ignores a cross-reference to an earlier lesson in the middle of a chapter", () => {
    const pages = [`Lesson 10\n${filler("ten")}\nLesson 3\nsee above\n${filler("more ten")}\nLesson 11\n${filler("eleven")}`];
    expect(splitHandout(pages).map((c) => c.number)).toEqual([10, 11]);
  });

  it("does not treat a sentence that begins with 'Lesson 5' as a heading", () => {
    const prose = "Lesson 5 covers the following topics and discusses how they are related to the earlier material";
    const chapters = splitHandout([`Lesson 4\n${filler("four")}\n${prose}\n${filler("still four")}`]);
    expect(chapters.map((c) => c.number)).toEqual([4]);
    expect(chapters[0].text).toContain(prose);
  });

  it("folds a stray heading with almost no text into the chapter before it", () => {
    const chapters = splitHandout([`Lesson 1\n${filler("one")}\nLesson 2\nSee next page.\nLesson 3\n${filler("three")}`]);
    expect(chapters.map((c) => c.number)).toEqual([1, 3]);
    expect(chapters[0].text).toContain("See next page.");
  });

  it("keeps a substantial introduction, and drops a tiny one", () => {
    const withIntro = splitHandout([`${filler("intro", 20)}\nLesson 1\n${filler("one")}`]);
    expect(withIntro[0]).toMatchObject({ number: null, title: "Introduction" });
    const tiny = splitHandout([`Virtual University\nLesson 1\n${filler("one")}`]);
    expect(tiny[0].number).toBe(1);
  });

  it("still returns usable parts when the handout has no headings at all", () => {
    const text = Array.from({ length: 60 }, (_, i) => filler(`para${i}`, 10)).join("\n\n");
    const chapters = splitHandout([text]);
    expect(chapters.length).toBeGreaterThan(1);
    expect(chapters.every((c) => c.number === null && c.title.startsWith("Part "))).toBe(true);
    expect(chapters.map((c) => c.text).join(" ")).toContain("para59 sentence 1");
  });

  it("returns nothing for an empty handout", () => {
    expect(splitHandout([])).toEqual([]);
    expect(splitHandout(["", "  \n "])).toEqual([]);
  });
});

describe("chunkText", () => {
  it("cuts at paragraph boundaries and never exceeds the limit", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Paragraph ${i}. ${"word ".repeat(40)}`).join("\n\n");
    const chunks = chunkText(text, 1500);
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1500);
    expect(chunks.join("\n\n")).toContain("Paragraph 29.");
    expect(chunks.every((c) => /^Paragraph \d+\./.test(c))).toBe(true); // every chunk starts at a paragraph start
  });

  it("cuts a single huge paragraph rather than returning it whole", () => {
    const chunks = chunkText("Sentence one is here. ".repeat(500), 1000);
    expect(chunks.length).toBeGreaterThan(5);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1000);
  });

  it("returns a short text as a single chunk and empty text as none", () => {
    expect(chunkText("short", 1000)).toEqual(["short"]);
    expect(chunkText("", 1000)).toEqual([]);
  });
});

describe("chapterLabel", () => {
  it("builds a lesson title", () => {
    expect(chapterLabel({ number: 43, title: "Teaching Academic L2 Writing II", text: "" })).toBe("Lesson 43: Teaching Academic L2 Writing II");
    expect(chapterLabel({ number: 5, title: "", text: "" })).toBe("Lesson 5");
    expect(chapterLabel({ number: null, title: "Part 2", text: "" })).toBe("Part 2");
  });
});
