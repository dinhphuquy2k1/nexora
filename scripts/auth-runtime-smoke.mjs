import { createSmokeChecks, untrustedHostStatus } from "./smoke-checks.mjs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const binding = process.env.WEB_PORT || "127.0.0.1:3001";
const port = binding.split(":").at(-1);
const baseUrl = `http://127.0.0.1:${port}`;
const origin = baseUrl;
const compose = [
  "compose",
  "-f",
  "compose.yml",
  ...(process.env.NEXORA_COMPOSE_OVERRIDE
    ? ["-f", process.env.NEXORA_COMPOSE_OVERRIDE]
    : []),
];
const run = (args, input) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      "docker",
      [...compose, ...args],
      { timeout: 60000 },
      (error, stdout) =>
        error
          ? reject(
              Object.assign(new Error("Disposable Compose operation failed"), {
                code: error.killed ? "DOCKER_TIMEOUT" : "DOCKER_FAILURE",
              }),
            )
          : resolve(stdout),
    );
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
const request = (path, options = {}) =>
  fetch(baseUrl + path, { ...options, signal: AbortSignal.timeout(10000) });
const login = (payload, headers = {}) =>
  request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin, ...headers },
    body: JSON.stringify(payload),
  });
const checks = createSmokeChecks();
const credentials = { username: "smoke_user", password: "SmokeTestPass123!" };
const cookieFrom = (response) => {
  const cookie = response.headers.get("set-cookie");
  assert.ok(
    cookie?.includes("HttpOnly") &&
      cookie.includes("SameSite=Lax") &&
      cookie.includes("Path=/"),
    "Session cookie attributes missing",
  );
  assert.ok(
    !cookie.includes("; Secure"),
    "Forwarding headers changed local HTTP cookie policy",
  );
  const match = /nexora_session=([^;]+)/.exec(cookie);
  assert.ok(match, "Session cookie missing");
  return `nexora_session=${match[1]}`;
};
const waitReady = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await request("/api/health/ready")).status === 200) return;
    } catch {
      /* retry only disposable startup */
    }
    await delay(1000);
  }
  throw new Error("Disposable runtime did not recover");
};

try {
  checks.step("HEALTH_LIVE");
  checks.status((await request("/api/health/live")).status, 200);
  checks.step("HEALTH_READY");
  checks.status((await request("/api/health/ready")).status, 200);
  checks.step("HOST_REJECTION");
  checks.status(await untrustedHostStatus(baseUrl + "/api/health/live"), 400);
  for (const cookie of [
    undefined,
    "nexora_session=" + "a".repeat(64),
    "nexora_session=%E0%A4%A",
  ]) {
    checks.step(
      cookie === undefined
        ? "SESSION_MISSING_COOKIE"
        : cookie.endsWith("%E0%A4%A")
          ? "SESSION_MALFORMED_COOKIE"
          : "SESSION_FAKE_TOKEN",
    );
    checks.status(
      (
        await request("/api/auth/session", {
          headers: cookie ? { cookie } : {},
        })
      ).status,
      401,
    );
  }
  for (const badOrigin of [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:9999",
    "http://attacker.example",
    "null",
    origin + "/path",
  ]) {
    checks.step(
      badOrigin.includes("attacker.example")
        ? "ORIGIN_UNTRUSTED_DOMAIN"
        : badOrigin === "null"
          ? "ORIGIN_NULL"
          : badOrigin.includes("/path")
            ? "ORIGIN_INVALID_SERIALIZATION"
            : "ORIGIN_WRONG_PORT",
    );
    checks.status(
      (await login(credentials, { origin: badOrigin })).status,
      403,
    );
  }
  checks.step("ORIGIN_MISSING");
  checks.status(
    (
      await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(credentials),
      })
    ).status,
    403,
  );
  checks.step("ORIGIN_INTERNAL_POST");
  const internalStatus = await run([
    "exec",
    "-T",
    "api",
    "node",
    "-e",
    "fetch('http://127.0.0.1:4000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(r=>console.log(r.status)).catch(()=>process.exit(1))",
  ]);
  checks.status(Number(internalStatus.trim()), 403);
  for (const payload of [
    null,
    [],
    {},
    { username: 123, password: "password" },
    { username: "smoke_user", password: null },
    { username: "smoke_user", password: {} },
  ]) {
    checks.step("LOGIN_INVALID_PAYLOAD");
    const response = await login(payload);
    checks.status(response.status, 400);
    assert.equal((await response.json()).code, "VALIDATION_ERROR");
  }
  checks.step("LOGIN_INVALID_PASSWORD");
  checks.status(
    (await login({ ...credentials, password: "wrongpassword" })).status,
    401,
  );
  checks.step("LOGIN_VALID_PASSWORD");
  const response = await login(credentials, {
    "x-forwarded-proto": "https",
    "x-forwarded-for": "203.0.113.99",
  });
  checks.status(response.status, 200);
  let cookie = cookieFrom(response);
  checks.step("SESSION_VALID");
  const session = await request("/api/auth/session", { headers: { cookie } });
  checks.status(session.status, 200);
  const data = await session.json();
  assert.equal(data.authenticated, true);
  assert.equal(data.user.username, credentials.username);
  assert.ok(data.user.id);
  checks.step("LOGIN_VALID_SESSION_REDIRECT");
  const redirect = await request("/login?from=%2Fsettings", {
    headers: { cookie },
    redirect: "manual",
  });
  checks.status(redirect.status, 307);
  assert.equal(redirect.headers.get("location"), "/settings");
  checks.step("API_RESTART_READINESS");
  await run(["restart", "api"]);
  await waitReady();
  checks.step("SESSION_AFTER_API_RESTART");
  checks.status(
    (await request("/api/auth/session", { headers: { cookie } })).status,
    200,
  );
  checks.step("DATABASE_STOP");
  await run(["stop", "postgres"]);
  checks.step("LOGOUT_DATABASE_OUTAGE");
  const failedLogout = await request("/api/auth/logout", {
    method: "POST",
    headers: { cookie, origin },
  });
  checks.status(
    failedLogout.status,
    500,
    "Database outage must be an API failure, not proxy failure or false success",
  );
  assert.equal(failedLogout.headers.get("set-cookie"), null);
  assert.equal((await failedLogout.json()).code, "INTERNAL_ERROR");
  checks.step("DATABASE_RECOVERY_READINESS");
  await run(["start", "postgres"]);
  await waitReady();
  checks.step("SESSION_AFTER_DATABASE_RECOVERY");
  checks.status(
    (await request("/api/auth/session", { headers: { cookie } })).status,
    200,
  );
  checks.step("LOGOUT_SUCCESS");
  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: { cookie, origin, "x-forwarded-proto": "https" },
  });
  checks.status(logout.status, 200);
  const clearing = logout.headers.get("set-cookie");
  assert.ok(clearing?.includes("Max-Age=0") && !clearing.includes("; Secure"));
  checks.step("SESSION_REVOKED");
  checks.status(
    (await request("/api/auth/session", { headers: { cookie } })).status,
    401,
  );
  checks.step("LOGOUT_IDEMPOTENT");
  checks.status(
    (
      await request("/api/auth/logout", {
        method: "POST",
        headers: { cookie, origin },
      })
    ).status,
    200,
  );
  checks.step("LOGIN_FOR_EXPIRY");
  const expiring = await login(credentials);
  checks.status(expiring.status, 200);
  cookie = cookieFrom(expiring);
  checks.step("SESSION_EXPIRY_SETUP");
  // Controlled expiry data belongs only to this script's disposable database.
  await run(
    ["exec", "-T", "api", "sh", "/scripts/api-entrypoint.sh", "node"],
    `const {createDatabase}=require('@nexora/database'); (async()=>{const db=createDatabase(process.env.DATABASE_URL);try{await db.session.updateMany({where:{user:{username:'smoke_user'}},data:{expiresAt:new Date(0)}});}finally{await db.$disconnect();}})().catch(()=>process.exit(1));`,
  );
  checks.step("SESSION_EXPIRED");
  checks.status(
    (await request("/api/auth/session", { headers: { cookie } })).status,
    401,
  );
  console.log(
    "Real proxy Origin/payload/cookie/session/expiry/restart/logout-outage security PASS",
  );
} catch (error) {
  checks.failure(error);
  process.exitCode = 1;
}
