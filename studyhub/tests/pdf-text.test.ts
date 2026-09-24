import { describe, expect, it } from "vitest";
import { pageTextFromItems, type TextItem } from "@/lib/pdf-text";

const item = (str: string, y: number, hasEOL = false): TextItem => ({ str, transform: [1, 0, 0, 1, 10, y], hasEOL });

describe("pageTextFromItems", () => {
  it("starts a new line when the vertical position jumps, and joins pieces on one line with a space", () => {
    expect(pageTextFromItems([item("Lesson-01", 700), item("DEFINITIONS AND", 650), item("GUIDING", 650), item("PRINCIPLES", 650)])).toBe("Lesson-01\nDEFINITIONS AND GUIDING PRINCIPLES");
  });

  it("does not double a space that is already there, and honours an explicit line end", () => {
    expect(pageTextFromItems([item("Hello ", 500), item("world", 500, true), item("Next", 480)])).toBe("Hello world\nNext");
  });

  it("ignores tiny vertical wobble on one line (subscripts, kerning)", () => {
    expect(pageTextFromItems([item("H", 500), item("2", 499), item("O", 500.5)])).toBe("H 2 O");
  });

  it("returns nothing for a page with no text", () => {
    expect(pageTextFromItems([])).toBe("");
  });
});
