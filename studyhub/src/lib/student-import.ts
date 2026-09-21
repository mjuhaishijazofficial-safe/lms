// Turns a pasted list of students and their subject codes into a plan. Pure (no I/O) so it can be unit tested.
//
// The accepted format is the one admins already send around on WhatsApp: a name, then one subject code per line,
// with a blank line between students:
//
//   hina
//   Cs301
//   Cs301 p
//
//   eman hafees
//   Mgt301
//
// "Name: code, code, code" on a single line works too.

export type ParsedStudent = { name: string; codes: string[] };

/** "Cs301 p", "CS301P" and "cs301p" are the same subject. */
export const normalizeCode = (code: string) => code.toLowerCase().replace(/[\s._-]+/g, "");

export function parseStudentList(text: string): ParsedStudent[] {
  const students: ParsedStudent[] = [];
  const blocks = text.replace(/\r/g, "").split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let name: string;
    let rest: string[];
    if (lines.length === 1 && lines[0].includes(":")) {
      const [head, ...tail] = lines[0].split(":");
      name = head.trim();
      rest = [tail.join(":")];
    } else {
      [name, ...rest] = lines;
    }

    const codes = rest
      .flatMap((l) => l.split(/[,;]/))
      .map((c) => c.trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const unique = codes.filter((c) => {
      const key = normalizeCode(c);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    name = name.replace(/\s+/g, " ").trim();
    if (name) students.push({ name, codes: unique });
  }
  return students;
}

export type SubjectRef = { id: string; name: string; courseId: string };

/**
 * Finds the subject a code refers to. A subject is matched by its whole name ("cs301p") or by its first word
 * ("CS301 Data Structures" matches "cs301"). When several subjects share a code, the one in the chosen program wins.
 */
export function matchSubject(code: string, subjects: SubjectRef[], preferCourseId: string | null): SubjectRef | null {
  const key = normalizeCode(code);
  if (!key) return null;
  const found = subjects.filter((s) => normalizeCode(s.name) === key || normalizeCode(s.name.split(/\s+/)[0] ?? "") === key);
  if (found.length === 0) return null;
  return found.find((s) => s.courseId === preferCourseId) ?? found[0];
}

/** A sign-in name from a person's name: "Eman Hafees" -> "eman.hafees". Adds a number if it is taken. */
export function makeUsername(name: string, taken: Set<string>): string {
  let base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  if (base.length < 3) base = `${base || "student"}.user`.slice(0, 40);
  base = base.slice(0, 34);
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base}${n}`;
  taken.add(candidate);
  return candidate;
}

// No 0/O/1/l/I: temporary passwords get read aloud or copied from WhatsApp.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makePassword(randomByte: () => number, length = 10): string {
  let out = "";
  while (out.length < length) {
    const b = randomByte();
    // Reject bytes that would bias the choice toward the start of the alphabet.
    if (b < 256 - (256 % PASSWORD_ALPHABET.length)) out += PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length];
  }
  return out;
}
