import "server-only";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import { PAGE_SIZE } from "./_shared";
import { getStudentScope, studentMaterialWhere, studentSubjectWhere } from "./access";
import { materialWithContextSelect, type MaterialWithContext } from "./library";

async function assertMaterialVisible(userId: string, materialId: string) {
  const scope = await getStudentScope(userId);
  const ok = await db.material.count({ where: { id: materialId, ...studentMaterialWhere(scope) } });
  if (!ok) throw new ServiceError("You don't have permission to access this material.", undefined, "not-found");
}
async function assertSubjectVisible(userId: string, subjectId: string) {
  const scope = await getStudentScope(userId);
  const ok = await db.subject.count({ where: { id: subjectId, ...studentSubjectWhere(scope) } });
  if (!ok) throw new ServiceError("You don't have permission to access this subject.", undefined, "not-found");
}

/** Toggles a material bookmark for the signed-in student and returns the new state. */
export async function toggleMaterialBookmark(actor: SessionUser, materialId: string): Promise<boolean> {
  await assertMaterialVisible(actor.id, materialId);
  const existing = await db.materialBookmark.findUnique({ where: { userId_materialId: { userId: actor.id, materialId } } });
  if (existing) {
    await db.materialBookmark.delete({ where: { id: existing.id } });
    return false;
  }
  await db.materialBookmark.create({ data: { userId: actor.id, materialId } });
  return true;
}

/** Toggles a subject bookmark for the signed-in student and returns the new state. */
export async function toggleSubjectBookmark(actor: SessionUser, subjectId: string): Promise<boolean> {
  await assertSubjectVisible(actor.id, subjectId);
  const existing = await db.subjectBookmark.findUnique({ where: { userId_subjectId: { userId: actor.id, subjectId } } });
  if (existing) {
    await db.subjectBookmark.delete({ where: { id: existing.id } });
    return false;
  }
  await db.subjectBookmark.create({ data: { userId: actor.id, subjectId } });
  return true;
}

export async function isMaterialBookmarked(userId: string, materialId: string): Promise<boolean> {
  return !!(await db.materialBookmark.findUnique({ where: { userId_materialId: { userId, materialId } }, select: { id: true } }));
}

export async function isSubjectBookmarked(userId: string, subjectId: string): Promise<boolean> {
  return !!(await db.subjectBookmark.findUnique({ where: { userId_subjectId: { userId, subjectId } }, select: { id: true } }));
}

/** Bookmarked subject ids the student can still see, most recently bookmarked first. */
export async function listBookmarkedSubjectIds(userId: string): Promise<string[]> {
  const scope = await getStudentScope(userId);
  const marks = await db.subjectBookmark.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { subjectId: true } });
  const ids = marks.map((m) => m.subjectId);
  if (ids.length === 0) return [];
  const visible = await db.subject.findMany({ where: { id: { in: ids }, ...studentSubjectWhere(scope) }, select: { id: true } });
  const visibleIds = new Set(visible.map((s) => s.id));
  return ids.filter((id) => visibleIds.has(id));
}

/** Bookmarked materials the student can still see, most recently bookmarked first, paginated. */
export async function listBookmarkedMaterials(userId: string, page: number, pageSize = PAGE_SIZE): Promise<{ rows: MaterialWithContext[]; total: number }> {
  const scope = await getStudentScope(userId);
  const marks = await db.materialBookmark.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { materialId: true } });
  const ids = marks.map((m) => m.materialId);
  if (ids.length === 0) return { rows: [], total: 0 };
  const visible = await db.material.findMany({ where: { id: { in: ids }, ...studentMaterialWhere(scope) }, select: materialWithContextSelect });
  const byId = new Map(visible.map((m) => [m.id, m]));
  const ordered = ids.map((id) => byId.get(id)).filter((m): m is MaterialWithContext => !!m);
  return { rows: ordered.slice((page - 1) * pageSize, page * pageSize), total: ordered.length };
}
