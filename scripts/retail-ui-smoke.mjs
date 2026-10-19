// Isolated frontend fixture smoke. This is NOT Nest/PostgreSQL auth or carrier evidence.
// Build first with API_INTERNAL_URL=http://127.0.0.1:4096, then run this script.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const output = resolve(
  process.argv[2] ?? `/tmp/nexora-retail-evidence-${randomUUID()}`,
);
await mkdir(output);
const portProbe = createServer();
await new Promise((resolve, reject) => {
  portProbe.once("error", reject);
  portProbe.listen(3096, "127.0.0.1", resolve);
});
await new Promise((resolve) => portProbe.close(resolve));
const base = "http://127.0.0.1:3096";
const accountA = "11111111-1111-4111-8111-111111111111";
const accountB = "22222222-2222-4222-8222-222222222222";
const longName = "Tài khoản vận chuyển miền Bắc — tên dài trùng nhau";
let mode = "ready",
  removed = false,
  calls = 0,
  logouts = 0;
const sockets = new Set();
const api = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const send = (status, data) => {
    res.writeHead(status);
    res.end(JSON.stringify(data));
  };
  if (req.url === "/api/auth/session")
    return send(
      req.headers.cookie?.includes("nexora_session=fixture") ? 200 : 401,
      {
        authenticated: true,
        user: { id: "fixture-user", username: "UI fixture" },
      },
    );
  if (req.url === "/api/auth/logout") {
    logouts++;
    res.setHeader(
      "Set-Cookie",
      "nexora_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
    );
    return send(200, { success: true });
  }
  if (req.url === "/api/carriers" || req.url === "/api/carrier-connections") {
    calls++;
    const selectedMode = mode;
    const respond = () => {
      if (res.destroyed) return;
      if (selectedMode === "error")
        return send(503, { code: "SERVICE_UNAVAILABLE" });
      if (req.url === "/api/carriers")
        return send(200, {
          carriers: [{ provider: "uniship", displayName: "Uniship" }],
        });
      return send(200, {
        connections:
          selectedMode === "empty"
            ? []
            : [
                {
                  id: accountA,
                  provider: "uniship",
                  displayName: longName,
                  status: "CONNECTED",
                },
                ...(removed
                  ? []
                  : [
                      {
                        id: accountB,
                        provider: "uniship",
                        displayName: longName,
                        status: "REAUTH_REQUIRED",
                      },
                    ]),
              ],
      });
    };
    if (selectedMode === "slow") setTimeout(respond, 400);
    else respond();
    return;
  }
  return send(404, { code: "NOT_FOUND" });
});
api.on("connection", (socket) => {
  sockets.add(socket);
  socket.once("close", () => sockets.delete(socket));
});
await new Promise((resolve, reject) => {
  api.once("error", reject);
  api.listen(4096, "127.0.0.1", resolve);
});
// The default frontend runtime is a disposable Linux Docker container. API is a loopback fixture.
const runtime = process.env.NEXORA_RETAIL_RUNTIME ?? "docker";
assert.ok(["docker", "host"].includes(runtime));
let web, containerId;
const profile = await mkdtemp(join(tmpdir(), "nexora-retail-browser-"));
let chrome, socket;
const checks = [];
try {
  const nextArgs = [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3096",
  ];
  if (runtime === "docker") {
    const created = spawnSync(
      "docker",
      [
        "create",
        "--name",
        `nexora-retail-ui-${randomUUID()}`,
        "--network",
        "host",
        "--user",
        `${process.getuid()}:${process.getgid()}`,
        "--mount",
        `type=bind,src=${process.cwd()},dst=/workspace,readonly`,
        "--workdir",
        "/workspace/apps/web",
        "--env",
        "API_INTERNAL_URL=http://127.0.0.1:4096",
        "--env",
        "NEXT_TELEMETRY_DISABLED=1",
        "node:24.19.0-bookworm-slim",
        "node",
        ...nextArgs,
      ],
      { encoding: "utf8" },
    );
    assert.equal(created.status, 0, "disposable Docker create failed");
    containerId = created.stdout.trim();
    assert.match(containerId, /^[a-f0-9]{64}$/);
    web = spawn("docker", ["start", "--attach", containerId], {
      stdio: "ignore",
    });
  } else {
    web = spawn(
      process.execPath,
      [
        resolve("apps/web/node_modules/next/dist/bin/next"),
        ...nextArgs.slice(1),
      ],
      {
        cwd: resolve("apps/web"),
        env: {
          ...process.env,
          API_INTERNAL_URL: "http://127.0.0.1:4096",
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: "ignore",
      },
    );
  }
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`${base}/login`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* listener/browser not ready yet */
    }
    await delay(100);
  }
  assert.ok(ready, "isolated Next server unavailable");
  chrome = spawn(
    process.env.CHROME_BIN ?? "chromium",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = (
        await readFile(join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      break;
    } catch {
      /* listener/browser not ready yet */
    }
    await delay(100);
  }
  assert.ok(port, "Chromium unavailable");
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) =>
    r.json(),
  );
  socket = new globalThis.WebSocket(
    targets.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      if (task) {
        pending.delete(message.id);
        if (message.error)
          task.reject(new Error(JSON.stringify(message.error)));
        else task.resolve(message.result);
      }
    }
  });
  function cdp(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const key = ++id;
      pending.set(key, { resolve, reject });
      socket.send(JSON.stringify({ id: key, method, params, sessionId }));
    });
  }
  async function evaluate(expression) {
    const result = await cdp("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    assert.ok(
      !result.exceptionDetails,
      JSON.stringify(result.exceptionDetails),
    );
    return result.result.value;
  }
  async function wait(expression) {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`!!document.body && Boolean(${expression})`)) return;
      await delay(100);
    }
    throw new Error(`Timeout: ${expression}`);
  }
  async function clickText(text) {
    await evaluate(
      `(()=>{const el=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!el)throw Error('missing control');el.click();})()`,
    );
  }
  async function screenshot(name) {
    const result = await cdp("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(
      join(output, `${name}.png`),
      Buffer.from(result.data, "base64"),
    );
  }
  async function key(key, code = key) {
    await cdp("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code,
      text: key === "Enter" ? "\r" : undefined,
      windowsVirtualKeyCode: {
        Enter: 13,
        Escape: 27,
        ArrowDown: 40,
        ArrowUp: 38,
      }[key],
    });
    await cdp("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
      windowsVirtualKeyCode: {
        Enter: 13,
        Escape: 27,
        ArrowDown: 40,
        ArrowUp: 38,
      }[key],
    });
  }
  async function navigate(path) {
    await cdp("Page.navigate", { url: base + path });
    await wait("document.readyState === 'complete'");
  }
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("DOM.enable");
  await cdp("CSS.enable");
  await cdp("Network.enable");
  await cdp("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate("/login");
  await wait("document.querySelector('input[type=password]')");
  assert.equal(calls, 0, "public login must not request carrier metadata");
  await evaluate("document.fonts.ready.then(()=>true)");
  const loginFont = await evaluate(
    "getComputedStyle(document.querySelector('input')).fontFamily",
  );
  assert.ok(loginFont.toLowerCase().includes("inter"), loginFont);
  checks.push("Public login: no carrier dependency; computed Inter on input");
  await screenshot("login-inter");
  await cdp("Network.setCookie", {
    name: "nexora_session",
    value: "fixture",
    url: base,
    httpOnly: true,
    sameSite: "Lax",
  });
  await navigate("/shipments/retail?q=áo&custom=kept&page=7#table");
  await wait(
    "document.body.textContent.includes('Dữ liệu kiện lẻ chưa được triển khai')",
  );
  const initialCalls = calls;
  assert.equal(initialCalls, 2);
  await screenshot("retail-header-closed");
  const trigger =
    "document.querySelector('button[aria-label^=\"Phạm vi vận chuyển\"]')";
  await evaluate(`${trigger}.click()`);
  await wait(
    "document.querySelector('input[aria-label=\"Tìm hãng hoặc tài khoản\"]')===document.activeElement",
  );
  await wait(
    `getComputedStyle(${trigger}).backgroundColor === "rgb(23, 43, 77)"`,
  );
  await screenshot("retail-header-open");
  await key("ArrowDown");
  await wait("document.activeElement.textContent.includes('Tất cả hãng')");
  await key("ArrowDown");
  await wait("document.activeElement.textContent.includes('Uniship')");
  await key("Enter");
  await wait(
    "new URLSearchParams(location.search).get('provider')==='uniship' && !document.querySelector('[role=dialog][aria-label=\"Chọn hãng và tài khoản\"]')",
  );
  assert.ok(await evaluate(`document.activeElement===${trigger}`));
  assert.ok(
    await evaluate(
      "new URLSearchParams(location.search).get('custom')==='kept' && !new URLSearchParams(location.search).has('page') && location.hash==='#table'",
    ),
  );
  await evaluate(`${trigger}.click()`);
  await wait(
    "document.querySelector('[role=dialog][aria-label=\"Chọn hãng và tài khoản\"]')",
  );
  await evaluate(
    `document.querySelector('button[title$="${accountB}"]').click()`,
  );
  await wait(
    `new URLSearchParams(location.search).get('connection')==='${accountB}'`,
  );
  assert.equal(
    calls,
    initialCalls,
    "opening and scope changes must not refetch metadata",
  );
  await wait(
    `getComputedStyle(${trigger}).backgroundColor === "rgb(255, 255, 255)"`,
  );
  await cdp("Page.navigateToHistoryEntry", {
    entryId: (await cdp("Page.getNavigationHistory")).entries.at(-2).id,
  });
  await wait(
    "new URLSearchParams(location.search).get('provider')==='uniship' && !new URLSearchParams(location.search).has('connection')",
  );
  await evaluate("history.forward()");
  await wait(
    `new URLSearchParams(location.search).get('connection')==='${accountB}'`,
  );
  await clickText("Cài đặt");
  await wait("location.pathname==='/settings'");
  assert.ok(!(await evaluate("location.search")).includes("provider"));
  await clickText("Kiện lẻ");
  await wait(
    `new URLSearchParams(location.search).get('connection')==='${accountB}'`,
  );
  await cdp("Page.reload");
  await wait(
    "document.body.textContent.includes('Dữ liệu kiện lẻ chưa được triển khai')",
  );
  checks.push(
    "Real Next URL push/back/forward/refresh; query/hash retained; page reset; settings unfiltered; shipping link restores scope",
  );
  const tab = await cdp("Target.createTarget", {
    url: base + "/shipments/retail?provider=uniship",
  });
  const attached = await cdp("Target.attachToTarget", {
    targetId: tab.targetId,
    flatten: true,
  });
  let otherReady = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await cdp(
      "Runtime.evaluate",
      {
        expression:
          "document.readyState === 'complete' && location.search === '?provider=uniship'",
        returnByValue: true,
      },
      attached.sessionId,
    );
    if (result.result?.value) {
      otherReady = true;
      break;
    }
    await delay(100);
  }
  assert.ok(otherReady, "second tab scope must remain independent");
  assert.ok(
    await evaluate(
      `new URLSearchParams(location.search).get('connection')==='${accountB}'`,
    ),
  );
  await cdp("Target.closeTarget", { targetId: tab.targetId });
  checks.push(
    "Second browser tab uses its own scope URL; first tab selection remains unchanged",
  );

  await evaluate(`${trigger}.click()`);
  await wait(
    "document.querySelector('input[aria-label=\"Tìm hãng hoặc tài khoản\"]')===document.activeElement",
  );
  await cdp("Input.insertText", { text: "miền Bắc" });
  await wait(
    "document.querySelectorAll('button[title^=\"Tài khoản vận chuyển miền Bắc\"]').length===2",
  );
  await key("Escape");
  assert.ok(await evaluate(`document.activeElement===${trigger}`));
  await evaluate(`${trigger}.click()`);
  await wait(
    "document.querySelector('[role=dialog][aria-label=\"Chọn hãng và tài khoản\"]')",
  );
  await evaluate(
    "document.querySelector('h1').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))",
  );
  await wait(`${trigger}.getAttribute('aria-expanded')==='false'`);
  checks.push(
    "Two accounts/duplicate long labels, search, keyboard selection, Escape/focus and outside dismissal",
  );
  await clickText("Cột hiển thị 19/20");
  await wait("document.querySelector('[aria-label=\"Tùy chỉnh cột\"]')");
  await clickText("Cơ bản");
  assert.equal(
    await evaluate("document.querySelectorAll('thead th').length"),
    7,
  );
  assert.ok(
    await evaluate(
      "document.querySelector('[aria-label=\"Tùy chỉnh cột\"] input[type=checkbox]:disabled').checked",
    ),
  );
  await key("Escape");
  await clickText("Thêm điều kiện lọc");
  await wait(
    "document.querySelector('[aria-label=\"Điều kiện lọc dự thảo\"]')",
  );
  await evaluate(
    "document.querySelector('[aria-label=\"Điều kiện lọc dự thảo\"] input').focus()",
  );
  await cdp("Input.insertText", { text: "áo" });
  await clickText("Thêm dự thảo");
  await wait(
    "document.querySelector('[aria-label=\"Điều kiện dự thảo\"]')?.textContent.includes('áo')",
  );
  await clickText("Chi tiết & lịch sử: chưa triển khai");
  await wait("document.querySelector('dialog').open");
  const dialogFont = await evaluate(
    "getComputedStyle(document.querySelector('dialog')).fontFamily",
  );
  assert.ok(dialogFont.toLowerCase().includes("inter"));
  await key("Escape");
  checks.push(
    "Column presets/required tracking, draft filters/chips, native dialog Inter; no fake Shipment records or success",
  );
  await evaluate("document.fonts.ready.then(()=>true)");
  const root = (await cdp("DOM.getDocument")).root.nodeId;
  const heading = (
    await cdp("DOM.querySelector", { nodeId: root, selector: "h1" })
  ).nodeId;
  const fonts = (await cdp("CSS.getPlatformFontsForNode", { nodeId: heading }))
    .fonts;
  assert.ok(
    fonts.some(
      (f) =>
        f.isCustomFont && f.familyName.includes("Inter") && f.glyphCount > 0,
    ),
    JSON.stringify(fonts),
  );
  const loaded = await evaluate(
    "performance.getEntriesByType('resource').filter(e=>e.name.includes('.woff2')).map(e=>({url:e.name,bytes:e.transferSize}))",
  );
  assert.ok(loaded.length && loaded.every((r) => r.url.startsWith(base)));
  const controlledFonts = await evaluate(
    "[...document.querySelectorAll('input,select,button')].map(e=>getComputedStyle(e).fontFamily)",
  );
  assert.ok(controlledFonts.every((f) => f.toLowerCase().includes("inter")));
  const fontResponse = await fetch(loaded[0].url);
  assert.equal(fontResponse.status, 200);
  const fontBytes = Buffer.from(await fontResponse.arrayBuffer());
  assert.ok(
    fontBytes.equals(await readFile("apps/web/app/fonts/InterVariable.woff2")),
    "served WOFF2 must match bundled Inter",
  );
  await writeFile(
    join(output, "font-evidence.json"),
    JSON.stringify(
      {
        fonts,
        loaded,
        loginFont,
        dialogFont,
        controlledFonts: [...new Set(controlledFonts)],
        fontHttpStatus: fontResponse.status,
        servedFontBytes: fontBytes.length,
        servedFontMatchesSource: true,
      },
      null,
      2,
    ),
  );
  for (const width of [1440, 1280, 390]) {
    await cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (let collapsed = 0; collapsed < 2; collapsed++) {
      if (collapsed)
        await evaluate(
          "document.querySelector('button[aria-label*=\"thanh điều hướng\"]').click()",
        );
      await delay(200);
      assert.ok(
        await evaluate("document.documentElement.scrollWidth<=innerWidth"),
        `page overflow ${width}/${collapsed}`,
      );
      await screenshot(
        `retail-${width}-${collapsed ? "collapsed" : "expanded"}`,
      );
    }
    await evaluate(
      "document.querySelector('button[aria-label*=\"thanh điều hướng\"]').click()",
    );
  }
  checks.push(
    "Actual rendered custom Inter + local WOFF2 requests, Vietnamese heading and controls; 1440/1280/390 expanded/collapsed containment",
  );
  const closeBox = await evaluate(
    "(()=>{const r=document.querySelector('button[aria-label=\"Đóng menu di động\"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()",
  );
  await cdp("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...closeBox,
    button: "left",
    clickCount: 1,
  });
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...closeBox,
    button: "left",
    clickCount: 1,
  });
  await wait(
    "document.activeElement?.getAttribute('aria-label')==='Mở rộng thanh điều hướng'",
  );
  await evaluate(`${trigger}.click()`);
  await wait(
    "document.querySelector('[role=dialog][aria-label=\"Chọn hãng và tài khoản\"]')",
  );
  assert.ok(
    await evaluate(
      "document.querySelector('[role=dialog][aria-label=\"Chọn hãng và tài khoản\"]').getBoundingClientRect().right<=innerWidth",
    ),
  );
  await wait(
    `getComputedStyle(${trigger}).backgroundColor === "rgb(23, 43, 77)"`,
  );
  await screenshot("retail-mobile-selector");
  await key("Escape");
  checks.push(
    "Mobile drawer closes through native pointer with focus restoration; selector fits viewport",
  );
  removed = true;
  await evaluate(`${trigger}.click()`);
  await wait(
    "document.querySelector('[role=dialog][aria-label=\"Chọn hãng và tài khoản\"]')",
  );
  await clickText("Cập nhật kết nối");
  await wait("document.body.textContent.includes('Phạm vi không khả dụng')");
  await key("Escape");
  assert.ok(
    await evaluate(
      `new URLSearchParams(location.search).get('connection')==='${accountB}'`,
    ),
  );
  mode = "error";
  await evaluate(`${trigger}.click()`);
  await wait(
    "document.querySelector('[role=dialog][aria-label=\"Chọn hãng và tài khoản\"]')",
  );
  await clickText("Cập nhật kết nối");
  await wait(
    "document.body.textContent.includes('Không tải được thông tin kết nối')",
  );
  mode = "slow";
  await clickText("Thử lại");
  await wait("document.body.textContent.includes('Đang tải kết nối')");
  await wait(
    "document.querySelector('button') && document.body.textContent.includes('Cập nhật kết nối')",
  );
  mode = "empty";
  await clickText("Cập nhật kết nối");
  await wait("document.body.textContent.includes('Chưa có kết nối tài khoản')");
  await key("Escape");
  checks.push(
    "Deleted scope stays invalid without widening; actual metadata loading/error/retry/empty are distinct",
  );
  await evaluate(
    "document.querySelector('button[aria-label^=\"Tài khoản người dùng\"]').click()",
  );
  await wait(
    "[...document.querySelectorAll('button')].some(e=>e.textContent.includes('Đăng xuất'))",
  );
  await clickText("Đăng xuất");
  await wait("location.pathname==='/login'");
  assert.equal(logouts, 1);
  checks.push(
    "Existing AccountMenu POST logout navigation (fixture backend only)",
  );
} finally {
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill();
    await new Promise((r) => chrome.once("exit", r));
  }
  if (web && web.exitCode === null) {
    web.kill();
    await new Promise((r) => web.once("exit", r));
  }
  if (containerId) {
    const cleanup = spawnSync("docker", ["rm", "--force", containerId], {
      stdio: "ignore",
    });
    assert.equal(cleanup.status, 0, "owned container cleanup failed");
  }
  for (const socket of sockets) socket.destroy();
  await new Promise((r) => api.close(r));
  await rm(profile, { recursive: true, force: true });
}

await writeFile(
  join(output, "summary.json"),
  JSON.stringify(
    {
      result: "PASS",
      kind: "FRONTEND_FIXTURE_ONLY",
      runtime,
      time: new Date().toISOString(),
      cleanup: "PASS",
      checks,
    },
    null,
    2,
  ),
);
console.log(
  `RETAIL_FRONTEND_FIXTURE_PASS: ${checks.length} groups; evidence ${output}`,
);
