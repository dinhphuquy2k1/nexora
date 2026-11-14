// Real Chromium acceptance over isolated actual TSX/CSS fixtures, no new packages.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { setTimeout, clearTimeout } from "node:timers";
import { createHash } from "node:crypto";
import { browserStartupSummary } from "./browser-startup-diagnostics.mjs";
import {
  terminateChildProcess,
  cleanupBrowserProfile,
} from "./browser-teardown.mjs";
const [bundleArgument, outputArgument, baselineArgument] =
  process.argv.slice(2);
assert.ok(
  bundleArgument && outputArgument,
  "Usage: node scripts/m5-browser-checks.mjs bundles output [baseline-output|--acceptance]",
);
const bundles = resolve(bundleArgument),
  output = resolve(outputArgument);
const acceptanceOnly = baselineArgument === "--acceptance";
const baseline =
  baselineArgument && !acceptanceOnly ? resolve(baselineArgument) : undefined;
const acceptance = acceptanceOnly || !!baseline;
const fixturePath = (name, file) =>
  join(
    bundles,
    acceptanceOnly
      ? name === "components"
        ? "m5-fixture"
        : `${name}-fixture`
      : name,
    file,
  );
const executable =
  process.env.CHROME_BIN ??
  ["google-chrome", "chromium", "chromium-browser"].find(
    (name) => spawnSync(name, ["--version"], { stdio: "ignore" }).status === 0,
  );
assert.ok(executable, "Chromium/Chrome is required for M5 acceptance");
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://fixture").pathname;
    const match = pathname.match(
      /^\/(components|retail|carrier)(?:\/(bundle\.js))?$/,
    );
    const file =
      pathname === "/inter.woff2"
        ? resolve("apps/web/assets/fonts/InterVariable.woff2")
        : match
          ? fixturePath(match[1], match[2] ?? "index.html")
          : null;
    if (!file) {
      res.writeHead(404).end();
      return;
    }
    let bytes = await readFile(file);
    if (!match?.[2] && match)
      bytes = Buffer.from(
        bytes
          .toString()
          .replace('src="/bundle.js"', `src="/${match[1]}/bundle.js"`),
      );
    res.setHeader(
      "content-type",
      pathname.endsWith(".js")
        ? "text/javascript"
        : pathname.endsWith(".woff2")
          ? "font/woff2"
          : "text/html",
    );
    res.end(bytes);
  } catch {
    res.writeHead(500).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), "nexora-m5-"));
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
let socket;
const records = [],
  errors = [];
const bundleHashes = Object.fromEntries(
  await Promise.all(
    ["components", "retail", "carrier"].map(async (name) => [
      name,
      createHash("sha256")
        .update(await readFile(fixturePath(name, "bundle.js")))
        .digest("hex"),
    ]),
  ),
);
try {
  let port;
  // Cold GitHub runners can initialize Chromium DevTools slowly; keep the launch gate bounded.
  for (let i = 0; i < 200; i++) {
    try {
      port = (
        await readFile(join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      break;
    } catch {
      await delay(100);
    }
    if (child.exitCode !== null || child.signalCode !== null) break;
  }
  collectingStartup = false;
  if (!port)
    console.error(
      "BROWSER_STARTUP_DIAGNOSTIC",
      JSON.stringify(browserStartupSummary(startupStderr, child)),
    );
  startupStderr = "";
  assert.ok(port, "Chromium startup");
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) =>
    r.json(),
  );
  socket = new globalThis.WebSocket(
    targets.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((yes, no) => {
    socket.addEventListener("open", yes, { once: true });
    socket.addEventListener("error", no, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const m = JSON.parse(event.data);
    if (m.method === "Runtime.exceptionThrown")
      errors.push(
        m.params.exceptionDetails.exception?.description ??
          m.params.exceptionDetails.text,
      );
    if (m.id) {
      const p = pending.get(m.id);
      if (p) {
        pending.delete(m.id);
        if (m.error) p.reject(Error(m.error.message));
        else p.resolve(m.result);
      }
    }
  });
  const send = (method, params = {}) =>
    new Promise((yes, no) => {
      const n = ++id;
      const timer = setTimeout(() => {
        pending.delete(n);
        no(Error(`CDP timeout ${method}`));
      }, 15000);
      pending.set(n, {
        resolve: (v) => {
          clearTimeout(timer);
          yes(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          no(e);
        },
      });
      socket.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails)
      throw Error(
        r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
      );
    return r.result.value;
  };
  async function until(expr) {
    for (let i = 0; i < 100; i++) {
      assert.deepEqual(errors, []);
      if (await evaluate(expr)) return;
      await delay(50);
    }
    throw Error(`Condition: ${expr}`);
  }
  async function visit(path) {
    await send("Page.navigate", { url: origin + path });
    await until(
      `document.readyState === 'complete' && !!document.querySelector('main,[data-retail-fixture],[data-parity-stage]')`,
    );
    await evaluate("document.fonts.ready");
    await delay(150);
  }
  async function click(selector) {
    const p = await evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
    );
    assert.ok(p, selector);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...p });
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 1,
      ...p,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 1,
      ...p,
    });
    await delay(250);
  }
  async function key(key, code) {
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code: key,
      windowsVirtualKeyCode: code,
      ...(key === "Enter" ? { text: "\r" } : {}),
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code: key,
      windowsVirtualKeyCode: code,
    });
    await delay(250);
  }
  async function select(selector, value) {
    const steps = await evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();return [...e.options].findIndex(o=>o.value===${JSON.stringify(value)})})()`,
    );
    assert.ok(steps >= 0);
    await key("Home", 36);
    for (let i = 0; i < steps; i++) await key("ArrowDown", 40);
    await key("Tab", 9);
  }
  async function snap(name, selector = "main") {
    const state = await evaluate(
      `(()=>{const root=document.querySelector(${JSON.stringify(selector)});if(!root)throw Error('missing snapshot root');return [...root.querySelectorAll('button,select,input,strong,output,[role=dialog],h2,label')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,text:e.textContent.replace(/\\s+/g,' ').trim(),label:e.getAttribute('aria-label'),disabled:e.disabled??null,current:e.getAttribute('aria-current'),rect:[r.x+scrollX,r.y+scrollY,r.width,r.height].map(v=>Math.round(v*100)/100),css:['color','backgroundColor','borderColor','borderRadius','fontSize','fontFamily','fontWeight','lineHeight','padding','gap','display','boxShadow','outlineColor','outlineWidth','transform'].map(k=>s[k])}})})()`,
    );
    await writeFile(
      join(output, name + ".json"),
      JSON.stringify(state, null, 2),
    );
    if (baseline) {
      const before = JSON.parse(
        await readFile(join(baseline, name + ".json"), "utf8"),
      );
      assert.equal(state.length, before.length, name + " element count");
      for (let i = 0; i < state.length; i++) {
        const rect = state[i].rect,
          oldRect = before[i].rect;
        for (let j = 0; j < 4; j++)
          assert.ok(
            Math.abs(rect[j] - oldRect[j]) <= 0.6,
            `${name} geometry ${i}/${j}: ${rect[j]} vs ${oldRect[j]}`,
          );
        assert.deepEqual(
          { ...state[i], rect: [] },
          { ...before[i], rect: [] },
          `${name} style/DOM ${i}`,
        );
      }
    }
    const { data } = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(join(output, name + ".png"), Buffer.from(data, "base64"));
    records.push({
      name,
      elements: state.length,
      sha256: createHash("sha256")
        .update(Buffer.from(data, "base64"))
        .digest("hex"),
      result: "PASS",
    });
  }
  await send("Page.enable");
  await send("Runtime.enable");
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await visit("/components");
    await snap(`components-${width}`);
    await click('[data-m5-case="customer"] button[aria-current]');
    await delay(200);
    assert.equal(
      await evaluate(
        `document.querySelector('[data-m5-case="customer"] button[aria-current]').matches(':hover')`,
      ),
      true,
    );
    await snap(`customer-hover-${width}`, '[data-m5-case="customer"]');
    await key("Tab", 9);
    assert.equal(
      await evaluate(`document.activeElement.matches(':focus-visible')`),
      true,
    );
    await snap(`customer-keyboard-focus-${width}`, '[data-m5-case="customer"]');
    for (const kind of ["retail-filter", "carrier-filter"]) {
      const root = `[data-m5-case="${kind}"]`;
      await click(root + ' button[aria-haspopup="dialog"]');
      await until(
        `document.activeElement === document.querySelector('${root} [role=dialog] select')`,
      );
      await snap(`${kind}-${width}`, root);
      if (acceptance) {
        const linked = await evaluate(
          `(()=>{const b=document.querySelector('${root} button[aria-haspopup]'),p=document.querySelector('${root} [role=dialog]');return b.getAttribute('aria-controls')===p.id && !!p.id && b.getAttribute('aria-expanded')==='true'})()`,
        );
        assert.equal(linked, true);
      }
      await key("Escape", 27);
      assert.equal(
        await evaluate(
          `document.activeElement===document.querySelector('${root} button[aria-haspopup]')`,
        ),
        true,
      );
      await click(root + " button[aria-haspopup]");
      await click(root + " [data-outside]");
      assert.equal(
        await evaluate(
          `!document.querySelector('${root} [role=dialog]') && document.activeElement===document.querySelector('${root} [data-outside]')`,
        ),
        true,
      );
    }
    for (const screen of ["retail", "carrier"]) {
      await visit("/" + screen);
      await snap(
        `${screen}-screen-${width}`,
        screen === "retail" ? "[data-retail-fixture]" : "[data-parity-stage]",
      );
      if (screen === "retail") {
        await click('button[aria-label="Tùy chỉnh cột hiển thị"]');
        await snap(`retail-column-picker-${width}`, "[data-retail-fixture]");
        await key("Escape", 27);
      }
    }
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await visit("/components?unknown");
  assert.equal(
    await evaluate(
      `['customer','retail','carrier','history'].every(k=>[...document.querySelectorAll('[data-m5-case="'+k+'"] button')].filter(b=>/^Trang/.test(b.getAttribute('aria-label')??'')).every(b=>b.disabled))`,
    ),
    true,
  );
  if (acceptance) {
    await visit("/components");
    for (const [kind, next, last, first] of [
      ["customer", "Trang sau", "Trang cuối", "Trang đầu"],
      ["retail", "Trang sau", "Trang cuối", "Trang đầu"],
      [
        "carrier",
        "Trang sau tài khoản",
        "Trang cuối tài khoản",
        "Trang đầu tài khoản",
      ],
      [
        "history",
        "Trang sau lịch sử",
        "Trang cuối lịch sử",
        "Trang đầu lịch sử",
      ],
    ]) {
      const root = `[data-m5-case="${kind}"]`;
      assert.equal(
        await evaluate(`document.querySelectorAll('${root} nav').length`),
        1,
      );
      await click(`${root} button[aria-label="${next}"]`);
      assert.match(
        await evaluate(
          `document.querySelector('${root} [aria-current=page]').getAttribute('aria-label')`,
        ),
        /3$/,
      );
      const previous = next.replace("sau", "trước");
      await click(`${root} button[aria-label="${previous}"]`);
      assert.match(
        await evaluate(
          `document.querySelector('${root} [aria-current=page]').getAttribute('aria-label')`,
        ),
        /2$/,
      );
      await click(`${root} button[aria-label="${last}"]`);
      await click(`${root} button[aria-label="${first}"]`);
      const numbered = `${root} button[aria-label="${kind === "carrier" ? "Trang tài khoản 2" : kind === "history" ? "Trang lịch sử 2" : "Trang 2"}"]`;
      await click(numbered);
      const keyboardNumber = numbered.replace(' 2"', ' 3"');
      await evaluate(
        `document.querySelector(${JSON.stringify(keyboardNumber)}).focus()`,
      );
      await key("Enter", 13);
      assert.match(
        await evaluate(
          `document.querySelector('${root} [aria-current=page]').getAttribute('aria-label')`,
        ),
        /3$/,
      );
      await click(`${root} button[aria-label="${first}"]`);
      assert.equal(
        await evaluate(
          `document.querySelector('${root} button[aria-label="${first}"]').disabled`,
        ),
        true,
      );
    }
    await visit("/components");
    await select('[data-m5-case="retail"] select', "20");
    assert.equal(
      await evaluate(
        `document.querySelector('[data-m5-case="retail"] [aria-current=page]').textContent`,
      ),
      "1",
    );
    for (const kind of ["retail-filter", "carrier-filter"]) {
      const root = `[data-m5-case="${kind}"]`;
      assert.equal(
        await evaluate(
          `document.querySelector('${root} button[aria-haspopup]').hasAttribute('aria-controls')`,
        ),
        false,
      );
      await click(root + " button[aria-haspopup]");
      const triggerId = await evaluate(
        `document.querySelector('${root} button[aria-haspopup]').getAttribute('aria-controls')`,
      );
      assert.ok(triggerId);
      assert.equal(
        await evaluate(`document.querySelector('${root} [role=dialog]').id`),
        triggerId,
      );
      await click(root + " button[aria-haspopup]");
      assert.equal(
        await evaluate(`!document.querySelector('${root} [role=dialog]')`),
        true,
      );
      assert.equal(
        await evaluate(
          `document.querySelector('${root} button[aria-haspopup]').hasAttribute('aria-controls')`,
        ),
        false,
      );
      await click(root + " button[aria-haspopup]");
      assert.equal(
        await evaluate(
          `document.querySelector('${root} button[aria-haspopup]').getAttribute('aria-controls')`,
        ),
        triggerId,
      );
      assert.equal(
        await evaluate(`document.querySelector('${root} [role=dialog]').id`),
        triggerId,
      );
      if (kind === "carrier-filter")
        assert.equal(
          await evaluate(
            `document.querySelector('${root} option[value=environment]').disabled`,
          ),
          true,
        );
      await click(root + " button[type=submit]");
      assert.equal(
        await evaluate(
          `!document.querySelector('${root} [role=dialog]') && document.querySelector('${root} output').textContent==='1' && document.activeElement===document.querySelector('${root} button[aria-haspopup]')`,
        ),
        true,
      );
      await click(root + " button[aria-haspopup]");
      if (kind === "retail-filter") await click(root + " button[type=submit]");
      assert.equal(
        await evaluate(`!!document.querySelector('${root} [role=alert]')`),
        true,
      );
      await key("Escape", 27);
      await click(root + " button[aria-haspopup]");
      // Field changes retain feature defaults/errors and disable unavailable environment.
      await select(
        root + " select",
        kind === "retail-filter" ? "weightKg" : "accountName",
      );
      const invalidField = await evaluate(
        `document.querySelector('${root} input')?.value`,
      );
      assert.equal(invalidField, "");
      if (kind === "retail-filter") {
        await click(root + " button[type=submit]");
        assert.match(
          await evaluate(
            `document.querySelector('${root} [role=alert]').textContent`,
          ),
          /hợp lệ/,
        );
      } else
        assert.equal(
          await evaluate(
            `document.querySelector('${root} button[type=submit]').disabled`,
          ),
          true,
        );
      await click(root + ' button[aria-label="Đóng bộ lọc"]');
      assert.equal(
        await evaluate(
          `document.activeElement===document.querySelector('${root} button[aria-haspopup]')`,
        ),
        true,
      );
    }
    await visit("/components?historyTotal=20");
    assert.equal(
      await evaluate(
        `document.querySelectorAll('[data-m5-case="history"] [aria-label^="Trang lịch sử "]').length`,
      ),
      5,
    );
    await visit("/components?max");
    await click('[data-m5-case="retail-filter"] button[aria-haspopup]');
    await click('[data-m5-case="retail-filter"] button[type=submit]');
    assert.match(
      await evaluate(
        `document.querySelector('[data-m5-case="retail-filter"] [role=alert]').textContent`,
      ),
      /12/,
    );
    await visit("/components?carrierMax");
    const carrierRoot = '[data-m5-case="carrier-filter"]';
    await click(carrierRoot + " button[aria-haspopup]");
    await click(carrierRoot + " button[type=submit]");
    assert.match(
      await evaluate(
        `document.querySelector('${carrierRoot} [role=alert]').textContent`,
      ),
      /12/,
    );
    await click(carrierRoot + " button[aria-haspopup]");
    await click(carrierRoot + " button[aria-haspopup]");
    assert.match(
      await evaluate(
        `document.querySelector('${carrierRoot} [role=alert]').textContent`,
      ),
      /12/,
    );
    await key("Escape", 27);
    await click(carrierRoot + " button[aria-haspopup]");
    assert.equal(
      await evaluate(`!document.querySelector('${carrierRoot} [role=alert]')`),
      true,
    );
    await visit("/components?environment");
    await click(carrierRoot + " button[aria-haspopup]");
    await select(carrierRoot + " select", "environment");
    assert.equal(
      await evaluate(
        `document.querySelectorAll('${carrierRoot} select')[2].value`,
      ),
      "production",
    );
    for (const state of ["empty", "single"]) {
      await visit("/components?" + state);
      assert.equal(
        await evaluate(
          `['customer','retail','carrier'].every(k=>[...document.querySelectorAll('[data-m5-case="'+k+'"] button')].filter(b=>/đầu|trước|sau|cuối/.test(b.getAttribute('aria-label')??'')).every(b=>b.disabled))`,
        ),
        true,
      );
    }
    await visit("/components?unknown");
    await evaluate(
      `document.querySelector('[data-m5-case="customer"] select').focus()`,
    );
    await key("Tab", 9);
    assert.equal(
      await evaluate(
        `document.activeElement===document.querySelector('[data-m5-case="retail"] select')`,
      ),
      true,
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(
    join(output, "manifest.json"),
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        bundleHashes,
        baseline: baseline ?? null,
        records,
        result: "PASS",
        scope:
          "actual components and isolated Retail/Carrier screens; no authenticated full-stack claim",
      },
      null,
      2,
    ),
  );
  console.log(
    `M5 Chromium PASS: ${records.length} visual captures; focus/dismissal/unknown${acceptance ? "/navigation/ARIA/filter regressions" : ""}`,
  );
} finally {
  socket?.close();
  await terminateChildProcess(child);
  await cleanupBrowserProfile(profile);
  await new Promise((r) => server.close(r));
}
