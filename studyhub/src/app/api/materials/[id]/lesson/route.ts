import { getSessionUser } from "@/server/auth/session";
import { checkMaterialAccess } from "@/server/services/access";
import { db } from "@/server/db";
import { idSchema } from "@/server/validation/common";
import { parseLesson } from "@/server/materials/lesson-sanitize";
import { lessonToHtml } from "@/server/materials/lesson-html";

// The downloadable lesson is built on request from the stored content, behind the same permission check as
// every other study file. It is never a public URL.
const json = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/** A safe download name: letters and numbers only, so no header can be broken by a title. */
const fileNameFor = (title: string) => {
  const stem = title.normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `${stem || "lesson"}.html`;
};

export async function GET(_request: Request, { params }: RouteContext<"/api/materials/[id]/lesson">) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return json(404, "Lesson not found.");

  const user = await getSessionUser();
  if (!user) return json(401, "Please sign in to download this lesson.");
  if (user.mustChangePassword) return json(403, "Please change your password first.");

  const access = await checkMaterialAccess(user, id);
  if (!access.exists) return json(404, "Lesson not found.");
  if (!access.allowed) return json(403, "You don't have permission to access this material.");

  const material = await db.material.findUnique({
    where: { id },
    select: {
      type: true, title: true, lessonData: true,
      chapter: { select: { title: true, subject: { select: { name: true } } } },
    },
  });
  if (!material || material.type !== "LESSON" || !material.lessonData) return json(404, "Lesson not found.");

  // Stored content was sanitised on the way in, and is checked again here because this file leaves the app.
  const parsed = parseLesson(material.lessonData);
  if (!parsed.ok) return json(500, "This lesson could not be prepared. Please tell your admin.");

  // The chapter is what the student knows this by ("Lesson 4: Dimensions of Bilinguality"); every lesson's material is
  // simply called "Study guide", which would make every download look the same.
  const title = material.chapter.title || material.title;
  const html = lessonToHtml(parsed.lesson, { title, subject: material.chapter.subject.name });

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileNameFor(title)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      // If the file is ever opened straight from the browser, it still cannot load or send anything anywhere.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:",
    },
  });
}
