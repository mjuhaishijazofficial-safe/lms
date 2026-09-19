import { idSchema, pageSchema } from "@/server/validation/common";

export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a query param, trimmed, or undefined when missing/blank. */
export function one(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 100) || undefined;
}

/** A query param that must be a valid id; anything else is treated as "not set". */
export function idParam(sp: SearchParams, key: string): string | undefined {
  const v = one(sp, key);
  return v && idSchema.safeParse(v).success ? v : undefined;
}

export const pageParam = (sp: SearchParams) => pageSchema.parse(one(sp, "page"));
