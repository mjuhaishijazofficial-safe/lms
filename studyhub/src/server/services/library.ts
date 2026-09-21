import "server-only";
import { cache } from "react";
import type { MaterialType } from "@prisma/client";
import { db } from "@/server/db";
import { computeProgress, type Progress } from "@/lib/progress";
import { PAGE_SIZE } from "./_shared";
import { getStudentScope, studentCourseWhere, studentMaterialWhere, studentSubjectWhere } from "./access";

/** Everything a student can see, as one tree: their program, its semesters up to the current one, subjects, chapters. */
export type SemesterRef = { id: string; name: string; order: number };
export type LibraryChapter = { id: string; title: string; description: string; chapterNumber: number; materialIds: string[] };
export type LibrarySubject = {
  id: string; name: string; description: string; icon: string; semester: SemesterRef | null;
  chapters: LibraryChapter[]; chapterCount: number; materialCount: number; progress: Progress;
};
export type LibraryCourse = {
  id: string; name: string; description: string;
  /** The semester the student is currently in (null if the program has none, or none is set yet). */
  currentSemester: SemesterRef | null;
  subjects: LibrarySubject[]; subjectCount: number; chapterCount: number; materialCount: number; progress: Progress;
};
export type Library = { courses: LibraryCourse[]; subjectCount: number; materialCount: number; progress: Progress };

const ORDER = [{ order: "asc" as const }, { createdAt: "asc" as const }];

const subjectTreeSelect = {
  id: true, name: true, description: true, icon: true, semester: { select: { id: true, name: true, order: true } },
  chapters: {
    where: { status: "PUBLISHED" as const }, orderBy: ORDER,
    select: { id: true, title: true, description: true, chapterNumber: true, materials: { where: { status: "PUBLISHED" as const }, orderBy: ORDER, select: { id: true } } },
  },
} as const;

type SubjectTreeRow = {
  id: string; name: string; description: string; icon: string; semester: SemesterRef | null;
  chapters: { id: string; title: string; description: string; chapterNumber: number; materials: { id: string }[] }[];
};

/** Turns a subject-with-chapters row into the display shape, computing its progress from `completed`. */
function buildSubject(s: SubjectTreeRow, completed: ReadonlySet<string>): LibrarySubject {
  const chapters = s.chapters.map((c) => ({ id: c.id, title: c.title, description: c.description, chapterNumber: c.chapterNumber, materialIds: c.materials.map((m) => m.id) }));
  return {
    id: s.id, name: s.name, description: s.description, icon: s.icon, semester: s.semester, chapters,
    chapterCount: chapters.length, materialCount: chapters.reduce((n, c) => n + c.materialIds.length, 0), progress: computeProgress(chapters, completed),
  };
}

async function completedMaterialIds(userId: string): Promise<Set<string>> {
  const rows = await db.materialProgress.findMany({ where: { userId, completedAt: { not: null } }, select: { materialId: true } });
  return new Set(rows.map((r) => r.materialId));
}

/** Loaded once per request per student (React `cache`), then sliced by the dashboard, program and subject pages. */
export const loadLibrary = cache(async (userId: string): Promise<Library> => {
  const scope = await getStudentScope(userId);
  const [courses, completed] = await Promise.all([
    db.course.findMany({
      where: studentCourseWhere(scope),
      orderBy: ORDER,
      select: {
        id: true, name: true, description: true,
        subjects: { where: studentSubjectWhere(scope), orderBy: [{ semester: { order: "desc" } }, { order: "asc" }, { createdAt: "asc" }], select: subjectTreeSelect },
      },
    }),
    completedMaterialIds(userId),
  ]);

  const built = courses.map((course): LibraryCourse => {
    const subjects = course.subjects.map((s) => buildSubject(s, completed));
    const allChapters = subjects.flatMap((s) => s.chapters);
    return {
      id: course.id, name: course.name, description: course.description,
      currentSemester: scope.enrollments.find((e) => e.courseId === course.id)?.semester ?? null,
      subjects, subjectCount: subjects.length, chapterCount: allChapters.length,
      materialCount: subjects.reduce((n, s) => n + s.materialCount, 0), progress: computeProgress(allChapters, completed),
    };
  });
  const allChapters = built.flatMap((c) => c.subjects.flatMap((s) => s.chapters));
  return {
    courses: built,
    subjectCount: built.reduce((n, c) => n + c.subjectCount, 0),
    materialCount: built.reduce((n, c) => n + c.materialCount, 0),
    progress: computeProgress(allChapters, completed),
  };
});

/** Specific subjects by id (e.g. bookmarked ones), in the given order. Subjects no longer visible are dropped silently. */
export async function getSubjectsByIds(userId: string, ids: string[]): Promise<LibrarySubject[]> {
  if (ids.length === 0) return [];
  const scope = await getStudentScope(userId);
  const [rows, completed] = await Promise.all([
    db.subject.findMany({ where: { id: { in: ids }, ...studentSubjectWhere(scope) }, select: subjectTreeSelect }),
    completedMaterialIds(userId),
  ]);
  const byId = new Map(rows.map((s) => [s.id, buildSubject(s, completed)]));
  return ids.map((id) => byId.get(id)).filter((s): s is LibrarySubject => !!s);
}

export type SubjectGroup = { key: string; name: string; current: boolean; subjects: LibrarySubject[] };

/** Groups subjects by semester: the current one first, earlier ones newest-first, then subjects for the whole program. */
export function groupBySemester(subjects: LibrarySubject[], currentId: string | undefined): SubjectGroup[] {
  const groups = new Map<string, SubjectGroup>();
  for (const s of subjects) {
    const key = s.semester?.id ?? "all";
    if (!groups.has(key)) groups.set(key, { key, name: s.semester?.name ?? "All semesters", current: !!currentId && s.semester?.id === currentId, subjects: [] });
    groups.get(key)!.subjects.push(s);
  }
  const rank = (g: SubjectGroup) => (g.key === "all" ? -1 : g.current ? Number.MAX_SAFE_INTEGER : (subjects.find((s) => s.semester?.id === g.key)?.semester?.order ?? 0));
  return [...groups.values()].sort((a, b) => rank(b) - rank(a));
}

export const cardSelect = {
  id: true, type: true, title: true, description: true, fileName: true, fileSize: true, durationSeconds: true, externalUrl: true, createdAt: true,
} as const;

export type MaterialCardData = {
  id: string; type: MaterialType; title: string; description: string; fileName: string | null; fileSize: number | null;
  durationSeconds: number | null; externalUrl: string | null; createdAt: Date;
};

/** A material card plus which subject/chapter it lives in, for lists that mix material from more than one place. */
export const materialWithContextSelect = {
  ...cardSelect,
  chapter: { select: { chapterNumber: true, title: true, subject: { select: { id: true, name: true, icon: true } } } },
} as const;
export type MaterialWithContext = MaterialCardData & { chapter: { chapterNumber: number; title: string; subject: { id: string; name: string; icon: string } } };

/** One subject with its chapters, materials and this student's activity. Null when it isn't theirs to see. */
export async function getSubjectView(userId: string, subjectId: string) {
  const scope = await getStudentScope(userId);
  const subject = await db.subject.findFirst({
    where: { AND: [{ id: subjectId }, studentSubjectWhere(scope)] },
    select: {
      id: true, name: true, description: true, icon: true,
      course: { select: { id: true, name: true } },
      semester: { select: { id: true, name: true } },
      chapters: {
        where: { status: "PUBLISHED" }, orderBy: ORDER,
        select: { id: true, title: true, description: true, chapterNumber: true, materials: { where: { status: "PUBLISHED" }, orderBy: ORDER, select: cardSelect } },
      },
    },
  });
  if (!subject) return null;

  const ids = subject.chapters.flatMap((c) => c.materials.map((m) => m.id));
  const activity = await db.materialProgress.findMany({ where: { userId, materialId: { in: ids } }, select: { materialId: true, completedAt: true } });
  const opened = new Set(activity.map((a) => a.materialId));
  const completed = new Set(activity.filter((a) => a.completedAt).map((a) => a.materialId));
  const progress = computeProgress(subject.chapters.map((c) => ({ id: c.id, materialIds: c.materials.map((m) => m.id) })), completed);
  return { subject, progress, opened, completed };
}

/** One material a student may open, with its place in the library and its neighbours in the chapter. */
export async function getMaterialView(userId: string, materialId: string) {
  const scope = await getStudentScope(userId);
  const material = await db.material.findFirst({
    where: { AND: [{ id: materialId }, studentMaterialWhere(scope)] },
    select: {
      id: true, type: true, title: true, description: true, fileName: true, fileSize: true, mimeType: true, externalUrl: true, youtubeId: true,
      durationSeconds: true, textContent: true, lessonData: true, createdAt: true, chapterId: true,
      chapter: {
        select: {
          id: true, title: true, chapterNumber: true,
          subject: { select: { id: true, name: true, course: { select: { id: true, name: true } }, semester: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!material) return null;
  const siblings = await db.material.findMany({ where: { chapterId: material.chapterId, status: "PUBLISHED" }, orderBy: ORDER, select: { id: true, title: true } });
  const at = siblings.findIndex((s) => s.id === material.id);
  return { material, previous: siblings[at - 1] ?? null, next: siblings[at + 1] ?? null, position: at + 1, total: siblings.length };
}

/** Newest material first, only what this student is allowed to see. */
export async function listRecentMaterials(userId: string, page: number, pageSize = PAGE_SIZE) {
  const where = studentMaterialWhere(await getStudentScope(userId));
  const [rows, total] = await Promise.all([
    db.material.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: materialWithContextSelect }),
    db.material.count({ where }),
  ]);
  return { rows, total };
}

/** Material added in the last week, for the bell menu. */
export async function getNotifications(userId: string, days = 7, take = 5) {
  const where = { AND: [studentMaterialWhere(await getStudentScope(userId)), { createdAt: { gte: new Date(Date.now() - days * 86_400_000) } }] };
  const [count, items] = await Promise.all([
    db.material.count({ where }),
    db.material.findMany({ where, orderBy: { createdAt: "desc" }, take, select: { id: true, title: true, createdAt: true, chapter: { select: { subject: { select: { name: true } } } } } }),
  ]);
  return { count, items };
}

export async function getStudentProfile(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      name: true, email: true, createdAt: true, studentProfile: { select: { studentId: true } },
      enrollments: { take: 1, orderBy: { createdAt: "asc" }, select: { course: { select: { name: true } }, semester: { select: { name: true } } } },
    },
  });
}
