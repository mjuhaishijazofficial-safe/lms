import "server-only";
import type { UserStatus } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import { hashPassword } from "@/server/auth/password";
import { AuthError } from "@/server/auth/guards";
import { destroyAllSessions, type SessionUser } from "@/server/auth/session";
import type { createAdminSchema } from "@/server/validation/admin";
import { ensureAdmin } from "./_shared";

/** The owner's account. Only they can delete admins. */
const SUPER_ADMIN_EMAIL = "mjuhaishijaz.official@gmail.com";
export const isSuperAdmin = (user: SessionUser) => user.role === "ADMIN" && user.email.toLowerCase() === SUPER_ADMIN_EMAIL;

export function listAdmins(actor: SessionUser) {
  ensureAdmin(actor);
  return db.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, name: true, email: true, status: true, createdAt: true, lastLoginAt: true, mustChangePassword: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createAdmin(actor: SessionUser, data: z.infer<typeof createAdminSchema>) {
  ensureAdmin(actor);
  if (await db.user.findUnique({ where: { email: data.email }, select: { id: true } })) {
    throw new ServiceError("Someone already uses this email or username.", "email");
  }
  return db.user.create({
    data: {
      name: data.name, email: data.email, role: "ADMIN", status: "ACTIVE",
      mustChangePassword: true, passwordHash: await hashPassword(data.password),
      adminProfile: { create: {} },
    },
    select: { id: true },
  });
}

export async function setAdminStatus(actor: SessionUser, id: string, status: UserStatus) {
  ensureAdmin(actor);
  if (id === actor.id && status === "INACTIVE") throw new ServiceError("You cannot deactivate your own account.");
  const { count } = await db.user.updateMany({ where: { id, role: "ADMIN" }, data: { status } });
  if (!count) throw new ServiceError("This admin no longer exists.", undefined, "not-found");
  if (status === "INACTIVE") await destroyAllSessions(id);
}

/** Permanently removes another admin (super admin only). Materials and tests they added stay, just without an uploader. */
export async function deleteAdmin(actor: SessionUser, id: string) {
  if (!isSuperAdmin(actor)) throw new AuthError();
  if (id === actor.id) throw new ServiceError("You cannot delete your own account.");
  const { count } = await db.user.deleteMany({ where: { id, role: "ADMIN" } });
  if (!count) throw new ServiceError("This admin no longer exists.", undefined, "not-found");
}

/** Sets a temporary password for another admin; they must replace it at next sign-in and are signed out everywhere. */
export async function resetAdminPassword(actor: SessionUser, id: string, password: string) {
  ensureAdmin(actor);
  if (id === actor.id) throw new ServiceError("Change your own password from your profile.");
  const { count } = await db.user.updateMany({
    where: { id, role: "ADMIN" },
    data: { passwordHash: await hashPassword(password), mustChangePassword: true },
  });
  if (!count) throw new ServiceError("This admin no longer exists.", undefined, "not-found");
  await destroyAllSessions(id);
}
