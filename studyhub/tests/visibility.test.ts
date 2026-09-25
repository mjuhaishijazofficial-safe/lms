import { describe, expect, it } from "vitest";
import { publishedWhere, studentChapterWhere, studentCourseWhere, studentMaterialWhere, studentSubjectWhere, studentTestWhere, type StudentScope } from "@/server/services/visibility";

const sem = (order: number) => ({ id: `sem${order}`, name: `Semester ${order}`, order });
const scope = (...e: { courseId: string; semester: ReturnType<typeof sem> | null }[]): StudentScope => ({ userId: "u1", enrollments: e });
const json = (x: unknown) => JSON.stringify(x);

describe("subject visibility (semesters)", () => {
  it("shows subjects with no semester, and semesters up to the current one — never later ones", () => {
    const where = studentSubjectWhere(scope({ courseId: "cs", semester: sem(3) }));
    expect(where.status).toBe("PUBLISHED");
    expect(where.OR).toEqual([
      { courseId: "cs", OR: [{ semesterId: null }, { semester: { courseId: "cs", order: { lte: 3 } } }] },
    ]);
  });

  it("a student with no current semester only sees subjects that apply to the whole program", () => {
    const where = studentSubjectWhere(scope({ courseId: "cs", semester: null }));
    expect(where.OR).toEqual([{ courseId: "cs", OR: [{ semesterId: null }] }]);
  });

  it("is restricted to the student's own program", () => {
    const w = json(studentSubjectWhere(scope({ courseId: "cs", semester: sem(2) })));
    expect(w).toContain('"courseId":"cs"');
    expect(w).not.toContain("bba");
  });

  it("requires the subject to be published", () => {
    expect(studentSubjectWhere(scope({ courseId: "cs", semester: sem(1) })).status).toBe("PUBLISHED");
  });
});

describe("fails closed with no enrolment", () => {
  const nobody = scope();
  it("matches nothing for courses, subjects and materials", () => {
    expect(studentCourseWhere(nobody)).toEqual({ id: { in: [] } });
    expect(studentSubjectWhere(nobody)).toEqual({ id: { in: [] } });
    expect(json(studentMaterialWhere(nobody))).toContain('"subject":{"id":{"in":[]}}');
  });
  it("cannot be widened by spreading it next to an id lookup", () => {
    // The pattern used for direct lookups: { id, ...where }. The empty-set condition must still win.
    const where = { id: "some-subject", ...studentSubjectWhere(nobody) };
    expect(where.id).toEqual({ in: [] });
  });
});

describe("material visibility chain", () => {
  const where = studentMaterialWhere(scope({ courseId: "cs", semester: sem(3) }));
  it("needs the material, its chapter, its subject and its program to be published (or the material/chapter's schedule to have come due)", () => {
    expect(where.OR).toEqual([{ status: "PUBLISHED" }, { status: "DRAFT", publishAt: { lte: expect.any(Date) } }]);
    const chapter = where.chapter as { OR: unknown; subject: { status: string } };
    expect(chapter.OR).toEqual([{ status: "PUBLISHED" }, { status: "DRAFT", publishAt: { lte: expect.any(Date) } }]);
    expect(chapter.subject.status).toBe("PUBLISHED");
  });
  it("carries the semester rule down to the material", () => {
    expect(json(where)).toContain('"order":{"lte":3}');
  });
  it("course visibility lists only enrolled, published programs", () => {
    expect(studentCourseWhere(scope({ courseId: "cs", semester: sem(3) }))).toEqual({ status: "PUBLISHED", id: { in: ["cs"] } });
  });
});

describe("subject visibility (subjects picked per student)", () => {
  const picked = (ids: string[], semester = sem(3)): StudentScope => ({
    userId: "u1", enrollments: [{ courseId: "cs", semester }], subjectIds: ids,
  });

  it("shows exactly the picked subjects and ignores the semester rule", () => {
    const where = studentSubjectWhere(picked(["s1", "s2"]));
    expect(where).toEqual({ status: "PUBLISHED", id: { in: ["s1", "s2"] }, course: { status: "PUBLISHED" } });
    expect(where.OR).toBeUndefined();
  });

  it("still requires the subject and its program to be published", () => {
    const where = studentSubjectWhere(picked(["s1"]));
    expect(where.status).toBe("PUBLISHED");
    expect(where.course).toEqual({ status: "PUBLISHED" });
  });

  it("lets a picked subject come from another program than the one the student is enrolled in", () => {
    // A BBIT student taking ECO401, which lives under BBA, must still see it.
    expect(json(studentSubjectWhere(picked(["eco401"])))).toContain('"eco401"');
  });

  it("falls back to the semester rule when nothing is picked", () => {
    expect(studentSubjectWhere(picked([]))).toEqual(studentSubjectWhere(scope({ courseId: "cs", semester: sem(3) })));
  });

  it("shows the programs of picked subjects alongside the enrolled one", () => {
    expect(studentCourseWhere(picked(["s1"]))).toEqual({
      status: "PUBLISHED",
      OR: [{ id: { in: ["cs"] } }, { subjects: { some: { id: { in: ["s1"] } } } }],
    });
  });

  it("fails closed for a student with no enrolment, even when subjects are picked", () => {
    const where = studentSubjectWhere({ userId: "u1", enrollments: [], subjectIds: ["s1"] });
    expect(where).toEqual({ id: { in: [] } });
  });

  it("restricts materials through the picked subjects", () => {
    expect(json(studentMaterialWhere(picked(["s1"])))).toContain('"s1"');
  });
});

describe("publishedWhere (scheduled publish)", () => {
  const NOW = new Date("2026-06-15T12:00:00Z");

  it("always matches a truly published row, whatever publishAt says", () => {
    expect(publishedWhere(NOW)).toEqual({ OR: [{ status: "PUBLISHED" }, { status: "DRAFT", publishAt: { lte: NOW } }] });
  });

  it("a draft's chapter visibility now includes 'draft but its time has come'", () => {
    const where = studentChapterWhere(scope({ courseId: "cs", semester: sem(1) }), NOW);
    expect(where.OR).toEqual([{ status: "PUBLISHED" }, { status: "DRAFT", publishAt: { lte: NOW } }]);
    expect(where.subject).toEqual(studentSubjectWhere(scope({ courseId: "cs", semester: sem(1) })));
  });

  it("threads the same clock through to materials, via their chapter", () => {
    const where = studentMaterialWhere(scope({ courseId: "cs", semester: sem(1) }), NOW);
    expect(where.OR).toEqual([{ status: "PUBLISHED" }, { status: "DRAFT", publishAt: { lte: NOW } }]);
    const chapter = where.chapter as { OR: unknown };
    expect(chapter.OR).toEqual([{ status: "PUBLISHED" }, { status: "DRAFT", publishAt: { lte: NOW } }]);
  });
});

describe("test visibility", () => {
  it("needs the test published (or its scheduled time come) and its subject published", () => {
    const NOW = new Date("2026-06-15T12:00:00Z");
    const where = studentTestWhere(scope({ courseId: "cs", semester: sem(3) }), NOW);
    expect(where.OR).toEqual([{ status: "PUBLISHED" }, { status: "DRAFT", publishAt: { lte: NOW } }]);
    expect((where.subject as { status: string }).status).toBe("PUBLISHED");
  });
  it("follows the same subject rule as materials — the semester or the admin's picks", () => {
    const scoped = scope({ courseId: "cs", semester: sem(3) });
    expect(studentTestWhere(scoped).subject).toEqual(studentSubjectWhere(scoped));
  });
  it("fails closed with no enrolment", () => {
    expect(json(studentTestWhere({ userId: "u1", enrollments: [] }))).toContain('"subject":{"id":{"in":[]}}');
  });
});
