import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
const sizes = [
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [768, 1024],
  [390, 844],
  [375, 812],
];
const trigger = 'button[aria-label^="Tài khoản người dùng:"]';
const panel = '[role=region][aria-label="Thông tin tài khoản"]';
const logout = 'button[aria-label="Đăng xuất khỏi hệ thống"]';

// Extend the existing authenticated Chromium session. Failure fixtures intercept
// only logout; the caller still performs genuine logout and checks session401.
export async function verifyAccountMenu({
  send,
  evaluate,
  socket,
  baseUrl,
  prefix,
  checks,
  evidenceDirectory = process.env.ACCOUNT_EVIDENCE_DIR,
  fixtureOnly = false,
}) {
  const records = [];
  const startUrl = await evaluate("location.href");
  const session = await evaluate(
    'fetch("/api/auth/session").then(async r=>({status:r.status,data:await r.json()}))',
  );
  assert.equal(session.status, 200);
  assert.equal(session.data.authenticated, true);
  const user = session.data.user;
  assert.equal(typeof user.username, "string");
  assert.ok(user.username && user.id);
  const pending = new Set();
  const interceptionErrors = [];
  let intercepted = 0,
    interception = false;
  const listener = (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Fetch.requestPaused") {
      if (
        new URL(m.params.request.url).pathname !== "/api/auth/logout" ||
        m.params.request.method !== "POST"
      )
        interceptionErrors.push("ACCOUNT_INTERCEPTION_SHAPE");
      pending.add(m.params.requestId);
      intercepted++;
    }
  };
  async function until(expression) {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw Error("ACCOUNT_BROWSER_CONDITION");
  }
  async function waitPending() {
    for (let i = 0; i < 100; i++) {
      assert.deepEqual(interceptionErrors, []);
      if (pending.size === 1) return;
      await delay(100);
    }
    throw Error("ACCOUNT_INTERCEPTION_MISSING");
  }
  async function pointer(selector, action = "click") {
    const p = await evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('ACCOUNT_POINTER_MISSING');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()`,
    );
    for (const type of action === "hover"
      ? ["mouseMoved"]
      : ["mouseMoved", "mousePressed", "mouseReleased"])
      await send("Input.dispatchMouseEvent", {
        type,
        ...p,
        ...(type === "mouseMoved" ? {} : { button: "left", clickCount: 1 }),
      });
  }
  async function key(key, shift = false) {
    const code = key === " " ? "Space" : key;
    const windowsVirtualKeyCode = { Enter: 13, Tab: 9, Escape: 27, " ": 32 }[
      key
    ];
    for (const type of ["keyDown", "keyUp"])
      await send("Input.dispatchKeyEvent", {
        type,
        key,
        code,
        windowsVirtualKeyCode,
        modifiers: shift ? 8 : 0,
        ...(type === "keyDown" && key === "Enter"
          ? { text: "\r", unmodifiedText: "\r" }
          : {}),
      });
  }
  async function open() {
    if (!(await evaluate(`!!document.querySelector(${JSON.stringify(panel)})`)))
      await pointer(trigger);
    await until(`!!document.querySelector(${JSON.stringify(panel)})`);
  }
  async function close() {
    if (await evaluate(`!!document.querySelector(${JSON.stringify(panel)})`)) {
      await key("Escape");
      await until(`!document.querySelector(${JSON.stringify(panel)})`);
    }
  }
  async function snapshot(phase) {
    if (!evidenceDirectory) return;
    await mkdir(evidenceDirectory, { recursive: true });
    for (const [width, height] of sizes) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evaluate(
        "document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))))",
      );
      await evaluate(
        `Promise.all(document.querySelector(${JSON.stringify(panel)})?.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))??[]).then(()=>true)`,
      );
      if (phase === "logout-hover") await pointer(logout, "hover");
      await evaluate(
        `Promise.all(document.querySelector(${JSON.stringify(panel)})?.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))??[]).then(()=>true)`,
      );
      const m = await evaluate(`(()=>{
        const t=document.querySelector(${JSON.stringify(trigger)}),p=document.querySelector(${JSON.stringify(panel)}),root=getComputedStyle(document.documentElement),probe=document.createElement('span');document.body.append(probe);
        function token(n,property='color'){probe.style[property]=root.getPropertyValue(n);return getComputedStyle(probe)[property];}
        function rect(e){const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};}
        try{const ts=getComputedStyle(t),small=t.querySelector('[class*=avatar]'),r=p?rect(p):null,entry=p?.querySelectorAll('button,a'),out=p?.querySelector(${JSON.stringify(logout)}),title=p?.querySelector('h4'),big=p?.querySelector('[class*=summaryAvatar]');return{
          noOverflow:document.documentElement.scrollWidth<=innerWidth,headerHeight:document.querySelector('header').getBoundingClientRect().height,trigger:rect(t),small:rect(small),triggerName:t.getAttribute('aria-label'),subtitle:t.textContent.includes('Tài khoản Nexora'),textVisible:!!t.querySelector('[class*=accountInfo]').getClientRects().length,
          open:!!p,region:p?.getAttribute('role'),rect:r,radius:p?getComputedStyle(p).borderRadius:null,background:p?getComputedStyle(p).backgroundColor:null,shadow:p?getComputedStyle(p).boxShadow:null,border:p?getComputedStyle(p).borderColor:null,
          summary:p?{username:title.textContent,avatar:rect(big),nameSize:getComputedStyle(title).fontSize,nameWeight:getComputedStyle(title).fontWeight,subtitle:p.querySelector('[class*=panelSubtitle]').textContent,subtitleSize:getComputedStyle(p.querySelector('[class*=panelSubtitle]')).fontSize,padding:getComputedStyle(p.querySelector('[class*=panelHeader]')).paddingTop,bg:getComputedStyle(p.querySelector('[class*=panelHeader]')).backgroundColor}:null,
          entries:entry?[...entry].map(e=>({text:e.textContent,disabled:e.disabled,href:e.getAttribute('href'),size:rect(e),icon:rect(e.querySelector('svg')),font:getComputedStyle(e.querySelector('span')).fontSize,gap:getComputedStyle(e).gap,padding:getComputedStyle(e).paddingLeft,border:getComputedStyle(e).borderTopWidth})):[],
          logout:p?{disabled:out.disabled,busy:out.getAttribute('aria-busy'),color:getComputedStyle(out).color,hover:out.matches(':hover'),bg:getComputedStyle(out).backgroundColor,outline:getComputedStyle(out).outlineStyle,outlineWidth:getComputedStyle(out).outlineWidth,outlineColor:getComputedStyle(out).outlineColor,outlineOffset:getComputedStyle(out).outlineOffset}:null,
          panelAbove:p?document.elementFromPoint(r.left+r.width/2,Math.min(innerHeight-1,r.top+20))?.closest(${JSON.stringify(panel)})===p:true,
          alert:!!p?.querySelector('[role=alert]'),hasUnexpected:p?/VIP|NXR-8829|Số dư ví|Lịch sử giao dịch|Nạp tiền|Bảo mật & Mật khẩu|Kiểm thử|Phiên làm việc|máy chủ nội bộ/.test(p.textContent.split(${JSON.stringify(user.username)}).join('')):false,
          expected:{navy:token('--color-primary'),white:token('--color-surface'),muted:token('--color-surface-muted'),logout:token('--color-account-logout-text'),logoutHover:token('--color-account-logout-hover-bg'),focus:token('--focus-ring-on-light'),shadow:token('--shadow-account-menu','boxShadow'),border:token('--color-border')},
        };}finally{probe.remove();}
      })()`);
      assert.ok(m.noOverflow);
      assert.equal(m.headerHeight, 56);
      assert.equal(m.trigger.height, 40);
      assert.equal(m.small.width, 32);
      assert.equal(m.small.height, 32);
      assert.ok(m.triggerName.endsWith(user.username));
      assert.ok(m.subtitle);
      assert.equal(m.textVisible, width >= 768);
      if (m.open) {
        assert.equal(m.region, "region");
        assert.equal(m.radius, "12px");
        assert.equal(m.rect.width, 256);
        assert.ok(m.rect.left >= 0 && m.rect.right <= width);
        assert.ok(m.rect.top >= 0 && m.rect.bottom <= height);
        assert.ok(m.panelAbove);
        assert.equal(m.background, m.expected.white);
        assert.equal(m.shadow, m.expected.shadow);
        assert.equal(m.border, m.expected.border);
        assert.equal(m.summary.username, user.username);
        assert.equal(m.summary.avatar.width, 40);
        assert.equal(m.summary.avatar.height, 40);
        assert.equal(m.summary.nameSize, "14px");
        assert.equal(m.summary.nameWeight, "600");
        assert.equal(m.summary.subtitle, "Tài khoản Nexora");
        assert.equal(m.summary.subtitleSize, "12px");
        assert.equal(m.summary.padding, "16px");
        assert.equal(m.summary.bg, m.expected.muted);
        assert.equal(m.entries.length, 3);
        assert.equal(m.entries[0].text, "Thông tin cá nhân");
        assert.equal(m.entries[1].text, "Kết nối hãng vận chuyển");
        for (const e of m.entries) {
          assert.equal(e.size.height, 32);
          assert.equal(e.icon.width, 16);
          assert.equal(e.icon.height, 16);
          assert.equal(e.font, "12px");
          assert.equal(e.gap, "10px");
          assert.equal(e.padding, "12px");
          assert.equal(e.border, "0px");
        }
        assert.ok(m.entries[0].disabled);
        assert.equal(m.entries[0].href, null);
        assert.equal(m.entries[1].href, "/settings/carrier-connections");
        assert.ok(!m.entries[1].disabled);
        assert.equal(m.logout.color, m.expected.logout);
        if (m.logout.hover && !m.logout.disabled)
          assert.equal(m.logout.bg, m.expected.logoutHover);
        if (phase === "focused-entry") {
          assert.equal(m.logout.outline, "solid");
          assert.equal(m.logout.outlineWidth, "2px");
          assert.equal(m.logout.outlineColor, m.expected.focus);
          assert.equal(m.logout.outlineOffset, "2px");
          const r = m.entries[2].size;
          assert.ok(
            r.left - 4 >= m.rect.left &&
              r.right + 4 <= m.rect.right &&
              r.top - 4 >= m.rect.top &&
              r.bottom + 4 <= m.rect.bottom,
          );
        }
        assert.equal(m.hasUnexpected, false);
      }
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
        geometry: m,
      });
    }
    await send("Emulation.clearDeviceMetricsOverride");
  }
  async function fulfillFailure() {
    const id = [...pending][0];
    assert.ok(id);
    await send("Fetch.fulfillRequest", {
      requestId: id,
      responseCode: 503,
      responseHeaders: [{ name: "content-type", value: "application/json" }],
      body: Buffer.from(
        '{"code":"SERVICE_UNAVAILABLE","message":"Synthetic logout failure"}',
      ).toString("base64"),
    });
    pending.delete(id);
    await until(
      `!!document.querySelector(${JSON.stringify(panel)})?.querySelector('[role=alert]')&&!document.querySelector(${JSON.stringify(logout)}).disabled`,
    );
  }
  try {
    checks.step("ACCOUNT_REAL_SESSION_AND_DISCLOSURE");
    await until(`!!document.querySelector(${JSON.stringify(trigger)})`);
    await close();
    await snapshot("closed");
    await pointer(trigger);
    await until(`!!document.querySelector(${JSON.stringify(panel)})`);
    await snapshot("opened");
    await pointer(trigger);
    await until(`!document.querySelector(${JSON.stringify(panel)})`);
    await evaluate(
      `document.querySelector(${JSON.stringify(trigger)}).focus();true`,
    );
    checks.step("ACCOUNT_KEYBOARD_ENTER");
    await key("Enter");
    await until(`!!document.querySelector(${JSON.stringify(panel)})`);
    await key("Tab");
    assert.equal(
      await evaluate('document.activeElement.getAttribute("href")'),
      "/settings/carrier-connections",
    );
    await key("Tab");
    assert.equal(
      await evaluate('document.activeElement.getAttribute("aria-label")'),
      "Đăng xuất khỏi hệ thống",
    );
    await snapshot("focused-entry");
    checks.step("ACCOUNT_KEYBOARD_SHIFT_TAB_ESCAPE");
    await key("Tab", true);
    assert.equal(
      await evaluate('document.activeElement.getAttribute("href")'),
      "/settings/carrier-connections",
    );
    await key("Tab", true);
    assert.equal(
      await evaluate(
        `document.activeElement===document.querySelector(${JSON.stringify(trigger)})`,
      ),
      true,
    );
    await key("Escape");
    await until(`!document.querySelector(${JSON.stringify(panel)})`);
    assert.equal(
      await evaluate(
        `document.activeElement===document.querySelector(${JSON.stringify(trigger)})`,
      ),
      true,
    );
    checks.step("ACCOUNT_KEYBOARD_SPACE_NOTIFICATION");
    await key(" ");
    await until(`!!document.querySelector(${JSON.stringify(panel)})`);
    await pointer('button[aria-label="Thông báo hệ thống"]');
    await until(`!document.querySelector(${JSON.stringify(panel)})`);
    assert.equal(
      await evaluate('document.activeElement.getAttribute("aria-label")'),
      "Thông báo hệ thống",
    );
    await pointer(trigger);
    await until(`!!document.querySelector(${JSON.stringify(panel)})`);
    assert.equal(
      await evaluate(
        '!!document.querySelector("div[aria-label=\\"Thông báo hệ thống\\"]")',
      ),
      false,
    );
    if (!fixtureOnly) {
      checks.step("ACCOUNT_REAL_CLIENT_ROUTE_DISMISSAL");
      // Screenshot loops restore Chrome's default narrow viewport, where the
      // desktop Sidebar is hidden. Exercise its real Next Link while visible.
      await send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evaluate(
        "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
      );
      const target = await evaluate(
        "location.pathname==='/settings'?'/system':'/settings'",
      );
      assert.equal(
        await evaluate(
          `(()=>{const a=document.querySelector('a[href="${target}"]');if(!a?.getClientRects().length)return false;a.focus();return document.activeElement===a;})()`,
        ),
        true,
        "real route Link must be visible and keyboard focused",
      );
      await key("Enter");
      await until(
        `location.pathname===${JSON.stringify(target)}&&!document.querySelector(${JSON.stringify(panel)})`,
      );
      await send("Page.navigate", { url: startUrl });
      await until(
        `location.href===${JSON.stringify(startUrl)}&&!!document.querySelector(${JSON.stringify(trigger)})`,
      );
      await open();
      await send("Emulation.clearDeviceMetricsOverride");
    }
    checks.step("ACCOUNT_PLANNED_ENTRIES_AND_HOVER");
    // Profile remains disabled; Carrier is a real native Link: no fake destinations or activation.
    const before = await evaluate("location.href");
    await pointer(`${panel} button[title="Chưa triển khai"]`);
    assert.equal(await evaluate("location.href"), before);
    await close();
    await open();
    // Genuine hover on the real logout control, with no active CSS state injection.
    await pointer(`${panel} [class*=panelTitle]`);
    await evaluate(
      `document.querySelector(${JSON.stringify(logout)}).focus();true`,
    );
    await key("Tab", true);
    await key("Tab");
    await snapshot("logout-hover");
    // Pause the exact logout request to capture loading; never forward the failure fixture.
    socket.addEventListener("message", listener);
    await send("Fetch.enable", {
      patterns: [
        { urlPattern: baseUrl + "/api/auth/logout", requestStage: "Request" },
      ],
    });
    interception = true;
    checks.step("ACCOUNT_LOGOUT_SYNTHETIC_LOADING_FAILURE_RETRY");
    await pointer(logout);
    await waitPending();
    await until(`document.querySelector(${JSON.stringify(logout)}).disabled`);
    assert.equal(intercepted, 1);
    await snapshot("logout-loading");
    await pointer(logout);
    assert.equal(intercepted, 1);
    await fulfillFailure();
    assert.equal(await evaluate("location.href"), before);
    await snapshot("logout-failed");
    const alive = await evaluate(
      'fetch("/api/auth/session").then(async r=>({status:r.status,user:(await r.json()).user}))',
    );
    assert.equal(alive.status, 200);
    assert.equal(alive.user.id, user.id);
    await pointer(logout);
    await waitPending();
    assert.equal(intercepted, 2);
    await fulfillFailure();
    assert.equal(await evaluate("location.href"), before);
    // A transport failure must preserve the workspace and permit another attempt too.
    await pointer(logout);
    await waitPending();
    assert.equal(intercepted, 3);
    const networkFailure = [...pending][0];
    await send("Fetch.failRequest", {
      requestId: networkFailure,
      errorReason: "ConnectionFailed",
    });
    pending.delete(networkFailure);
    await until(
      `!!document.querySelector(${JSON.stringify(panel)})?.querySelector('[role=alert]')&&!document.querySelector(${JSON.stringify(logout)}).disabled`,
    );
    assert.equal(await evaluate("location.href"), before);
    const afterNetworkFailure = await evaluate(
      'fetch("/api/auth/session").then(r=>r.status)',
    );
    assert.equal(afterNetworkFailure, 200);
    await close();
  } finally {
    for (const id of pending)
      await send("Fetch.failRequest", {
        requestId: id,
        errorReason: "Aborted",
      }).catch(() => {});
    if (interception) await send("Fetch.disable").catch(() => {});
    socket.removeEventListener("message", listener);
    await send("Emulation.clearDeviceMetricsOverride").catch(() => {});
    if (evidenceDirectory) {
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(
        resolve(evidenceDirectory, `${prefix}.json`),
        JSON.stringify(
          {
            sourceCommit: process.env.GITHUB_SHA ?? null,
            syntheticLogoutFailures: true,
            records,
          },
          null,
          2,
        ),
      );
    }
  }
}
