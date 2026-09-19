import "server-only";

// In-memory limiter: fine for a single server process. Swap for Redis/Postgres when running several instances.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const failures = new Map<string, number[]>();

function recent(key: string): number[] {
  const now = Date.now();
  const list = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list;
}

export const isLimited = (key: string) => recent(key).length >= MAX_FAILURES;
export const recordFailure = (key: string) => failures.set(key, [...recent(key), Date.now()]);
export const clearFailures = (key: string) => failures.delete(key);
