import { describe, expect, it } from "vitest";
import { makePassword, makeUsername, matchSubject, normalizeCode, parseStudentList } from "@/lib/student-import";

const WHATSAPP = `hina
Cs301
Cs301 p
Cs 304
Cs 304 p
Cs 601
Mcm 301
Mth 101
cs201p

eman hafees
Mgt301
 eng201
 mgt501
 Pak301
 psy101
 eco401

ayesha yaqoob
CS201P
MTH302
ECO401
CS302P
MCM101
cs201`;

describe("parseStudentList", () => {
  it("reads the WhatsApp format: a name, then one subject code per line, blank line between students", () => {
    const students = parseStudentList(WHATSAPP);
    expect(students.map((s) => s.name)).toEqual(["hina", "eman hafees", "ayesha yaqoob"]);
    expect(students[0].codes).toEqual(["Cs301", "Cs301 p", "Cs 304", "Cs 304 p", "Cs 601", "Mcm 301", "Mth 101", "cs201p"]);
    expect(students[1].codes).toHaveLength(6);
    expect(students[2].codes).toHaveLength(6);
  });

  it("accepts 'Name: code, code' on one line and Windows line endings", () => {
    expect(parseStudentList("Sara Khan: cs101, MTH 102 ; eng201")).toEqual([{ name: "Sara Khan", codes: ["cs101", "MTH 102", "eng201"] }]);
    expect(parseStudentList("a b\r\ncs1\r\n\r\nc d\r\ncs2")).toHaveLength(2);
  });

  it("drops repeated codes, ignoring case and spacing", () => {
    expect(parseStudentList("Ali\ncs301\nCS 301\ncs301p")[0].codes).toEqual(["cs301", "cs301p"]);
  });

  it("keeps a student who has a name but no subjects, and ignores empty input", () => {
    expect(parseStudentList("Only Name")).toEqual([{ name: "Only Name", codes: [] }]);
    expect(parseStudentList("  \n\n \n")).toEqual([]);
    expect(parseStudentList("")).toEqual([]);
  });
});

describe("normalizeCode", () => {
  it("treats spacing and case differences as the same subject", () => {
    for (const c of ["Cs301 p", "CS301P", "cs 301 p", "cs-301-p"]) expect(normalizeCode(c)).toBe("cs301p");
  });
});

describe("matchSubject", () => {
  const subjects = [
    { id: "a", name: "cs301", courseId: "bscs" },
    { id: "b", name: "cs301p", courseId: "bscs" },
    { id: "c", name: "ECO401", courseId: "bba" },
    { id: "d", name: "ECO401", courseId: "bbit" },
    { id: "e", name: "MTH101 Calculus", courseId: "bscs" },
  ];

  it("matches by code however it was typed, and does not confuse cs301 with cs301p", () => {
    expect(matchSubject("Cs301", subjects, null)?.id).toBe("a");
    expect(matchSubject("Cs301 p", subjects, null)?.id).toBe("b");
  });

  it("matches the first word of a longer subject name", () => {
    expect(matchSubject("mth 101", subjects, null)?.id).toBe("e");
  });

  it("prefers the subject in the chosen program when a code exists in several", () => {
    expect(matchSubject("eco401", subjects, "bbit")?.id).toBe("d");
    expect(matchSubject("eco401", subjects, "bba")?.id).toBe("c");
    expect(matchSubject("eco401", subjects, null)?.id).toBe("c");
  });

  it("returns null for an unknown code or an empty one", () => {
    expect(matchSubject("zzz999", subjects, null)).toBeNull();
    expect(matchSubject("  ", subjects, null)).toBeNull();
  });
});

describe("makeUsername", () => {
  it("builds a valid, lower-case sign-in name from a person's name", () => {
    expect(makeUsername("Eman Hafees", new Set())).toBe("eman.hafees");
    expect(makeUsername("  Ayesha   Yaqoob ", new Set())).toBe("ayesha.yaqoob");
  });

  it("adds a number instead of colliding, including within one import", () => {
    const taken = new Set(["hina"]);
    expect(makeUsername("Hina", taken)).toBe("hina2");
    expect(makeUsername("Hina", taken)).toBe("hina3");
  });

  it("always satisfies the sign-in rules, even for very short or non-Latin names", () => {
    for (const n of ["Al", "A", "علی", "!!!", "x".repeat(100)]) {
      expect(makeUsername(n, new Set()), n).toMatch(/^[a-z0-9._-]{3,40}$/);
    }
  });
});

describe("makePassword", () => {
  it("makes passwords of the requested length from readable characters only", () => {
    let n = 0;
    const p = makePassword(() => (n++ * 37) % 256, 12);
    expect(p).toHaveLength(12);
    expect(p).toMatch(/^[a-zA-Z2-9]+$/);
    expect(p).not.toMatch(/[01OIl]/);
  });
});
