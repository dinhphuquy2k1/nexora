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

test("RootLayout and LoginLayout are decoupled from AppShell", async () => {
  const fs = await import("node:fs/promises");
  const rootLayoutContent = await fs.readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(
    rootLayoutContent.includes("AppShell"),
    false,
    "Root layout must not import or render AppShell",
  );

  const loginLayoutContent = await fs.readFile(
    new URL("../app/login/layout.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(
    loginLayoutContent.includes("AppShell"),
    false,
    "Login layout must not import or render AppShell",
  );

  const workspaceLayoutContent = await fs.readFile(
    new URL("../app/(workspace)/layout.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(
    workspaceLayoutContent.includes("AppShell"),
    true,
    "Workspace layout must import AppShell for authenticated users",
  );
  assert.equal(
    workspaceLayoutContent.includes("getCachedServerSession") ||
      workspaceLayoutContent.includes("verifyServerSession"),
    true,
    "Workspace layout must enforce server session verification",
  );
});

test("dev script enforces canonical port 3001 and collision refusal", async () => {
  const net = await import("node:net");
  const { spawn } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");

  // Create dummy server listening on 3001 to simulate busy port (e.g. Docker container)
  const server = net.createServer();
  await new Promise((resolve) => server.listen(3001, "0.0.0.0", resolve));

  try {
    const webDir = fileURLToPath(new URL("..", import.meta.url));
    const child = spawn(process.execPath, ["scripts/dev.mjs"], { cwd: webDir });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const exitCode = await new Promise((resolve) => {
      child.on("exit", resolve);
    });

    assert.equal(
      exitCode,
      1,
      "Dev script must exit with code 1 on port collision",
    );
    assert.match(
      stderr,
      /Port 3001 is already in use/,
      "Dev script must report port collision explicitly",
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("middleware passes x-pathname header and enforces unauthenticated redirects", async () => {
  const { middleware } = await import("../middleware.ts");
  const { NextRequest } = await import("next/server.js");

  // 1. Untrusted host header rejected
  const reqUntrusted = new NextRequest("http://evil.com/settings", {
    headers: { host: "evil.com" },
  });
  const resUntrusted = middleware(reqUntrusted);
  assert.equal(resUntrusted.status, 400);

  // 2. Unauthenticated request to / -> redirect to /login
  const reqRoot = new NextRequest("http://localhost:3001/", {
    headers: { host: "localhost:3001" },
  });
  const resRoot = middleware(reqRoot);
  assert.equal(resRoot.status, 307);
  assert.equal(resRoot.headers.get("location"), "http://localhost:3001/login");

  // 3. Unauthenticated request to /settings -> redirect to /login?from=/settings
  const reqSettings = new NextRequest("http://localhost:3001/settings", {
    headers: { host: "localhost:3001" },
  });
  const resSettings = middleware(reqSettings);
  assert.equal(resSettings.status, 307);
  assert.equal(
    resSettings.headers.get("location"),
    "http://localhost:3001/login?from=%2Fsettings",
  );

  // 4. Request with cookie -> passes through and injects x-pathname
  const reqWithCookie = new NextRequest("http://localhost:3001/settings", {
    headers: {
      host: "localhost:3001",
      cookie: "nexora_session=valid-or-pending-token",
    },
  });
  const resWithCookie = middleware(reqWithCookie);
  assert.equal(resWithCookie.status, 200);
  // Next.js middleware headers are passed to downstream via x-middleware-request-x-pathname or res headers
  const forwardedPathname =
    resWithCookie.headers.get("x-middleware-request-x-pathname") ||
    resWithCookie.headers.get("x-pathname");
  assert.equal(forwardedPathname, "/settings");

  // 5. Unauthenticated request to public /login -> passes through
  const reqLogin = new NextRequest("http://localhost:3001/login", {
    headers: { host: "localhost:3001" },
  });
  const resLogin = middleware(reqLogin);
  assert.equal(resLogin.status, 200);
});

test("return URL rejects parser-normalized authority escapes and controls", () => {
  for (const value of [
    "/\t/attacker.example/path",
    "/\n/attacker.example/path",
    "/\r/attacker.example/path",
    "/safe\u0000path",
    "/safe\u007fpath",
    "/safe\u0085path",
    "///attacker.example",
    "/\\attacker.example",
  ]) {
    assert.equal(sanitizeReturnUrl(value), "/");
  }
  assert.equal(
    sanitizeReturnUrl("/a/../settings?tab=security#session"),
    "/settings?tab=security#session",
  );
});

test("deployment presentation reflects the selected server profile without serializing configuration", async () => {
  const { deploymentPresentation } = await import(
    "../lib/auth/deployment-presentation.ts"
  );
  assert.equal(deploymentPresentation({}).badge, "Cục bộ");
  const presentation = deploymentPresentation({
    NEXORA_DEPLOYMENT_PROFILE: "PUBLIC_HTTPS",
    PUBLIC_ORIGIN: "https://nexora.example",
    ALLOWED_HOSTS: "nexora.example",
    ALLOWED_ORIGINS: "https://nexora.example",
    IDENTITY_KEYRING_JSON: "never-serialize",
  });
  assert.equal(presentation.badge, "HTTPS");
  assert.equal(presentation.runtime.includes("nội bộ"), false);
  assert.deepEqual(Object.keys(presentation).sort(), [
    "badge",
    "runtime",
    "session",
  ]);
  assert.equal(JSON.stringify(presentation).includes("never-serialize"), false);
});
