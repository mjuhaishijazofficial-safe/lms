import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { loginSchema } from "@/server/validation/auth";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(stored, "correct horse battery")).toBe(true);
    expect(await verifyPassword(stored, "wrong")).toBe(false);
  });

  it("returns false instead of throwing on a malformed hash", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
});

describe("login validation", () => {
  it("normalises email case and whitespace", () => {
    expect(loginSchema.parse({ email: "  Ali@School.COM ", password: "x" }).email).toBe("ali@school.com");
  });
  it("rejects empty fields", () => {
    expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(false);
  });
});
