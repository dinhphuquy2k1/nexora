import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { dockerCommand } from "./docker-command.mjs";
import {
  createSmokeChecks,
  hostStatus,
  untrustedHostStatus,
} from "./smoke-checks.mjs";
import { totpAtStep } from "./helpers/totp.mjs";
const hash = (token) => createHash("sha256").update(token).digest("hex");
const mfaStepSql =
  "SELECT last_used_step FROM user_mfa WHERE user_id=(SELECT id FROM users WHERE username='browser_user');";
const sessionsSql =
  "SELECT count(*) FROM sessions WHERE user_id=(SELECT id FROM users WHERE username='browser_user');";
function cookie(response, name, { pending = false, clear = false } = {}) {
  const all = response.headers.getSetCookie();
  const rows = all.filter((value) => value.startsWith(name + "="));
  assert.ok(rows.length === 1, "Exactly one scoped cookie");
  const value = rows[0];
  assert.ok(
    value.includes("HttpOnly") && !value.includes("; Secure"),
    "LOCAL HttpOnly cookie transport",
  );
  assert.ok(
    value.includes(pending ? "Path=/api/auth/mfa" : "Path=/"),
    "Cookie path",
  );
  assert.ok(
    value.includes(pending ? "SameSite=Strict" : "SameSite=Lax"),
    "Cookie SameSite",
  );
  assert.ok(
    value.includes(`Max-Age=${clear ? 0 : pending ? 300 : 604800}`),
    "Cookie TTL",
  );
  const pair = value.split(";")[0];
  assert.ok(
    clear ? pair === name + "=" : /^[a-z_]+=[a-f0-9]{64}$/.test(pair),
    "Opaque cookie shape",
  );
  return pair;
}
async function laterStep(previous) {
  const last = Number(previous);
  assert.ok(Number.isSafeInteger(last), "Persisted TOTP step is valid");
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const step = Math.floor(Date.now() / 30000);
    if (step > last) return step;
    await delay(200);
  }
  throw Error("DEV_MFA_NEXT_STEP_TIMEOUT");
}
function requests(baseUrl, origin) {
  return (path, body, credentials) =>
    fetch(baseUrl + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined
          ? {}
          : { "content-type": "application/json", origin }),
        ...(credentials ? { cookie: credentials } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
}
export async function verifyDevelopmentMfa(
  fixture,
  {
    baseUrl,
    origin,
    readState,
    afterRestart = false,
    checks = createSmokeChecks(console.error, "DEV_MFA_HTTP_FAILED"),
  },
) {
  assert.ok(
    fixture.username === "browser_user" &&
      typeof fixture.password === "string" &&
      typeof fixture.mfaSetupKey === "string",
    "Owned enrolled fixture",
  );
  const request = requests(baseUrl, origin),
    prefix = afterRestart ? "RESTART_" : "";
  if (afterRestart) {
    checks.step("RESTART_EXISTING_MFA_SESSION");
    assert.ok(
      typeof fixture.mfaSessionCookie === "string",
      "Prior private session fixture",
    );
    checks.status(
      (await request("/api/auth/session", undefined, fixture.mfaSessionCookie))
        .status,
      200,
    );
    checks.status(
      (await request("/api/admin/users", undefined, fixture.mfaSessionCookie))
        .status,
      200,
    );
  }
  const last = await readState(mfaStepSql),
    sessionCount = await readState(sessionsSql);
  checks.step(prefix + "PASSWORD_CHALLENGE_NO_SESSION");
  const login = await request("/api/auth/login", {
    username: fixture.username,
    password: fixture.password,
  });
  checks.status(login.status, 200);
  assert.ok(
    (await login.json()).mfaRequired === true,
    "ADMIN password creates MFA challenge",
  );
  assert.ok(
    !login.headers
      .getSetCookie()
      .some((value) => /^nexora_session=[a-f0-9]{64};/.test(value)),
    "Password never authenticates ADMIN",
  );
  const pending = cookie(login, "nexora_mfa_token", { pending: true }),
    challengeHash = hash(pending.split("=")[1]);
  checks.status(
    (await request("/api/auth/session", undefined, pending)).status,
    401,
  );
  checks.status(
    (await request("/api/admin/users", undefined, pending)).status,
    401,
  );
  assert.ok(
    (await readState(sessionsSql)) === sessionCount,
    "No session inserted before MFA",
  );
  const validChallenge = `SELECT (consumed_at IS NULL AND expires_at>clock_timestamp())::int FROM mfa_challenges WHERE token_hash='${challengeHash}';`;
  assert.ok(
    (await readState(validChallenge)) === "1",
    "Valid unconsumed pending challenge",
  );
  checks.step(prefix + "FRESH_TOTP_VERIFICATION");
  const step = await laterStep(last);
  const verified = await request(
    "/api/auth/mfa/verify",
    { type: "totp", code: totpAtStep(fixture.mfaSetupKey, step) },
    pending,
  );
  checks.status(verified.status, 200);
  const result = await verified.json();
  assert.ok(
    result.user?.username === fixture.username,
    "Session belongs to enrolled ADMIN fixture",
  );
  const session = cookie(verified, "nexora_session");
  cookie(verified, "nexora_mfa_token", { pending: true, clear: true });
  assert.ok(
    (await readState(
      `SELECT (consumed_at IS NOT NULL)::int FROM mfa_challenges WHERE token_hash='${challengeHash}';`,
    )) === "1",
    "Pending challenge consumed",
  );
  assert.ok(
    Number(await readState(mfaStepSql)) === step,
    "Exact accepted TOTP step persisted",
  );
  checks.step(prefix + "MFA_SESSION_ADMIN_ASSURANCE");
  const authenticated = await request("/api/auth/session", undefined, session);
  checks.status(authenticated.status, 200);
  assert.ok(
    (await authenticated.json()).authenticated === true,
    "Authenticated session after MFA",
  );
  checks.status(
    (await request("/api/admin/users", undefined, session)).status,
    200,
  );
  const sessionHash = hash(session.split("=")[1]);
  assert.ok(
    (await readState(
      `SELECT (s.auth_level='MFA' AND u.role='ADMIN')::int FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash='${sessionHash}';`,
    )) === "1",
    "Persisted ADMIN MFA assurance",
  );
  checks.step(prefix + "REPLAY_WITH_FRESH_CHALLENGE");
  const fresh = await request("/api/auth/login", {
    username: fixture.username,
    password: fixture.password,
  });
  checks.status(fresh.status, 200);
  assert.ok(
    (await fresh.json()).mfaRequired === true,
    "Fresh challenge for replay",
  );
  const replayPending = cookie(fresh, "nexora_mfa_token", { pending: true }),
    replayHash = hash(replayPending.split("=")[1]);
  assert.ok(
    (await readState(
      `SELECT (consumed_at IS NULL AND expires_at>clock_timestamp())::int FROM mfa_challenges WHERE token_hash='${replayHash}';`,
    )) === "1",
    "Replay uses valid fresh challenge",
  );
  assert.ok(
    Math.abs(Math.floor(Date.now() / 30000) - step) <= 1,
    "Replay code still within accepted time window",
  );
  const beforeReplay = await readState(sessionsSql);
  const replay = await request(
    "/api/auth/mfa/verify",
    { type: "totp", code: totpAtStep(fixture.mfaSetupKey, step) },
    replayPending,
  );
  checks.status(replay.status, 401);
  assert.ok(
    (await replay.json()).code === "MFA_VERIFICATION_FAILED",
    "TOTP replay error contract",
  );
  assert.ok(
    !replay.headers
      .getSetCookie()
      .some((value) => /^nexora_session=[a-f0-9]{64};/.test(value)),
    "Replay cannot issue session",
  );
  assert.ok(
    (await readState(sessionsSql)) === beforeReplay &&
      Number(await readState(mfaStepSql)) === step,
    "Replay leaves session/replay state unchanged",
  );
  assert.ok(
    (await readState(
      `SELECT (consumed_at IS NULL)::int FROM mfa_challenges WHERE token_hash='${replayHash}';`,
    )) === "1",
    "Rejected replay cannot consume valid challenge",
  );
  checks.status(
    (await request("/api/auth/mfa/cancel", {}, replayPending)).status,
    200,
  );
  console.log(
    afterRestart
      ? "Dev ADMIN TOTP restart/session/assurance/replay PASS"
      : "Dev ADMIN CLI-enrolled TOTP/challenge/session/assurance/replay PASS",
  );
  return { ...fixture, mfaSessionCookie: session, lastAcceptedStep: step };
}
export async function verifyDevelopmentOriginHost({
  baseUrl,
  explicit = false,
  checks = createSmokeChecks(console.error, "DEV_ORIGIN_HOST_FAILED"),
}) {
  const port = new URL(baseUrl).port,
    local = `http://localhost:${port}`;
  const credentials = {
    username: "dev_smoke_user",
    password: "DevSmokePass123!",
  };
  const attempt = async (origin, status, code) => {
    const headers = {
      "content-type": "application/json",
      ...(origin === undefined ? {} : { origin }),
    };
    const response = await fetch(baseUrl + "/api/auth/login", {
      method: "POST",
      headers,
      body: JSON.stringify(credentials),
      signal: AbortSignal.timeout(10000),
    });
    checks.status(response.status, status);
    assert.ok(
      (await response.json()).code === code,
      "Origin versus authentication result is distinct",
    );
  };
  checks.step(
    explicit ? "EXPLICIT_ORIGIN_REPLACEMENT" : "DERIVED_BROWSER_PORT_ORIGINS",
  );
  await attempt(baseUrl, 403, "MFA_ENROLLMENT_REQUIRED");
  await attempt(local, 403, explicit ? "FORBIDDEN" : "MFA_ENROLLMENT_REQUIRED");
  for (const origin of [
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3000",
    "http://untrusted.fixture",
    undefined,
    "null",
    baseUrl + "/path",
  ])
    await attempt(origin, 403, "FORBIDDEN");
  checks.step("CUSTOM_LOCAL_HOST");
  checks.status(
    await hostStatus(baseUrl + "/api/health/live", "nexora-dev.fixture"),
    200,
  );
  checks.status(await untrustedHostStatus(baseUrl + "/api/health/live"), 400);
  console.log(
    explicit
      ? "Dev explicit Origin replacement/custom Host/negative policy PASS"
      : "Dev custom-port derived Origin/custom Host/negative policy PASS",
  );
}
async function main() {
  const checks = createSmokeChecks(console.error, "DEV_MFA_HTTP_FAILED");
  try {
    const [path, mode] = process.argv.slice(2);
    assert.ok(
      path &&
        [
          undefined,
          "--after-restart",
          "--origin-derived",
          "--origin-explicit",
        ].includes(mode),
      "Fixed dev smoke invocation",
    );
    const binding = process.env.WEB_PORT || "127.0.0.1:3001",
      baseUrl = `http://127.0.0.1:${binding.split(":").at(-1)}`;
    if (mode?.startsWith("--origin-")) {
      await verifyDevelopmentOriginHost({
        baseUrl,
        explicit: mode === "--origin-explicit",
        checks,
      });
      return;
    }
    assert.ok(
      ((await stat(path)).mode & 0o777) === 0o600,
      "Private fixture mode0600",
    );
    const fixture = JSON.parse(await readFile(path, "utf8"));
    const compose = [
      "compose",
      "-f",
      "compose.yml",
      "-f",
      "compose.dev.yml",
      ...(process.env.NEXORA_COMPOSE_OVERRIDE
        ? ["-f", process.env.NEXORA_COMPOSE_OVERRIDE]
        : []),
    ];
    const readState = async (data) => {
      assert.ok(data.startsWith("SELECT "), "Read-only MFA evidence SQL");
      const r = await dockerCommand(
        [
          ...compose,
          "exec",
          "-T",
          "postgres",
          "psql",
          "-U",
          "nexora",
          "-d",
          "nexora",
          "-At",
          "-v",
          "ON_ERROR_STOP=1",
        ],
        { data, timeout: 20000 },
      );
      assert.ok(r.code === 0, "Read-only owned MFA evidence query");
      return r.stdout.trim();
    };
    const next = await verifyDevelopmentMfa(fixture, {
      baseUrl,
      origin: baseUrl,
      readState,
      afterRestart: mode === "--after-restart",
      checks,
    });
    await writeFile(path, JSON.stringify(next), { mode: 0o600 });
  } catch (error) {
    checks.failure(error);
    process.exitCode = 1;
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
