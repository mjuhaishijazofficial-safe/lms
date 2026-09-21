import { describe, expect, it } from "vitest";
import { lessonTabs, type Lesson } from "@/lib/lesson";
import { parseLesson, sanitizeLessonBody } from "@/server/materials/lesson-sanitize";
import { lessonToHtml } from "@/server/materials/lesson-html";

const minimal = { topics: [{ title: "T", body: "<p>Body</p>" }], definitions: [], mcqs: [] };
const ok = (input: unknown) => {
  const r = parseLesson(input);
  if (!r.ok) throw new Error(r.error);
  return r.lesson;
};

describe("parseLesson", () => {
  it("accepts a lesson shaped like the real study guides", () => {
    const lesson = ok({
      subtitle: "Cause and effect, comparison and contrast",
      topics: [{ ref: "248", title: "Teaching Cause and Effect", body: "<p><strong>Causal Reasoning:</strong> tasks…</p><ul><li>Business</li></ul>" }],
      definitions: [{ term: "Exposition", definition: "Writing that explains.", example: "An essay on hormones." }],
      mcqs: [{ question: "What is analysis?", options: ["Splitting a whole into parts", "Reciting"], answer: 0, explanation: "It separates parts." }],
    });
    expect(lesson.topics[0].ref).toBe("248");
    expect(lesson.mcqs[0].answer).toBe(0);
  });

  it("rejects an answer index that is not one of the options", () => {
    const r = parseLesson({ ...minimal, mcqs: [{ question: "Q", options: ["a", "b"], answer: 2 }] });
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.error).toMatch(/answer must be one of/i);
  });

  it("rejects a question with fewer than two options, and an empty lesson", () => {
    expect(parseLesson({ ...minimal, mcqs: [{ question: "Q", options: ["only"], answer: 0 }] }).ok).toBe(false);
    expect(parseLesson({ topics: [], definitions: [], mcqs: [] }).ok).toBe(false);
    expect(parseLesson({}).ok).toBe(false);
  });

  it("rejects a topic that is only markup, with no readable content", () => {
    const r = parseLesson({ topics: [{ title: "Empty one", body: "<script>alert(1)</script>" }] });
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.error).toContain("Empty one");
  });

  it("stores the topic body already cleaned", () => {
    const lesson = ok({ topics: [{ title: "T", body: "<p onclick='x()'>Keep</p><script>bad()</script>" }] });
    expect(lesson.topics[0].body).toBe("<p>Keep</p>");
  });
});

describe("sanitizeLessonBody", () => {
  it("keeps the layout the lessons actually use", () => {
    const html = '<table class="data-table"><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>';
    expect(sanitizeLessonBody(html)).toBe(html);
    expect(sanitizeLessonBody('<div class="step-grid"><div class="step-box c1"><h4>X</h4></div></div>')).toContain('class="step-box c1"');
    expect(sanitizeLessonBody('<div class="example-box">Note</div>')).toContain('class="example-box"');
  });

  it("removes anything that could run, load or track", () => {
    for (const bad of [
      "<script>alert(1)</script>",
      "<iframe src='https://evil.test'></iframe>",
      "<img src=x onerror=alert(1)>",
      "<style>body{display:none}</style>",
      "<form><input name='pw'></form>",
      "<p style='position:fixed'>x</p>",
      "<p onmouseover='steal()'>x</p>",
    ]) {
      const out = sanitizeLessonBody(bad);
      expect(out, bad).not.toMatch(/<script|<iframe|onerror|onmouseover|<style|<form|<input|style=/i);
    }
  });

  it("drops class names that are not part of the template", () => {
    expect(sanitizeLessonBody('<div class="evil-overlay">x</div>')).not.toContain("evil-overlay");
  });

  it("forces links to open safely", () => {
    const out = sanitizeLessonBody('<a href="https://example.com">go</a>');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(sanitizeLessonBody(`<a href="javascript:alert(1)">x</a>`)).not.toContain("javascript:");
  });
});

describe("lessonToHtml", () => {
  const lesson: Lesson = {
    subtitle: "Sub",
    topics: [{ ref: "1", title: "Topic one", body: "<p>Hello</p>" }],
    definitions: [{ term: "Term", definition: "Meaning", example: "Example" }],
    mcqs: [{ question: "Which one?", options: ["Right", "Wrong"], answer: 0, explanation: "Because." }],
  };

  it("produces a standalone page with every section and no external resources", () => {
    const html = lessonToHtml(lesson, { title: "Chapter 1", subject: "CS301", chapter: "Ch 1" });
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("Topic one");
    expect(html).toContain("Term");
    expect(html).toContain("Which one?");
    expect(html).toContain("CS301 · Ch 1");
    expect(html).not.toMatch(/src=["']https?:|<link|@import/);
  });

  it("marks the right option as the answer", () => {
    const html = lessonToHtml(lesson, { title: "t" });
    expect(html).toContain('<div class="opt correct"><span class="opt-l">A</span><span>Right</span></div>');
    expect(html).toContain("Answer: A) Right");
  });

  it("escapes text so a title or option cannot inject markup into the downloaded file", () => {
    const nasty: Lesson = {
      topics: [{ title: "</title><script>alert(1)</script>", body: "<p>ok</p>" }],
      definitions: [{ term: "</div><script>a()</script>", definition: "d" }],
      mcqs: [{ question: "q", options: ["</span><script>b()</script>", "safe"], answer: 1 }],
    };
    const html = lessonToHtml(nasty, { title: "</title><script>alert(2)</script>" });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<script>alert(2)");
    expect(html).not.toContain("<script>a()");
    expect(html).not.toContain("<script>b()");
    expect(html).toContain("&lt;/title&gt;");
  });

  it("leaves out a tab bar and empty sections when a lesson has only one kind of content", () => {
    const html = lessonToHtml({ topics: lesson.topics, definitions: [], mcqs: [] }, { title: "t" });
    expect(html).not.toContain("tablist");
    expect(html).not.toContain('id="mcqs"');
  });
});

describe("lessonTabs", () => {
  it("lists only the sections that have content", () => {
    expect(lessonTabs({ topics: [], definitions: [{ term: "a", definition: "b" }], mcqs: [] }).map((t) => t[0])).toEqual(["definitions"]);
    expect(lessonTabs({ topics: [{ title: "a", body: "b" }], definitions: [], mcqs: [{ question: "q", options: ["a", "b"], answer: 0 }] }).map((t) => t[0]))
      .toEqual(["summary", "mcqs"]);
  });
});

describe("createMaterialSchema (LESSON)", () => {
  const base = { type: "LESSON", chapterId: "c".repeat(25), title: "Chapter 1", description: "", status: "PUBLISHED" };

  it("turns pasted JSON into a cleaned lesson", async () => {
    const { createMaterialSchema } = await import("@/server/validation/materials");
    const parsed = createMaterialSchema.parse({ ...base, lessonJson: JSON.stringify({ topics: [{ title: "T", body: "<p onclick='x()'>Hi</p>" }] }) });
    expect(parsed.type === "LESSON" && parsed.lessonJson.topics[0].body).toBe("<p>Hi</p>");
  });

  it("explains a paste that is not JSON, or not a lesson, in plain words", async () => {
    const { createMaterialSchema } = await import("@/server/validation/materials");
    const notJson = createMaterialSchema.safeParse({ ...base, lessonJson: "topics: nothing" });
    expect(!notJson.success && notJson.error.issues[0].message).toMatch(/not valid JSON/);
    const empty = createMaterialSchema.safeParse({ ...base, lessonJson: "{}" });
    expect(!empty.success && empty.error.issues[0].message).toMatch(/at least one/);
  });
});
