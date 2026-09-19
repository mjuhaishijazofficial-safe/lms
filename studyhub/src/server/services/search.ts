import "server-only";
import type { MaterialType } from "@prisma/client";
import { db } from "@/server/db";
import { getStudentScope, studentChapterWhere, studentMaterialWhere, studentSubjectWhere } from "./access";

export type SearchResults = {
  subjects: { id: string; name: string; description: string; icon: string; courseName: string }[];
  chapters: { id: string; title: string; chapterNumber: number; subjectId: string; subjectName: string }[];
  materials: { id: string; title: string; type: MaterialType; fileName: string | null; subjectId: string; subjectName: string; chapterId: string; chapterTitle: string }[];
};

const LIMIT = 20;

/** Searches subjects, chapters and material titles within what this student is allowed to see. */
export async function searchLibrary(userId: string, query: string): Promise<SearchResults> {
  const q = query.trim();
  if (!q) return { subjects: [], chapters: [], materials: [] };
  const scope = await getStudentScope(userId);

  const [subjects, chapters, materials] = await Promise.all([
    db.subject.findMany({
      where: { ...studentSubjectWhere(scope), name: { contains: q, mode: "insensitive" } },
      orderBy: { name: "asc" },
      take: LIMIT,
      select: { id: true, name: true, description: true, icon: true, course: { select: { name: true } } },
    }),
    db.chapter.findMany({
      where: { ...studentChapterWhere(scope), title: { contains: q, mode: "insensitive" } },
      orderBy: { title: "asc" },
      take: LIMIT,
      select: { id: true, title: true, chapterNumber: true, subject: { select: { id: true, name: true } } },
    }),
    db.material.findMany({
      where: { ...studentMaterialWhere(scope), title: { contains: q, mode: "insensitive" } },
      orderBy: { title: "asc" },
      take: LIMIT,
      select: { id: true, title: true, type: true, fileName: true, chapter: { select: { id: true, title: true, subject: { select: { id: true, name: true } } } } },
    }),
  ]);

  return {
    subjects: subjects.map((s) => ({ id: s.id, name: s.name, description: s.description, icon: s.icon, courseName: s.course.name })),
    chapters: chapters.map((c) => ({ id: c.id, title: c.title, chapterNumber: c.chapterNumber, subjectId: c.subject.id, subjectName: c.subject.name })),
    materials: materials.map((m) => ({
      id: m.id, title: m.title, type: m.type, fileName: m.fileName,
      subjectId: m.chapter.subject.id, subjectName: m.chapter.subject.name, chapterId: m.chapter.id, chapterTitle: m.chapter.title,
    })),
  };
}
