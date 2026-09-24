import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AuthError } from "@/server/auth/guards";

/** Shape every form action returns to its client form. */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: string;
  /** Echo of submitted values so fields keep their input after a failed submit. */
  values?: Record<string, string>;
};

/** A user-facing error thrown by services (e.g. "Move or delete its chapters first"). */
export class ServiceError extends Error {
  constructor(message: string, readonly field?: string, readonly code?: "not-found" | "not-empty" | "last") {
    super(message);
    this.name = "ServiceError";
  }
}

export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && !k.startsWith("$") && !/password/i.test(k)) out[k] = v;
  return out;
}

export function fromZodError(err: z.ZodError, values?: Record<string, string>): FormState {
  const flat = z.flattenError(err);
  return { error: flat.formErrors[0] ?? "Please fix the highlighted fields.", fieldErrors: flat.fieldErrors, values };
}

/** Turn any thrown error into a safe message. Unknown errors are logged, never shown. */
export function toFormState(err: unknown, values?: Record<string, string>): FormState {
  if (err instanceof AuthError) return { error: err.message, values };
  if (err instanceof ServiceError) {
    return err.field ? { error: err.message, fieldErrors: { [err.field]: [err.message] }, values } : { error: err.message, values };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = String((err.meta?.target as string[] | string | undefined) ?? "");
    if (target.includes("email")) return { error: "That email or username is already in use.", fieldErrors: { email: ["Already in use."] }, values };
    if (target.includes("studentId")) return { error: "That student ID is already in use.", fieldErrors: { studentId: ["Already in use."] }, values };
    return { error: "That value is already in use.", values };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return { error: "This item no longer exists. It may have been deleted.", values };
  }
  console.error(err);
  return { error: "Something went wrong. Please try again.", values };
}

/** Map a thrown error to one of the fixed ?error= keys used after a redirect (see lib/notices). */
export function errorKey(err: unknown, entity: "course" | "subject" | "chapter" | "student" | "material" | "semester" | "announcement" | "test" | "fee"): string {
  if (err instanceof ServiceError && err.code === "last") return "semester-last";
  if (err instanceof AuthError) return "forbidden";
  if (err instanceof ServiceError && err.code === "not-empty") return `${entity}-not-empty`;
  if ((err instanceof ServiceError && err.code === "not-found") || (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) return "not-found";
  if (err instanceof ServiceError) return "failed";
  console.error(err);
  return "failed";
}
