import { describe, expect, it } from "vitest";
import { studentCourseWhere, studentMaterialWhere, studentSubjectWhere, type StudentScope } from "@/server/services/visibility";

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
  it("needs the material, its chapter, its subject and its program to be published", () => {
    expect(where.status).toBe("PUBLISHED");
    const chapter = where.chapter as { status: string; subject: { status: string } };
    expect(chapter.status).toBe("PUBLISHED");
    expect(chapter.subject.status).toBe("PUBLISHED");
  });
  it("carries the semester rule down to the material", () => {
    expect(json(where)).toContain('"order":{"lte":3}');
  });
  it("course visibility lists only enrolled, published programs", () => {
    expect(studentCourseWhere(scope({ courseId: "cs", semester: sem(3) }))).toEqual({ status: "PUBLISHED", id: { in: ["cs"] } });
  });
});
