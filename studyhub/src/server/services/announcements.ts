import "server-only";
import type { z } from "zod";
import { db } from "@/server/db";
import { ServiceError } from "@/server/action-result";
import type { SessionUser } from "@/server/auth/session";
import type { announcementSchema } from "@/server/validation/admin";
import { ensureAdmin } from "./_shared";

const DASHBOARD_LIMIT = 5;

export function listAnnouncements(actor: SessionUser) {
  ensureAdmin(actor);
  return db.announcement.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, body: true, active: true, createdAt: true, course: { select: { id: true, name: true } } },
  });
}

export async function createAnnouncement(actor: SessionUser, data: z.infer<typeof announcementSchema>) {
  ensureAdmin(actor);
  if (data.courseId && !(await db.course.findUnique({ where: { id: data.courseId }, select: { id: true } }))) {
    throw new ServiceError("Choose a program that exists.", "courseId");
  }
  return db.announcement.create({ data: { title: data.title, body: data.body, courseId: data.courseId }, select: { id: true } });
}

export async function setAnnouncementActive(actor: SessionUser, id: string, active: boolean) {
  ensureAdmin(actor);
  const { count } = await db.announcement.updateMany({ where: { id }, data: { active } });
  if (!count) throw new ServiceError("This announcement no longer exists.", undefined, "not-found");
}

export async function deleteAnnouncement(actor: SessionUser, id: string) {
  ensureAdmin(actor);
  const { count } = await db.announcement.deleteMany({ where: { id } });
  if (!count) throw new ServiceError("This announcement no longer exists.", undefined, "not-found");
}

/** What a student may read: visible announcements for everyone, plus those aimed at a program they are enrolled in. */
export async function announcementsForStudent(userId: string) {
  const enrollments = await db.enrollment.findMany({
    where: { userId, user: { status: "ACTIVE", role: "STUDENT" } },
    select: { courseId: true },
  });
  return db.announcement.findMany({
    where: { active: true, OR: [{ courseId: null }, { courseId: { in: enrollments.map((e) => e.courseId) } }] },
    orderBy: { createdAt: "desc" },
    take: DASHBOARD_LIMIT,
    select: { id: true, title: true, body: true, createdAt: true },
  });
}
