import { describe, expect, it } from "vitest";
import { SUBJECT_ICON_KEYS } from "@/lib/subject-icons";
import { findVuProgram, VU_PROGRAMS } from "@/lib/vu-catalog";
import { existingCodes, guessVuProgram, iconForCode, leadingCode, matchProgram, planVuImport, vuSemesterIndex, vuSubjectName } from "@/lib/vu-import";

const cs = findVuProgram("computer-science")!;

describe("VU catalog", () => {
  it("has the programs the admin asked for, each with 8 semesters of courses", () => {
    for (const slug of ["computer-science", "information-technology", "business-administration", "psychology", "data-science"]) {
      const p = findVuProgram(slug);
      expect(p, slug).toBeDefined();
      expect(p!.semesters).toHaveLength(8);
      for (const sem of p!.semesters) expect(sem.length).toBeGreaterThan(0);
    }
  });

  it("matches VU's published BS Computer Science first semester", () => {
    const required = cs.semesters[0].filter((c) => c.kind === "R").map((c) => c.code);
    expect(required).toEqual(expect.arrayContaining(["CS101", "CS201", "ENG101", "MTH202", "VU001"]));
    expect(cs.semesters[0].find((c) => c.code === "MTH100")?.kind).toBe("D");
    expect(cs.semesters[1].find((c) => c.code === "CS304")?.title).toBe("Object Oriented Programming");
  });

  it("never lists a course twice within one program, and every row is well formed", () => {
    for (const p of VU_PROGRAMS) {
      const codes = p.semesters.flat().map((c) => c.code);
      expect(new Set(codes).size, p.name).toBe(codes.length);
      for (const c of p.semesters.flat()) {
        expect(c.code).toMatch(/^[A-Z]{2,5}\d{3,4}[A-Z]{0,2}$/);
        expect(c.title.length).toBeGreaterThan(2);
        expect(["R", "E", "D"]).toContain(c.kind);
        expect(c.credits).toBeGreaterThan(0);
        expect(vuSubjectName(c).length).toBeLessThanOrEqual(120);
      }
    }
  });

  it("has unique slugs and links each program back to its VU page", () => {
    expect(new Set(VU_PROGRAMS.map((p) => p.slug)).size).toBe(VU_PROGRAMS.length);
    expect(cs.sourceUrl).toBe("https://www.vu.edu.pk/AboutUs/ProgramDetails?StudyProgramID=4");
  });
});

describe("leadingCode / existingCodes", () => {
  it("reads the code at the start of a subject name", () => {
    expect(leadingCode("CS101 - Introduction to Computing")).toBe("cs101");
    expect(leadingCode("cs 101")).toBe("cs101");
    expect(leadingCode("CS301 Data Structures")).toBe("cs301");
    expect(leadingCode("MTH5101 Calculus I")).toBe("mth5101");
    expect(leadingCode("Data Structures")).toBeNull();
  });

  it("keeps a practical apart from its theory course", () => {
    expect(leadingCode("CS301 P")).toBe("cs301p");
    expect(leadingCode("CS301P - Data Structures (Practical)")).toBe("cs301p");
    const have = existingCodes(["CS301 P"]);
    expect(have.has("cs301p")).toBe(true);
    expect(have.has("cs301")).toBe(false);
  });
});

describe("planVuImport", () => {
  it("creates chosen courses in their VU semester, named code first", () => {
    const { create, skipped } = planVuImport(cs, ["CS101", "CS304"], []);
    expect(skipped).toBe(0);
    expect(create).toEqual([
      { semesterIndex: 0, code: "CS101", name: "CS101 - Introduction to Computing", icon: "code" },
      { semesterIndex: 1, code: "CS304", name: "CS304 - Object Oriented Programming", icon: "code" },
    ]);
  });

  it("skips courses the program already has, however they were written", () => {
    const { create, skipped } = planVuImport(cs, ["CS101", "ENG101", "CS201"], ["cs101", "ENG101 English"]);
    expect(create.map((c) => c.code)).toEqual(["CS201"]);
    expect(skipped).toBe(2);
  });

  it("ignores codes that are not in the scheme, and accepts any spelling of a real one", () => {
    const { create } = planVuImport(cs, ["HACK999", "cs 101"], []);
    expect(create.map((c) => c.code)).toEqual(["CS101"]);
  });
});

describe("vuSemesterIndex (suggesting a semester for a course that has none)", () => {
  it("finds the VU semester from the code at the start of the name, however it is written", () => {
    expect(vuSemesterIndex(cs, "cs304")).toBe(1);
    expect(vuSemesterIndex(cs, "CS304 - Object Oriented Programming")).toBe(1);
    expect(vuSemesterIndex(cs, "Cs101")).toBe(0);
    expect(vuSemesterIndex(cs, "cs301p")).toBe(2);
  });
  it("gives nothing for a code the scheme doesn't have, or a name with no code", () => {
    expect(vuSemesterIndex(cs, "ZZZ999")).toBeNull();
    expect(vuSemesterIndex(cs, "Academic Writing")).toBeNull();
  });
});

describe("guessVuProgram", () => {
  it("goes by the program's name first", () => {
    expect(guessVuProgram(VU_PROGRAMS, "BSCS", [])?.slug).toBe("computer-science");
    expect(guessVuProgram(VU_PROGRAMS, "BBA", ["cs101"])?.slug).toBe("business-administration");
  });
  it("otherwise picks the degree sharing the most course codes", () => {
    expect(guessVuProgram(VU_PROGRAMS, "My Degree", ["CS101", "CS201", "CS304", "CS301", "CS403", "CS604"])?.slug).toBe("computer-science");
    expect(guessVuProgram(VU_PROGRAMS, "My Degree", ["PSY101", "PSY502", "PSY404", "PSY405"])?.slug).toBe("psychology");
  });
  it("makes no guess from too few codes", () => {
    expect(guessVuProgram(VU_PROGRAMS, "phsycology", ["CS101", "ENG101"])).toBeUndefined();
    expect(guessVuProgram(VU_PROGRAMS, "Something", [])).toBeUndefined();
  });
});

describe("iconForCode", () => {
  it("picks an icon from the code prefix, falling back to a book", () => {
    expect(iconForCode("CS101")).toBe("code");
    expect(iconForCode("MTH202 - Discrete Mathematics")).toBe("calculator");
    expect(iconForCode("ENG101")).toBe("pen");
    expect(iconForCode("MGT201")).toBe("chart");
    expect(iconForCode("PSY101")).toBe("book");
    expect(iconForCode("Something")).toBe("book");
    expect(SUBJECT_ICON_KEYS).toContain(iconForCode("BIO101"));
  });
});

describe("matchProgram", () => {
  const programs = [{ id: "a", name: "BSCS" }, { id: "b", name: "BBA" }, { id: "c", name: "BS Psychology" }];
  it("finds an existing program by its common short name or full name", () => {
    expect(matchProgram(cs, programs)?.id).toBe("a");
    expect(matchProgram(findVuProgram("business-administration")!, programs)?.id).toBe("b");
    expect(matchProgram(findVuProgram("psychology")!, programs)?.id).toBe("c");
    expect(matchProgram(findVuProgram("zoology")!, programs)).toBeUndefined();
  });
});
