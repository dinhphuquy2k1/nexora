import { NextResponse, type NextRequest } from "next/server";
import { isAllowedHost } from "./lib/auth/host.ts";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  if (!isAllowedHost(host)) {
    return new NextResponse("Invalid Host header", { status: 400 });
  }

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths including /api/* except for static assets:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
