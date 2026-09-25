import { describe, expect, it } from "vitest";
import { ALLOWED_EXTENSIONS, checkUpload, cleanFileName, extensionOf } from "@/server/materials/upload";
import { noteText, sanitizeNoteHtml } from "@/server/materials/sanitize";
import { formatDuration, parseDuration, parseYouTubeId, safeExternalUrl } from "@/lib/media";
import { STORAGE_KEY_PATTERN } from "@/server/storage/types";

const MB = 1_048_576;
const bytes = (...b: number[]) => Uint8Array.from(b);
const pdf = (extra = "") => new TextEncoder().encode(`%PDF-1.4\n${extra}`);
const zipWith = (...names: string[]) => Uint8Array.from(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(names.join("\0"))]));
const ole = () => Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);

describe("checkUpload: spreadsheets, text and images", () => {
  const png = () => bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
  const jpg = () => bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46);
  const text = (t: string) => new TextEncoder().encode(t);

  it("accepts real files of each new type", () => {
    expect(checkUpload({ name: "marks.xlsx", data: zipWith("[Content_Types].xml", "xl/workbook.xml") }, 50 * MB)).toMatchObject({ ok: true, ext: "xlsx" });
    expect(checkUpload({ name: "old.xls", data: ole() }, 50 * MB)).toMatchObject({ ok: true, ext: "xls" });
    expect(checkUpload({ name: "readme.txt", data: text("Chapter 1 notes\nاردو") }, 50 * MB)).toMatchObject({ ok: true, ext: "txt", mime: "text/plain" });
    expect(checkUpload({ name: "scan.png", data: png() }, 50 * MB)).toMatchObject({ ok: true, ext: "png", mime: "image/png" });
    expect(checkUpload({ name: "photo.JPG", data: jpg() }, 50 * MB)).toMatchObject({ ok: true, ext: "jpg", mime: "image/jpeg" });
    expect(checkUpload({ name: "photo.jpeg", data: jpg() }, 50 * MB)).toMatchObject({ ok: true, ext: "jpeg" });
  });

  it("rejects a file whose contents do not match its extension", () => {
    expect(checkUpload({ name: "a.png", data: jpg() }, 50 * MB).ok).toBe(false);
    expect(checkUpload({ name: "a.jpg", data: png() }, 50 * MB).ok).toBe(false);
    expect(checkUpload({ name: "a.png", data: text("not an image") }, 50 * MB).ok).toBe(false);
    expect(checkUpload({ name: "a.xlsx", data: zipWith("[Content_Types].xml", "word/document.xml") }, 50 * MB).ok).toBe(false); // a docx wearing an .xlsx name
  });

  it("rejects a binary file renamed to .txt, and executables renamed to any new type", () => {
    expect(checkUpload({ name: "a.txt", data: bytes(0x41, 0x42, 0x00, 0x43) }, 50 * MB).ok).toBe(false);
    const exe = bytes(0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0);
    for (const name of ["a.txt", "a.png", "a.jpg", "a.xlsx", "a.xls"]) expect(checkUpload({ name, data: exe }, 50 * MB).ok, name).toBe(false);
  });

  it("accepts an HTML study guide only when it really is an HTML page", () => {
    const page = text("<!DOCTYPE html>\n<html lang=\"en\"><head><title>PSY101</title></head><body><script>const mcqs=[]</script></body></html>");
    expect(checkUpload({ name: "PSY101_Lesson 1.html", data: page }, 50 * MB)).toMatchObject({ ok: true, ext: "html", mime: "text/html" });
    expect(checkUpload({ name: "guide.HTM", data: page }, 50 * MB)).toMatchObject({ ok: true, ext: "htm", mime: "text/html" });
    // A byte-order mark or a leading comment is fine; plain text, a PDF or an executable named .html is not.
    expect(checkUpload({ name: "a.html", data: text("﻿<!-- saved from NotebookLM -->\n<html><body>x</body></html>") }, 50 * MB).ok).toBe(true);
    expect(checkUpload({ name: "a.html", data: text("just some notes") }, 50 * MB).ok).toBe(false);
    expect(checkUpload({ name: "a.html", data: pdf() }, 50 * MB).ok).toBe(false);
    expect(checkUpload({ name: "a.html", data: bytes(0x4d, 0x5a, 0x90, 0) }, 50 * MB).ok).toBe(false);
    expect(checkUpload({ name: "a.html", data: bytes(0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e, 0x00) }, 50 * MB).ok).toBe(false); // "<html>" then a zero byte
  });

  it("names the rejected type in the error so the admin can see what went wrong", () => {
    const r = checkUpload({ name: "song.mp3", data: pdf() }, 50 * MB);
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.error).toContain(".mp3");
  });
});

describe("checkUpload", () => {
  it("accepts real files of each allowed type", () => {
    expect(checkUpload({ name: "notes.pdf", data: pdf() }, 50 * MB)).toMatchObject({ ok: true, ext: "pdf", mime: "application/pdf" });
    expect(checkUpload({ name: "a.docx", data: zipWith("[Content_Types].xml", "word/document.xml") }, 50 * MB)).toMatchObject({ ok: true, ext: "docx" });
    expect(checkUpload({ name: "a.pptx", data: zipWith("[Content_Types].xml", "ppt/slides/slide1.xml") }, 50 * MB)).toMatchObject({ ok: true, ext: "pptx" });
    expect(checkUpload({ name: "old.doc", data: ole() }, 50 * MB)).toMatchObject({ ok: true, ext: "doc" });
    expect(checkUpload({ name: "old.PPT", data: ole() }, 50 * MB)).toMatchObject({ ok: true, ext: "ppt" });
  });

  it("rejects files whose extension is not allowed", () => {
    for (const name of ["virus.exe", "run.bat", "x.js", "x.html", "x.svg", "x.php", "x.sh", "x.zip", "x.rar", "x.gif", "x.webp", "x.docm", "x.xlsm", "noextension", "x.pdf.exe", ".pdf"]) {
      const r = checkUpload({ name, data: pdf() }, 50 * MB);
      expect(r.ok, name).toBe(false);
    }
  });

  it("rejects executables renamed to an allowed extension", () => {
    const exe = bytes(0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0);
    const elf = bytes(0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0);
    const script = new TextEncoder().encode("#!/bin/sh\nrm -rf /\n");
    for (const [name, data] of [["a.pdf", exe], ["a.docx", exe], ["a.pdf", elf], ["a.pdf", script], ["a.pptx", script]] as const) {
      const r = checkUpload({ name, data }, 50 * MB);
      expect(r.ok, `${name}`).toBe(false);
    }
  });

  it("rejects content that does not match the extension", () => {
    expect(checkUpload({ name: "a.pdf", data: ole() }, 50 * MB).ok).toBe(false);
    expect(checkUpload({ name: "a.pdf", data: new TextEncoder().encode("<html><script>alert(1)</script>") }, 50 * MB).ok).toBe(false);
    expect(checkUpload({ name: "a.docx", data: pdf() }, 50 * MB).ok).toBe(false);
    expect(checkUpload({ name: "a.docx", data: zipWith("[Content_Types].xml", "ppt/slides/s.xml") }, 50 * MB).ok).toBe(false); // a pptx wearing a .docx name
    expect(checkUpload({ name: "a.docx", data: zipWith("evil.class") }, 50 * MB).ok).toBe(false); // arbitrary zip
    expect(checkUpload({ name: "a.doc", data: pdf() }, 50 * MB).ok).toBe(false);
  });

  it("enforces size and rejects empty files", () => {
    expect(checkUpload({ name: "a.pdf", data: new Uint8Array(0) }, 50 * MB)).toMatchObject({ ok: false, error: "This file is empty." });
    const big = checkUpload({ name: "a.pdf", data: pdf("x".repeat(3 * MB)) }, 2 * MB);
    expect(big).toMatchObject({ ok: false });
    expect((big as { error: string }).error).toContain("2 MB");
    expect(checkUpload({ name: "a.pdf", data: pdf("x".repeat(1 * MB)) }, 2 * MB).ok).toBe(true);
  });
});

describe("file names", () => {
  it("extensionOf", () => {
    expect(extensionOf("Report.FINAL.PDF")).toBe("pdf");
    expect(extensionOf("C:\\fakepath\\a.docx")).toBe("docx");
    expect(extensionOf("noext")).toBe("");
    expect(extensionOf(".hidden")).toBe("");
  });
  it("cleanFileName strips paths, control and reserved characters", () => {
    expect(cleanFileName("C:\\Users\\me\\Chapter 1: Notes?.pdf", "pdf")).toBe("Chapter 1 Notes.pdf");
    expect(cleanFileName("../../etc/passwd.pdf", "pdf")).toBe("passwd.pdf");
    expect(cleanFileName('a"b<c>d|e.pdf', "pdf")).toBe("abcde.pdf");
    expect(cleanFileName("\u0000\u001f.pdf", "pdf")).toBe("file.pdf");
    expect(cleanFileName(`${"x".repeat(300)}.pdf`, "pdf").length).toBeLessThanOrEqual(104);
  });
});

describe("storage keys", () => {
  it("only accept generated-looking keys, so paths cannot be smuggled in", () => {
    expect(STORAGE_KEY_PATTERN.test(`${"a1".repeat(24)}.pdf`)).toBe(true);
    // Every uploadable type must also be storable (an HTML guide once passed the upload check but failed to store).
    for (const ext of ALLOWED_EXTENSIONS) expect(STORAGE_KEY_PATTERN.test(`${"a1".repeat(24)}.${ext}`), ext).toBe(true);
    for (const bad of ["../secret.pdf", "a/b.pdf", "abc.pdf", `${"a1".repeat(24)}.exe`, `${"a1".repeat(24)}.pdf/../x`, "", `${"A1".repeat(24)}.pdf`, `..${"a".repeat(46)}.pdf`]) {
      expect(STORAGE_KEY_PATTERN.test(bad), bad).toBe(false);
    }
  });
});

describe("sanitizeNoteHtml (XSS)", () => {
  const attacks = [
    "<script>alert(1)</script><p>hi</p>",
    '<img src=x onerror="alert(1)">',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    '<iframe src="https://evil.com"></iframe>',
    '<svg onload="alert(1)"><circle/></svg>',
    '<p onclick="alert(1)" style="background:url(javascript:alert(1))">x</p>',
    '<form action="https://evil.com"><input name="password"></form>',
    "<style>body{display:none}</style>",
    '<object data="x.swf"></object>',
    '<a href="//evil.com">x</a>',
    "<math><mtext><script>alert(1)</script></mtext></math>",
  ];
  it.each(attacks)("neutralises %s", (attack) => {
    const out = sanitizeNoteHtml(attack).toLowerCase();
    for (const bad of ["<script", "onerror", "onload", "onclick", "javascript:", "<iframe", "<svg", "<form", "<style", "<object", "<img", "data:text", 'href="//']) {
      expect(out, `${attack} -> ${out}`).not.toContain(bad);
    }
  });
  it("keeps normal formatting and forces safe link attributes", () => {
    const out = sanitizeNoteHtml('<h2>Title</h2><p><strong>Bold</strong> <em>it</em> <a href="https://example.com/x" onclick="x()">link</a></p><ul><li>a</li></ul>');
    expect(out).toContain("<h2>Title</h2>");
    expect(out).toContain("<strong>Bold</strong>");
    expect(out).toContain("<ul><li>a</li></ul>");
    expect(out).toContain('href="https://example.com/x"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
    expect(out).not.toContain("onclick");
  });
  it("noteText ignores formatting and whitespace-only notes", () => {
    expect(noteText("<p> </p><p>&nbsp;</p>")).toBe("");
    expect(noteText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });
});

describe("parseYouTubeId", () => {
  const id = "dQw4w9WgXcQ";
  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s&list=PL123`,
    `http://m.youtube.com/watch?feature=share&v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `  https://music.youtube.com/watch?v=${id}  `,
  ])("accepts %s", (url) => expect(parseYouTubeId(url)).toBe(id));

  it.each([
    "", "not a url", "https://vimeo.com/123456789", "https://evil.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ<script>", "javascript:alert(1)", "https://user:pw@www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/", "ftp://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/channel/UC1234567890",
  ])("rejects %j", (url) => expect(parseYouTubeId(url)).toBeNull());
});

describe("safeExternalUrl", () => {
  it("accepts ordinary web links", () => {
    expect(safeExternalUrl("https://khanacademy.org/math")).toBe("https://khanacademy.org/math");
    expect(safeExternalUrl(" http://example.com/a?b=1 ")).toBe("http://example.com/a?b=1");
  });
  it.each(["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,hi", "file:///etc/passwd", "ftp://x.com/a", "//evil.com", "https://user:pw@example.com", "https://localhost", "not a url", "", `https://example.com/${"a".repeat(2100)}`, "vbscript:x"])("rejects %j", (u) =>
    expect(safeExternalUrl(u)).toBeNull());
});

describe("durations", () => {
  it("parses mm:ss, h:mm:ss and bare minutes", () => {
    expect(parseDuration("24:15")).toBe(1455);
    expect(parseDuration("1:02:03")).toBe(3723);
    expect(parseDuration("0:45")).toBe(45);
    expect(parseDuration("90")).toBe(5400);
    expect(parseDuration(" 5:00 ")).toBe(300);
  });
  it.each(["", "abc", "12:75", "1:2:3", "-5", "99999", "0:00", "25:00:00", "1.5"])("rejects %j", (v) => expect(parseDuration(v)).toBeNull());
  it("formats", () => {
    expect(formatDuration(1455)).toBe("24:15");
    expect(formatDuration(3723)).toBe("1:02:03");
    expect(formatDuration(45)).toBe("0:45");
    expect(parseDuration(formatDuration(3723))).toBe(3723);
  });
});
