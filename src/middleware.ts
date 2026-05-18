import { auth } from "@/auth";

// Protect /dashboard and any nested routes. Unauthenticated visitors get
// bounced to /login.
export default auth((req) => {
  const isAuthed = !!req.auth;
  const path = req.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard");
  if (isProtected && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
