import { getSessionUser } from "@/server/auth/session";
import { checkMaterialAccess } from "@/server/services/access";
import { db } from "@/server/db";
import { getStorage } from "@/server/storage";
import { idSchema } from "@/server/validation/common";

// Study files are never served from a public URL. Every download passes through this check.
const json = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/** RFC 6266 filename: an ASCII fallback plus the UTF-8 original. */
function contentDisposition(kind: "inline" | "attachment", name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: Request, { params }: RouteContext<"/api/materials/[id]/file">) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return json(404, "File not found.");

  const user = await getSessionUser();
  if (!user) return json(401, "Please sign in to open this file.");
  if (user.mustChangePassword) return json(403, "Please change your password first.");

  const access = await checkMaterialAccess(user, id);
  if (!access.exists) return json(404, "File not found.");
  if (!access.allowed) return json(403, "You don't have permission to access this material.");

  const material = await db.material.findUnique({ where: { id }, select: { type: true, fileKey: true, fileName: true, mimeType: true } });
  if (!material || material.type !== "FILE" || !material.fileKey) return json(404, "File not found.");

  const file = await getStorage().get(material.fileKey);
  if (!file) return json(404, "This file is no longer available. Please tell your admin.");

  const forceDownload = new URL(request.url).searchParams.has("download");
  const isPdf = material.mimeType === "application/pdf";
  const isHtml = material.mimeType === "text/html";
  return new Response(file.stream, {
    headers: {
      "Content-Type": isHtml ? "text/html; charset=utf-8" : material.mimeType ?? "application/octet-stream",
      "Content-Length": String(file.size),
      "Content-Disposition": contentDisposition((isPdf || isHtml) && !forceDownload ? "inline" : "attachment", material.fileName ?? "file"),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      // An HTML study guide runs its own scripts (tabs, "mark as read"), so it is locked in a sandbox: a unique
      // origin with no access to StudyHub's cookies, storage or pages, no network requests, no forms, and it may
      // only be framed by StudyHub itself. Fonts and images may still come from the web or be inlined.
      ...(isHtml ? {
        "Content-Security-Policy": [
          "sandbox allow-scripts allow-popups",
          "default-src 'none'",
          "script-src 'unsafe-inline'",
          "style-src 'unsafe-inline' https:",
          "font-src https: data:",
          "img-src https: data:",
          "form-action 'none'",
          "frame-ancestors 'self'",
        ].join("; "),
      } : {}),
    },
  });
}
