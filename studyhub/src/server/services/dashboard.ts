import "server-only";
import { db } from "@/server/db";

export async function getAdminStats() {
  const [students, activeStudents, courses, subjects, chapters, materials] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
    db.course.count(),
    db.subject.count(),
    db.chapter.count(),
    db.material.count(),
  ]);
  return { students, activeStudents, courses, subjects, chapters, materials };
}

export function recentStudents(take = 5) {
  return db.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, name: true, email: true, status: true, createdAt: true, enrollments: { take: 1, select: { course: { select: { name: true } }, semester: { select: { name: true } } } } },
  });
}

export function recentUploads(take = 5) {
  return db.material.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true, title: true, type: true, createdAt: true,
      chapter: { select: { title: true, subject: { select: { name: true } } } },
    },
  });
}

export type ModifiedItem = { kind: "Program" | "Subject" | "Chapter" | "Material"; id: string; name: string; context: string; updatedAt: Date; href: string };

/** The most recently edited content of any kind, newest first. */
export async function recentlyModified(take = 6): Promise<ModifiedItem[]> {
  const [courses, subjects, chapters, materials] = await Promise.all([
    db.course.findMany({ orderBy: { updatedAt: "desc" }, take, select: { id: true, name: true, updatedAt: true } }),
    db.subject.findMany({ orderBy: { updatedAt: "desc" }, take, select: { id: true, name: true, updatedAt: true, course: { select: { name: true } } } }),
    db.chapter.findMany({ orderBy: { updatedAt: "desc" }, take, select: { id: true, title: true, updatedAt: true, subject: { select: { name: true } } } }),
    db.material.findMany({ orderBy: { updatedAt: "desc" }, take, select: { id: true, title: true, updatedAt: true, chapter: { select: { title: true } } } }),
  ]);
  const all: ModifiedItem[] = [
    ...courses.map((c) => ({ kind: "Program" as const, id: c.id, name: c.name, context: "Program", updatedAt: c.updatedAt, href: `/admin/courses/${c.id}` })),
    ...subjects.map((s) => ({ kind: "Subject" as const, id: s.id, name: s.name, context: s.course.name, updatedAt: s.updatedAt, href: `/admin/subjects/${s.id}` })),
    ...chapters.map((c) => ({ kind: "Chapter" as const, id: c.id, name: c.title, context: c.subject.name, updatedAt: c.updatedAt, href: `/admin/chapters/${c.id}` })),
    ...materials.map((m) => ({ kind: "Material" as const, id: m.id, name: m.title, context: m.chapter.title, updatedAt: m.updatedAt, href: `/admin/materials/${m.id}` })),
  ];
  return all.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, take);
}
