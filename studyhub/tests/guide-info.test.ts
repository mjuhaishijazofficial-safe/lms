import { describe, expect, it } from "vitest";
import { guideInfo, naturalCompare } from "@/lib/guide-info";

describe("guideInfo", () => {
  it("takes the main heading and the line right under it (PSY101 guide layout)", () => {
    const src = `<title>VU Study Sphere — Lesson 1: What is Psychology?</title><div class="hero"><span class="badge">PSY101</span>
      <h1>What is Psychology?</h1>
      <p class="sub">Psychology's definition &amp; nature, the six primary goals.</p><div class="hero-stats"></div></div>`;
    expect(guideInfo(src, "PSY101_Lesson 1.html")).toEqual({ title: "What is Psychology?", description: "Psychology's definition & nature, the six primary goals." });
  });

  it("falls back to the <title>, then the file name", () => {
    expect(guideInfo("<title>ECO401 — Lecture 2 Study Guide</title><body></body>", "x.html").title).toBe("ECO401 — Lecture 2 Study Guide");
    expect(guideInfo("<body>no headings</body>", "MGT201_lecture_3.html").title).toBe("MGT201 lecture 3");
  });

  it("ignores a paragraph that isn't directly under the heading", () => {
    expect(guideInfo("<h1>Topic</h1><div>stats</div><p>Unrelated footer</p>", "a.html").description).toBe("");
  });

  it("keeps titles and descriptions within the chapter's limits", () => {
    const long = "x".repeat(300);
    const r = guideInfo(`<h1>${long}</h1><p>${long.repeat(3)}</p>`, "a.html");
    expect(r.title.length).toBe(120);
    expect(r.description.length).toBe(500);
  });
});

describe("naturalCompare", () => {
  it("orders numbered lessons the way a person would", () => {
    expect(["Lesson 10.html", "Lesson 2.html", "lesson 1.html"].sort(naturalCompare)).toEqual(["lesson 1.html", "Lesson 2.html", "Lesson 10.html"]);
  });
});
