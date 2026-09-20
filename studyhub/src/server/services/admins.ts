import "server-only";
import type { UserStatus } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import { hashPassword } from "@/server/auth/password";
import { destroyAllSessions, type SessionUser } from "@/server/auth/session";
import type { createAdminSchema } from "@/server/validation/admin";
import { ensureAdmin } from "./_shared";

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
