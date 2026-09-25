import { describe, expect, it } from "vitest";
import { effectiveStatus } from "@/lib/schedule";

const NOW = new Date("2026-06-15T12:00:00Z");
const past = new Date("2026-06-15T00:00:00Z");
const future = new Date("2026-06-20T00:00:00Z");

describe("effectiveStatus", () => {
  it("passes PUBLISHED and ARCHIVED straight through, ignoring any publishAt", () => {
    expect(effectiveStatus("PUBLISHED", future, NOW)).toBe("PUBLISHED");
    expect(effectiveStatus("PUBLISHED", null, NOW)).toBe("PUBLISHED");
    expect(effectiveStatus("ARCHIVED", past, NOW)).toBe("ARCHIVED");
  });

  it("a draft with no publishAt is just a draft", () => {
    expect(effectiveStatus("DRAFT", null, NOW)).toBe("DRAFT");
  });

  it("a draft scheduled for the future reads as SCHEDULED", () => {
    expect(effectiveStatus("DRAFT", future, NOW)).toBe("SCHEDULED");
  });

  it("a draft whose scheduled time has passed reads as PUBLISHED", () => {
    expect(effectiveStatus("DRAFT", past, NOW)).toBe("PUBLISHED");
  });

  it("treats the exact scheduled instant as already due", () => {
    expect(effectiveStatus("DRAFT", NOW, NOW)).toBe("PUBLISHED");
  });

  it("accepts an ISO string the same way as a Date", () => {
    expect(effectiveStatus("DRAFT", past.toISOString(), NOW)).toBe("PUBLISHED");
    expect(effectiveStatus("DRAFT", future.toISOString(), NOW)).toBe("SCHEDULED");
  });
});
