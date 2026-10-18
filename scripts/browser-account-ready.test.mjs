import { clearTimeout } from "node:timers";
const WebSocket = globalThis.WebSocket;
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { openInteractiveAccountMenu } from "./browser-account-ready.mjs";
const executable =
  process.env.CHROME_BIN ||
  [
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
  ].find(
    (name) => spawnSync(name, ["--version"], { stdio: "ignore" }).status === 0,
  );
assert.ok(executable, "Chromium/Chrome is required");
const html = await readFile(
  new URL("./fixtures/delayed-account.html", import.meta.url),
  "utf8",
);
const server = createServer((_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const profile = await mkdtemp(join(tmpdir(), "nexora-interactivity-"));
const child = spawn(
  executable,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--no-first-run",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
const exited = new Promise((r) => {
  child.once("exit", r);
  child.once("error", r);
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
  assert.ok(port);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  socket = new WebSocket(
    targets.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((r, j) => {
    socket.addEventListener("open", r, { once: true });
    socket.addEventListener("error", j, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      const op = pending.get(m.id);
      if (op) {
        clearTimeout(op.timer);
        pending.delete(m.id);
        if (m.error) op.reject(Error("CDP operation failed"));
        else op.resolve(m.result);
      }
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id,
        timer = setTimeout(() => {
          pending.delete(n);
          reject(Error("CDP timeout"));
        }, 5000);
      pending.set(n, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw Error("Evaluation failed");
    return r.result.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 100; i++) {
      try {
        if (await evaluate(expression)) return;
      } catch {
        // A navigation may temporarily replace the execution context.
      }
      await delay(50);
    }
    throw Error("Readiness timeout");
  };
  await send("Page.enable");
  await send("Page.navigate", {
    url: `http://127.0.0.1:${server.address().port}`,
  });
  await until(
    `!!document.querySelector('button[aria-label^="Tài khoản người dùng"]')`,
  );
  await evaluate(
    `document.querySelector('button[aria-label^="Tài khoản người dùng"]').click()`,
  );
  assert.equal(
    await evaluate(
      `!!document.querySelector('button[aria-label="Đăng xuất khỏi hệ thống"]')`,
    ),
    false,
    "old DOM-only predicate proceeds without a menu",
  );
  await evaluate("setTimeout(window.attachHandlers, 100)");
  await openInteractiveAccountMenu({ until });
  await evaluate(
    `document.querySelector('button[aria-label="Đăng xuất khỏi hệ thống"]').click()`,
  );
  assert.equal(
    await evaluate("document.documentElement.dataset.logout"),
    "once",
  );
  console.log(
    "Real Chromium delayed-handler/menu RED reproduction and interactive GREEN PASS",
  );
} finally {
  socket?.close();
  child.kill("SIGTERM");
  await exited;
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
  await new Promise((r) => server.close(r));
}
