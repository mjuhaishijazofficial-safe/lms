import "server-only";
import { Prisma, type MaterialType } from "@prisma/client";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { checkUpload } from "@/server/materials/upload";
import { noteText, sanitizeNoteHtml } from "@/server/materials/sanitize";
import { getStorage, newStorageKey } from "@/server/storage";
import type { CreateMaterialInput, UpdateMaterialInput } from "@/server/validation/materials";
import { ensureAdmin, moveInList, nextOrder, PAGE_SIZE } from "./_shared";

export type UploadedFile = { name: string; data: Buffer };

export const SORTS = {
  library: "Library order",
  newest: "Newest first",
  oldest: "Oldest first",
  edited: "Recently edited",
  title: "Title A–Z",
} as const;
export type SortKey = keyof typeof SORTS;

const ORDERINGS: Record<SortKey, Prisma.MaterialOrderByWithRelationInput[]> = {
  library: [{ chapter: { subject: { course: { order: "asc" } } } }, { chapter: { subject: { order: "asc" } } }, { chapter: { order: "asc" } }, { order: "asc" }, { createdAt: "asc" }],
  newest: [{ createdAt: "desc" }],
  oldest: [{ createdAt: "asc" }],
  edited: [{ updatedAt: "desc" }],
  title: [{ title: "asc" }],
};

const listInclude = {
  chapter: { select: { id: true, title: true, chapterNumber: true, subject: { select: { id: true, name: true, semester: { select: { name: true } }, course: { select: { id: true, name: true } } } } } },
} satisfies Prisma.MaterialInclude;

export type MaterialFilter = {
  courseId?: string; subjectId?: string; chapterId?: string; type?: MaterialType; status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  q?: string; sort: SortKey; page: number;
};

export async function listMaterials(filter: MaterialFilter) {
  const where: Prisma.MaterialWhereInput = {
    ...(filter.chapterId
      ? { chapterId: filter.chapterId }
      : filter.subjectId
        ? { chapter: { subjectId: filter.subjectId } }
        : filter.courseId
          ? { chapter: { subject: { courseId: filter.courseId } } }
          : {}),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.q ? { OR: [{ title: { contains: filter.q, mode: "insensitive" } }, { description: { contains: filter.q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.material.findMany({
      where, orderBy: ORDERINGS[filter.sort], skip: (filter.page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: listInclude,
    }),
    db.material.count({ where }),
  ]);
  return { rows, total };
}

export function getMaterial(id: string) {
  return db.material.findUnique({ where: { id }, include: listInclude });
}

export type PickerTree = {
  id: string; name: string;
  subjects: { id: string; name: string; chapters: { id: string; label: string }[] }[];
}[];

/** Program → subject → chapter tree for the pickers. Archived content is listed so admins can still file into it. */
export async function chapterPickerTree(): Promise<PickerTree> {
  const courses = await db.course.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, name: true,
      subjects: {
        orderBy: [{ semester: { order: "asc" } }, { order: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, semester: { select: { name: true } }, chapters: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, chapterNumber: true } } },
      },
    },
  });
  return courses.map((c) => ({
    id: c.id, name: c.name,
    subjects: c.subjects.map((s) => ({ id: s.id, name: s.semester ? `${s.semester.name} · ${s.name}` : s.name, chapters: s.chapters.map((ch) => ({ id: ch.id, label: `${ch.chapterNumber}. ${ch.title}` })) })),
  }));
}

async function appendOrder(chapterId: string) {
  const max = await db.material.aggregate({ where: { chapterId }, _max: { order: true } });
  return nextOrder(max._max.order);
}

async function assertChapter(chapterId: string) {
  if (!(await db.chapter.findUnique({ where: { id: chapterId }, select: { id: true } }))) {
    throw new ServiceError("Choose a chapter that exists.", "chapterId");
  }
}

/** Validates the upload's real contents and writes it to storage. Returns what to save on the Material row. */
async function storeUpload(file: UploadedFile) {
  const check = checkUpload({ name: file.name, data: file.data }, env.MAX_UPLOAD_MB * 1_048_576);
  if (!check.ok) throw new ServiceError(check.error, "file");
  const key = newStorageKey(check.ext);
  try {
    await getStorage().put(key, file.data, { contentType: check.mime });
  } catch (err) {
    console.error("Upload storage failed", err);
    throw new ServiceError("File upload failed. Please try again.", "file");
  }
  return { fileKey: key, fileName: check.displayName, mimeType: check.mime, fileSize: file.data.byteLength };
}

const discardFile = (key: string | null | undefined) =>
  key ? getStorage().delete(key).catch((err) => console.error("Could not remove stored file", key, err)) : undefined;

/** The type-specific columns for a validated input. Everything not relevant to the type is cleared. */
function typeColumns(data: CreateMaterialInput | UpdateMaterialInput) {
  const cleared = { externalUrl: null, youtubeId: null, durationSeconds: null, textContent: null, lessonData: Prisma.DbNull };
  switch (data.type) {
    case "YOUTUBE": return { ...cleared, youtubeId: data.youtubeUrl, durationSeconds: data.duration }; // youtubeUrl was parsed to the id
    case "LINK": return { ...cleared, externalUrl: data.externalUrl };
    case "TEXT": {
      const html = sanitizeNoteHtml(data.textContent);
      if (!noteText(html)) throw new ServiceError("Write something in the note before saving.", "textContent");
      return { ...cleared, textContent: html };
    }
    case "LESSON": return { ...cleared, lessonData: data.lessonJson as unknown as Prisma.InputJsonValue }; // already validated and sanitised
    case "FILE": return cleared;
  }
}

export async function createMaterial(actor: SessionUser, data: CreateMaterialInput, file: UploadedFile | null) {
  ensureAdmin(actor);
  await assertChapter(data.chapterId);
  const columns = typeColumns(data);

  let stored: Awaited<ReturnType<typeof storeUpload>> | null = null;
  if (data.type === "FILE") {
    if (!file) throw new ServiceError("Choose a file to upload.", "file");
    stored = await storeUpload(file);
  }
  try {
    return await db.material.create({
      data: {
        chapterId: data.chapterId, type: data.type, title: data.title, description: data.description, status: data.status,
        order: await appendOrder(data.chapterId), uploadedById: actor.id, ...columns, ...(stored ?? {}),
      },
      select: { id: true },
    });
  } catch (err) {
    await discardFile(stored?.fileKey); // never leave an upload behind without a row pointing at it
    throw err;
  }
}

export async function updateMaterial(actor: SessionUser, data: UpdateMaterialInput, file: UploadedFile | null) {
  ensureAdmin(actor);
  const existing = await db.material.findUnique({ where: { id: data.id } });
  if (!existing) throw new ServiceError("This material no longer exists.", undefined, "not-found");
  if (existing.type !== data.type) throw new ServiceError("The type of a material can't be changed. Create a new one instead.");
  await assertChapter(data.chapterId);
  const columns = typeColumns(data);

  const stored = data.type === "FILE" && file ? await storeUpload(file) : null;
  const moved = existing.chapterId !== data.chapterId;
  try {
    await db.material.update({
      where: { id: data.id },
      data: {
        chapterId: data.chapterId, title: data.title, description: data.description, status: data.status,
        ...(moved ? { order: await appendOrder(data.chapterId) } : {}), ...columns, ...(stored ?? {}),
      },
    });
  } catch (err) {
    await discardFile(stored?.fileKey);
    throw err;
  }
  if (stored) await discardFile(existing.fileKey); // the replaced file is only removed once the new one is saved
}

export async function moveMaterial(actor: SessionUser, id: string, direction: "up" | "down") {
  ensureAdmin(actor);
  const material = await db.material.findUnique({ where: { id }, select: { chapterId: true } });
  if (!material) return;
  const siblings = await db.material.findMany({ where: { chapterId: material.chapterId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const next = moveInList(siblings, id, direction);
  if (next) await db.$transaction(next.map((m, i) => db.material.update({ where: { id: m.id }, data: { order: i } })));
}

export async function setMaterialStatus(actor: SessionUser, id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  ensureAdmin(actor);
  return db.material.update({ where: { id }, data: { status } });
}

export async function deleteMaterial(actor: SessionUser, id: string) {
  ensureAdmin(actor);
  const material = await db.material.findUnique({ where: { id }, select: { fileKey: true } });
  if (!material) throw new ServiceError("This material no longer exists.", undefined, "not-found");
  await db.material.delete({ where: { id } }); // progress and bookmarks cascade
  await discardFile(material.fileKey);
}
