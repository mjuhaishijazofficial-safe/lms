import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

// Fast path only: reject requests that carry no session cookie at all.
// Real authentication and role checks happen server-side in every page, action and route (see server/auth/guards).
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  // API clients get a status code they can act on; browsers get sent to the login page.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/change-password", "/admin/:path*", "/dashboard/:path*", "/courses/:path*", "/subjects/:path*", "/materials/:path*",
    "/recent/:path*", "/bookmarks/:path*", "/profile/:path*", "/search/:path*", "/api/materials/:path*",
  ],
};
