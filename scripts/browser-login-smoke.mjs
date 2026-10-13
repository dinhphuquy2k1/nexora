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
const { baseUrl, username, password } = JSON.parse(input);
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
  { stdio: "ignore" },
);
const exited = new Promise((resolve) => {
  child.once("exit", resolve);
  child.once("error", resolve);
});
let socket;
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
  let loginStatus;
  let loginUrl;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const operation = pending.get(message.id);
      if (operation) {
        pending.delete(message.id);
        if (message.error)
          operation.reject(new Error("Browser command failed"));
        else operation.resolve(message.result);
      }
    }
    if (
      message.method === "Network.responseReceived" &&
      (message.params.response.url === `${baseUrl}/api/auth/login` ||
        message.params.response.url === `${baseUrl}/api/auth/provider/login`)
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
  const evaluate = async (expression) =>
    (
      await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
    ).result.value;
  checks.step("LOGIN_PAGE_RENDER");
  await send("Network.enable");
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

  checks.step("EMPLOYEE_FORM_VERIFICATION");
  const hasAdminSwitch = await evaluate(
    "!!document.querySelector(\"a[href*='mode=admin']\")",
  );
  assert.ok(hasAdminSwitch, "Employee login must link to Admin mode");

  // Verify employee form submits to provider endpoint and shows safe error when provider is unconfigured/fails
  await delay(500);
  await evaluate('document.querySelector("input[name=username]").focus()');
  await send("Input.insertText", { text: "operator_test" });
  await evaluate('document.querySelector("input[name=password]").focus()');
  await send("Input.insertText", { text: "TestPassword123!" });
  await evaluate('document.querySelector("button[type=submit]").click()');
  let sawProviderResponse = false;
  for (let i = 0; i < 100; i++) {
    if (loginUrl === `${baseUrl}/api/auth/provider/login`) {
      sawProviderResponse = true;
      break;
    }
    await delay(100);
  }
  assert.ok(
    sawProviderResponse,
    "Employee form must call /api/auth/provider/login",
  );
  let hasErrorBanner = false;
  for (let i = 0; i < 50; i++) {
    hasErrorBanner = await evaluate('!!document.querySelector("[role=alert]")');
    if (hasErrorBanner) break;
    await delay(100);
  }
  assert.ok(
    hasErrorBanner,
    "Failed provider login must display safe error banner",
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
    url: `${baseUrl}/login?mode=admin&from=%2Fsettings`,
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
  const hasEmployeeSwitch = await evaluate(
    "!!document.querySelector(\"a[href*='/login']\")",
  );
  assert.ok(hasEmployeeSwitch, "Admin login must link back to employee mode");

  checks.step("ADMIN_FORM_INTERACTION");
  // Allow hydration, then type via browser input events and click the actual submit button.
  await delay(500);
  await evaluate('document.querySelector("input[name=username]").focus()');
  await send("Input.insertText", { text: username });
  await evaluate('document.querySelector("input[name=password]").focus()');
  await send("Input.insertText", { text: password });
  loginStatus = undefined;
  loginUrl = undefined;
  await evaluate('document.querySelector("button[type=submit]").click()');
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
  checks.step("LOGOUT_SUCCESS");
  checks.status(
    await evaluate(
      'fetch("/api/auth/logout", {method:"POST"}).then(res => res.status)',
    ),
    200,
  );
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
  console.log(
    "Actual browser Login form, cookie, protected navigation and Logout PASS",
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
