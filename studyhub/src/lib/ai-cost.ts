// Rough cost figures for the handout screen. Estimates only: the real bill is on the OpenAI usage page.

export type Prices = { inputPerM: number | null; outputPerM: number | null };
export type TokenUsage = { inputTokens: number; outputTokens: number };

/** English text is about four characters to a token. Good enough for a rough estimate. */
export const estimateTokens = (chars: number) => Math.ceil(chars / 4);

/** What a lesson's answer typically costs to write out. A guess: the first real run replaces it with measured numbers. */
export const GUESSED_OUTPUT_TOKENS_PER_LESSON = 3_700;

/** Dollars for some usage, or null when the prices are not known. */
export function costOf(usage: TokenUsage, prices: Prices): number | null {
  if (prices.inputPerM === null || prices.outputPerM === null) return null;
  return (usage.inputTokens * prices.inputPerM + usage.outputTokens * prices.outputPerM) / 1_000_000;
}

/** A lesson is read twice (notes, then questions), and the answer is a guess until measured. */
export function estimateRun(chars: number[], prices: Prices): { usage: TokenUsage; dollars: number | null } {
  const usage = {
    inputTokens: chars.reduce((n, c) => n + estimateTokens(c) * 2, 0),
    outputTokens: chars.length * GUESSED_OUTPUT_TOKENS_PER_LESSON,
  };
  return { usage, dollars: costOf(usage, prices) };
}

export const formatDollars = (d: number) => (d < 0.01 ? "under $0.01" : `$${d.toFixed(2)}`);
export const formatTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : String(n));
