// One dependency-free Chromium DevTools test for the real browser Login form.
// Credentials arrive via stdin, never command-line arguments or diagnostic output.
import { clearTimeout } from "node:timers";
const WebSocket = globalThis.WebSocket;
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const { baseUrl, username, password } = JSON.parse(input);
const executable =
  process.env.CHROME_BIN ||
  ["google-chrome", "chromium", "chromium-browser"].find(
    (name) => spawnSync(name, ["--version"], { stdio: "ignore" }).status === 0,
  );
if (!executable)
  throw new Error(
    "Chromium/Chrome is required for actual Login form verification.",
  );
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
      message.params.response.url === `${baseUrl}/api/auth/login`
    )
      loginStatus = message.params.response.status;
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
  // Allow hydration, then type via browser input events and click the actual submit button.
  await delay(500);
  await evaluate('document.querySelector("input[name=username]").focus()');
  await send("Input.insertText", { text: username });
  await evaluate('document.querySelector("input[name=password]").focus()');
  await send("Input.insertText", { text: password });
  await evaluate('document.querySelector("button[type=submit]").click()');
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
  assert.equal(loginStatus, 200, "Actual Login submission failed");
  assert.equal(
    location,
    "/settings",
    "Browser did not reach protected return page",
  );
  const cookies = (await send("Network.getCookies", { urls: [baseUrl] }))
    .cookies;
  assert.ok(
    cookies.some(
      (cookie) => cookie.name === "nexora_session" && cookie.httpOnly,
    ),
    "Session cookie missing",
  );
  const session = await evaluate(
    'fetch("/api/auth/session").then(async res => ({status: res.status, data: await res.json()}))',
  );
  assert.equal(session.status, 200);
  assert.equal(session.data.authenticated, true);
  assert.equal(session.data.user.username, username);
  assert.equal(
    await evaluate(
      'fetch("/api/auth/logout", {method:"POST"}).then(res => res.status)',
    ),
    200,
  );
  assert.equal(
    await evaluate('fetch("/api/auth/session").then(res => res.status)'),
    401,
  );
  console.log(
    "Actual browser Login form, cookie, protected navigation and Logout PASS",
  );
} catch {
  throw new Error(
    "Browser Login smoke failed; credentials and browser payloads withheld.",
  );
} finally {
  socket?.close();
  child.kill();
  await exited;
  await rm(profile, { recursive: true, force: true });
}
