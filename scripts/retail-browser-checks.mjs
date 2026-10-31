// Extends the existing Chromium session; fixture origin exists only during this test.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const viewports = [
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [375, 812],
];
export async function verifyRetailBrowser({
  send,
  evaluate,
  socket,
  baseUrl,
  prefix,
  checks,
  fixtureDirectory = resolve(root, "artifacts/retail-fixture"),
  evidenceDirectory = process.env.M3_EVIDENCE_DIR,
  fixtureOnly = false,
}) {
  const records = [];
  let fixtureOrigin = "",
    server;
  const badRequests = [],
    errors = [];
  const listener = (event) => {
    const m = JSON.parse(event.data);
    if (m.method === "Network.requestWillBeSent") {
      const r = m.params.request,
        u = new URL(r.url);
      if (
        (u.origin === baseUrl && u.pathname.startsWith("/api/shipments")) ||
        (fixtureOrigin &&
          u.origin === fixtureOrigin &&
          !["GET", "HEAD"].includes(r.method))
      )
        badRequests.push(r.method);
    }
    if (fixtureOrigin && m.method === "Runtime.exceptionThrown")
      errors.push("BROWSER_EXCEPTION");
  };
  socket.addEventListener("message", listener);
  async function until(expression) {
    for (let n = 0; n < 100; n++) {
      assert.equal(errors.length, 0, "fixture must not throw");
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw Error("RETAIL_BROWSER_CONDITION");
  }
  async function key(key, shift = false) {
    const code = {
      Escape: 27,
      Tab: 9,
      Enter: 13,
      ArrowRight: 39,
      ArrowLeft: 37,
    }[key];
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code: key,
      windowsVirtualKeyCode: code,
      modifiers: shift ? 8 : 0,
      ...(key === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {}),
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code: key,
      windowsVirtualKeyCode: code,
      modifiers: shift ? 8 : 0,
    });
  }
  async function click(name) {
    const found = await evaluate(
      `(()=>{const b=Array.from(document.querySelectorAll('button')).find(e=>e.getAttribute('aria-label')===${JSON.stringify(name)}||e.textContent.trim()===${JSON.stringify(name)});if(!b||b.disabled)return false;b.focus();b.click();return true;})()`,
    );
    assert.equal(found, true, "required action " + name);
  }
  async function select(label, value) {
    assert.equal(
      await evaluate(
        `(()=>{const e=Array.from(document.querySelectorAll('select')).find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)}||document.querySelector('label[for="'+e.id+'"]')?.textContent===${JSON.stringify(label)});if(!e)return false;e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`,
      ),
      true,
    );
  }
  async function type(label, value) {
    const selector = `(()=>{return Array.from(document.querySelectorAll('input')).find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)}||document.querySelector('label[for="'+e.id+'"]')?.textContent===${JSON.stringify(label)});})()`;
    assert.equal(
      await evaluate(
        `(()=>{const e=${selector};if(!e)return false;e.focus();e.select();return true;})()`,
      ),
      true,
    );
    await send("Input.insertText", { text: value });
    assert.equal(
      await evaluate(`(${selector}).value===${JSON.stringify(value)}`),
      true,
    );
  }
  async function navigate(url) {
    await send("Page.navigate", { url });
    await until(
      "Boolean(document.querySelector('#retail-packages-heading'))&&document.readyState==='complete'",
    );
  }
  async function snapshot(phase) {
    if (!evidenceDirectory) return;
    await mkdir(evidenceDirectory, { recursive: true });
    for (const [width, height] of viewports) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evaluate(
        "document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))))",
      );
      const geometry = await evaluate(
        `(()=>{const list=document.querySelector('#retail-packages-list-page'),tabs=document.querySelector('[role=tablist]'),table=document.querySelector('table'),dialog=document.querySelector('dialog[open]');return{noOverflow:document.documentElement.scrollWidth<=innerWidth,tabs:tabs.querySelectorAll('[role=tab]').length,cols:table.querySelectorAll('colgroup col').length,availability:list.dataset.availability,dialog:!!dialog,dialogFits:!dialog||dialog.getBoundingClientRect().width<=innerWidth,panelsFit:Array.from(document.querySelectorAll('[role=dialog]')).filter(e=>e.getClientRects().length).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}),controls:Array.from(document.querySelectorAll('button[data-size=default],input[data-size=default],select[data-size=default]')).filter(e=>e.getClientRects().length&&!e.closest('[inert]')).map(e=>e.getBoundingClientRect().height)};})()`,
      );
      assert.equal(geometry.noOverflow, true);
      assert.equal(geometry.tabs, 7);
      assert.equal(geometry.dialogFits, true);
      assert.equal(geometry.panelsFit, true, "popover remains within viewport");
      assert.ok(geometry.controls.length > 0);
      assert.ok(
        geometry.controls.every((h) => Math.abs(h - 32) < 1),
        "shared controls default32",
      );
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
        sha256: createHash("sha256").update(bytes).digest("hex"),
        geometry,
      });
    }
    await send("Emulation.clearDeviceMetricsOverride");
  }
  try {
    await send("Network.enable");
    await send("Runtime.enable");
    if (!fixtureOnly) {
      checks.step("RETAIL_PRODUCTION_AUTH_AND_TRUTH");
      const guest = await fetch(baseUrl + "/shipments/retail", {
        redirect: "manual",
      });
      assert.equal(guest.status, 307);
      assert.ok(
        new URL(guest.headers.get("location"), baseUrl).pathname === "/login",
      );
      await navigate(baseUrl + "/shipments/retail");
      assert.equal(
        await evaluate("document.querySelectorAll('[data-package-id]').length"),
        0,
      );
      assert.equal(
        await evaluate(
          "document.querySelector('[data-availability]').dataset.availability",
        ),
        "unavailable",
      );
      assert.equal(
        await evaluate("document.querySelectorAll('[role=tab]').length"),
        7,
      );
      assert.equal(
        await evaluate(
          "Array.from(document.querySelectorAll('[role=tab] span[class*=\"badge\"]')).every(b => b.textContent.trim() === '0')",
        ),
        true,
        "Production unavailable badges present placeholder 0",
      );
      assert.equal(
        await evaluate("document.querySelectorAll('colgroup col').length"),
        19,
      );
      assert.equal(
        await evaluate(
          "document.querySelector('button[aria-label=\"Tạo kiện lẻ mới\"]').disabled",
        ),
        true,
      );
      assert.equal(
        await evaluate(
          "document.querySelectorAll('main [data-workspace-frame]').length>0||!!document.querySelector('header')",
        ),
        true,
      );
      await snapshot("production-unavailable");
    }
    if (prefix !== "admin" && !fixtureOnly) return;
    checks.step("RETAIL_ISOLATED_FIXTURE");
    const files = new Map([
      ["/bundle.js", resolve(fixtureDirectory, "bundle.js")],
      ["/fixture", resolve(fixtureDirectory, "index.html")],
      ["/reference-sample", resolve(fixtureDirectory, "index.html")],
      ["/inter.woff2", resolve(root, "apps/web/app/fonts/InterVariable.woff2")],
    ]);
    await readFile(files.get("/bundle.js")); // Missing real compiled fixture is a failure, not a skip.
    server = createServer((req, res) => {
      const path = new URL(req.url, "http://localhost").pathname;
      const file = files.get(path);
      if (!file || !["GET", "HEAD"].includes(req.method)) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader(
        "content-type",
        path.endsWith(".js")
          ? "text/javascript"
          : path.endsWith(".woff2")
            ? "font/woff2"
            : "text/html; charset=utf-8",
      );
      readFile(file)
        .then((bytes) => res.end(bytes))
        .catch(() => {
          res.statusCode = 500;
          res.end();
        });
    });
    await new Promise((yes, no) => {
      server.once("error", no);
      server.listen(0, "127.0.0.1", yes);
    });
    fixtureOrigin = "http://127.0.0.1:" + server.address().port;
    await navigate(fixtureOrigin + "/fixture");
    await until(
      "!!document.querySelector('[data-retail-fixture]')&&document.querySelector('[data-retail-count]').textContent==='30 kiện lẻ'",
    );
    await snapshot("all");
    checks.step("RETAIL_SEVEN_TABS_AND_HISTORY");
    const expectedIconColors = {
      all: "rgb(23, 43, 77)",
      to_origin: "rgb(180, 83, 9)",
      at_origin: "rgb(29, 78, 216)",
      in_transit: "rgb(67, 56, 202)",
      at_dest: "rgb(4, 120, 87)",
      delivered: "rgb(15, 118, 110)",
      disputed: "rgb(190, 18, 60)",
    };

    // Verify typography and border geometry contract
    const stylesContract = await evaluate(`(()=>{
      const tab = document.querySelector('#retail-tab-all');
      const title = tab.querySelector('span[class*="tabTitle"]');
      const badge = tab.querySelector('span[class*="badge"]');
      const titleRow = document.querySelector('div[class*="titleRow"]');
      const wrapper = document.querySelector('div[class*="tabBarWrapper"]');
      const toolbar = document.querySelector('div[class*="toolbar"]');
      return {
        titleFontSize: window.getComputedStyle(title).fontSize,
        titleFontWeight: window.getComputedStyle(title).fontWeight,
        badgeFontSize: window.getComputedStyle(badge).fontSize,
        titleRowBorderBottom: window.getComputedStyle(titleRow).borderBottomWidth,
        wrapperMarginBottom: window.getComputedStyle(wrapper).marginBottom,
        toolbarBorderTop: window.getComputedStyle(toolbar).borderTopWidth,
      };
    })()`);

    assert.equal(
      stylesContract.titleFontSize,
      "14px",
      "Tab title font-size must be 14px",
    );
    assert.equal(
      stylesContract.badgeFontSize,
      "12px",
      "Badge font-size must be 12px",
    );
    assert.equal(
      stylesContract.titleRowBorderBottom,
      "1px",
      "Title row must have 1px border-bottom",
    );
    assert.equal(
      stylesContract.wrapperMarginBottom,
      "0px",
      "TabBarWrapper must have 0 margin-bottom",
    );
    assert.equal(
      stylesContract.toolbarBorderTop,
      "0px",
      "Toolbar must have 0 border-top",
    );

    for (const status of [
      "all",
      "to_origin",
      "at_origin",
      "in_transit",
      "at_dest",
      "delivered",
      "disputed",
    ]) {
      await evaluate(
        `document.querySelector('#retail-tab-${status}').click();true`,
      );
      await until(
        `document.querySelector('#retail-tab-${status}').getAttribute('aria-selected')==='true'`,
      );
      assert.equal(
        await evaluate(
          "document.querySelector('[data-retail-count]').textContent",
        ),
        status === "all" ? "30 kiện lẻ" : "5 kiện lẻ",
      );

      // Verify active tab icon color matches status tone (waiting for transition to complete)
      await until(
        `window.getComputedStyle(document.querySelector('#retail-tab-${status} span[class*="tabIcon"]')).color===${JSON.stringify(expectedIconColors[status])}`,
      );
      const activeColor = await evaluate(
        `window.getComputedStyle(document.querySelector('#retail-tab-${status} span[class*="tabIcon"]')).color`,
      );
      assert.equal(
        activeColor,
        expectedIconColors[status],
        `Active icon color for ${status}`,
      );

      // Verify active tab font-weight remains 600 (no shift)
      const tabWeight = await evaluate(
        `window.getComputedStyle(document.querySelector('#retail-tab-${status}')).fontWeight`,
      );
      assert.equal(tabWeight, "600", "Tab font-weight remains 600 when active");
    }
    await snapshot("status");
    await evaluate("history.back();true");
    await until(
      "document.querySelector('#retail-tab-delivered').getAttribute('aria-selected')==='true'",
    );
    await evaluate("history.forward();true");
    await until(
      "document.querySelector('#retail-tab-disputed').getAttribute('aria-selected')==='true'",
    );
    await send("Page.reload");
    await until(
      "document.querySelector('#retail-tab-disputed')?.getAttribute('aria-selected')==='true'",
    );
    await evaluate("document.querySelector('#retail-tab-all').click();true");
    await until(
      "document.querySelector('#retail-tab-all').getAttribute('aria-selected')==='true'",
    );
    await evaluate("document.querySelector('#retail-tab-all').focus();true");
    await key("ArrowRight");
    // Under manual activation, focus moves to to_origin but selected remains all until Enter is pressed
    assert.equal(
      await evaluate("document.activeElement.id"),
      "retail-tab-to_origin",
      "ArrowRight moves DOM focus to next tab without immediate activation",
    );
    assert.equal(
      await evaluate(
        "document.querySelector('#retail-tab-all').getAttribute('aria-selected')",
      ),
      "true",
      "aria-selected remains on previous tab before Enter",
    );
    assert.equal(
      await evaluate(
        "document.querySelector('#retail-tab-to_origin').getAttribute('aria-selected')",
      ),
      "false",
      "next tab is not yet selected before Enter",
    );
    await key("Enter");
    await until(
      "document.querySelector('#retail-tab-to_origin').getAttribute('aria-selected')==='true'",
    );
    await navigate(fixtureOrigin + "/fixture");
    await until(
      "document.querySelector('[data-retail-count]').textContent==='30 kiện lẻ'",
    );
    checks.step("RETAIL_SEARCH_FILTER_AND_DUPLICATE");
    await type("Tìm kiếm kiện lẻ", "FIXTURE0001");
    await until(
      "document.querySelector('[data-retail-count]').textContent==='1 kiện lẻ'",
    );
    await type("Tìm kiếm kiện lẻ", "");
    await until(
      "document.querySelector('[data-retail-count]').textContent==='30 kiện lẻ'",
    );
    await click("Bộ lọc nâng cao");
    await snapshot("filter-popover");
    await select("Trường lọc", "weightKg");
    await select("Toán tử", "greater_than");
    await type("Giá trị", "5");
    await click("Thêm điều kiện");
    await until(
      "document.querySelector('[data-retail-count]').textContent==='25 kiện lẻ'",
    );
    assert.equal(
      await evaluate("new URLSearchParams(location.search).get('page')"),
      "1",
    );
    await snapshot("advanced-filter");
    await click("Bộ lọc nâng cao");
    await type("Giá trị", "5");
    await click("Thêm điều kiện");
    await until(
      "document.querySelector('[role=alert]')?.textContent.includes('đã tồn tại')",
    );
    await key("Escape");
    await click("Bộ lọc nâng cao");
    await select("Trường lọc", "weightKg");
    await select("Toán tử", "less_than");
    await type("Giá trị", "10");
    await click("Thêm điều kiện");
    await until(
      "document.querySelector('[data-retail-count]').textContent==='4 kiện lẻ'",
    );
    await evaluate(
      `document.querySelector('button[aria-label^="Xóa bộ lọc:"]').click();true`,
    );
    await until(
      "document.querySelector('[data-retail-count]').textContent==='9 kiện lẻ'",
    );
    await click("Xóa tất cả");
    await until(
      "document.querySelector('[data-retail-count]').textContent==='30 kiện lẻ'",
    );
    const dateFilter = encodeURIComponent(
      JSON.stringify([
        {
          field: "originWarehouseDate",
          operator: "before",
          value: "2026-02-15",
        },
      ]),
    );
    await navigate(fixtureOrigin + "/fixture?filters=" + dateFilter);
    await until(
      "document.querySelector('[data-retail-count]').textContent==='15 kiện lẻ'",
    );
    await click("Xóa tất cả");
    checks.step("RETAIL_COLUMNS_PRESETS_STICKY");
    await click("Tùy chỉnh cột hiển thị");
    await snapshot("column-picker");
    assert.equal(
      await evaluate(
        "document.querySelector('[role=dialog] button[aria-pressed=true]')?.textContent?.trim()",
      ),
      "Mặc định",
    );
    await click("Cơ bản");
    assert.equal(
      await evaluate("document.querySelectorAll('colgroup col').length"),
      7,
    );
    assert.equal(
      await evaluate(
        "document.querySelector('[role=dialog] button[aria-pressed=true]')?.textContent?.trim()",
      ),
      "Cơ bản",
    );
    const basicWidthCheck = await evaluate(
      `(()=>{const table=document.querySelector('table'),container=table.parentElement;return{tableWidth:table.getBoundingClientRect().width,containerWidth:container.clientWidth};})()`,
    );
    assert.ok(
      Math.abs(basicWidthCheck.tableWidth - basicWidthCheck.containerWidth) <=
        2,
      "table spans full container width when 7 columns are shown",
    );
    await click("Mặc định");
    assert.equal(
      await evaluate("document.querySelectorAll('colgroup col').length"),
      19,
    );
    assert.equal(
      await evaluate(
        "document.querySelector('[role=dialog] button[aria-pressed=true]')?.textContent?.trim()",
      ),
      "Mặc định",
    );
    await key("Escape");
    await until("!document.querySelector('[role=dialog]')");
    assert.equal(
      await evaluate("document.activeElement.getAttribute('aria-label')"),
      "Tùy chỉnh cột hiển thị",
    );
    await click("Tùy chỉnh cột hiển thị");
    await click("Tất cả");
    assert.equal(
      await evaluate("document.querySelectorAll('colgroup col').length"),
      20,
    );
    assert.equal(
      await evaluate(
        "document.querySelector('[role=dialog] button[aria-pressed=true]')?.textContent?.trim()",
      ),
      "Tất cả",
    );
    await type("Tìm tên cột", "HÃNG VẬN CHUYỂN");
    await evaluate(
      `(()=>{const cb=document.querySelector('[role=dialog] input[type=checkbox]:not(:disabled)');if(cb){cb.click();}})()`,
    );
    await type("Tìm tên cột", "");
    assert.equal(
      await evaluate("document.querySelectorAll('colgroup col').length"),
      19,
    );
    await type("Tìm tên cột", "MÃ VẬN ĐƠN");
    assert.equal(
      await evaluate(
        "document.querySelector('[role=dialog] input[type=checkbox]').disabled",
      ),
      true,
    );
    assert.equal(
      await evaluate(
        "document.querySelector('[role=dialog] [class*=\"colPinnedBadge\"]')?.textContent?.trim()",
      ),
      "Cố định",
    );
    await type("Tìm tên cột", "");
    await click("Đã xong");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1024,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const sticky = await evaluate(
      `(()=>{const viewport=document.querySelector('table').parentElement,cell=document.querySelector('tbody td[data-column=trackingCode]');viewport.scrollLeft=600;const r=cell.getBoundingClientRect(),v=viewport.getBoundingClientRect();return{left:r.left- v.left,width:r.width,opaque:getComputedStyle(cell).backgroundColor!=='rgba(0, 0, 0, 0)'};})()`,
    );
    assert.ok(Math.abs(sticky.left) < 2);
    assert.equal(sticky.width, 150);
    assert.equal(sticky.opaque, true);
    await snapshot("horizontal-scroll");
    await evaluate(
      "document.querySelector('table').parentElement.scrollLeft=0;true",
    );
    await send("Emulation.clearDeviceMetricsOverride");
    checks.step("RETAIL_PAGINATION");
    await select("Số dòng mỗi trang", "5");
    await click("Trang sau");
    assert.equal(
      await evaluate("new URLSearchParams(location.search).get('page')"),
      "2",
    );
    await send("Page.reload");
    await until(
      "document.querySelector('[aria-current=page]')?.textContent==='2'",
    );
    checks.step("RETAIL_DETAIL_AND_CREATE_NATIVE_DIALOG");
    await evaluate(
      "(()=>{const b=document.querySelector('tbody button[aria-label^=\"Xem\"]');if(!b)throw Error('DETAIL_TRIGGER_MISSING');b.focus();b.click();return true;})()",
    );
    await until("!!document.querySelector('dialog[open]')");
    assert.equal(
      await evaluate(
        "document.querySelectorAll('dialog[open] [role=dialog]').length",
      ),
      0,
    );
    await snapshot("detail");
    await key("Tab", true);
    assert.equal(
      await evaluate("!!document.activeElement.closest('dialog[open]')"),
      true,
    );
    await key("Tab");
    assert.equal(
      await evaluate("!!document.activeElement.closest('dialog[open]')"),
      true,
    );
    await key("Escape");
    await until("!document.querySelector('dialog[open]')");
    assert.equal(
      await evaluate(
        "document.activeElement.getAttribute('aria-label')?.startsWith('Xem')",
      ),
      true,
    );
    await click("Tạo kiện lẻ mới");
    await until("!!document.querySelector('dialog[open]')");
    assert.equal(
      await evaluate(
        "document.querySelector('dialog[open] button[type=submit]').disabled",
      ),
      true,
    );
    assert.equal(
      await evaluate(
        "document.querySelectorAll('dialog[open] [role=dialog]').length",
      ),
      0,
    );
    assert.equal(
      await evaluate(
        "document.querySelector('dialog[open]').textContent.includes('NEXORA Linehaul')",
      ),
      false,
    );
    await snapshot("create");
    await key("Escape");
    await until("!document.querySelector('dialog[open]')");
    assert.equal(
      await evaluate("document.activeElement.getAttribute('aria-label')"),
      "Tạo kiện lẻ mới",
    );
    checks.step("RETAIL_EMPTY_AND_QUERY_VALIDATION");
    await type("Tìm kiếm kiện lẻ", "nothing-matches");
    await until(
      "document.querySelector('[data-retail-count]').textContent==='0 kiện lẻ'",
    );
    await snapshot("empty");
    await navigate(fixtureOrigin + "/fixture?status=bad");
    await until(
      "document.querySelector('[role=alert]')?.textContent.includes('URL không hợp lệ')",
    );
    await click("Đặt lại bộ lọc");
    await until(
      "document.querySelector('[data-retail-count]').textContent==='30 kiện lẻ'",
    );
    await navigate(fixtureOrigin + "/reference-sample");
    await until(
      "document.querySelector('[data-retail-count]').textContent==='6 kiện lẻ'",
    );
    await snapshot("reference-sample");
    assert.equal(errors.length, 0);
    assert.deepEqual(badRequests, []);
    console.log(
      "Retail M3 actual TSX/CSS fixture interactions, URL/history, native dialogs, sticky columns and six viewport evidence PASS",
    );
  } finally {
    socket.removeEventListener("message", listener);
    try {
      await send("Emulation.clearDeviceMetricsOverride");
      if (server) {
        await send("Page.navigate", {
          url: fixtureOnly ? "about:blank" : baseUrl + "/settings",
        });
      }
    } finally {
      if (server) {
        await new Promise((r) => {
          server.close(r);
          server.closeAllConnections();
        });
      }
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
    assert.deepEqual(
      badRequests,
      [],
      "no unavailable Shipment API or fixture writes",
    );
  }
}
