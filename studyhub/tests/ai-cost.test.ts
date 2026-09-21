import { describe, expect, it } from "vitest";
import { costOf, estimateRun, estimateTokens, formatDollars, formatTokens } from "@/lib/ai-cost";

describe("costOf", () => {
  it("prices input and output separately, per million tokens", () => {
    // 1M in at $0.75 + 1M out at $4.50
    expect(costOf({ inputTokens: 1_000_000, outputTokens: 1_000_000 }, { inputPerM: 0.75, outputPerM: 4.5 })).toBeCloseTo(5.25);
    expect(costOf({ inputTokens: 140_000, outputTokens: 185_000 }, { inputPerM: 0.75, outputPerM: 4.5 })).toBeCloseTo(0.9375);
  });
  it("says nothing when a price is not set, rather than guessing", () => {
    expect(costOf({ inputTokens: 1, outputTokens: 1 }, { inputPerM: null, outputPerM: 4.5 })).toBeNull();
    expect(costOf({ inputTokens: 1, outputTokens: 1 }, { inputPerM: 0.75, outputPerM: null })).toBeNull();
  });
});

describe("estimateRun", () => {
  it("reads each lesson twice and guesses the output per lesson", () => {
    const r = estimateRun([4_000, 8_000], { inputPerM: 1, outputPerM: 1 });
    expect(r.usage.inputTokens).toBe((1_000 + 2_000) * 2);
    expect(r.usage.outputTokens).toBe(2 * 3_700);
    expect(r.dollars).toBeCloseTo((6_000 + 7_400) / 1_000_000);
  });
  it("matches the back-of-envelope figure for the 50-lesson handout it was designed around", () => {
    const r = estimateRun(Array.from({ length: 50 }, () => 5_460), { inputPerM: 0.75, outputPerM: 4.5 });
    expect(r.dollars).toBeGreaterThan(0.7);
    expect(r.dollars).toBeLessThan(1.2);
  });
});

describe("formatting", () => {
  it("formats small and large amounts readably", () => {
    expect(formatDollars(0.004)).toBe("under $0.01");
    expect(formatDollars(0.9375)).toBe("$0.94");
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(1_500)).toBe("1.5k");
    expect(formatTokens(185_000)).toBe("185k");
    expect(estimateTokens(273_200)).toBe(68_300);
  });
});
