import { browserStartupSummary } from "./browser-startup-diagnostics.mjs";
import { verifyCustomerBrowser } from "./customer-browser-checks.mjs";
import { verifyM1Visuals } from "./m1-visual-checks.mjs";
import { createHmac } from "node:crypto";
import { URLSearchParams } from "node:url";
// One dependency-free Chromium DevTools test for the real browser Login form.
// Credentials arrive via stdin, never command-line arguments or diagnostic output.
import { clearTimeout } from "node:timers";
const WebSocket = globalThis.WebSocket;
import { createSmokeChecks } from "./smoke-checks.mjs";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const checks = createSmokeChecks(console.error, "BROWSER_LOGIN_SMOKE_FAILED");
let input = "";
for await (const chunk of process.stdin) input += chunk;
const { baseUrl, username, password, mfaSetupKey, recoveryCodes } =
  JSON.parse(input);
function totp(key, offset = 0) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0,
    v = 0,
    bytes = [];
  for (const c of key) {
    v = (v << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((v >>> bits) & 255);
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const mac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest(),
    at = mac.at(-1) & 15;
  return String((mac.readUInt32BE(at) & 0x7fffffff) % 1000000).padStart(6, "0");
}
checks.step("BROWSER_BINARY");
const executable =
  process.env.CHROME_BIN ||
  ["google-chrome", "chromium", "chromium-browser"].find(
    (name) => spawnSync(name, ["--version"], { stdio: "ignore" }).status === 0,
  );
if (!executable) {
  checks.failure(
    new Error(
      "Chromium/Chrome is required for actual Login form verification.",
    ),
  );
  process.exit(1);
}
const profile = await mkdtemp(join(tmpdir(), "nexora-browser-"));
const child = spawn(
  executable,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
let startupStderr = "";
let collectingStartup = true;
child.stderr.on("data", (chunk) => {
  if (collectingStartup)
    startupStderr = (startupStderr + chunk.toString("utf8")).slice(-16384);
});
const exited = new Promise((resolve) => {
  child.once("exit", resolve);
  child.once("error", resolve);
});
let socket;
let restartMfaSession;
try {
  checks.step("BROWSER_LAUNCH");
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = (
        await readFile(join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      break;
    } catch {
      await delay(100);
    }
  }
  collectingStartup = false;
  if (!port) {
    console.error(
      "BROWSER_STARTUP_DIAGNOSTIC",
      JSON.stringify(browserStartupSummary(startupStderr, child)),
    );
  }
  startupStderr = "";
  assert.ok(port, "Browser did not start");
  checks.step("CDP_CONNECTION");
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(
    (res) => res.json(),
  );
  socket = new WebSocket(
    targets.find((target) => target.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  let setupSecret;
  let setupStatus;
  let leakedSetupSecret = false;
  let pausedMfa;
  let mfaStatus;
  let cancelStatus;
  const cookieRequests = new Map(),
    requestUrls = new Map();
  let loginStatus;
  let loginUrl;
  let hydrationMismatchCount = 0;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (
      message.method === "Runtime.consoleAPICalled" &&
      message.params.type === "error"
    ) {
      const text = message.params.args
        .map((arg) => arg.value ?? arg.description ?? "")
        .filter((value) => typeof value === "string")
        .join(" ");
      if (
        /A tree hydrated but some attributes|Hydration failed because|server rendered HTML didn.t match|Text content does not match server-rendered HTML/i.test(
          text,
        )
      )
        hydrationMismatchCount++;
    }
    if (message.id) {
      const operation = pending.get(message.id);
      if (operation) {
        pending.delete(message.id);
        if (message.error)
          operation.reject(new Error("Browser command failed"));
        else operation.resolve(message.result);
      }
    }
    if (message.method === "Network.requestWillBeSentExtraInfo") {
      const header =
        Object.entries(message.params.headers).find(
          ([key]) => key.toLowerCase() === "cookie",
        )?.[1] ?? "";
      cookieRequests.set(message.params.requestId, {
        pending: String(header).includes("nexora_mfa_token="),
        session: String(header).includes("nexora_session="),
      });
    }
    if (message.method === "Fetch.requestPaused")
      pausedMfa = message.params.requestId;
    if (message.method === "Network.requestWillBeSent") {
      const request = message.params.request;
      requestUrls.set(message.params.requestId, request.url);
      const secrets = [
        setupSecret,
        mfaSetupKey,
        ...(recoveryCodes ?? []),
      ].filter((value) => typeof value === "string" && value.length);
      if (
        secrets.some(
          (secret) =>
            request.url.includes(secret) ||
            Object.entries(request.headers).some(
              ([key, value]) =>
                key.toLowerCase() === "referer" &&
                String(value).includes(secret),
            ),
        )
      )
        leakedSetupSecret = true;
    }

    if (
      message.method === "Network.responseReceived" &&
      message.params.response.url === `${baseUrl}/api/auth/setup-password`
    )
      setupStatus = message.params.response.status;
    if (
      message.method === "Network.responseReceived" &&
      message.params.response.url === `${baseUrl}/api/auth/mfa/verify`
    )
      mfaStatus = message.params.response.status;
    if (
      message.method === "Network.responseReceived" &&
      message.params.response.url === `${baseUrl}/api/auth/mfa/cancel`
    )
      cancelStatus = message.params.response.status;
    if (
      message.method === "Network.responseReceived" &&
      message.params.response.url === `${baseUrl}/api/auth/login`
    ) {
      loginStatus = message.params.response.status;
      loginUrl = message.params.response.url;
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const current = ++id;
      const timer = setTimeout(() => {
        pending.delete(current);
        reject(new Error("Browser command timeout"));
      }, 15000);
      pending.set(current, {
        resolve(value) {
          clearTimeout(timer);
          resolve(value);
        },
        reject(error) {
          clearTimeout(timer);
          reject(error);
        },
      });
      socket.send(JSON.stringify({ id: current, method, params }));
    });
  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      const desc =
        res.exceptionDetails.exception?.description ||
        res.exceptionDetails.text ||
        "Browser evaluation failed";
      const err = new Error(`Browser evaluation failed: ${desc}`);
      err.code = "PROTOCOL_EXCEPTION";
      throw err;
    }
    return res.result?.value;
  };
  checks.step("LOGIN_PAGE_RENDER");
  await send("Network.enable");
  await send("Runtime.enable");
  await send("Page.bringToFront");
  await send("Page.navigate", { url: `${baseUrl}/login?from=%2Fsettings` });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    ready = await evaluate(
      '!!document.querySelector("input[name=username]") && !!document.querySelector("input[name=password]")',
    );
    if (ready) break;
    await delay(100);
  }
  assert.ok(ready, "Login form did not render");
  checks.step("LOGIN_STANDALONE_LAYOUT");
  const hasShell = await evaluate(
    '!!document.querySelector("header[aria-label=\'Thanh công cụ đầu trang\']") || !!document.querySelector("aside")',
  );
  assert.equal(
    hasShell,
    false,
    "Login page must not render authenticated AppShell",
  );

  await verifyM1Visuals({
    send,
    evaluate,
    phase: "login",
    prefix: mfaSetupKey ? "admin" : "operator",
  });
  checks.step("UNIFIED_LOCAL_FORM");
  assert.equal(
    await evaluate("!!document.querySelector(\"a[href*='mode=admin']\")"),
    false,
  );
  checks.step("UNAUTHENTICATED_WORKSPACE_REDIRECT");
  await send("Page.navigate", { url: `${baseUrl}/settings` });
  let unauthRedirected = false;
  for (let i = 0; i < 100; i++) {
    const curPath = await evaluate("window.location.pathname");
    if (curPath === "/login") {
      unauthRedirected = true;
      break;
    }
    await delay(100);
  }
  assert.ok(
    unauthRedirected,
    "Unauthenticated navigation to /settings must redirect to /login",
  );

  checks.step("ADMIN_MODE_SWITCH_AND_FORM");
  await send("Page.navigate", {
    url: `${baseUrl}/login?from=%2Fsettings`,
  });
  let adminReady = false;
  for (let i = 0; i < 100; i++) {
    adminReady = await evaluate(
      '!!document.querySelector("input[name=username]") && !!document.querySelector("input[name=password]")',
    );
    if (adminReady) break;
    await delay(100);
  }
  assert.ok(adminReady, "Admin login form did not render");
  await delay(500);
  await evaluate('document.querySelector("input[name=username]").focus()');
  await send("Input.insertText", { text: username });
  await evaluate('document.querySelector("input[name=password]").focus()');
  await send("Input.insertText", { text: password });
  let m1OverflowBefore;
  if (process.env.M1_EVIDENCE_DIR && mfaSetupKey) {
    // Controlled real-React unmount race: leave help modal open during the
    // existing real password submit, then MFA replaces the password subtree.
    // No screenshots are taken while credential inputs contain values.
    m1OverflowBefore = await evaluate("document.body.style.overflow");
    await evaluate(
      'Array.from(document.querySelectorAll("button")).find(e=>e.textContent.includes("Quên mật khẩu")).click()',
    );
    let open = false;
    for (let i = 0; i < 100; i++) {
      open = await evaluate(
        '!!document.querySelector("dialog[open]") && document.body.style.overflow==="hidden"',
      );
      if (open) break;
      await delay(100);
    }
    assert.ok(
      open,
      "M1 help modal must be mounted before the unmount regression",
    );
  }
  loginStatus = undefined;
  loginUrl = undefined;
  await evaluate('document.querySelector("button[type=submit]").click()');
  if (mfaSetupKey) {
    checks.step("ADMIN_MFA_PENDING");
    let ready = false;
    for (let i = 0; i < 100; i++) {
      ready = await evaluate(
        '!!document.querySelector("input[name=mfa-code]")',
      );
      if (ready) break;
      await delay(100);
    }
    assert.ok(ready, "MFA step missing");
    if (m1OverflowBefore !== undefined) {
      for (let i = 0; i < 100; i++) {
        if (
          await evaluate(
            '!document.querySelector("dialog[open]") && document.body.style.overflow!=="hidden"',
          )
        )
          break;
        await delay(100);
      }
      assert.equal(
        await evaluate("document.body.style.overflow"),
        m1OverflowBefore,
        "MFA transition unmount restores body scroll",
      );
      assert.equal(
        await evaluate('!!document.querySelector("dialog[open]")'),
        false,
      );
    }
    await verifyM1Visuals({ send, evaluate, phase: "mfa", prefix: "admin" });
    assert.equal(await evaluate("location.pathname"), "/login");
    assert.equal(
      (await send("Network.getCookies", { urls: [baseUrl] })).cookies.some(
        (c) => c.name === "nexora_session",
      ),
      false,
    );
    const pendingCookies = (
      await send("Network.getCookies", {
        urls: [baseUrl + "/api/auth/mfa/verify"],
      })
    ).cookies;
    assert.ok(
      pendingCookies.some(
        (c) =>
          c.name === "nexora_mfa_token" &&
          c.httpOnly &&
          c.path === "/api/auth/mfa" &&
          c.sameSite === "Strict",
      ),
    );
    // Native Chromium cookie selection: no manually supplied Cookie header.
    assert.equal(
      (
        await send("Network.getCookies", {
          urls: [baseUrl + "/api/auth/logout"],
        })
      ).cookies.some((c) => c.name === "nexora_mfa_token"),
      false,
    );
    checks.status(
      await evaluate(
        'fetch("/api/auth/logout",{method:"POST"}).then(r=>r.status)',
      ),
      200,
    );
    assert.ok(
      (
        await send("Network.getCookies", {
          urls: [baseUrl + "/api/auth/mfa/cancel"],
        })
      ).cookies.some((c) => c.name === "nexora_mfa_token"),
    );
    const composeMfa = [
      "compose",
      "-f",
      "compose.yml",
      ...(process.env.NEXORA_COMPOSE_OVERRIDE
        ? ["-f", process.env.NEXORA_COMPOSE_OVERRIDE]
        : []),
    ];
    const restartMfaApi = async () => {
      const result = spawnSync("docker", [...composeMfa, "restart", "api"], {
        stdio: "pipe",
        timeout: 45000,
      });
      assert.equal(result.status, 0);
      const deadline = Date.now() + 30000;
      let ready = false;
      while (Date.now() < deadline) {
        try {
          ready =
            (
              await fetch(baseUrl + "/api/health/ready", {
                signal: AbortSignal.timeout(2000),
              })
            ).status === 200;
        } catch {
          /* actual runtime restart */
        }
        if (ready) break;
        await delay(100);
      }
      assert.ok(ready, "API did not recover from restart");
    };
    checks.step("ADMIN_PENDING_CHALLENGE_API_RESTART");
    await restartMfaApi();
    await send("Fetch.enable", {
      patterns: [
        { urlPattern: "*/api/auth/mfa/verify", requestStage: "Request" },
      ],
    });
    const submitCode = async (value) => {
      await evaluate('document.querySelector("input[name=mfa-code]").focus()');
      await send("Input.insertText", { text: value });
      mfaStatus = undefined;
      pausedMfa = undefined;
      await evaluate('document.querySelector("button[type=submit]").click()');
      for (let i = 0; i < 100 && !pausedMfa; i++) await delay(20);
      assert.ok(pausedMfa, "Expected paused MFA request");
      assert.equal(
        await evaluate(
          'document.querySelector("button[type=submit]").disabled',
        ),
        true,
      );
      await send("Fetch.continueRequest", { requestId: pausedMfa });
      for (let i = 0; i < 100 && mfaStatus === undefined; i++) await delay(100);
      return mfaStatus;
    };
    checks.step("ADMIN_MFA_ERROR_RETRY");
    let wrong = "000000";
    const valid = new Set([-1, 0, 1].map((o) => totp(mfaSetupKey, o)));
    while (valid.has(wrong)) wrong = String(Number(wrong) + 1).padStart(6, "0");
    checks.status(await submitCode(wrong), 401);
    assert.equal(await evaluate("location.pathname"), "/login");
    for (let i = 0; i < 100; i++) {
      if (
        await evaluate(
          '!!document.querySelector("[role=alert]") && !document.querySelector("button[type=submit]").disabled',
        )
      )
        break;
      await delay(50);
    }
    assert.equal(
      await evaluate('!!document.querySelector("[role=alert]")'),
      true,
    );
    // Exercise recovery entry without putting a recovery code in URL/storage.
    await evaluate(
      'Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Dùng mã khôi phục")).click()',
    );
    assert.equal(
      await evaluate(
        'document.querySelector("input[name=mfa-code]").maxLength',
      ),
      35,
    );
    await evaluate(
      'Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Dùng ứng dụng xác thực")).click()',
    );
    checks.step("ADMIN_MFA_EXPIRED_CHALLENGE");
    assert.match(username, /^[a-z_]+$/);
    const compose = [
      "compose",
      "-f",
      "compose.yml",
      ...(process.env.NEXORA_COMPOSE_OVERRIDE
        ? ["-f", process.env.NEXORA_COMPOSE_OVERRIDE]
        : []),
    ];
    const expired = spawnSync(
      "docker",
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
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `UPDATE mfa_challenges SET expires_at=now()-interval '1 second' WHERE user_id=(SELECT id FROM users WHERE username='${username}');`,
      ],
      { stdio: "pipe" },
    );
    assert.equal(expired.status, 0);
    checks.status(await submitCode(totp(mfaSetupKey)), 401);
    for (let i = 0; i < 100; i++) {
      if (
        await evaluate(
          '!document.querySelector("button[type=submit]").disabled',
        )
      )
        break;
      await delay(50);
    }
    const cancelClick = () =>
      evaluate(
        'Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Hủy và quay lại")).click()',
      );
    const waitCancelError = async () => {
      for (let i = 0; i < 100; i++) {
        if (
          await evaluate(
            '!!document.querySelector("input[name=mfa-code]") && !!document.querySelector("[role=alert]") && !Array.from(document.querySelectorAll("button")).find(b=>b.textContent.includes("Hủy và quay lại")).disabled',
          )
        )
          return;
        await delay(50);
      }
      assert.fail("Cancel failure must retain MFA form and enabled retry");
    };
    checks.step("ADMIN_CANCEL_NETWORK_FAILURE");
    await send("Fetch.enable", {
      patterns: [
        { urlPattern: "*/api/auth/mfa/cancel", requestStage: "Request" },
      ],
    });
    pausedMfa = undefined;
    await cancelClick();
    for (let i = 0; i < 100 && !pausedMfa; i++) await delay(20);
    assert.ok(pausedMfa);
    await send("Fetch.failRequest", {
      requestId: pausedMfa,
      errorReason: "ConnectionFailed",
    });
    await waitCancelError();
    await send("Fetch.disable");
    const sql = (command) => {
      const result = spawnSync(
        "docker",
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
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          command,
        ],
        { stdio: "pipe", timeout: 15000 },
      );
      assert.equal(result.status, 0);
    };
    checks.step("ADMIN_CANCEL_DATABASE_FAILURE");
    sql(
      "CREATE FUNCTION smoke_reject_cancel() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled cancellation failure'; END $$; CREATE TRIGGER smoke_reject_cancel BEFORE DELETE ON mfa_challenges FOR EACH ROW EXECUTE FUNCTION smoke_reject_cancel();",
    );
    try {
      cancelStatus = undefined;
      await cancelClick();
      for (let i = 0; i < 100 && cancelStatus === undefined; i++)
        await delay(50);
      checks.status(cancelStatus, 500);
      await waitCancelError();
      assert.ok(
        (
          await send("Network.getCookies", {
            urls: [baseUrl + "/api/auth/mfa/cancel"],
          })
        ).cookies.some((c) => c.name === "nexora_mfa_token"),
      );
    } finally {
      sql(
        "DROP TRIGGER smoke_reject_cancel ON mfa_challenges; DROP FUNCTION smoke_reject_cancel();",
      );
    }
    checks.step("ADMIN_CANCEL_RETRY_SUCCESS");
    cancelStatus = undefined;
    await cancelClick();

    for (let i = 0; i < 100; i++) {
      if (await evaluate('!!document.querySelector("input[name=username]")'))
        break;
      await delay(100);
    }
    checks.status(cancelStatus, 200);
    assert.equal(
      (
        await send("Network.getCookies", {
          urls: [baseUrl + "/api/auth/mfa/cancel"],
        })
      ).cookies.some((c) => c.name === "nexora_mfa_token"),
      false,
    );
    assert.equal(
      await evaluate('!!document.querySelector("dialog[open]")'),
      false,
      "Returning from MFA must not reopen the previous help overlay",
    );
    // Returning to password form only after the real scoped cookie was sent and revoked.
    await send("Fetch.enable", {
      patterns: [
        { urlPattern: "*/api/auth/mfa/verify", requestStage: "Request" },
      ],
    });
    await evaluate('document.querySelector("input[name=username]").focus()');
    await send("Input.insertText", { text: "" });
    // Username remains; password is cleared on entering the MFA step.
    await evaluate('document.querySelector("input[name=password]").focus()');
    await send("Input.insertText", { text: password });
    await evaluate('document.querySelector("button[type=submit]").click()');
    for (let i = 0; i < 100; i++) {
      if (await evaluate('!!document.querySelector("input[name=mfa-code]")'))
        break;
      await delay(100);
    }
    checks.step("ADMIN_MFA_SUCCESS");
    checks.status(await submitCode(totp(mfaSetupKey, 1)), 200);
    await send("Fetch.disable");
    const browserStorage = await evaluate(
      "JSON.stringify({...localStorage,...sessionStorage})",
    );
    for (const secret of [mfaSetupKey, ...recoveryCodes])
      assert.equal(browserStorage.includes(secret), false);
    restartMfaSession = restartMfaApi;
  }
  checks.step("LOGIN_RESPONSE_AND_NAVIGATION");
  let location;
  for (let i = 0; i < 150; i++) {
    try {
      location = await evaluate("window.location.pathname");
    } catch {
      await delay(100);
      continue;
    }
    if (location === "/settings") break;
    await delay(100);
  }
  checks.step("LOGIN_RESPONSE");
  assert.equal(loginUrl, `${baseUrl}/api/auth/login`);
  checks.status(loginStatus, 200);
  checks.step("PROTECTED_NAVIGATION");
  assert.equal(
    location,
    "/settings",
    "Browser did not reach protected return page",
  );
  const shellPresent = await evaluate(
    '!!document.querySelector("header[aria-label=\'Thanh công cụ đầu trang\']") && !!document.querySelector("aside")',
  );
  assert.ok(
    shellPresent,
    "Protected workspace must render AppShell for authenticated session",
  );
  await verifyM1Visuals({
    send,
    evaluate,
    phase: "shell",
    prefix: mfaSetupKey ? "admin" : "operator",
  });
  checks.step("CUSTOMER_ADMIN_UI");
  const customerOwnerProof = await verifyCustomerBrowser({
    send,
    evaluate,
    baseUrl,
    prefix: mfaSetupKey ? "admin" : "operator",
    checks,
    socket,
  });
  checks.step("SESSION_COOKIE");
  const cookies = (await send("Network.getCookies", { urls: [baseUrl] }))
    .cookies;
  assert.ok(
    cookies.some(
      (cookie) => cookie.name === "nexora_session" && cookie.httpOnly,
    ),
    "Session cookie missing",
  );
  checks.step("SESSION_VALID");
  const session = await evaluate(
    'fetch("/api/auth/session").then(async res => ({status: res.status, data: await res.json()}))',
  );
  checks.status(session.status, 200);
  assert.equal(session.data.authenticated, true);
  assert.equal(session.data.user.username, username);
  if (restartMfaSession) {
    checks.step("ADMIN_MFA_SESSION_API_RESTART");
    await restartMfaSession();
    checks.status(
      await evaluate('fetch("/api/auth/session").then(r=>r.status)'),
      200,
    );
  }

  if (mfaSetupKey) {
    checks.step("ADMIN_MFA_SECRET_PRIVACY");
    const html = await fetch(baseUrl + "/login").then((r) => r.text());
    for (const value of [mfaSetupKey, ...recoveryCodes])
      assert.equal(html.includes(value), false);
    assert.equal(
      await evaluate(
        'document.cookie.includes("nexora_session") || document.cookie.includes("nexora_mfa_token")',
      ),
      false,
    );
    const href = await evaluate("location.href");
    for (const value of [mfaSetupKey, ...recoveryCodes])
      assert.equal(href.includes(value), false);
  }
  checks.step("OPERATOR_SETUP_LINK");
  const operatorName = "browser-" + Date.now();
  const created = await evaluate(
    `fetch("/api/admin/operators",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:${JSON.stringify(operatorName)}})}).then(async r=>({status:r.status,data:await r.json()}))`,
  );
  checks.status(created.status, 201);
  const setupUrl = new URL(created.data.setupUrl);
  setupSecret = new URLSearchParams(setupUrl.hash.slice(1)).get("token");
  assert.ok(!!setupSecret && setupUrl.origin === new URL(baseUrl).origin);
  checks.step("ADMIN_ACCOUNT_MENU_LOGOUT");
  await evaluate(
    `document.querySelector('button[aria-label^="Tài khoản người dùng"]').click()`,
  );
  await evaluate(
    `document.querySelector('button[aria-label="Đăng xuất khỏi hệ thống"]').click()`,
  );
  for (let i = 0; i < 100; i++) {
    if (await evaluate('location.pathname==="/login"')) break;
    await delay(100);
  }
  assert.equal(await evaluate("location.pathname"), "/login");
  checks.step("SESSION_REVOKED");
  checks.status(
    await evaluate('fetch("/api/auth/session").then(res => res.status)'),
    401,
  );
  checks.step("REVOKED_SESSION_PROTECTED_REDIRECT");
  await send("Page.navigate", { url: `${baseUrl}/settings` });
  let revokedRedirected = false;
  for (let i = 0; i < 100; i++) {
    const p = await evaluate("window.location.pathname");
    if (p === "/login") {
      revokedRedirected = true;
      break;
    }
    await delay(100);
  }
  assert.ok(
    revokedRedirected,
    "Revoked session must redirect to /login when visiting protected workspace",
  );
  checks.step("SETUP_FRAGMENT_PRIVACY");
  await send("Page.navigate", { url: created.data.setupUrl });
  let setupReady = false;
  for (let i = 0; i < 100; i++) {
    setupReady = await evaluate(
      'location.pathname==="/setup" && location.hash==="" && !!document.querySelector("input[name=confirmation]:not(:disabled)")',
    );
    if (setupReady) break;
    await delay(100);
  }
  assert.ok(setupReady, "Setup did not consume and clear fragment");
  const privacy = await evaluate(
    `fetch("/setup",{cache:"no-store"}).then(async r=>({referrer:r.headers.get("referrer-policy"),cache:r.headers.get("cache-control"),safe:!(await r.text()).includes(${JSON.stringify(setupSecret)})}))`,
  );
  assert.equal(privacy.referrer, "no-referrer");
  assert.ok(privacy.cache.includes("no-store"));
  assert.equal(privacy.safe, true);
  assert.equal(
    await evaluate(
      `JSON.stringify({...localStorage,...sessionStorage}).includes(${JSON.stringify(setupSecret)})`,
    ),
    false,
  );
  for (const name of ["password", "confirmation"]) {
    await evaluate(`document.querySelector('input[name=${name}]').focus()`);
    await send("Input.insertText", { text: password });
  }
  await evaluate('document.querySelector("button[type=submit]").click()');
  let setupComplete = false;
  for (let i = 0; i < 100; i++) {
    if (await evaluate('location.pathname==="/login"')) {
      setupComplete = true;
      break;
    }
    await delay(100);
  }
  checks.status(setupStatus, 200);
  assert.ok(setupComplete);
  assert.equal(leakedSetupSecret, false);
  assert.equal(
    (await send("Network.getCookies", { urls: [baseUrl] })).cookies.some(
      (c) => c.name === "nexora_session",
    ),
    false,
  );
  checks.status(
    await evaluate('fetch("/api/auth/session").then(r=>r.status)'),
    401,
  );
  checks.step("OPERATOR_LOCAL_LOGIN");
  checks.status(
    await evaluate(
      `fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:${JSON.stringify(operatorName)},password:${JSON.stringify(password)}})}).then(r=>r.status)`,
    ),
    200,
  );
  checks.step("CUSTOMER_OPERATOR_UI");
  await verifyCustomerBrowser({
    send,
    evaluate,
    baseUrl,
    prefix: "second-operator",
    foreignId: customerOwnerProof,
    checks,
    socket,
  });
  checks.step("OPERATOR_ACCOUNT_MENU_LOGOUT");
  await send("Page.navigate", { url: baseUrl + "/settings" });
  let accountReady = false;
  for (let i = 0; i < 100; i++) {
    accountReady = await evaluate(`(() => {
      if (document.readyState !== "complete") return false;
      const trigger = document.querySelector('button[aria-label^="Tài khoản người dùng"]');
      const logout = document.querySelector('button[aria-label="Đăng xuất khỏi hệ thống"]');
      if (trigger?.getAttribute("aria-expanded") === "true" && logout && !logout.disabled) return true;
      // Only a harmless menu toggle is probed; logout is submitted once below.
      if (trigger?.getAttribute("aria-expanded") !== "true") trigger?.click();
      return false;
    })()`);
    if (accountReady) break;
    await delay(100);
  }
  assert.equal(accountReady, true, "Account menu did not become interactive");
  await evaluate(
    `document.querySelector('button[aria-label="Đăng xuất khỏi hệ thống"]').click()`,
  );
  for (let i = 0; i < 100; i++) {
    if (await evaluate('location.pathname==="/login"')) break;
    await delay(100);
  }
  assert.equal(await evaluate("location.pathname"), "/login");
  checks.status(
    await evaluate('fetch("/api/auth/session").then(r=>r.status)'),
    401,
  );
  if (mfaSetupKey) {
    checks.step("COEXISTING_SESSION_AND_PENDING_COOKIE_SCOPE");
    const browserLogin = (name) =>
      evaluate(
        `fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:${JSON.stringify(name)},password:${JSON.stringify(password)}})}).then(r=>r.status)`,
      );
    checks.status(await browserLogin(username), 200);
    checks.status(await browserLogin(operatorName), 200);
    const before = (
      await send("Network.getCookies", {
        urls: [baseUrl + "/api/auth/mfa/cancel"],
      })
    ).cookies;
    assert.ok(before.some((c) => c.name === "nexora_session"));
    assert.ok(before.some((c) => c.name === "nexora_mfa_token"));
    cookieRequests.clear();
    requestUrls.clear();
    checks.status(
      await evaluate(
        'fetch("/api/auth/logout",{method:"POST"}).then(r=>r.status)',
      ),
      200,
    );
    checks.status(
      await evaluate('fetch("/api/auth/session").then(r=>r.status)'),
      401,
    );
    assert.ok(
      (
        await send("Network.getCookies", {
          urls: [baseUrl + "/api/auth/mfa/cancel"],
        })
      ).cookies.some((c) => c.name === "nexora_mfa_token"),
    );
    checks.status(
      await evaluate(
        'fetch("/api/auth/mfa/cancel",{method:"POST"}).then(r=>r.status)',
      ),
      200,
    );
    for (let i = 0; i < 100; i++) {
      if (
        [...requestUrls]
          .filter(
            ([, url]) =>
              url.endsWith("/api/auth/logout") ||
              url.endsWith("/api/auth/mfa/cancel"),
          )
          .every(([id]) => cookieRequests.has(id))
      )
        break;
      await delay(20);
    }
    const transport = (suffix) =>
      [...requestUrls]
        .filter(([, url]) => url.endsWith(suffix))
        .map(([id]) => cookieRequests.get(id));
    assert.deepEqual(transport("/api/auth/logout"), [
      { pending: false, session: true },
    ]);
    assert.deepEqual(transport("/api/auth/mfa/cancel"), [
      { pending: true, session: false },
    ]);
    assert.equal(
      (
        await send("Network.getCookies", {
          urls: [baseUrl + "/api/auth/mfa/cancel"],
        })
      ).cookies.some((c) => c.name === "nexora_mfa_token"),
      false,
    );
  }
  if (process.env.COMPOSE_PROJECT_NAME) {
    checks.step("SETUP_SERVER_LOG_PRIVACY");
    const args = ["compose", "-f", "compose.yml"];
    if (process.env.NEXORA_COMPOSE_OVERRIDE)
      args.push("-f", process.env.NEXORA_COMPOSE_OVERRIDE);
    args.push("logs", "--no-color", "api", "web");
    const logs = spawnSync("docker", args, {
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 8 * 1024 * 1024,
    });
    assert.equal(logs.status, 0);
    if (mfaSetupKey)
      for (const secret of [mfaSetupKey, ...recoveryCodes])
        assert.equal(logs.stdout.includes(secret), false);
    assert.equal(
      logs.stdout.includes(setupSecret),
      false,
      "Setup token leaked into server logs",
    );
  }
  checks.step("SSR_CLIENT_HYDRATION");
  assert.equal(
    hydrationMismatchCount,
    0,
    "React reported server/client hydration mismatch in the actual browser",
  );
  console.log(
    "Actual browser unified Login, fragment Setup privacy, no auto-login, OPERATOR login, cookies and Logout PASS",
  );
} catch (error) {
  checks.failure(error);
  process.exitCode = 1;
} finally {
  socket?.close();
  child.kill();
  await exited;
  try {
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  } catch {
    // Best-effort cleanup of temporary browser profile in tmpdir
  }
}
