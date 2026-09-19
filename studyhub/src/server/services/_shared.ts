import "server-only";
import { AuthError } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";

export const PAGE_SIZE = 20;

/** Defence in depth: services re-check the role even though actions already did. */
export function ensureAdmin(actor: SessionUser): void {
  if (actor.role !== "ADMIN") throw new AuthError();
}

/** Returns the sibling list with `id` moved one step, or null when it is already at the edge. */
export function moveInList<T extends { id: string }>(items: T[], id: string, direction: "up" | "down"): T[] | null {
  const i = items.findIndex((x) => x.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= items.length) return null;
  const next = [...items];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const nextOrder = (max: number | null | undefined) => (max ?? -1) + 1;
