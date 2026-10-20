import { RETAIL_ROUTE } from "./lib/navigation/nav-config.ts";
import { loadDeploymentPolicy } from "@nexora/shared";
import { NextResponse, type NextRequest } from "next/server.js";
import { sanitizeReturnUrl } from "./lib/auth/sanitize.ts";
import { isAllowedHost } from "./lib/auth/host.ts";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  if (!isAllowedHost(host)) {
    return new NextResponse("Invalid Host header", { status: 400 });
  }

  const { pathname } = request.nextUrl;
  const workspaceReturn = sanitizeReturnUrl(
    pathname === RETAIL_ROUTE || pathname.startsWith(`${RETAIL_ROUTE}/`)
      ? pathname + request.nextUrl.search
      : pathname,
  );
  const sessionToken = request.cookies.get("nexora_session")?.value;

  // Protect workspace routes: redirect to /login if no session cookie
  if (
    pathname === "/" ||
    pathname === "/system" ||
    pathname === "/settings" ||
    pathname === RETAIL_ROUTE ||
    pathname.startsWith(`${RETAIL_ROUTE}/`)
  ) {
    if (!sessionToken) {
      const loginUrl = new URL(
        "/login",
        loadDeploymentPolicy(process.env).publicOrigin ?? request.url,
      );
      if (pathname !== "/") {
        loginUrl.searchParams.set("from", workspaceReturn);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  // Forward request with x-pathname header so Server Components/Layouts know the route
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", workspaceReturn);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
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
