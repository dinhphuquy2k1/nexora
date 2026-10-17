import { connect as http2Connect } from "node:http2";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { clearTimeout, setTimeout } from "node:timers";
const WebSocket = globalThis.WebSocket;
import assert from "node:assert/strict";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createSmokeChecks } from "./smoke-checks.mjs";
const checks = createSmokeChecks(console.error, "PUBLIC_HTTPS_SMOKE_FAILED");
let input = "";
for await (const chunk of process.stdin) input += chunk;
let f;
try {
  f = JSON.parse(input);
} catch {
  console.error("Invalid HTTPS fixture input");
  process.exit(1);
}
const ca = await readFile(f.caPath),
  origin = `https://${f.host}:${f.httpsPort}`;
function request(
  path,
  {
    method = "GET",
    headers = {},
    body,
    trust = ca,
    servername = f.host,
    plain = false,
    tlsVersion,
  } = {},
) {
  return new Promise((resolve, reject) => {
    const req = (plain ? httpRequest : httpsRequest)(
      {
        hostname: f.host,
        port: plain ? f.httpPort : f.httpsPort,
        path,
        method,
        servername,
        ca: trust,
        ...(tlsVersion
          ? { minVersion: tlsVersion, maxVersion: tlsVersion, agent: false }
          : {}),
        lookup: (_hostname, options, callback) =>
          options.all
            ? callback(null, [{ address: "127.0.0.1", family: 4 }])
            : callback(null, "127.0.0.1", 4),
        headers: { host: `${f.host}:${f.httpsPort}`, ...headers },
        timeout: 10000,
      },
      (res) => {
        const protocol = res.socket.getProtocol?.();
        let text = "";
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text,
            protocol,
          }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Request timeout")));
    req.end(body);
  });
}
function totp(key) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0,
    value = 0;
  const bytes = [];
  for (const char of key) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + 1));
  const mac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest(),
    offset = mac.at(-1) & 15;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
const profile = await mkdtemp(join(tmpdir(), "nexora-https-browser-"));
let chrome, socket;
try {
  checks.step("STRICT_TLS_CA_AND_HOSTNAME");
  const readiness = await request("/api/health/ready");
  checks.status(readiness.status, 200);
  assert.ok(["TLSv1.2", "TLSv1.3"].includes(readiness.protocol));
  const tls12 = await request("/api/health/live", { tlsVersion: "TLSv1.2" });
  checks.status(tls12.status, 200);
  assert.equal(tls12.protocol, "TLSv1.2");
  assert.equal(readiness.headers["x-content-type-options"], "nosniff");
  assert.equal(readiness.headers["x-frame-options"], "DENY");
  assert.ok(
    readiness.headers["strict-transport-security"].includes("max-age=31536000"),
  );
  await new Promise((resolve, reject) => {
    const h2 = http2Connect(origin, {
      ca,
      servername: f.host,
      lookup: (_host, options, callback) =>
        options.all
          ? callback(null, [{ address: "127.0.0.1", family: 4 }])
          : callback(null, "127.0.0.1", 4),
    });
    h2.on("error", reject);
    h2.setTimeout(10000, () => {
      h2.destroy();
      reject(Error("HTTP2 timeout"));
    });
    const stream = h2.request({ ":path": "/api/health/ready" });
    let status;
    stream.on("response", (headers) => {
      status = headers[":status"];
    });
    stream.resume();
    stream.on("error", reject);
    stream.on("end", () => {
      try {
        assert.equal(status, 200);
        assert.equal(h2.socket.alpnProtocol, "h2");
        h2.close();
        resolve();
      } catch (error) {
        h2.destroy();
        reject(error);
      }
    });
    stream.end();
  });
  await assert.rejects(request("/api/health/ready", { trust: null }), (e) =>
    [
      "SELF_SIGNED_CERT_IN_CHAIN",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    ].includes(e.code),
  );
  await assert.rejects(
    request("/api/health/ready", { servername: "wrong.example.test" }),
    (e) => e.code === "ERR_TLS_CERT_ALTNAME_INVALID",
  );
  const config = JSON.parse(await readFile(f.composePath, "utf8"));
  checks.step("PRIVATE_CONTAINER_EXPOSURE");
  for (const name of ["api", "web", "postgres"])
    assert.equal(config.services[name].ports?.length ?? 0, 0);
  assert.ok(config.networks.backend.internal);
  assert.deepEqual(Object.keys(config.services.ingress.networks), ["ingress"]);
  assert.deepEqual(Object.keys(config.services.postgres.networks), ["backend"]);
  assert.equal(config.services.api.user ?? "", ""); // Image USER remains non-root; no override.
  assert.ok(
    !JSON.stringify(config.services.ingress.volumes).includes("docker.sock"),
  );
  const rawContainers = (await readFile(f.containersPath, "utf8")).trim();
  const containers = rawContainers.startsWith("[")
    ? JSON.parse(rawContainers)
    : rawContainers.split("\n").map((line) => JSON.parse(line));
  const inspected = spawnSync(
    "docker",
    ["inspect", ...containers.map((c) => c.ID)],
    { encoding: "utf8", timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
  );
  assert.equal(inspected.status, 0);
  const actual = JSON.parse(inspected.stdout),
    service = (name) =>
      actual.find(
        (c) => c.Config.Labels["com.docker.compose.service"] === name,
      );
  for (const name of ["api", "web", "postgres"]) {
    const container = service(name);
    assert.ok(container);
    assert.ok(
      Object.values(container.NetworkSettings.Ports ?? {}).every(
        (bindings) => !bindings?.length,
      ),
    );
  }
  assert.ok(
    service("api").Config.User &&
      !["0", "root", "0:0"].includes(service("api").Config.User),
  );
  assert.ok(
    service("api").Mounts.some(
      (m) => m.Destination === "/runtime-config" && !m.RW,
    ),
  );
  assert.equal(
    service("api").Mounts.some((m) => m.Destination === "/config"),
    false,
  );
  assert.equal(
    service("web").Mounts.some((m) =>
      ["/config", "/runtime-config"].includes(m.Destination),
    ),
    false,
  );
  assert.ok(
    Object.values(service("ingress").NetworkSettings.Ports)
      .flat()
      .filter(Boolean)
      .every((binding) => binding.HostIp === "127.0.0.1"),
  );
  assert.equal(
    Object.keys(service("ingress").NetworkSettings.Networks).length,
    1,
  );
  assert.equal(
    Object.keys(service("postgres").NetworkSettings.Networks).length,
    1,
  );
  assert.equal(Object.keys(service("web").NetworkSettings.Networks).length, 2);
  const forged = {
    "x-forwarded-host": "evil.example.test",
    "x-forwarded-proto": "http",
    "x-forwarded-for": "1.2.3.4, invalid",
    forwarded: "for=attacker;host=evil.example.test;proto=http",
  };
  checks.step("HOST_ORIGIN_AND_REDIRECT_POISONING");
  for (const host of [
    "evil.example.test",
    `${f.host}:1`,
    "localhost",
    "0.0.0.0",
    `${f.host}.`,
  ])
    checks.status(
      (await request("/api/health/live", { headers: { host } })).status,
      421,
    );
  const redirect = await request("/settings", { headers: forged });
  checks.status(redirect.status, 307);
  assert.equal(new URL(redirect.headers.location).origin, origin);
  for (const bad of [
    null,
    "null",
    "http://" + f.host,
    origin + "/",
    origin + "?x",
    "https://evil.example.test",
  ]) {
    checks.status(
      (
        await request("/api/auth/mfa/cancel", {
          method: "POST",
          headers: { ...forged, ...(bad === null ? {} : { origin: bad }) },
        })
      ).status,
      403,
    );
  }
  const plain = await request("/api/auth/login", {
    method: "POST",
    plain: true,
  });
  checks.status(plain.status, 308);
  assert.equal(plain.headers["set-cookie"], undefined);
  checks.step("REAL_HTTPS_BROWSER");
  const executable =
    process.env.CHROME_BIN ||
    ["google-chrome", "chromium", "chromium-browser"].find(
      (name) =>
        spawnSync(name, ["--version"], { stdio: "ignore" }).status === 0,
    );
  assert.ok(executable);
  chrome = spawn(
    executable,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      `--ignore-certificate-errors-spki-list=${f.spki}`,
      `--host-resolver-rules=MAP ${f.host} 127.0.0.1, EXCLUDE localhost`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let debugPort;
  for (let i = 0; i < 100; i++) {
    try {
      debugPort = (
        await readFile(join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      break;
    } catch {
      await delay(100);
    }
  }
  assert.ok(debugPort);
  const targets = await (
    await fetch(`http://127.0.0.1:${debugPort}/json`)
  ).json();
  socket = new WebSocket(
    targets.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  let leaked = false,
    setupToken;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const op = pending.get(message.id);
      if (op) {
        pending.delete(message.id);
        clearTimeout(op.timer);
        if (message.error) op.reject(Error("CDP operation failed"));
        else op.resolve(message.result);
      }
    }
    if (message.method === "Network.requestWillBeSent") {
      const req = message.params.request;
      for (const secret of [
        setupToken,
        f.mfaSetupKey,
        ...f.recoveryCodes,
      ].filter(Boolean))
        if (
          req.url.includes(secret) ||
          Object.entries(req.headers).some(
            ([k, v]) =>
              k.toLowerCase() === "referer" && String(v).includes(secret),
          )
        )
          leaked = true;
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const current = ++id;
      const timer = setTimeout(() => {
        pending.delete(current);
        reject(Error("CDP timeout"));
      }, 15000);
      pending.set(current, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: current, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw Error("Browser evaluation failed");
    return r.result.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 100; i++) {
      try {
        if (await evaluate(expression)) return;
      } catch {
        /* actual navigation */
      }
      await delay(100);
    }
    throw Error("Browser condition timeout");
  };
  const type = async (name, value) => {
    await evaluate(`document.querySelector('input[name="${name}"]').focus()`);
    await send("Input.insertText", { text: value });
  };
  await send("Network.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: origin + "/login" });
  await until('!!document.querySelector("input[name=password]")');
  await type("username", f.username);
  await type("password", f.password);
  await evaluate('document.querySelector("button[type=submit]").click()');
  await until('!!document.querySelector("input[name=mfa-code]")');
  assert.equal(await evaluate("location.pathname"), "/login");
  let cookies = (
    await send("Network.getCookies", {
      urls: [origin + "/api/auth/mfa/verify"],
    })
  ).cookies;
  assert.ok(
    cookies.some(
      (c) =>
        c.name === "nexora_mfa_token" &&
        c.secure &&
        c.httpOnly &&
        c.path === "/api/auth/mfa" &&
        c.sameSite === "Strict",
    ),
  );
  assert.equal(
    cookies.some((c) => c.name === "nexora_session"),
    false,
  );
  assert.equal(
    await evaluate('document.cookie.includes("nexora_mfa_token")'),
    false,
  );
  await evaluate(
    'Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Dùng mã khôi phục")).click()',
  );
  await type("mfa-code", f.recoveryCodes[0]);
  await evaluate('document.querySelector("button[type=submit]").click()');
  await until(
    `location.pathname!=="/login" && !!document.querySelector('[aria-label^="Tài khoản người dùng"]')`,
  );
  cookies = (
    await send("Network.getCookies", {
      urls: [origin + "/api/auth/mfa/verify"],
    })
  ).cookies;
  const session = cookies.find((c) => c.name === "nexora_session");
  assert.ok(session?.secure && session.httpOnly && session.sameSite === "Lax");
  assert.equal(
    cookies.some((c) => c.name === "nexora_mfa_token"),
    false,
  );
  const sql = (statement) => {
    const result = spawnSync(
      "docker",
      [
        "compose",
        "-f",
        "compose.yml",
        "-f",
        "compose.public.yml",
        "-f",
        f.overridePath,
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "nexora",
        "-d",
        "nexora",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        statement,
      ],
      { stdio: "pipe", timeout: 15000 },
    );
    if (result.status !== 0)
      throw Object.assign(new Error("Owned SQL fixture failed"), {
        code:
          result.error?.code === "ETIMEDOUT"
            ? "DOCKER_TIMEOUT"
            : "DOCKER_FAILURE",
      });
  };
  checks.step("HTTPS_PASSWORD_ASSURANCE_AND_RECOVERY_REPLAY");
  const adminIdentity = JSON.parse(
    (
      await request("/api/auth/session", {
        headers: { cookie: `nexora_session=${session.value}` },
      })
    ).text,
  ).user.id;
  assert.ok(/^[a-f0-9-]{36}$/i.test(adminIdentity));
  const legacyToken = randomBytes(32).toString("hex"),
    legacyHash = createHash("sha256").update(legacyToken).digest("hex");
  checks.step("OWNED_LEGACY_PASSWORD_SESSION_FIXTURE");
  sql(
    `INSERT INTO sessions(id,user_id,token_hash,expires_at,auth_level) VALUES(gen_random_uuid(),'${adminIdentity}'::uuid,'${legacyHash}',now()+interval '1 day','PASSWORD');`,
  );
  checks.step("HTTPS_PASSWORD_ASSURANCE_AND_RECOVERY_REPLAY");
  checks.status(
    (
      await request("/api/admin/users", {
        headers: { cookie: `nexora_session=${legacyToken}` },
      })
    ).status,
    403,
  );
  const second = await request("/api/auth/login", {
    method: "POST",
    headers: { ...forged, origin, "content-type": "application/json" },
    body: JSON.stringify({ username: f.username, password: f.password }),
  });
  checks.status(second.status, 200);
  const secondPending = second.headers["set-cookie"].find((value) =>
    value.startsWith("nexora_mfa_token="),
  );
  assert.ok(
    secondPending.includes("; Secure") &&
      secondPending.includes("Path=/api/auth/mfa"),
  );
  const secondCookie = secondPending.split(";")[0];
  checks.status(
    (
      await request("/api/auth/mfa/verify", {
        method: "POST",
        headers: {
          origin,
          cookie: secondCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ type: "recovery", code: f.recoveryCodes[0] }),
      })
    ).status,
    401,
  );
  const totpProof = await request("/api/auth/mfa/verify", {
    method: "POST",
    headers: {
      origin,
      cookie: secondCookie,
      "content-type": "application/json",
    },
    body: JSON.stringify({ type: "totp", code: totp(f.mfaSetupKey) }),
  });
  checks.status(totpProof.status, 200);
  const totpSession = totpProof.headers["set-cookie"].find((value) =>
    /^nexora_session=[a-f0-9]{64}/.test(value),
  );
  assert.ok(totpSession.includes("; Secure"));
  checks.status(
    (
      await request("/api/auth/logout", {
        method: "POST",
        headers: { origin, cookie: totpSession.split(";")[0] },
      })
    ).status,
    200,
  );
  const cancel = await request("/api/auth/mfa/cancel", {
    method: "POST",
    headers: { origin, cookie: secondCookie },
  });
  checks.status(cancel.status, 200);
  assert.ok(
    cancel.headers["set-cookie"].some(
      (value) =>
        value.includes("Max-Age=0") &&
        value.includes("; Secure") &&
        value.includes("Path=/api/auth/mfa"),
    ),
  );
  checks.step("CANONICAL_HTTPS_REMOTE_OPERATOR_SETUP");
  const created = await evaluate(
    `fetch("/api/admin/operators",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:"https_operator"})}).then(async r=>({status:r.status,data:await r.json()}))`,
  );
  checks.status(created.status, 201);
  const oldLink = new URL(created.data.setupUrl),
    oldToken = oldLink.hash.slice("#token=".length);
  const reissued = await evaluate(
    `fetch("/api/admin/operators/${created.data.user.id}/setup-link",{method:"POST"}).then(async r=>({status:r.status,data:await r.json()}))`,
  );
  checks.status(reissued.status, 200);
  const link = new URL(reissued.data.setupUrl);
  assert.equal(link.origin, origin);
  assert.equal(link.search, "");
  setupToken = link.hash.slice("#token=".length);
  assert.match(setupToken, /^[a-f0-9]{64}$/);
  const setupAttempt = async (token) =>
    request("/api/auth/setup-password", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ token, password: f.password }),
    });
  checks.status((await setupAttempt(oldToken)).status, 400);
  for (const mode of ["disabled", "expired"]) {
    const extra = await evaluate(
      `fetch("/api/admin/operators",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:"https_${mode}"})}).then(async r=>({status:r.status,data:await r.json()}))`,
    );
    checks.status(extra.status, 201);
    const extraToken = new URL(extra.data.setupUrl).hash.slice(
      "#token=".length,
    );
    if (mode === "disabled")
      checks.status(
        await evaluate(
          `fetch("/api/admin/users/${extra.data.user.id}/status",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status:"DISABLED"})}).then(r=>r.status)`,
        ),
        200,
      );
    else {
      assert.ok(/^[a-f0-9-]{36}$/i.test(extra.data.user.id));
      sql(
        `UPDATE operator_setup_tokens SET expires_at=now()-interval '1 second' WHERE user_id='${extra.data.user.id}'::uuid;`,
      );
    }
    checks.status((await setupAttempt(extraToken)).status, 400);
  }
  // Actual session logout under Secure transport, then remote fragment setup without auto-login.
  checks.status(
    await evaluate(
      'fetch("/api/auth/logout",{method:"POST"}).then(r=>r.status)',
    ),
    200,
  );
  checks.status(
    (
      await request("/api/auth/session", {
        headers: { cookie: `nexora_session=${session.value}` },
      })
    ).status,
    401,
  );
  await send("Page.navigate", { url: reissued.data.setupUrl });
  await until(
    'location.hash==="" && !!document.querySelector("input[name=confirmation]:not(:disabled)")',
  );
  assert.equal(
    await evaluate(
      "JSON.stringify({...localStorage,...sessionStorage}).includes(" +
        JSON.stringify(setupToken) +
        ")",
    ),
    false,
  );
  const setupPage = await request("/setup");
  assert.equal(setupPage.headers["referrer-policy"], "no-referrer");
  assert.ok(!setupPage.text.includes(setupToken));
  await type("password", f.password);
  await type("confirmation", f.password);
  await evaluate('document.querySelector("button[type=submit]").click()');
  await until('location.pathname==="/login"');
  checks.status(
    await evaluate('fetch("/api/auth/session").then(r=>r.status)'),
    401,
  );
  const replay = await evaluate(
    `fetch("/api/auth/setup-password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:${JSON.stringify(setupToken)},password:${JSON.stringify(f.password)}})}).then(r=>r.status)`,
  );
  checks.status(replay, 400);
  await until('!!document.querySelector("input[name=password]")');
  await type("username", "https_operator");
  await type("password", f.password);
  await evaluate('document.querySelector("button[type=submit]").click()');
  await until('location.pathname!=="/login"');
  cookies = (await send("Network.getCookies", { urls: [origin] })).cookies;
  assert.ok(
    cookies.some((c) => c.name === "nexora_session" && c.secure && c.httpOnly),
  );
  assert.equal(leaked, false);
  for (const secret of [setupToken, f.mfaSetupKey, ...f.recoveryCodes])
    assert.equal(
      await evaluate(
        `JSON.stringify({...localStorage,...sessionStorage}).includes(${JSON.stringify(secret)})`,
      ),
      false,
    );
  await writeFile(
    f.sessionPath,
    JSON.stringify({
      token: cookies.find((c) => c.name === "nexora_session").value,
      setupToken,
      host: f.host,
    }),
    { mode: 0o600 },
  );
  checks.step("INGRESS_LIMIT_NOT_BYPASSED_BY_FORWARDING_HEADERS");
  const burst = await Promise.all(
    Array.from({ length: 45 }, (_, i) =>
      request("/api/auth/mfa/cancel", {
        method: "POST",
        headers: {
          origin,
          ...forged,
          "x-forwarded-for": `198.51.100.${i + 1}`,
        },
      }),
    ),
  );
  const limited = burst.filter(
    (r) => r.status === 429 && r.headers["x-nexora-ingress-rate-limit"] === "1",
  );
  assert.ok(limited.length > 0);
  for (const r of limited) {
    assert.equal(JSON.parse(r.text).code, "TOO_MANY_REQUESTS");
    assert.equal(r.headers["cache-control"], "no-store");
    assert.ok(
      r.headers["strict-transport-security"].includes("max-age=31536000"),
    );
    assert.equal(r.headers["x-content-type-options"], "nosniff");
  }
  for (const path of [
    "/api/auth/mfa/cancel/",
    "/api/auth/MFA/CANCEL",
    "/api/auth/mfa//cancel",
    "/api/auth/mfa%2Fcancel",
  ]) {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        request(path, { method: "POST", headers: { origin, ...forged } }),
      ),
    );
    assert.ok(
      responses.some(
        (response) =>
          response.status === 429 &&
          response.headers["x-nexora-ingress-rate-limit"] === "1",
      ),
    );
  }
  checks.status((await request("/api/health/ready")).status, 200);
  console.log(
    "Strict CA/name HTTPS, isolated Chromium leaf pin, Secure MFA/session cookies, real remote setup/replay/privacy, Host/Origin/forwarding and ingress429 PASS",
  );
} catch (error) {
  checks.failure(error);
  process.exitCode = 1;
} finally {
  socket?.close();
  if (chrome) {
    chrome.kill("SIGTERM");
    await new Promise((resolve) => {
      if (chrome.exitCode !== null) resolve();
      else chrome.once("exit", resolve);
    });
  }
  await rm(profile, { recursive: true, force: true });
}
