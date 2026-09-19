"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { burnPasswordCheck, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession } from "@/server/auth/session";
import { homeFor } from "@/server/auth/guards";
import { clearFailures, isLimited, recordFailure } from "@/server/auth/rate-limit";
import { loginSchema } from "@/server/validation/auth";

export type LoginState = { error?: string; email?: string };

const GENERIC_ERROR = "Incorrect email or password.";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  const { email, password } = parsed.data;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const keys = [`ip:${ip}`, `email:${email}`];
  if (keys.some(isLimited)) return { error: "Too many attempts. Please wait 15 minutes and try again.", email };

  const user = await db.user.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(user.passwordHash, password) : (await burnPasswordCheck(password), false);

  if (!user || !ok) {
    keys.forEach(recordFailure);
    return { error: GENERIC_ERROR, email };
  }
  if (user.status !== "ACTIVE") return { error: "Your account is inactive. Please contact your admin.", email };

  keys.forEach(clearFailures);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  redirect(user.mustChangePassword ? "/change-password" : homeFor(user));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
