import type { ContentStatus } from "@prisma/client";

/**
 * A DRAFT chapter or material can carry a `publishAt` time: once that time passes it behaves exactly like
 * PUBLISHED — for students (see visibility.ts, which checks the same condition at query time, so nothing has to
 * run in the background for this to take effect) and for the admin screens that show status. SCHEDULED exists
 * only here, as a label for "still DRAFT, but its time hasn't come yet" — it is never a stored value.
 */
export type EffectiveStatus = ContentStatus | "SCHEDULED";

export function effectiveStatus(status: ContentStatus, publishAt: Date | string | null | undefined, now: Date = new Date()): EffectiveStatus {
  if (status !== "DRAFT" || !publishAt) return status;
  return new Date(publishAt) <= now ? "PUBLISHED" : "SCHEDULED";
}
