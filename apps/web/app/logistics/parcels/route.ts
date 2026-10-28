import { type NextRequest, NextResponse } from "next/server.js";

/**
 * Legacy redirect: /logistics/parcels → /shipments/retail
 *
 * HTTP 307 (Temporary Redirect) preserves the HTTP method.
 * Query parameters are forwarded to preserve any filter state in bookmarks.
 *
 * This redirect is intentionally temporary (307) as the canonical
 * route may be updated when the Shipment domain backend is implemented.
 */
export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const qs = searchParams.toString();
  const destination = qs ? `/shipments/retail?${qs}` : "/shipments/retail";
  return NextResponse.redirect(new URL(destination, request.url), {
    status: 307,
  });
}
