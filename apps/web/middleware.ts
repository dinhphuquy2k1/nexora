import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get("nexora_session")?.value;

  // Protect workspace routes: redirect to /login if no session cookie
  if (pathname === "/" || pathname === "/system" || pathname === "/settings") {
    if (!sessionToken) {
      const loginUrl = new URL("/login", request.url);
      if (pathname !== "/") {
        loginUrl.searchParams.set("from", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  // If already has session cookie and visiting /login, redirect to /
  if (pathname === "/login") {
    if (sessionToken) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes (/api/*)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
