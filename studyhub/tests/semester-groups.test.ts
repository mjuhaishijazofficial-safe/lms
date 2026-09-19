import { describe, expect, it } from "vitest";
import { groupBySemester, type LibrarySubject } from "@/server/services/library";

const subject = (id: string, semester: { id: string; name: string; order: number } | null): LibrarySubject => ({
  id, name: id, description: "", icon: "book", semester, chapters: [], chapterCount: 0, materialCount: 0,
  progress: { completedChapters: 0, totalChapters: 0, percent: 0 },
});
const s = (n: number) => ({ id: `s${n}`, name: `Semester ${n}`, order: n });

describe("groupBySemester", () => {
  it("puts the current semester first, earlier ones newest-first, and whole-program subjects last", () => {
    const groups = groupBySemester(
      [subject("writing", null), subject("calc", s(1)), subject("dsa", s(3)), subject("linalg", s(2)), subject("oop", s(3))],
      "s3",
    );
    expect(groups.map((g) => g.name)).toEqual(["Semester 3", "Semester 2", "Semester 1", "All semesters"]);
    expect(groups[0].current).toBe(true);
    expect(groups[0].subjects.map((x) => x.id)).toEqual(["dsa", "oop"]);
    expect(groups.slice(1).every((g) => !g.current)).toBe(true);
  });
  it("copes with no current semester", () => {
    const groups = groupBySemester([subject("a", s(2)), subject("b", null)], undefined);
    expect(groups.map((g) => g.name)).toEqual(["Semester 2", "All semesters"]);
    expect(groups.some((g) => g.current)).toBe(false);
  });
  it("returns nothing for no subjects", () => {
    expect(groupBySemester([], "s1")).toEqual([]);
  });
});
