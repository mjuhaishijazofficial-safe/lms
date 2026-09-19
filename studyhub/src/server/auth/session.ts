import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { db } from "@/server/db";
import { SESSION_COOKIE } from "@/lib/constants";

const SESSION_DAYS = 30;
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000; // extend sliding expiry at most once a day

export type SessionUser = { id: string; name: string; email: string; role: Role; mustChangePassword: boolean };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Current signed-in user, or null. Inactive users and expired sessions count as signed out. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, status: true, mustChangePassword: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;

  if (Date.now() - session.lastSeenAt.getTime() > REFRESH_AFTER_MS) {
    await db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) },
    });
  }
  const { id, name, email, role, mustChangePassword } = session.user;
  return { id, name, email, role, mustChangePassword };
});

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

/** Sign a user out everywhere, e.g. after deactivation or a password reset. */
export async function destroyAllSessions(userId: string, exceptCurrent = false): Promise<void> {
  const token = exceptCurrent ? (await cookies()).get(SESSION_COOKIE)?.value : undefined;
  await db.session.deleteMany({ where: { userId, ...(token ? { NOT: { tokenHash: hashToken(token) } } : {}) } });
}
