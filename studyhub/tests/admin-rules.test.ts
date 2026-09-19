import { describe, expect, it } from "vitest";
import { moveInList } from "@/server/services/_shared";
import {
  changePasswordSchema, chapterSchema, createStudentSchema, generateSemestersSchema, loginHandleSchema, resetPasswordSchema, semesterNameSchema, subjectSchema,
} from "@/server/validation/admin";
import { safeReturn } from "@/server/action-helpers";
import { formValues } from "@/server/action-result";
import { timeAgo, plural, initials } from "@/lib/format";

const ID = "cmabcdefghijklmnopqrstuvw"; // shape of a cuid

describe("moveInList (reordering)", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("moves an item up and down", () => {
    expect(moveInList(items, "b", "up")?.map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(moveInList(items, "b", "down")?.map((x) => x.id)).toEqual(["a", "c", "b"]);
  });
  it("returns null at the edges and for unknown ids", () => {
    expect(moveInList(items, "a", "up")).toBeNull();
    expect(moveInList(items, "c", "down")).toBeNull();
    expect(moveInList(items, "zzz", "up")).toBeNull();
  });
  it("does not mutate the input", () => {
    moveInList(items, "b", "up");
    expect(items.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("login handle", () => {
  it.each(["ali@school.com", "ali.khan", "student_01", "  ALI@School.COM "])("accepts %s", (v) => {
    expect(loginHandleSchema.safeParse(v).success).toBe(true);
  });
  it.each(["ab", "has space", "bad!char", "@nope", ""])("rejects %j", (v) => {
    expect(loginHandleSchema.safeParse(v).success).toBe(false);
  });
  it("lower-cases", () => expect(loginHandleSchema.parse("ALI@X.COM")).toBe("ali@x.com"));
});

describe("student validation", () => {
  const base = { name: "Ali Khan", email: "ali@x.com", studentId: "", courseId: "", status: "ACTIVE", password: "longenough1" };
  it("treats blank optional fields as null", () => {
    const r = createStudentSchema.parse(base);
    expect(r.studentId).toBeNull();
    expect(r.courseId).toBeNull();
  });
  it("rejects short passwords, bad status and malformed program ids", () => {
    expect(createStudentSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(createStudentSchema.safeParse({ ...base, status: "ADMIN" }).success).toBe(false);
    expect(createStudentSchema.safeParse({ ...base, courseId: "not an id!" }).success).toBe(false);
    expect(createStudentSchema.safeParse({ ...base, courseId: ID }).success).toBe(true);
  });
  it("cannot smuggle a role or status field through", () => {
    const r = createStudentSchema.parse({ ...base, role: "ADMIN", mustChangePassword: false } as never);
    expect(r).not.toHaveProperty("role");
    expect(r).not.toHaveProperty("mustChangePassword");
  });
  it("reset requires matching passwords", () => {
    expect(resetPasswordSchema.safeParse({ id: ID, password: "longenough1", confirm: "different" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ id: ID, password: "longenough1", confirm: "longenough1" }).success).toBe(true);
  });
});

describe("semester fields", () => {
  const student = { name: "Ali Khan", email: "ali@x.com", studentId: "", courseId: ID, status: "ACTIVE", password: "longenough1" };
  const subject = { courseId: ID, name: "Data Structures", description: "", icon: "code", status: "PUBLISHED" };

  it("a missing semester is fine: a disabled select is not submitted by the browser", () => {
    expect(createStudentSchema.parse(student).semesterId).toBeNull();
    expect(subjectSchema.parse(subject).semesterId).toBeNull();
  });
  it("an empty semester means none", () => {
    expect(createStudentSchema.parse({ ...student, semesterId: "" }).semesterId).toBeNull();
    expect(subjectSchema.parse({ ...subject, semesterId: "  " }).semesterId).toBeNull();
  });
  it("a chosen semester must look like an id", () => {
    expect(createStudentSchema.parse({ ...student, semesterId: ID }).semesterId).toBe(ID);
    expect(subjectSchema.safeParse({ ...subject, semesterId: "not an id!" }).success).toBe(false);
    expect(createStudentSchema.safeParse({ ...student, semesterId: "<script>" }).success).toBe(false);
  });
  it("semester names and counts are bounded", () => {
    expect(semesterNameSchema.safeParse({ courseId: ID, name: "Semester 3" }).success).toBe(true);
    expect(semesterNameSchema.safeParse({ courseId: ID, name: "  " }).success).toBe(false);
    expect(semesterNameSchema.safeParse({ courseId: ID, name: "x".repeat(61) }).success).toBe(false);
    expect(generateSemestersSchema.parse({ courseId: ID, count: "8" }).count).toBe(8);
    for (const bad of ["0", "13", "-1", "2.5", "abc", ""]) expect(generateSemestersSchema.safeParse({ courseId: ID, count: bad }).success, bad).toBe(false);
  });
});

describe("password change validation", () => {
  it("rejects reusing the current password and mismatched confirmation", () => {
    expect(changePasswordSchema.safeParse({ current: "same-pass-1", password: "same-pass-1", confirm: "same-pass-1" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ current: "old-pass-1", password: "new-pass-12", confirm: "nope" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ current: "old-pass-1", password: "new-pass-12", confirm: "new-pass-12" }).success).toBe(true);
  });
});

describe("content validation", () => {
  it("subject: requires a known icon and a program", () => {
    const ok = { courseId: ID, name: "Maths", description: "", icon: "calculator", status: "PUBLISHED" };
    expect(subjectSchema.safeParse(ok).success).toBe(true);
    expect(subjectSchema.safeParse({ ...ok, icon: "<script>" }).success).toBe(false);
    expect(subjectSchema.safeParse({ ...ok, name: "   " }).success).toBe(false);
  });
  it("chapter: coerces the number and bounds it", () => {
    const ok = { subjectId: ID, title: "Real Numbers", chapterNumber: "4", description: "", status: "DRAFT" };
    expect(chapterSchema.parse(ok).chapterNumber).toBe(4);
    expect(chapterSchema.safeParse({ ...ok, chapterNumber: "-1" }).success).toBe(false);
    expect(chapterSchema.safeParse({ ...ok, chapterNumber: "1.5" }).success).toBe(false);
    expect(chapterSchema.safeParse({ ...ok, chapterNumber: "abc" }).success).toBe(false);
  });
});

describe("safeReturn (open-redirect guard)", () => {
  it("allows only /admin paths", () => {
    expect(safeReturn("/admin/students?page=2", "/x")).toBe("/admin/students?page=2");
    for (const bad of ["https://evil.com", "//evil.com", "/dashboard", "\\admin", "/admin\\..", null, ""]) {
      expect(safeReturn(bad, "/fallback")).toBe("/fallback");
    }
  });
});

describe("formValues", () => {
  it("never echoes password fields or internal action fields back", () => {
    const fd = new FormData();
    fd.set("name", "Ali"); fd.set("password", "secret"); fd.set("confirm", "secret"); fd.set("current", "x"); fd.set("$ACTION_ID_1", "y");
    expect(formValues(fd)).toEqual({ name: "Ali", confirm: "secret", current: "x" });
  });
});

describe("format helpers", () => {
  it("timeAgo", () => {
    const now = Date.UTC(2026, 0, 10, 12);
    expect(timeAgo(new Date(now - 10_000), now)).toBe("just now");
    expect(timeAgo(new Date(now - 3 * 3600_000), now)).toBe("3 hours ago");
    expect(timeAgo(new Date(now - 2 * 86_400_000), now)).toBe("2 days ago");
  });
  it("plural / initials", () => {
    expect(plural(1, "subject")).toBe("1 subject");
    expect(plural(0, "subject")).toBe("0 subjects");
    expect(initials("Ali Khan")).toBe("AK");
    expect(initials("madonna")).toBe("M");
  });
});
