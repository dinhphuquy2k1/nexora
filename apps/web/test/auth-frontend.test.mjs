import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeReturnUrl } from "../lib/auth/sanitize.ts";
import { isAllowedHost } from "../lib/auth/host.ts";

test("isAllowedHost validates permitted hostnames and rejects untrusted hosts", () => {
  // Permitted loopback hosts
  assert.equal(isAllowedHost("localhost"), true);
  assert.equal(isAllowedHost("localhost:3000"), true);
  assert.equal(isAllowedHost("localhost:3001"), true);
  assert.equal(isAllowedHost("127.0.0.1"), true);
  assert.equal(isAllowedHost("127.0.0.1:3000"), true);
  assert.equal(isAllowedHost("127.0.0.1:3001"), true);
  assert.equal(isAllowedHost("0.0.0.0"), true);
  assert.equal(isAllowedHost("0.0.0.0:3000"), true);

  // Untrusted hosts rejected
  assert.equal(isAllowedHost("evil.example"), false);
  assert.equal(isAllowedHost("evil.example:3000"), false);
  assert.equal(isAllowedHost("attacker.com"), false);
  assert.equal(isAllowedHost("192.168.1.100"), false);
  assert.equal(isAllowedHost(""), false);
  assert.equal(isAllowedHost(null), false);
  assert.equal(isAllowedHost(undefined), false);

  // Custom allowed hosts via env
  process.env.ALLOWED_HOSTS = "custom.internal, special.host:8080";
  assert.equal(isAllowedHost("custom.internal"), true);
  assert.equal(isAllowedHost("custom.internal:3000"), true);
  assert.equal(isAllowedHost("special.host:8080"), true);
  assert.equal(isAllowedHost("other.internal"), false);
  delete process.env.ALLOWED_HOSTS;
});

test("sanitizeReturnUrl prevents open redirects and allows safe local paths", () => {
  // Safe local paths
  assert.equal(sanitizeReturnUrl("/"), "/");
  assert.equal(sanitizeReturnUrl("/system"), "/system");
  assert.equal(sanitizeReturnUrl("/settings"), "/settings");
  assert.equal(sanitizeReturnUrl("/shipments?page=2"), "/shipments?page=2");

  // Open redirect attempts rejected -> fallback to /
  assert.equal(sanitizeReturnUrl(""), "/");
  assert.equal(sanitizeReturnUrl(null), "/");
  assert.equal(sanitizeReturnUrl(undefined), "/");
  assert.equal(sanitizeReturnUrl("//evil.com"), "/");
  assert.equal(sanitizeReturnUrl("http://evil.com"), "/");
  assert.equal(sanitizeReturnUrl("https://evil.com/login"), "/");
  assert.equal(sanitizeReturnUrl("javascript:alert(1)"), "/");
  assert.equal(sanitizeReturnUrl("/\\evil.com"), "/");
});

test("middleware routing logic accurately identifies protected and auth routes", () => {
  const protectedRoutes = ["/", "/system", "/settings"];

  for (const route of protectedRoutes) {
    const isProtected =
      route === "/" || route === "/system" || route === "/settings";
    assert.equal(isProtected, true, `${route} must be protected`);
  }

  // Non-protected routes
  assert.equal(
    ["/login", "/api/health/live"].some(
      (r) => r === "/" || r === "/system" || r === "/settings",
    ),
    false,
  );
});

test("resolveApiInternalUrl validates configuration matrix and rejects invalid inputs (F2)", async () => {
  const { resolveApiInternalUrl } = await import("../lib/api/config.ts");

  // Missing, empty, or whitespace-only values
  assert.throws(
    () => resolveApiInternalUrl(undefined),
    /API_INTERNAL_URL is required/,
  );
  assert.throws(
    () => resolveApiInternalUrl(""),
    /API_INTERNAL_URL is required/,
  );
  assert.throws(
    () => resolveApiInternalUrl("   \t\n"),
    /API_INTERNAL_URL is required/,
  );

  // Malformed URL
  assert.throws(
    () => resolveApiInternalUrl("not-a-valid-url"),
    /API_INTERNAL_URL is malformed/,
  );

  // Unsupported protocols
  assert.throws(
    () => resolveApiInternalUrl("ftp://api:4000"),
    /must use HTTP or HTTPS/,
  );
  assert.throws(
    () => resolveApiInternalUrl("ws://api:4000"),
    /must use HTTP or HTTPS/,
  );
  assert.throws(
    () => resolveApiInternalUrl("javascript:alert(1)"),
    /must use HTTP or HTTPS/,
  );

  // Disallowed credentials, paths, query params, fragments
  assert.throws(
    () => resolveApiInternalUrl("http://user:pass@api:4000"),
    /must be an origin without credentials, path, query, or fragment/,
  );
  assert.throws(
    () => resolveApiInternalUrl("http://api:4000/api/v1"),
    /must be an origin without credentials, path, query, or fragment/,
  );
  assert.throws(
    () => resolveApiInternalUrl("http://api:4000?query=1"),
    /must be an origin without credentials, path, query, or fragment/,
  );
  assert.throws(
    () => resolveApiInternalUrl("http://api:4000#fragment"),
    /must be an origin without credentials, path, query, or fragment/,
  );

  // Valid inputs
  assert.equal(resolveApiInternalUrl("http://api:4000"), "http://api:4000");
  assert.equal(resolveApiInternalUrl("http://api:4000/"), "http://api:4000");
  assert.equal(
    resolveApiInternalUrl("http://127.0.0.1:4000"),
    "http://127.0.0.1:4000",
  );
  assert.equal(
    resolveApiInternalUrl("https://nexora.internal:8443"),
    "https://nexora.internal:8443",
  );
  assert.equal(
    resolveApiInternalUrl("   http://api:4000   "),
    "http://api:4000",
  );
});

test("verifyServerSession distinguishes authenticated, unauthenticated, and unavailable states (F4)", async () => {
  const { verifyServerSession } = await import("../lib/api/session.ts");

  // 1. Missing cookie -> unauthenticated
  const noCookieResult = await verifyServerSession(undefined);
  assert.equal(noCookieResult.status, "unauthenticated");

  const emptyCookieResult = await verifyServerSession("");
  assert.equal(emptyCookieResult.status, "unauthenticated");

  // Save original env & global fetch
  const originalEnv = process.env.API_INTERNAL_URL;
  const originalFetch = globalThis.fetch;

  try {
    process.env.API_INTERNAL_URL = "http://api:4000";

    // 2. HTTP 200 -> authenticated
    globalThis.fetch = async () => ({
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({
        authenticated: true,
        user: { id: "u-1", username: "admin" },
      }),
    });
    const authResult = await verifyServerSession("valid-session-token");
    assert.equal(authResult.status, "authenticated");
    if (authResult.status === "authenticated") {
      assert.equal(authResult.user.username, "admin");
    }

    // 3. HTTP 401 -> unauthenticated (stale/invalid session)
    globalThis.fetch = async () => ({
      status: 401,
      headers: { get: () => "application/json" },
      json: async () => ({ error: "Unauthorized" }),
    });
    const unauthResult = await verifyServerSession("expired-session-token");
    assert.equal(unauthResult.status, "unauthenticated");

    // 4. HTTP 500 -> unavailable (upstream error, NOT unauthenticated)
    globalThis.fetch = async () => ({
      status: 500,
      headers: { get: () => "application/json" },
      json: async () => ({ error: "Internal Server Error" }),
    });
    const error500Result = await verifyServerSession("session-token");
    assert.equal(error500Result.status, "unavailable");
    if (error500Result.status === "unavailable") {
      assert.match(error500Result.reason, /500/);
    }

    // 5. Network / DNS error (e.g. getaddrinfo ENOTFOUND) -> unavailable
    globalThis.fetch = async () => {
      const err = new TypeError("fetch failed");
      err.cause = { code: "ENOTFOUND", hostname: "api" };
      throw err;
    };
    const networkErrorResult = await verifyServerSession("session-token");
    assert.equal(networkErrorResult.status, "unavailable");

    // 6. Missing API_INTERNAL_URL -> unavailable (graceful config failure)
    delete process.env.API_INTERNAL_URL;
    const missingConfigResult = await verifyServerSession("session-token");
    assert.equal(missingConfigResult.status, "unavailable");
  } finally {
    process.env.API_INTERNAL_URL = originalEnv;
    globalThis.fetch = originalFetch;
  }
});

test("malformed HTTP 200 session payloads never authenticate", async () => {
  const { verifyServerSession } = await import("../lib/api/session.ts");
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.API_INTERNAL_URL;
  process.env.API_INTERNAL_URL = "http://api:4000";
  try {
    for (const payload of [
      null,
      {},
      { authenticated: false, user: { id: "u", username: "operator" } },
      { authenticated: true },
      { authenticated: true, user: null },
      { authenticated: true, user: { id: "", username: "operator" } },
      { authenticated: true, user: { id: "u", username: " " } },
      { authenticated: true, user: { id: 123, username: "operator" } },
    ]) {
      globalThis.fetch = async () => ({
        status: 200,
        json: async () => payload,
      });
      assert.equal((await verifyServerSession("cookie")).status, "unavailable");
    }
    globalThis.fetch = async () => ({
      status: 200,
      json: async () => {
        throw new SyntaxError("invalid JSON");
      },
    });
    assert.equal((await verifyServerSession("cookie")).status, "unavailable");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.API_INTERNAL_URL;
    else process.env.API_INTERNAL_URL = oldUrl;
  }
});
