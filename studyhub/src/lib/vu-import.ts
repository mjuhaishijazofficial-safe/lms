import type { SubjectIconKey } from "@/lib/subject-icons";
import { normalizeCode } from "@/lib/student-import";
import type { VuCourse, VuProgram } from "@/lib/vu-catalog";

/** How an imported course is named: "CS101 - Introduction to Computing". The code comes first so student import still finds it. */
export function vuSubjectName(course: Pick<VuCourse, "code" | "title">): string {
  return `${course.code} - ${course.title}`.slice(0, 120);
}

/**
 * The course code a subject name starts with, normalised: "CS101 - Intro" and "cs 101" give "cs101", while a practical
 * written "CS301 P" or "CS301P" gives "cs301p" (a different course). Null when the name has no leading code.
 */
export function leadingCode(name: string): string | null {
  const m = name.trim().match(/^([A-Za-z]{2,5})\s*(\d{3,4})\s*([A-Za-z]{1,2})?(?=$|[\s\-–—:(,.])/);
  return m ? normalizeCode(m[1] + m[2] + (m[3] ?? "")) : null;
}

/** The codes a program's existing subjects already cover: each whole name, and the code it starts with. */
export function existingCodes(subjectNames: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const name of subjectNames) {
    out.add(normalizeCode(name));
    const code = leadingCode(name);
    if (code) out.add(code);
  }
  return out;
}

const PREFIX_ICONS: [RegExp, SubjectIconKey][] = [
  [/^(CS|IT|CSI|SE)\d/, "code"],
  [/^(MTH|MATH)\d/, "calculator"],
  [/^(STA|STAT)\d/, "sigma"],
  [/^(ENG|ENGL)\d/, "pen"],
  [/^(ECO|FIN|ACC|BNK|MGT|MGMT|MKT|HRM|BIT)\d/, "chart"],
  [/^PHY\d/, "atom"],
  [/^(CHE|CHEM)\d/, "flask"],
  [/^(BIO|BT|BIF|ZOO|BCH|MCB|GEN)\d/, "dna"],
  [/^(PAK|HIS|PAD)\d/, "landmark"],
  [/^(ISL|ETH|ARB|URD)\d/, "languages"],
  [/^(SOC|MCM|GSC)\d/, "globe"],
];

/** A sensible default icon from a course code, so imported courses don't all look the same. */
export function iconForCode(nameOrCode: string): SubjectIconKey {
  const code = leadingCode(nameOrCode)?.toUpperCase() ?? "";
  return PREFIX_ICONS.find(([re]) => re.test(code))?.[1] ?? "book";
}

export type PlannedCourse = { semesterIndex: number; code: string; name: string; icon: SubjectIconKey };

/**
 * Which of the chosen VU courses to create, and in which semester (0-based position in the program's own order).
 * Codes not in the scheme are ignored; codes the program already has, or chosen twice, are skipped.
 */
export function planVuImport(program: VuProgram, chosenCodes: readonly string[], haveNames: readonly string[]): { create: PlannedCourse[]; skipped: number } {
  const chosen = new Set(chosenCodes.map(normalizeCode));
  const have = existingCodes(haveNames);
  const create: PlannedCourse[] = [];
  let skipped = 0;
  program.semesters.forEach((courses, semesterIndex) => {
    for (const c of courses) {
      const key = normalizeCode(c.code);
      if (!chosen.has(key)) continue;
      if (have.has(key)) { skipped++; continue; }
      have.add(key);
      create.push({ semesterIndex, code: c.code, name: vuSubjectName(c), icon: iconForCode(c.code) });
    }
  });
  return { create, skipped };
}

/** The existing program a VU scheme most likely belongs to, by name ("BSCS", "BS Computer Science" …). */
export function matchProgram<T extends { id: string; name: string }>(vu: VuProgram, programs: readonly T[]): T | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const names = new Set([norm(vu.name), ...vu.aliases.map(norm), norm(vu.name.replace(/^BS\s+/i, ""))]);
  return programs.find((p) => {
    const n = norm(p.name);
    return names.has(n) || names.has(n.replace(/^bs\s+/, ""));
  });
}
