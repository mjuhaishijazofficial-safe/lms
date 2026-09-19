import "server-only";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { destroyAllSessions, type SessionUser } from "@/server/auth/session";

export async function changeOwnPassword(user: SessionUser, current: string, next: string) {
  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(row.passwordHash, current))) {
    throw new ServiceError("Your current password is incorrect.", "current");
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), mustChangePassword: false } });
  await destroyAllSessions(user.id, true); // sign out every other device, keep this one
}

export async function updateOwnName(user: SessionUser, name: string) {
  await db.user.update({ where: { id: user.id }, data: { name } });
}
