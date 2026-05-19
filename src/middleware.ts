import { auth } from "@/auth";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/adminAuth";

// Hybrid gate: /admin/* uses its own JWT cookie; everything else goes
// through NextAuth's `auth()` wrapper for the user session.
//
// For /admin we redirect to /admin/login when the admin session is
// missing/invalid. For /dashboard, /generate we redirect to /login.
export default auth(async (req) => {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/admin")) {
    if (path === "/admin/login") return; // public
    const token = req.cookies.get(ADMIN_COOKIE)?.value;
    const session = token ? await verifyAdminToken(token) : null;
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", path);
      return Response.redirect(url);
    }
    return;
  }

  // NextAuth-based gates.
  const isAuthed = !!req.auth;
  const protectedPath = path.startsWith("/dashboard") || path.startsWith("/generate");
  if (protectedPath && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/generate/:path*", "/admin/:path*"],
};
