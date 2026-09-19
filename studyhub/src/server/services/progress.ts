import "server-only";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import { getStudentScope, studentMaterialWhere } from "./access";

/**
 * Records that a student opened a material. Safe to call on every view of the material page: the first call
 * creates the row, later calls are a no-op update. Silently does nothing for a material the student can no
 * longer see, since there is nothing meaningful to record.
 */
export async function recordOpened(userId: string, materialId: string): Promise<void> {
  const scope = await getStudentScope(userId);
  const visible = await db.material.count({ where: { id: materialId, ...studentMaterialWhere(scope) } });
  if (!visible) return;
  await db.materialProgress.upsert({ where: { userId_materialId: { userId, materialId } }, create: { userId, materialId }, update: {} });
}

/** Whether this student has opened / completed a material, for the "Mark as complete" button on its page. */
export async function getMaterialProgress(userId: string, materialId: string): Promise<{ opened: boolean; completed: boolean }> {
  const row = await db.materialProgress.findUnique({ where: { userId_materialId: { userId, materialId } }, select: { completedAt: true } });
  return { opened: !!row, completed: !!row?.completedAt };
}

/**
 * Toggles whether a student has finished a material, and returns the new state. A chapter counts as complete
 * once every one of its published materials is completed (see lib/progress); there is no separate per-chapter flag.
 */
export async function toggleCompleted(actor: SessionUser, materialId: string): Promise<boolean> {
  const scope = await getStudentScope(actor.id);
  const visible = await db.material.count({ where: { id: materialId, ...studentMaterialWhere(scope) } });
  if (!visible) throw new ServiceError("You don't have permission to access this material.", undefined, "not-found");

  const existing = await db.materialProgress.findUnique({ where: { userId_materialId: { userId: actor.id, materialId } } });
  const done = !existing?.completedAt;
  await db.materialProgress.upsert({
    where: { userId_materialId: { userId: actor.id, materialId } },
    create: { userId: actor.id, materialId, completedAt: done ? new Date() : null },
    update: { completedAt: done ? new Date() : null },
  });
  return done;
}
