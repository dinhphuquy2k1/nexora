import { browserContrastExpression } from "./browser-contrast.mjs";
import { waitForInteractiveAccount } from "./browser-login-ready.mjs";
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
  async function pointer(selector) {
    const point = await evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`,
    );
    assert.ok(point, selector);
    for (const type of ["mousePressed", "mouseReleased"])
      await send("Input.dispatchMouseEvent", {
        type,
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
  async function capture(phase, width, height, expected) {
    await evaluate(
      "document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))",
    );
    const geometry = await evaluate(
      `(()=>{const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};const root=document.querySelector('[data-carrier-connections]'),container=document.querySelector('[data-carrier-table-container]'),d=[...document.querySelectorAll('dialog[open]')];return {page:rect(root),deck:rect(document.querySelector('[data-carrier-command-deck]')),container:rect(container),footer:rect(document.querySelector('[data-carrier-pagination]')),columns:[...document.querySelectorAll('table th')].map(rect),rows:[...document.querySelectorAll('tbody tr')].map(rect),frame:rect(d.at(-1)),frameHeader:rect(d.at(-1)?.querySelector(':scope>header')),noOverflow:document.documentElement.scrollWidth<=innerWidth,noVerticalBorders:[...document.querySelectorAll('table th:not(:last-child),table td:not(:last-child)')].every(e=>getComputedStyle(e).borderRightWidth==='0px'||getComputedStyle(e).borderRightStyle==='none'),controls:[...document.querySelectorAll('button[data-size=default],input[data-size=default],select[data-size=default]')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().height),passwordBlank:[...document.querySelectorAll('input[type=password]')].every(e=>!e.value),dialogs:d.map(rect),syncBodyFits:[...document.querySelectorAll('dialog[open] [role=tabpanel]')].every(e=>e.scrollWidth<=e.clientWidth+1)}})()`,
    );
    assert.equal(geometry.noOverflow, true, phase + " document overflow");
    assert.equal(geometry.columns.length, 7);
    assert.equal(
      geometry.noVerticalBorders,
      true,
      "Carrier table vertical borders aligned with Retail (no column dividers)",
    );
    assert.ok(
      geometry.controls.length > 0 &&
        geometry.controls.every((h) => Math.abs(h - 32) < 1),
      "default32 hit targets",
    );
    assert.equal(
      geometry.passwordBlank,
      true,
      "Never capture credential drafts",
    );
    assert.equal(
      geometry.syncBodyFits,
      true,
      "Sync content must not clip horizontally",
    );
    assert.ok(
      geometry.dialogs.every(
        (d) => d.left >= -1 && d.right <= width + 1 && d.height <= height + 1,
      ),
      "modal bounds",
    );
    assert.ok(
      Math.abs(geometry.container.bottom - geometry.page.bottom + 2) < 2,
      "table fills workspace",
    );
    assert.ok(
      Math.abs(geometry.footer.bottom - geometry.container.bottom + 1) < 2,
      "fixed table footer",
    );
    geometry.runningContrast = [];
    for (const selector of [
      "dialog[open] span[data-state=running]",
      "[data-carrier-running-note]",
    ]) {
      if (
        await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)
      ) {
        const result = await evaluate(browserContrastExpression(selector));
        assert.ok(
          result.ratio >= 4.5,
          "running badge/note small text contrast",
        );
        geometry.runningContrast.push({ selector, ...result });
      }
    }
    if (expected?.frameHeaderHeight)
      assert.ok(
        Math.abs(geometry.frameHeader.height - expected.frameHeaderHeight) <= 3,
        "ZIP Sync header height",
      );
    if (expected) {
      assert.ok(
        Math.abs(geometry.deck.height - expected.deck.height) <= 2,
        "ZIP command deck geometry",
      );
      for (let i = 0; i < 7; i++)
        assert.ok(
          Math.abs(geometry.columns[i].width - expected.columns[i].width) <= 5,
          "ZIP auto column " + i,
        );
      assert.ok(
        geometry.rows.every(
          (row, i) => Math.abs(row.height - expected.rows[i].height) <= 2,
        ),
        "ZIP row geometry",
      );
      if (expected.frame && geometry.frame)
        assert.ok(
          Math.abs(geometry.frame.width - expected.frame.width) <= 2,
          "ZIP drawer/modal width",
        );
    }
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      const shot = await send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: false,
        }),
        bytes = Buffer.from(shot.data, "base64"),
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
  async function viewport(width, height) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }
  async function firstMenu(action) {
    await pointer("tbody tr:first-child button[aria-haspopup=menu]");
    await until("!!document.querySelector('[role=menu]')");
    await click(action);
    await until("!!document.querySelector('dialog[open]')");
  }
  async function openSurface(surface) {
    if (surface === "filter") await click("Thêm điều kiện lọc");
    if (surface === "actions") {
      await pointer("tbody tr:first-child button[aria-haspopup=menu]");
      await until("!!document.querySelector('[role=menu]')");
    }
    if (surface === "create") await click("Kết nối hãng mới");
    if (["edit", "details", "disconnect"].includes(surface))
      await firstMenu(
        {
          edit: "Chỉnh sửa tài khoản",
          details: "Chi tiết tài khoản",
          disconnect: "Ngắt kết nối",
        }[surface],
      );
    if (
      surface.startsWith("sync-") ||
      ["progress", "error", "history-details"].includes(surface)
    ) {
      await pointer(
        'tbody tr:first-child button[aria-label^="Chi tiết đồng bộ"]',
      );
      await until("!!document.querySelector('dialog[open]')");
      if (surface === "sync-expanded" || surface === "error")
        await click("Mô phỏng: 8 loại dữ liệu");
      if (surface === "sync-schedule") await click("Lịch tự động");
      if (surface === "sync-history" || surface === "history-details")
        await click("Lịch sử đồng bộ");
      if (surface === "progress") await click("Xem tiến độ");
      if (surface === "error") await click("Xem lỗi");
      if (surface === "history-details")
        await pointer('[data-carrier-history-id="1"]');
    }
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
      await waitForInteractiveAccount({ until, evaluate });
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
        0,
      );
      assert.equal(
        await evaluate(
          "document.querySelector('[data-carrier-connections]').textContent.includes('Chưa tích hợp')",
        ),
        true,
      );
      assert.equal(
        await evaluate(
          "document.querySelector('[data-carrier-pagination]').textContent.includes('—')",
        ),
        true,
      );
      assert.equal(
        await evaluate(
          "!!document.querySelector('[data-carrier-connections] dialog')",
        ),
        false,
      );
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [1024, 768],
        [768, 1024],
        [390, 844],
        [375, 812],
      ]) {
        await viewport(width, height);
        await capture("production", width, height);
      }
      await viewport(1440, 900);
      await until(
        "[...document.querySelectorAll('button[aria-label=\"Thu gọn thanh điều hướng\"]')].some(e=>e.getClientRects().length)",
      );
      const expandedLeft = await evaluate(
        "document.querySelector('[data-carrier-connections]').getBoundingClientRect().left",
      );
      await click("Thu gọn thanh điều hướng");
      await until(
        "document.querySelector('[data-carrier-connections]').getBoundingClientRect().left < " +
          expandedLeft,
      );
      await capture("production-collapsed-sidebar", 1440, 900);
      await click("Mở rộng thanh điều hướng");
      await until(
        "Math.abs(document.querySelector('[data-carrier-connections]').getBoundingClientRect().left-" +
          expandedLeft +
          ")<1",
      );
      await send("Emulation.clearDeviceMetricsOverride");
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
    const navigate = async (query = "") => {
      await send("Page.navigate", { url: origin + "/fixture" + query });
      await until("!!document.querySelector('[data-carrier-table-container]')");
    };
    await viewport(1440, 900);
    await navigate();
    await until("document.querySelectorAll('tbody tr').length===10");
    checks.step("CARRIER_V2_FILTERS_PAGES_AND_CONTROL_FLOW");
    assert.equal(
      await evaluate(
        "document.querySelectorAll('[data-carrier-command-deck] header button').length",
      ),
      3,
    );
    assert.equal(
      await evaluate(
        "document.querySelectorAll('[data-carrier-toolbar] select').length",
      ),
      0,
    );
    await select("Số dòng tài khoản mỗi trang", "50");
    await until("document.querySelectorAll('tbody tr').length===27");
    const fixedBefore = await evaluate(
      "({head:document.querySelector('thead').getBoundingClientRect().top,footer:document.querySelector('[data-carrier-pagination]').getBoundingClientRect().top})",
    );
    await evaluate("document.querySelector('[role=region]').scrollTop=120");
    const fixedAfter = await evaluate(
      "({head:document.querySelector('thead').getBoundingClientRect().top,footer:document.querySelector('[data-carrier-pagination]').getBoundingClientRect().top,scroll:document.querySelector('[role=region]').scrollTop})",
    );
    assert.ok(
      fixedAfter.scroll > 0 &&
        Math.abs(fixedBefore.head - fixedAfter.head) < 1 &&
        fixedBefore.footer === fixedAfter.footer,
      "sticky header/fixed footer during real body scroll",
    );
    await select("Số dòng tài khoản mỗi trang", "10");
    await until("document.querySelectorAll('tbody tr').length===10");
    await click("Trang sau tài khoản");
    await until("document.querySelector('tbody tr td').textContent==='11'");
    await select("Số dòng tài khoản mỗi trang", "5");
    await until("document.querySelectorAll('tbody tr').length===5");
    await click("Trang cuối tài khoản");
    await until("document.querySelector('tbody tr td').textContent==='26'");
    await click("Trang đầu tài khoản");
    await click("Thêm điều kiện lọc");
    await until("!!document.querySelector('[role=dialog] select')");
    // Native select and genuine keyboard submission; no product network operation.
    await evaluate(
      "(()=>{const e=document.querySelector('[role=dialog] select:last-of-type');e.value='fixture-b';e.dispatchEvent(new Event('change',{bubbles:true}))})()",
    );
    await pointer("[role=dialog] button[type=submit]");
    await until(
      "!document.querySelector('[role=dialog] select') && [...document.querySelectorAll('tbody tr')].every(e=>e.textContent.includes('Hãng B'))",
    );
    await click("Thêm điều kiện lọc");
    await until("!!document.querySelector('[role=dialog]')");
    assert.equal(
      await evaluate(
        "document.querySelector('[role=dialog] button[type=submit]').disabled",
      ),
      true,
      "duplicate prevented",
    );
    await key("Escape");
    await until("!document.querySelector('[role=dialog]')");
    await click("Xóa tất cả");
    await input(
      'input[aria-label="Tìm tài khoản kết nối"]',
      "no-matching-carrier",
    );
    await until("document.querySelectorAll('tbody tr').length===0");
    assert.equal(
      await evaluate(
        "document.querySelector('[data-carrier-connections] [role=status]').textContent.includes('Không tìm thấy tài khoản hãng phù hợp')",
      ),
      true,
    );
    await input('input[aria-label="Tìm tài khoản kết nối"]', "");
    await until("document.querySelectorAll('tbody tr').length===5");
    // Each row menu action remains reachable after horizontal scrolling, then returns focus.
    await firstMenu("Chỉnh sửa tài khoản");
    assert.equal(
      await evaluate("document.querySelector('input[type=password]').value"),
      "",
    );
    await focusContained();
    await key("Escape");
    await until("!document.querySelector('dialog[open]')");
    await click("Kết nối hãng mới");
    await until("!!document.querySelector('input[type=password]')");
    for (const name of ["displayName", "loginIdentifier", "password"])
      await evaluate(
        `(()=>{const e=document.querySelector('input[name="${name}"]');e.focus();e.blur()})()`,
      );
    await until("document.querySelectorAll('[aria-invalid=true]').length===3");
    for (const [name, value] of [
      ["displayName", "Local draft"],
      ["loginIdentifier", "draft-user"],
      ["password", "test-only-unsaved"],
    ])
      await input("input[name=" + name + "]", value);
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('dialog button')].find(e=>e.textContent.includes('Kích hoạt')).disabled",
      ),
      true,
    );
    await key("Escape");
    await until("!document.querySelector('dialog[open]')");
    await click("Kết nối hãng mới");
    await until("!!document.querySelector('input[type=password]')");
    assert.equal(
      await evaluate("document.querySelector('input[type=password]').value"),
      "",
    );
    await key("Escape");
    await navigate("?parity");
    await until("document.querySelectorAll('tbody tr').length===3");
    await openSurface("sync-schedule");
    const initial = await evaluate(
      "document.querySelector('[role=switch]').getAttribute('aria-checked')",
    );
    await evaluate("document.querySelector('[role=switch]').click()");
    await until(
      "document.querySelector('[aria-label=\"Có thay đổi chưa lưu\"]')!==null",
    );
    await click("Lịch sử đồng bộ");
    await until(
      "!!document.querySelector('select[aria-label=\"Lọc lịch sử đồng bộ\"]')",
    );
    assert.equal(
      await evaluate("document.querySelector('[role=tabpanel]').scrollTop"),
      0,
    );
    assert.equal(
      await evaluate(
        "document.querySelectorAll('[data-carrier-history-id]').length",
      ),
      4,
    );
    await click("Trang sau lịch sử");
    await until("!!document.querySelector('[data-carrier-history-id=\"5\"]')");
    await select("Lọc lịch sử đồng bộ", "failed");
    await until(
      "document.querySelectorAll('[data-carrier-history-id]').length===2",
    );
    await input(
      'input[aria-label="Khoảng ngày lịch sử"]',
      "31/02/2026 - 01/03/2026",
    );
    await until(
      "document.querySelector('input[aria-label=\"Khoảng ngày lịch sử\"]').getAttribute('aria-invalid')==='true'",
    );
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Lọc lại').disabled",
      ),
      true,
    );
    await key("Escape");
    await until("document.querySelectorAll('dialog[open]').length===2");
    await focusContained();
    await click("Tiếp tục chỉnh sửa");
    await until("document.querySelectorAll('dialog[open]').length===1");
    await click("Lịch tự động");
    assert.notEqual(
      await evaluate(
        "document.querySelector('[role=switch]').getAttribute('aria-checked')",
      ),
      initial,
    );
    await key("Escape");
    await until("document.querySelectorAll('dialog[open]').length===2");
    await click("Bỏ thay đổi");
    await until("!document.querySelector('dialog[open]')");
    await openSurface("sync-schedule");
    assert.equal(
      await evaluate(
        "document.querySelector('[role=switch]').getAttribute('aria-checked')",
      ),
      initial,
    );
    await key("Escape");
    await until("!document.querySelector('dialog[open]')");

    // FIX 1 & FIX 4: Assert shared TabBar consistency and zero layout shift on tab switch
    checks.step("CARRIER_TABBAR_SHARED_CONSISTENCY_AND_LAYOUT_SHIFT");
    const tabStyles = await evaluate(`(()=>{
      const tab = document.querySelector('[role="tab"]');
      const badge = tab?.querySelector('[class*="badge"]');
      const icon = tab?.querySelector('svg');
      if (!tab) return null;
      const cs = getComputedStyle(tab);
      const bs = badge ? getComputedStyle(badge) : null;
      const is = icon ? getComputedStyle(icon) : null;
      const rect = tab.getBoundingClientRect();
      return {
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
        height: rect.height,
        gap: cs.gap,
        badgeFontSize: bs?.fontSize,
        badgeFontFamily: bs?.fontFamily,
        badgePadding: bs?.padding,
        badgeHeight: bs ? badge.getBoundingClientRect().height : null,
        iconWidth: is?.width,
        iconHeight: is?.height,
        hasIndicator: Boolean(document.querySelector('[class*="filterIndicator"]')),
      };
    })()`);
    assert.equal(
      tabStyles.fontSize,
      "14px",
      "tab font size must be 14px (var(--font-size-md))",
    );
    assert.equal(
      tabStyles.fontWeight,
      "600",
      "tab font weight must be 600 (var(--font-weight-semibold))",
    );
    assert.equal(
      tabStyles.paddingLeft,
      "12px",
      "tab paddingLeft must be 12px (var(--space-3))",
    );
    assert.equal(
      tabStyles.paddingRight,
      "12px",
      "tab paddingRight must be 12px (var(--space-3))",
    );
    assert.equal(tabStyles.height, 44, "tab height must be 44px");
    assert.equal(tabStyles.iconWidth, "16px", "icon width must be 16px");
    assert.equal(tabStyles.iconHeight, "16px", "icon height must be 16px");
    assert.equal(
      tabStyles.badgeFontSize,
      "12px",
      "badge font size must be 12px (var(--font-size-sm))",
    );
    assert.equal(tabStyles.badgeHeight, 20, "badge height must be 20px");
    assert.equal(
      tabStyles.hasIndicator,
      false,
      "filterIndicator must not exist in toolbar",
    );

    // Measure layout across tab switching
    const measureDeck = async () =>
      await evaluate(`(()=>{
      const rect = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, height: r.height }; };
      const deck = document.querySelector('[data-carrier-command-deck]');
      const toolbar = document.querySelector('[data-carrier-toolbar]');
      const table = document.querySelector('[data-carrier-table-container]');
      return {
        deck: rect(deck),
        toolbar: rect(toolbar),
        table: rect(table),
        hasIndicator: Boolean(document.querySelector('[class*="filterIndicator"]')),
      };
    })()`);

    const initialDeck = await measureDeck();
    assert.equal(initialDeck.hasIndicator, false);

    // Click "Đang hoạt động"
    await evaluate(`(()=>{
      const btn = [...document.querySelectorAll('[role="tab"]')].find(b => b.textContent.includes('Đang hoạt động'));
      btn?.click();
    })()`);
    await until(
      "Boolean([...document.querySelectorAll('[role=\"tab\"][aria-selected=\"true\"]')].some(b => b.textContent.includes('Đang hoạt động')))",
    );
    const connectedDeck = await measureDeck();
    assert.equal(connectedDeck.hasIndicator, false);
    assert.ok(
      Math.abs(connectedDeck.toolbar.height - initialDeck.toolbar.height) < 0.5,
      "toolbar height stable on connected",
    );
    assert.ok(
      Math.abs(connectedDeck.deck.height - initialDeck.deck.height) < 0.5,
      "deck height stable on connected",
    );
    assert.ok(
      Math.abs(connectedDeck.table.top - initialDeck.table.top) < 0.5,
      "table top stable on connected",
    );

    // Click "Cần kiểm tra"
    await evaluate(`(()=>{
      const btn = [...document.querySelectorAll('[role="tab"]')].find(b => b.textContent.includes('Cần kiểm tra'));
      btn?.click();
    })()`);
    await until(
      "Boolean([...document.querySelectorAll('[role=\"tab\"][aria-selected=\"true\"]')].some(b => b.textContent.includes('Cần kiểm tra')))",
    );
    const needsCheckDeck = await measureDeck();
    assert.equal(needsCheckDeck.hasIndicator, false);
    assert.ok(
      Math.abs(needsCheckDeck.toolbar.height - initialDeck.toolbar.height) <
        0.5,
      "toolbar height stable on needs_check",
    );
    assert.ok(
      Math.abs(needsCheckDeck.deck.height - initialDeck.deck.height) < 0.5,
      "deck height stable on needs_check",
    );
    assert.ok(
      Math.abs(needsCheckDeck.table.top - initialDeck.table.top) < 0.5,
      "table top stable on needs_check",
    );

    // Return to "Tất cả tài khoản"
    await evaluate(`(()=>{
      const btn = [...document.querySelectorAll('[role="tab"]')].find(b => b.textContent.includes('Tất cả'));
      btn?.click();
    })()`);
    await until(
      "Boolean([...document.querySelectorAll('[role=\"tab\"][aria-selected=\"true\"]')].some(b => b.textContent.includes('Tất cả')))",
    );

    // FIX 2, FIX 4, FIX 5: Assert shared visual alignment with Retail baseline
    checks.step("CARRIER_RETAIL_VISUAL_ALIGNMENT_CONTRACT");
    const visualStyles = await evaluate(`(()=>{
      const heading = document.querySelector('[data-carrier-command-deck] h1');
      const icon = document.querySelector('[class*="titleIcon"]');
      const header = document.querySelector('[class*="pageHeader"]');
      const actions = document.querySelector('[class*="headerActions"]');
      const toolbar = document.querySelector('[data-carrier-toolbar]');
      const th = document.querySelector('table th');
      const td = document.querySelector('table td');
      const footer = document.querySelector('[data-carrier-pagination]');
      const summary = footer?.querySelector('[class*="summary"]');
      const range = footer?.querySelector('[class*="paginationRange"]');

      const cs = e => e ? getComputedStyle(e) : null;
      const rect = e => e ? e.getBoundingClientRect() : null;

      const hcs = cs(heading);
      const ics = cs(icon);
      const hdcs = cs(header);
      const acs = cs(actions);
      const tcs = cs(toolbar);
      const thcs = cs(th);
      const tdcs = cs(td);
      const fcs = cs(footer);
      const scs = cs(summary);
      const rcs = cs(range);

      return {
        headingColor: hcs?.color,
        headingFontWeight: hcs?.fontWeight,
        headingTextTransform: hcs?.textTransform,
        iconWidth: rect(icon)?.width,
        iconHeight: rect(icon)?.height,
        iconBorderRadius: ics?.borderRadius,
        headerPaddingLeft: hdcs?.paddingLeft,
        headerPaddingRight: hdcs?.paddingRight,
        headerActionsGap: acs?.gap,
        toolbarPaddingTop: tcs?.paddingTop,
        toolbarPaddingBottom: tcs?.paddingBottom,
        toolbarPaddingLeft: tcs?.paddingLeft,
        toolbarPaddingRight: tcs?.paddingRight,
        toolbarGap: tcs?.gap,
        thFontWeight: thcs?.fontWeight,
        thColor: thcs?.color,
        thBackground: thcs?.backgroundColor,
        thTextTransform: thcs?.textTransform,
        thBorderRightWidth: thcs?.borderRightWidth,
        tdBorderRightWidth: tdcs?.borderRightWidth,
        tdPaddingTop: tdcs?.paddingTop,
        tdPaddingBottom: tdcs?.paddingBottom,
        footerBackground: fcs?.backgroundColor,
        footerMinHeight: fcs?.minHeight,
        footerPaddingTop: fcs?.paddingTop,
        footerPaddingBottom: fcs?.paddingBottom,
        footerBorderTopWidth: fcs?.borderTopWidth,
        summaryFontSize: scs?.fontSize,
        summaryColor: scs?.color,
        rangeFontWeight: rcs?.fontWeight,
        rangeColor: rcs?.color,
      };
    })()`);

    assert.equal(
      visualStyles.headingColor,
      "rgb(23, 43, 77)",
      "heading color must be var(--color-primary)",
    );
    assert.equal(
      visualStyles.headingFontWeight,
      "700",
      "heading font weight must be 700 (var(--font-weight-bold))",
    );
    assert.equal(
      visualStyles.headingTextTransform,
      "uppercase",
      "heading text transform uppercase",
    );
    assert.equal(visualStyles.iconWidth, 32, "brand icon width 32px");
    assert.equal(visualStyles.iconHeight, 32, "brand icon height 32px");
    assert.equal(
      visualStyles.headerPaddingLeft,
      "16px",
      "header padding left 16px (var(--space-4))",
    );
    assert.equal(
      visualStyles.headerPaddingRight,
      "16px",
      "header padding right 16px (var(--space-4))",
    );
    assert.equal(
      visualStyles.headerActionsGap,
      "8px",
      "header actions gap 8px (var(--space-2))",
    );
    assert.equal(
      visualStyles.toolbarPaddingTop,
      "8px",
      "toolbar padding top 8px (var(--space-2))",
    );
    assert.equal(
      visualStyles.toolbarPaddingBottom,
      "8px",
      "toolbar padding bottom 8px (var(--space-2))",
    );
    assert.equal(
      visualStyles.toolbarGap,
      "12px",
      "toolbar gap 12px (var(--space-3))",
    );
    assert.equal(
      visualStyles.thFontWeight,
      "600",
      "th font weight 600 (var(--font-weight-semibold))",
    );
    assert.equal(visualStyles.thColor, "rgb(255, 255, 255)", "th color white");
    assert.equal(
      visualStyles.thBackground,
      "rgb(23, 43, 77)",
      "th background navy",
    );
    assert.equal(
      visualStyles.thTextTransform,
      "uppercase",
      "th text transform uppercase",
    );
    assert.equal(
      visualStyles.thBorderRightWidth,
      "0px",
      "th vertical border removed",
    );
    assert.equal(
      visualStyles.tdBorderRightWidth,
      "0px",
      "td vertical border removed",
    );
    assert.equal(
      visualStyles.footerBackground,
      "rgb(241, 245, 249)",
      "footer background var(--color-surface-subtle)",
    );
    assert.equal(
      visualStyles.footerMinHeight,
      "44px",
      "footer min-height 44px",
    );
    assert.equal(
      visualStyles.footerPaddingTop,
      "8px",
      "footer padding top 8px (var(--space-2))",
    );
    assert.equal(
      visualStyles.footerPaddingBottom,
      "8px",
      "footer padding bottom 8px (var(--space-2))",
    );
    assert.equal(
      visualStyles.summaryFontSize,
      "11px",
      "summary font size 11px (var(--font-size-xs))",
    );
    assert.equal(visualStyles.rangeFontWeight, "600", "range font weight 600");
    assert.equal(
      visualStyles.rangeColor,
      "rgb(23, 43, 77)",
      "range color var(--color-primary)",
    );

    // Source-derived contract records original ZIP geometry, never the implementation's geometry.
    const contract = JSON.parse(
      await readFile(
        resolve("apps/web/test/fixtures/carrier-zip-geometry.json"),
        "utf8",
      ),
    );
    assert.equal(
      contract.zipSha256,
      "6912f4917756a1c3393e48b34f63f350464cb068351a377c2efb9d5cde6d5a52",
    );
    checks.step("CARRIER_V2_SOURCE_BACKED_SIX_VIEWPORT_MATRIX");
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [1024, 768],
      [768, 1024],
      [390, 844],
      [375, 812],
    ])
      for (const surface of [
        "list",
        "filter",
        "actions",
        "create",
        "edit",
        "details",
        "disconnect",
        "sync-status",
        "sync-schedule",
        "sync-history",
        "sync-expanded",
        "progress",
        "error",
        "history-details",
      ]) {
        await viewport(width, height);
        await navigate("?parity");
        await until("document.querySelectorAll('tbody tr').length===3");
        await openSurface(surface);
        if (["progress", "error", "history-details"].includes(surface)) {
          await until("document.querySelectorAll('dialog[open]').length===2");
          await focusContained();
        }
        const size = contract.sizes.find(
          (s) => s.width === width && s.height === height,
        );
        const referenceSurface = contract.surfaces.find(
          (s) => s.surface === surface,
        );
        assert.ok(size && referenceSurface, "source capture membership");
        if (surface.startsWith("sync-"))
          assert.equal(
            referenceSurface.frameHeaderHeights?.length,
            6,
            "source Sync header inventory required",
          );
        const sourceIndex = contract.sizes.indexOf(size);
        const expected = {
          deck: { height: size.deckHeight },
          columns: size.columnWidths.map((width) => ({ width })),
          rows: size.rowHeights.map((height) => ({ height })),
          frameHeaderHeight: referenceSurface.frameHeaderHeights?.[sourceIndex],
          frame: referenceSurface.frameWidths[sourceIndex]
            ? { width: referenceSurface.frameWidths[sourceIndex] }
            : null,
        };
        await capture(surface, width, height, expected);
      }
    await viewport(375, 812);
    await navigate("?parity");
    await until("document.querySelectorAll('tbody tr').length===3");
    await openSurface("sync-history");
    await viewport(375, 480);
    await evaluate(
      "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
    );
    const autoChip = await evaluate(
      "(()=>{const s=getComputedStyle(document.querySelector('[data-manual=false]'));return {color:s.color,bg:s.backgroundColor,border:s.borderTopWidth}})()",
    );
    assert.deepEqual(
      autoChip,
      { color: "rgb(71, 85, 105)", bg: "rgb(241, 245, 249)", border: "0px" },
      "ZIP automatic source chip is slate; blue belongs to running status",
    );
    const historyFooter = await evaluate(
      "document.querySelector('dialog[open]>footer').getBoundingClientRect().top",
    );
    assert.equal(
      await evaluate(
        "(()=>{const e=document.querySelector('dialog[open] [role=tabpanel]');e.scrollTop=120;return e.scrollTop>0})()",
      ),
      true,
      "long history scrolls inside drawer",
    );
    assert.equal(
      await evaluate(
        "document.querySelector('dialog[open]>footer').getBoundingClientRect().top",
      ),
      historyFooter,
      "history footer remains fixed",
    );
    await evaluate(
      "document.querySelector('[data-carrier-history-id=\"1\"]').focus()",
    );
    const handle = await send("Runtime.evaluate", {
      expression: "document.querySelector('[data-carrier-history-id=\"1\"]')",
      returnByValue: false,
    });
    try {
      const tree = await send("Accessibility.getPartialAXTree", {
        objectId: handle.result.objectId,
        fetchRelatives: false,
      });
      const card = tree.nodes.find((n) => n.role?.value === "button");
      assert.ok(card, "native history card role");
      for (const text of ["Shipment", "Đang chạy", "09/10/2026 14:27"])
        assert.ok(
          card.name.value.includes(text),
          "visible history metadata in accessible name",
        );
    } finally {
      await send("Runtime.releaseObject", { objectId: handle.result.objectId });
    }
    await key("Enter");
    await until("document.querySelectorAll('dialog[open]').length===2");
    await key("Escape");
    await until("document.querySelectorAll('dialog[open]').length===1");
    await viewport(1440, 900);
    await navigate("?parity");
    await until("document.querySelectorAll('tbody tr').length===3");
    const primarySelector =
      "[data-carrier-command-deck] header button:last-child";
    const primaryDefault = await evaluate(
      `getComputedStyle(document.querySelector(${JSON.stringify(primarySelector)})).backgroundColor`,
    );
    const hoverPoint = await evaluate(
      `(()=>{const r=document.querySelector(${JSON.stringify(primarySelector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`,
    );
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      ...hoverPoint,
    });
    await until(
      `getComputedStyle(document.querySelector(${JSON.stringify(primarySelector)})).backgroundColor!==${JSON.stringify(primaryDefault)}`,
    );
    await capture("primary-hover", 1440, 900);
    await evaluate(
      `document.querySelector(${JSON.stringify(primarySelector)}).focus()`,
    );
    await key("Tab", true);
    await key("Tab");
    assert.equal(
      await evaluate(
        `document.querySelector(${JSON.stringify(primarySelector)}).matches(':focus-visible')`,
      ),
      true,
      "real keyboard focus",
    );
    await capture("primary-focus", 1440, 900);
    await navigate("?empty");
    await until("document.querySelectorAll('tbody tr').length===0");
    assert.equal(
      await evaluate("localStorage.length===0 && sessionStorage.length===0"),
      true,
      "fixture drafts never persisted",
    );
    assert.deepEqual(badRequests, []);
    assert.deepEqual(errors, []);
    checks.step("CARRIER_V2_UI_ONLY_AND_PARITY_REGRESSIONS_PASS");
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
