import { getSessionUser } from "@/server/auth/session";
import { checkMaterialAccess } from "@/server/services/access";
import { db } from "@/server/db";
import { idSchema } from "@/server/validation/common";
import { safeExternalUrl } from "@/lib/media";

const json = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Sends the student to an external link material. The click is checked first (signed in, allowed to see this
 * material) and the address is re-validated, so only real http(s) links are ever redirected to.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/materials/[id]/open">) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return json(404, "Link not found.");

  const user = await getSessionUser();
  if (!user) return json(401, "Please sign in to open this link.");
  if (user.mustChangePassword) return json(403, "Please change your password first.");

  const access = await checkMaterialAccess(user, id);
  if (!access.exists) return json(404, "Link not found.");
  if (!access.allowed) return json(403, "You don't have permission to access this material.");

  const material = await db.material.findUnique({ where: { id }, select: { type: true, externalUrl: true } });
  const target = material?.type === "LINK" && material.externalUrl ? safeExternalUrl(material.externalUrl) : null;
  if (!target) return json(404, "Link not found.");

  return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
