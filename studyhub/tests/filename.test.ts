import { describe, expect, it } from "vitest";
import { titleFromFileName } from "@/lib/filename";

describe("titleFromFileName", () => {
  it("drops the extension and capitalises the first letter", () => {
    expect(titleFromFileName("lesson notes.pdf")).toBe("Lesson notes");
  });

  it("turns underscores and dashes into spaces", () => {
    expect(titleFromFileName("Chapter_04-Handout.docx")).toBe("Chapter 04 Handout");
  });

  it("collapses repeated separators and trims the result", () => {
    expect(titleFromFileName("__weird--name__.pptx")).toBe("Weird name");
  });

  it("only removes the last extension, leaving earlier dots alone", () => {
    expect(titleFromFileName("report.v2.final.pdf")).toBe("Report.v2.final");
  });

  it("falls back to a placeholder for a name that is nothing but an extension", () => {
    expect(titleFromFileName(".pdf")).toBe("Untitled");
  });
});
