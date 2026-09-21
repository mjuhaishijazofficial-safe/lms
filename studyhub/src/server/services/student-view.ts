import "server-only";
import { db } from "@/server/db";
import { getStudentScope } from "./access";
import { loadLibrary } from "./library";

export type StudentViewSubject = {
  id: string; name: string; semester: string | null; picked: boolean;
  chapters: { id: string; title: string; materials: { id: string; title: string; type: string }[] }[];
  materialCount: number;
};

/**
 * What one student can actually open, for the admin's profile page. It is built from the same rules the student app
 * uses (published content only, picked subjects or the semester rule), so it cannot drift from what the student sees.
 * An inactive student sees nothing, and so does this.
 */
export async function studentView(userId: string): Promise<{ subjects: StudentViewSubject[]; usesPicked: boolean }> {
  const [scope, library] = await Promise.all([getStudentScope(userId), loadLibrary(userId)]);
  const subjects = library.courses.flatMap((c) => c.subjects);
  const ids = subjects.flatMap((s) => s.chapters.flatMap((c) => c.materialIds));
  const rows = ids.length ? await db.material.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, type: true } }) : [];
  const byId = new Map(rows.map((m) => [m.id, m]));
  const picked = new Set(scope.subjectIds ?? []);
  return {
    usesPicked: picked.size > 0,
    subjects: subjects.map((s) => ({
      id: s.id, name: s.name, semester: s.semester?.name ?? null, picked: picked.has(s.id),
      materialCount: s.materialCount,
      chapters: s.chapters.map((c) => ({
        id: c.id, title: c.title,
        materials: c.materialIds.flatMap((id) => { const m = byId.get(id); return m ? [{ id, title: m.title, type: m.type }] : []; }),
      })),
    })),
  };
}
