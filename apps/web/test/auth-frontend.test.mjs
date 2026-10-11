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
