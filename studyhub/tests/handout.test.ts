import { describe, expect, it } from "vitest";
import { chapterLabel, chunkText, splitHandout, stripPageFurniture, tidyTitle } from "@/lib/handout";

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

// A synthetic handout that has every quirk found in a real Virtual University handout: a cover and contents page that
// list every lesson, titles on the line after the heading (in capitals, sometimes wrapped), a "Topic No." line under
// each, a watermark and footer repeated on every page, and a heading whose letters were split by mixed fonts.
describe("splitHandout on a real-world layout", () => {
  const body = (topic: string, n = 14) => filler(topic, n).replace(/\. /g, ".\n\n");
  const furniture = (n: number) => `vubookshoppk.com\n\n${"__BODY__"}\n\nENG999 VU\nAll VU books are available in hard copy. Order now!\nWebsite: vubookshoppk.com | WhatsApp: 0326-0775533 ${n}`;
  const page = (n: number, content: string) => furniture(n).replace("__BODY__", content);

  const contents = `Table of Contents\nLesson No. Title Topic Page\nLesson 1 Definitions and Guiding Principles of\nBilingualism\n001-006 5-6\nLesson 2 Forms of Language and Change 007-011 7-8\nLesson 3 Collective Aspects of Language\nBehavior\n012-016 9-10\nLesson 4 Code Switching 017-021 11\nLesson 5 Marginalization 022-026 12`;
  const pages = [
    page(1, "Virtual University of Pakistan\nCOURSE HANDOUTS\nBilingualism\nENG999"),
    page(2, contents),
    page(3, `Lesson-01\n\nDEFINITIONS AND GUIDING PRINCIPLES OF BILINGUALISM\n\nTopic No. 001-006\n\nIntroduction; Definitions\n\n${body("alpha")}`),
    page(4, body("alpha continued")),
    page(5, `Lesson-02\nFORMS OF LANGUAGE AND CHANGE\nTopic No 007-011\nLanguage Change\n${body("beta")}`),
    page(6, `Le sson-03\n\nLINGUISTIC DIMENSIONS OF BILINGUALISM- EARLY LANGUAGE\nDEVELOPMENT\nTopic No. 012-016\n${body("gamma")}`),
    page(7, `Lesson-04\n21ST CENTURY NEEDS:SOCIAL JUSTICE AND SOCIAL PRACTICES\nTopic No. 017-021\n${body("delta")}`),
    page(8, `Lesson-05\nTranslanguaging-A Closer Look\n\nTopic No. 022-026\n${body("epsilon")}`),
  ];
  const chapters = splitHandout(pages);

  it("finds every lesson, not the contents page entries, and no 'introduction' made of the cover and contents", () => {
    expect(chapters.map((c) => c.number)).toEqual([1, 2, 3, 4, 5]);
    expect(chapters.some((c) => c.title === "Introduction")).toBe(false);
  });

  it("takes the title from the line after the heading, including wrapped and capitalised titles", () => {
    expect(chapters.map((c) => c.title)).toEqual([
      "Definitions and Guiding Principles of Bilingualism",
      "Forms of Language and Change",
      "Linguistic Dimensions of Bilingualism- Early Language Development",
      "21st Century Needs:Social Justice and Social Practices",
      "Translanguaging-A Closer Look", // already mixed case: left as the author wrote it
    ]);
  });

  it("recognises a heading whose letters were split by mixed fonts ('Le sson-03')", () => {
    expect(chapters[2].number).toBe(3);
  });

  it("removes the watermark and footer from every chapter, so they are never sent to the AI", () => {
    const all = chapters.map((c) => c.text).join("\n");
    for (const junk of ["vubookshoppk", "ENG999 VU", "All VU books", "WhatsApp"]) expect(all, junk).not.toContain(junk);
  });

  it("keeps the real content, and drops the heading, title and 'Topic No.' lines from it", () => {
    expect(chapters[0].text).toContain("alpha sentence 1");
    expect(chapters[0].text).toContain("alpha continued sentence 1"); // a chapter spanning two pages stays whole
    expect(chapters[0].text).not.toMatch(/Lesson-01|DEFINITIONS AND|Topic No/);
    expect(chapters[1].text).not.toContain("alpha");
  });

  it("keeps a real introduction when there is no contents page", () => {
    const withIntro = splitHandout([`${filler("preface", 20)}\nLesson 1\nFirst Title\n${filler("one")}\nLesson 2\nSecond Title\n${filler("two")}`]);
    expect(withIntro[0]).toMatchObject({ number: null, title: "Introduction" });
    expect(withIntro.map((c) => c.number)).toEqual([null, 1, 2]);
  });
});

describe("stripPageFurniture", () => {
  it("removes lines repeated across pages, ignoring the page number inside them", () => {
    const pages = ["Watermark\nreal one\nPage 1 of ads", "Watermark\nreal two\nPage 2 of ads", "Watermark\nreal three\nPage 3 of ads", "Watermark\nreal four\nPage 4 of ads"];
    expect(stripPageFurniture(pages).join("|")).toBe("real one|real two|real three|real four");
  });

  it("never removes chapter headings or 'Topic No.' lines, even though they repeat", () => {
    const pages = ["Lesson 1\nTopic No. 1\nx", "Lesson 2\nTopic No. 2\ny", "Lesson 3\nTopic No. 3\nz", "Lesson 4\nTopic No. 4\nw"];
    const out = stripPageFurniture(pages).join("\n");
    expect(out).toContain("Lesson 3");
    expect(out).toContain("Topic No. 3");
  });

  it("leaves a short handout alone: with two pages nothing counts as repeated", () => {
    expect(stripPageFurniture(["Same line\na", "Same line\nb"])).toEqual(["Same line\na", "Same line\nb"]);
  });
});

describe("tidyTitle", () => {
  it("title-cases a shouting title and keeps small words small", () => {
    expect(tidyTitle("DEFINITIONS AND GUIDING PRINCIPLES OF BILINGUALISM")).toBe("Definitions and Guiding Principles of Bilingualism");
    expect(tidyTitle("SELF-REGULATION")).toBe("Self-Regulation");
    expect(tidyTitle("21ST CENTURY NEEDS")).toBe("21st Century Needs");
  });
  it("leaves a mixed-case title exactly as written", () => {
    expect(tidyTitle("Teaching Academic L2 Writing II")).toBe("Teaching Academic L2 Writing II");
  });
});
