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
      (error) =>
        error
          ? reject(new Error("Disposable Compose operation failed"))
          : resolve(),
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
  assert.equal((await request("/api/health/live")).status, 200);
  assert.equal((await request("/api/health/ready")).status, 200);
  assert.equal(
    (await request("/api/health/live", { headers: { host: "evil.example" } }))
      .status,
    400,
  );
  for (const cookie of [
    undefined,
    "nexora_session=" + "a".repeat(64),
    "nexora_session=%E0%A4%A",
  ]) {
    assert.equal(
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
    assert.equal((await login(credentials, { origin: badOrigin })).status, 403);
  }
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(credentials),
      })
    ).status,
    403,
  );
  await run([
    "exec",
    "-T",
    "api",
    "node",
    "-e",
    "fetch('http://127.0.0.1:4000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(r=>{if(r.status!==403)process.exit(1)})",
  ]);
  for (const payload of [
    null,
    [],
    {},
    { username: 123, password: "password" },
    { username: "smoke_user", password: null },
    { username: "smoke_user", password: {} },
  ]) {
    const response = await login(payload);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "VALIDATION_ERROR");
  }
  assert.equal(
    (await login({ ...credentials, password: "wrongpassword" })).status,
    401,
  );
  const response = await login(credentials, {
    "x-forwarded-proto": "https",
    "x-forwarded-for": "203.0.113.99",
  });
  assert.equal(response.status, 200);
  let cookie = cookieFrom(response);
  let session = await request("/api/auth/session", { headers: { cookie } });
  assert.equal(session.status, 200);
  const data = await session.json();
  assert.equal(data.authenticated, true);
  assert.equal(data.user.username, credentials.username);
  assert.ok(data.user.id);
  const redirect = await request("/login?from=%2Fsettings", {
    headers: { cookie },
    redirect: "manual",
  });
  assert.equal(redirect.status, 307);
  assert.equal(redirect.headers.get("location"), "/settings");
  await run(["restart", "api"]);
  await waitReady();
  assert.equal(
    (await request("/api/auth/session", { headers: { cookie } })).status,
    200,
  );
  await run(["stop", "postgres"]);
  const failedLogout = await request("/api/auth/logout", {
    method: "POST",
    headers: { cookie, origin },
  });
  assert.equal(
    failedLogout.status,
    500,
    "Database outage must be an API failure, not proxy failure or false success",
  );
  assert.equal(failedLogout.headers.get("set-cookie"), null);
  assert.equal((await failedLogout.json()).code, "INTERNAL_ERROR");
  await run(["start", "postgres"]);
  await waitReady();
  assert.equal(
    (await request("/api/auth/session", { headers: { cookie } })).status,
    200,
  );
  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: { cookie, origin, "x-forwarded-proto": "https" },
  });
  assert.equal(logout.status, 200);
  const clearing = logout.headers.get("set-cookie");
  assert.ok(clearing?.includes("Max-Age=0") && !clearing.includes("; Secure"));
  assert.equal(
    (await request("/api/auth/session", { headers: { cookie } })).status,
    401,
  );
  assert.equal(
    (
      await request("/api/auth/logout", {
        method: "POST",
        headers: { cookie, origin },
      })
    ).status,
    200,
  );
  const expiring = await login(credentials);
  assert.equal(expiring.status, 200);
  cookie = cookieFrom(expiring);
  // Controlled expiry data belongs only to this script's disposable database.
  await run(
    ["exec", "-T", "api", "sh", "/scripts/api-entrypoint.sh", "node"],
    `const {createDatabase}=require('@nexora/database'); (async()=>{const db=createDatabase(process.env.DATABASE_URL);try{await db.session.updateMany({where:{user:{username:'smoke_user'}},data:{expiresAt:new Date(0)}});}finally{await db.$disconnect();}})().catch(()=>process.exit(1));`,
  );
  assert.equal(
    (await request("/api/auth/session", { headers: { cookie } })).status,
    401,
  );
  console.log(
    "Real proxy Origin/payload/cookie/session/expiry/restart/logout-outage security PASS",
  );
} catch {
  console.error(
    "Authentication runtime smoke failed; credentials and cookies withheld.",
  );
  process.exitCode = 1;
}
