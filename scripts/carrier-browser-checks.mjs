// Reuses the authenticated CDP session and the existing TSX fixture compiler.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
export async function verifyCarrierBrowser({
  send,
  evaluate,
  socket,
  baseUrl,
  prefix,
  checks,
  fixtureDirectory = resolve("artifacts/carrier-fixture"),
  evidenceDirectory = process.env.CARRIER_EVIDENCE_DIR,
  fixtureOnly = false,
}) {
  const records = [],
    badRequests = [],
    errors = [];
  let origin = "",
    server;
  const listener = (event) => {
    const m = JSON.parse(event.data);
    if (m.method === "Network.requestWillBeSent") {
      const { url, method } = m.params.request,
        u = new URL(url);
      if (
        (u.origin === baseUrl && /\/api\/carrier/.test(u.pathname)) ||
        (u.origin === origin && !["GET", "HEAD"].includes(method))
      )
        badRequests.push(method);
    }
    if (m.method === "Runtime.exceptionThrown")
      errors.push("BROWSER_EXCEPTION");
  };
  socket.addEventListener("message", listener);
  async function until(expression) {
    for (let n = 0; n < 100; n++) {
      assert.deepEqual(errors, []);
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw Error("CARRIER_BROWSER_CONDITION: " + expression);
  }
  async function click(text) {
    const point = await evaluate(
      `(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(text)}||e.textContent.trim()===${JSON.stringify(text)});if(!e||e.disabled)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`,
    );
    assert.ok(point, text);
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 1,
      ...point,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 1,
      ...point,
    });
  }
  async function key(key, shift = false) {
    for (const type of ["keyDown", "keyUp"])
      await send("Input.dispatchKeyEvent", {
        type,
        key,
        code: key,
        windowsVirtualKeyCode: {
          Escape: 27,
          Tab: 9,
          ArrowRight: 39,
          ArrowLeft: 37,
          Enter: 13,
        }[key],
        ...(key === "Enter" && type === "keyDown"
          ? { text: "\r", unmodifiedText: "\r" }
          : {}),
        modifiers: shift ? 8 : 0,
      });
  }
  async function input(selector, value) {
    await evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  }
  async function select(label, value) {
    await evaluate(
      `(()=>{const e=document.querySelector('select[aria-label="${label}"]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
  }
  async function focusContained() {
    for (let i = 0; i < 12; i++) {
      await key("Tab", i % 3 === 0);
      assert.equal(
        await evaluate(
          "[...document.querySelectorAll('dialog[open]')].at(-1)?.contains(document.activeElement)",
        ),
        true,
        "native top modal keeps keyboard focus",
      );
    }
  }
  async function capture(phase) {
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [1024, 768],
      [768, 1024],
      [390, 844],
      [375, 812],
    ]) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evaluate(
        "document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))",
      );
      const geometry = await evaluate(
        `(()=>{const d=[...document.querySelectorAll('dialog[open]')];return {noOverflow:document.documentElement.scrollWidth<=innerWidth,cols:document.querySelectorAll('colgroup col').length,controls:[...document.querySelectorAll('button[data-size=default],input[data-size=default],select[data-size=default]')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().height),verticalBorders:[...document.querySelectorAll('table th,table td')].every(e=>getComputedStyle(e).borderRightWidth==='0px' && getComputedStyle(e).borderLeftWidth==='0px'),passwordBlank:[...document.querySelectorAll('input[type=password]')].every(e=>!e.value),dialogs:d.map(e=>{const r=e.getBoundingClientRect();return {width:r.width,left:r.left,right:r.right,height:r.height}})}})()`,
      );
      assert.equal(geometry.noOverflow, true, phase + " document overflow");
      assert.equal(geometry.cols, 7);
      assert.equal(geometry.verticalBorders, true);
      assert.ok(
        geometry.controls.length > 0 &&
          geometry.controls.every((h) => Math.abs(h - 32) < 1),
        "canonical default32 controls",
      );
      assert.equal(
        geometry.passwordBlank,
        true,
        "Never capture credential drafts",
      );
      assert.ok(
        geometry.dialogs.every(
          (d) => d.left >= -1 && d.right <= width + 1 && d.height <= height + 1,
        ),
      );
      if (evidenceDirectory) {
        await mkdir(evidenceDirectory, { recursive: true });
        const shot = await send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: false,
        });
        const bytes = Buffer.from(shot.data, "base64"),
          file = `${prefix}-${phase}-${width}x${height}.png`;
        await writeFile(resolve(evidenceDirectory, file), bytes);
        records.push({
          file,
          width,
          height,
          geometry,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
    await send("Emulation.clearDeviceMetricsOverride");
  }
  try {
    await send("Network.enable");
    await send("Runtime.enable");
    if (!fixtureOnly) {
      checks.step("CARRIER_PRODUCTION_ROUTE_AND_NO_BACKEND");
      const guest = await fetch(baseUrl + "/settings/carrier-connections", {
        redirect: "manual",
      });
      assert.equal(guest.status, 307);
      assert.equal(
        new URL(guest.headers.get("location"), baseUrl).pathname,
        "/login",
      );
      await send("Page.navigate", {
        url: baseUrl + "/settings/carrier-connections",
      });
      await until("!!document.querySelector('[data-carrier-connections]')");
      await send("Page.navigate", { url: baseUrl + "/settings" });
      await until(
        "!!document.querySelector('button[aria-label^=\"Tài khoản người dùng\"]') && document.readyState==='complete'",
      );
      // Harmless toggle proves hydration before testing controls.
      await until(
        `(()=>{const t=document.querySelector('button[aria-label^="Tài khoản người dùng"]');if(t?.getAttribute('aria-expanded')==='true')return true;t?.click();return false})()`,
      );
      assert.equal(
        await evaluate(
          "!!document.querySelector('a[href=\"/settings/carrier-connections\"]')",
        ),
        true,
      );
      await evaluate(
        "document.querySelector('a[href=\"/settings/carrier-connections\"]').click()",
      );
      await until(
        "location.pathname==='/settings/carrier-connections' && !!document.querySelector('[data-carrier-connections]')",
      );
      assert.equal(
        await evaluate(
          "document.querySelector('nav[aria-label=\"Breadcrumb\"] [aria-current=page]')?.textContent==='Kết nối hãng vận chuyển' && document.querySelector('nav[aria-label=\"Breadcrumb\"]').textContent.includes('Cài đặt')",
        ),
        true,
      );
      await key("Escape");
      assert.equal(
        await evaluate("document.querySelectorAll('tbody tr').length"),
        1,
      );
      assert.equal(
        await evaluate(
          "document.querySelector('[data-carrier-connections]').textContent.includes('Chưa tích hợp dữ liệu')",
        ),
        true,
      );
      await capture("production");
      await click("Xem giao diện đồng bộ");
      await until("!!document.querySelector('dialog[open]')");
      assert.equal(
        await evaluate("document.querySelectorAll('progress').length"),
        0,
      );
      await capture("production-sync");
      await key("Escape");
    }
    const files = new Map([
      ["/fixture", resolve(fixtureDirectory, "index.html")],
      ["/bundle.js", resolve(fixtureDirectory, "bundle.js")],
      ["/inter.woff2", resolve("apps/web/app/fonts/InterVariable.woff2")],
    ]);
    server = createServer((req, res) => {
      const path = new URL(req.url, "http://localhost").pathname,
        file = files.get(path);
      if (req.method !== "GET" || !file) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader(
        "content-type",
        path.endsWith(".js")
          ? "text/javascript"
          : path.endsWith("woff2")
            ? "font/woff2"
            : "text/html",
      );
      readFile(file)
        .then((b) => res.end(b))
        .catch(() => {
          res.writeHead(500);
          res.end();
        });
    });
    await new Promise((yes, no) => {
      server.once("error", no);
      server.listen(0, "127.0.0.1", yes);
    });
    origin = "http://127.0.0.1:" + server.address().port;
    await send("Page.navigate", { url: origin + "/fixture" });
    await until("document.querySelectorAll('tbody tr').length===20");
    checks.step("CARRIER_FIXTURE_FILTERS_AND_PAGINATION");
    await capture("list");
    await click("Trang sau tài khoản");
    await until("document.querySelectorAll('tbody tr').length===7");
    await click("Trang đầu tài khoản");
    await until("document.querySelectorAll('tbody tr').length===20");
    await select("Số dòng tài khoản mỗi trang", "5");
    await until("document.querySelectorAll('tbody tr').length===5");
    await select("Lọc hãng vận chuyển", "fixture-b");
    await until(
      "[...document.querySelectorAll('tbody tr')].every(e=>e.textContent.includes('Hãng B'))",
    );
    await select("Lọc trạng thái kết nối", "ERROR");
    await until(
      "[...document.querySelectorAll('tbody tr')].every(e=>e.textContent.includes('Lỗi kết nối'))",
    );
    assert.equal(
      await evaluate(
        "document.querySelector('[aria-label=\"Bộ lọc đang áp dụng\"]').textContent.includes('Hãng B')",
      ),
      true,
    );
    await click("Đặt lại bộ lọc");
    await select("Số dòng tài khoản mỗi trang", "20");
    await until("document.querySelectorAll('tbody tr').length===20");

    await input(
      'input[aria-label="Tìm tài khoản kết nối"]',
      "no-matching-carrier",
    );
    await until(
      "document.querySelector('tbody').textContent.includes('Không có kết quả')",
    );
    await click("Đặt lại bộ lọc");
    await until("document.querySelectorAll('tbody tr').length===20");
    await click("KẾT NỐI HÃNG MỚI");
    await until(
      "!!document.querySelector('dialog[open] input[type=password]')",
    );
    await click("Kiểm tra thông tin");
    await until("document.querySelectorAll('[aria-invalid=true]').length===3");
    await focusContained();
    await capture("form-validation");
    for (const [name, value] of [
      ["displayName", "Local draft"],
      ["loginIdentifier", "draft-user"],
      ["password", "test-only-unsaved"],
    ])
      await input(`input[name=${name}]`, value);
    await click("Kiểm tra thông tin");
    await until(
      "document.querySelector('[role=alert]')?.textContent.includes('Chưa thể lưu')",
    );
    await key("Escape");
    await until("!document.querySelector('dialog[open]')");
    await click("KẾT NỐI HÃNG MỚI");
    await until("!!document.querySelector('input[type=password]')");
    assert.equal(
      await evaluate("document.querySelector('input[type=password]').value"),
      "",
    );
    await key("Escape");
    const firstAction = async (action) => {
      await evaluate(
        `document.querySelector('tbody button[aria-label^="${action}"]').click()`,
      );
      await until("!!document.querySelector('dialog[open]')");
    };
    await firstAction("Chỉnh sửa");
    assert.equal(
      await evaluate("document.querySelector('input[type=password]').value"),
      "",
    );
    assert.equal(
      await evaluate(
        "!!document.querySelector('input[name=displayName]').value",
      ),
      true,
    );
    await key("Escape");
    await firstAction("Chi tiết");
    await capture("details");
    await key("Escape");
    await firstAction("Ngắt kết nối");
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('dialog[open] button')].some(e=>e.disabled&&e.textContent.includes('Ngắt'))",
      ),
      true,
    );
    await key("Escape");
    await firstAction("Đồng bộ");
    await capture("sync-status");
    await click("Xem tiến độ");
    await until("document.querySelectorAll('dialog[open]').length===2");
    await focusContained();
    await capture("sync-inspect");
    await key("Escape");
    await until("document.querySelectorAll('dialog[open]').length===1");
    await click("Xem lỗi");
    await until("document.querySelectorAll('dialog[open]').length===2");
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('dialog[open]')].at(-1).textContent.includes('Chi tiết lỗi')",
      ),
      true,
    );
    await key("Escape");
    await until("document.querySelectorAll('dialog[open]').length===1");
    await click("Lịch tự động");
    await capture("sync-schedule");
    await evaluate(
      "document.querySelector('dialog[open] input[type=checkbox]').click()",
    );
    await click("Lịch sử đồng bộ");
    await until("document.querySelectorAll('dialog[open] ol li').length===40");
    await capture("sync-history");
    assert.equal(
      await evaluate(
        "(()=>{const e=document.querySelector('dialog[open] [role=tabpanel]');e.scrollTop=e.scrollHeight;return e.scrollTop>0})()",
      ),
      true,
      "history scrolls within fixed drawer",
    );
    await select("Lọc lịch sử đồng bộ", "failed");
    await until(
      "document.querySelectorAll('dialog[open] ol li').length>0 && document.querySelectorAll('dialog[open] ol li').length<40",
    );
    await key("Escape");
    await until("!document.querySelector('dialog[open]')");
    await firstAction("Đồng bộ");
    await click("Lịch tự động");
    assert.equal(
      await evaluate(
        "document.querySelector('dialog[open] input[type=checkbox]').checked",
      ),
      false,
      "unsaved schedule discarded on close",
    );
    await key("Escape");
    assert.equal(
      await evaluate("localStorage.length===0 && sessionStorage.length===0"),
      true,
      "fixture drafts are never persisted",
    );
    assert.deepEqual(badRequests, []);
    assert.deepEqual(errors, []);
    checks.step("CARRIER_UI_ONLY_AND_DRAWERS_PASS");
  } finally {
    socket.removeEventListener("message", listener);
    try {
      await send("Emulation.clearDeviceMetricsOverride");
      if (server)
        await send("Page.navigate", {
          url: fixtureOnly ? "about:blank" : baseUrl + "/settings",
        });
    } finally {
      if (server)
        await new Promise((r) => {
          server.close(r);
          server.closeAllConnections();
        });
    }
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(
        resolve(evidenceDirectory, `${prefix}.json`),
        JSON.stringify(
          { sourceCommit: process.env.GITHUB_SHA ?? null, records },
          null,
          2,
        ),
      );
    }
    assert.deepEqual(badRequests, [], "No Carrier API calls or fixture writes");
  }
}
