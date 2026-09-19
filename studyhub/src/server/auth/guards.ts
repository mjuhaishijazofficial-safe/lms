import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";

/** For pages: redirect to login when signed out, and to the password page while a change is required. */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/change-password");
  return user;
}

/** For admin pages: students are sent to their dashboard, never shown admin UI. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export async function requireStudent(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "STUDENT") redirect("/admin");
  return user;
}

export class AuthError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "AuthError";
  }
}

/** For server actions and route handlers: throw instead of redirecting. */
export async function assertUser(opts: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Your session has expired. Please sign in again.");
  if (user.mustChangePassword && !opts.allowPasswordChange) throw new AuthError("Please change your password first.");
  return user;
}

export async function assertAdmin(): Promise<SessionUser> {
  const user = await assertUser();
  if (user.role !== "ADMIN") throw new AuthError();
  return user;
}

export async function assertStudent(): Promise<SessionUser> {
  const user = await assertUser();
  if (user.role !== "STUDENT") throw new AuthError();
  return user;
}

export const homeFor = (user: Pick<SessionUser, "role">) => (user.role === "ADMIN" ? "/admin" : "/dashboard");
