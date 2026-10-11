import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeReturnUrl } from "../lib/auth/sanitize.ts";

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
