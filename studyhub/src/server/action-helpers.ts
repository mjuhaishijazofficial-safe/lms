import "server-only";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";
import { errorKey } from "@/server/action-result";
import { moveSchema, statusChangeSchema } from "@/server/validation/admin";
import { idSchema } from "@/server/validation/common";

type Entity = "course" | "subject" | "chapter" | "student" | "material" | "semester" | "announcement";

/** Only same-site relative paths are allowed as a post-action return target. */
export function safeReturn(value: FormDataEntryValue | null, fallback: string): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/admin") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
}

const withParam = (path: string, key: string, value: string) => {
  const [base, query = ""] = path.split("?");
  const q = new URLSearchParams(query);
  q.delete("notice"); q.delete("error");
  q.set(key, value);
  return `${base}?${q}`;
};

/**
 * Runs an admin-only mutation and redirects back with a fixed notice or error key.
 * Errors never leak raw messages into the URL.
 */
export async function runAdminAction(entity: Entity, returnTo: string, notice: string, fn: (actor: SessionUser) => Promise<void>): Promise<never> {
  let key: string | null = null;
  try {
    await fn(await assertAdmin());
  } catch (err) {
    key = errorKey(err, entity);
  }
  revalidatePath("/admin", "layout");
  redirect(withParam(returnTo, key ? "error" : "notice", key ?? notice));
}

/** Shared handler for "Move up / Move down" buttons. */
export async function handleMove(entity: Entity, formData: FormData, mover: (actor: SessionUser, id: string, dir: "up" | "down") => Promise<void>, fallback: string) {
  const returnTo = safeReturn(formData.get("returnTo"), fallback);
  const parsed = moveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(withParam(returnTo, "error", "failed"));
  let key: string | null = null;
  try { await mover(await assertAdmin(), parsed.data.id, parsed.data.direction); } catch (err) { key = errorKey(err, entity); }
  revalidatePath("/admin", "layout");
  redirect(key ? withParam(returnTo, "error", key) : returnTo);
}

export async function handleStatus(entity: Entity, formData: FormData, setter: (actor: SessionUser, id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") => Promise<unknown>, fallback: string) {
  const returnTo = safeReturn(formData.get("returnTo"), fallback);
  const parsed = statusChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(withParam(returnTo, "error", "failed"));
  return runAdminAction(entity, returnTo, "status-updated", async (actor) => { await setter(actor, parsed.data.id, parsed.data.status); });
}

export async function handleDelete(entity: Entity, formData: FormData, deleter: (actor: SessionUser, id: string) => Promise<void>, fallback: string, notice: string) {
  const returnTo = safeReturn(formData.get("returnTo"), fallback);
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) redirect(withParam(returnTo, "error", "failed"));
  return runAdminAction(entity, returnTo, notice, (actor) => deleter(actor, id.data));
}
