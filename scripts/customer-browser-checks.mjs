// Extends the existing authenticated CDP session. Only owned disposable fixtures.
import {
  verifyWorkspaceGeometry,
  verifyCustomerTableGeometry,
  verifyCustomerDetailGeometry,
  verifyMainFocusOutlineContract,
} from "./workspace-geometry-checks.mjs";
import {
  verifyCustomerControls,
  verifyCustomerStatusContrast,
} from "./customer-control-checks.mjs";
import {
  verifyCustomerReadRaces,
  verifyCustomerPower,
  dismissCustomerToasts,
} from "./customer-read-races.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { M1_VIEWPORTS } from "./m1-visual-checks.mjs";
// CDP returnByValue must never serialize a React-owned DOM node/circular Fiber.
export function customerPredicate(expression) {
  return `Boolean(${expression})`;
}
export function customerFieldSelector(name, inDialog) {
  return `${inDialog ? "dialog[open] " : ""}[name=${JSON.stringify(name)}]`;
}
export async function verifyCustomerBrowser({
  send,
  evaluate,
  baseUrl,
  prefix,
  foreignId,
  phone = "0912345678",
  checks,
  socket,
}) {
  if (!process.env.M2_EVIDENCE_DIR) return;
  const step = (name) => checks?.step(`CUSTOMER_${prefix}_${name}`);
  const directory = process.env.M2_EVIDENCE_DIR;
  await mkdir(directory, { recursive: true });
  const records = [];
  async function until(expression) {
    for (let n = 0; n < 100; n++) {
      try {
        if (await evaluate(customerPredicate(expression))) return;
      } catch (error) {
        const message = String(error?.message ?? "");
        const contextChanged =
          /Cannot find context|Execution context was destroyed|Inspected target navigated/.test(
            message,
          );
        if (!contextChanged) {
          console.error(
            "Customer protocol diagnostic",
            JSON.stringify({
              typeError: error?.name === "TypeError",
              missingValue: /undefined/.test(message),
              invalidSelector: /selector/i.test(message),
              commandTimeout: /timeout/i.test(message),
            }),
          );
          throw error;
        }
      }
      await delay(100);
    }
    throw Error("CUSTOMER_BROWSER_CONDITION");
  }
  let expectedCustomerId;
  async function loseOneCommittedResponse(method, run) {
    let responses = 0;
    let detailReads = 0;
    let dropped = 0;
    let interceptionError;
    const intercept = (event) => {
      const message = JSON.parse(event.data);
      if (message.method !== "Fetch.requestPaused") return;
      const paused = message.params;
      void (async () => {
        if (paused.responseStatusCode === undefined) {
          await send("Fetch.continueRequest", { requestId: paused.requestId });
          return;
        }
        if (
          expectedCustomerId &&
          paused.request.method === "GET" &&
          new URL(paused.request.url).pathname ===
            `/api/customers/${expectedCustomerId}`
        ) {
          detailReads++;
        }
        if (paused.request.method === method) {
          responses++;
          if (dropped === 0) {
            assert.equal(
              paused.responseStatusCode,
              200,
              "A response may be lost only after the genuine server write succeeds",
            );
            dropped++;
            await send("Fetch.failRequest", {
              requestId: paused.requestId,
              errorReason: "Failed",
            });
            return;
          }
        }
        await send("Fetch.continueResponse", { requestId: paused.requestId });
      })().catch((error) => {
        interceptionError = error;
      });
    };
    socket.addEventListener("message", intercept);
    await send("Fetch.enable", {
      patterns: [
        { urlPattern: baseUrl + "/api/customers/*", requestStage: "Response" },
      ],
    });
    try {
      const counts = () => {
        if (interceptionError) throw interceptionError;
        return { responses, dropped, detailReads };
      };
      await run(counts);
      assert.equal(counts().dropped, 1);
    } finally {
      try {
        await send("Fetch.disable");
      } finally {
        socket.removeEventListener("message", intercept);
      }
    }
  }
  const button = (text) =>
    `Array.from(document.querySelectorAll('button')).find(b=>b.getClientRects().length&&(b.getAttribute('aria-label')??b.textContent.trim())===${JSON.stringify(text)})`;
  async function clickPointer(text) {
    const expr = button(text);
    await until(
      `${expr} && !${expr}.disabled && !${expr}.matches(':disabled') && ${expr}.getAttribute('aria-disabled') !== 'true'`,
    );
    const loc = await evaluate(`(()=>{
      const el = ${expr};
      if (!el) return null;
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    assert.ok(loc, `Pointer target for "${text}" must be rendered and visible`);
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: loc.x,
      y: loc.y,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: loc.x,
      y: loc.y,
      button: "left",
      clickCount: 1,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: loc.x,
      y: loc.y,
      button: "left",
      clickCount: 1,
    });
  }
  async function clickWithVerifiedFocus(text) {
    const expr = button(text);
    await until(
      `${expr} && !${expr}.disabled && !${expr}.matches(':disabled') && ${expr}.getAttribute('aria-disabled') !== 'true'`,
    );
    const check = await evaluate(`(()=>{
      const el = ${expr};
      if (!el) return { found: false, enabled: false, visible: false, active: false };
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const enabled = !el.disabled && !el.matches(':disabled') && el.getAttribute('aria-disabled') !== 'true';
      const visible = el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible';
      el.focus();
      return {
        found: true,
        enabled,
        visible,
        active: document.activeElement === el,
      };
    })()`);
    assert.equal(check.found, true, `Trigger "${text}" must exist`);
    assert.equal(check.enabled, true, `Trigger "${text}" must be enabled`);
    assert.equal(check.visible, true, `Trigger "${text}" must be visible`);
    assert.equal(
      check.active,
      true,
      `Trigger "${text}" must have activeElement focus`,
    );
    await evaluate(`${expr}.click();true`);
  }
  async function dismissToastFeedback() {
    // Assert/capture feedback before this explicit user dismissal, never retry a write.
    console.log(
      "Customer Create pointer diagnostic",
      JSON.stringify(
        await evaluate(
          `(()=>{const el=${button("Thêm khách hàng")};if(!el)return{present:false};const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {present:true,toastOcclusion:!!hit?.closest('[data-toast-viewport]')};})()`,
        ),
      ),
    );
    await dismissCustomerToasts({ evaluate });
  }

  async function click(text) {
    const expr = button(text);
    await until(
      `${expr} && !${expr}.disabled && !${expr}.matches(':disabled') && ${expr}.getAttribute('aria-disabled') !== 'true'`,
    );
    const loc = await evaluate(`(()=>{
      const el = ${expr};
      if (!el) return null;
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (loc) {
      await send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: loc.x,
        y: loc.y,
      });
      await send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: loc.x,
        y: loc.y,
        button: "left",
        clickCount: 1,
      });
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: loc.x,
        y: loc.y,
        button: "left",
        clickCount: 1,
      });
    } else {
      await evaluate(`(()=>{
        const el = ${expr};
        if (el) {
          el.focus();
          el.click();
        }
        return true;
      })()`);
    }
  }
  async function fill(name, text) {
    const fieldSteps = {
      name: "FILL_NAME",
      phone: "FILL_PHONE",
      addressText: "FILL_ADDRESS",
      note: "FILL_NOTE",
      q: "FILL_QUERY",
      label: "FILL_LABEL",
    };
    if (!fieldSteps[name]) throw Error("FILL_UNKNOWN_FIELD");
    step(fieldSteps[name]);
    const selector = customerFieldSelector(
      name,
      await evaluate('!!document.querySelector("dialog[open]")'),
    );
    await until(`(()=>{
      const el = document.querySelector(${JSON.stringify(selector)});
      return !!el && !el.matches(":disabled") && el.getAttribute('aria-disabled') !== 'true';
    })()`);
    await evaluate(`(()=>{
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el) el.focus();
      return true;
    })()`);
    const focusCheck = await evaluate(`(()=>{
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return { found: false, active: false, disabled: false };
      return {
        found: true,
        active: document.activeElement === el,
        disabled: el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true',
      };
    })()`);
    if (!focusCheck.found) {
      const err = new Error("FILL_SELECTOR_NOT_FOUND");
      err.code = "SELECTOR_NOT_FOUND";
      throw err;
    }
    if (focusCheck.disabled) {
      const err = new Error("FILL_DISABLED");
      err.code = "CONTROL_DISABLED";
      throw err;
    }
    if (!focusCheck.active) {
      await send("Page.bringToFront");
      await evaluate(
        `document.querySelector(${JSON.stringify(selector)})?.focus();true`,
      );
      const retryActive = await evaluate(
        `document.activeElement === document.querySelector(${JSON.stringify(selector)})`,
      );
      if (!retryActive) {
        const err = new Error("FILL_FOCUS_MISMATCH");
        err.code = "FOCUS_MISMATCH";
        throw err;
      }
    }
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "a",
      code: "KeyA",
      modifiers: 2,
      windowsVirtualKeyCode: 65,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "a",
      code: "KeyA",
      modifiers: 2,
      windowsVirtualKeyCode: 65,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Backspace",
      code: "Backspace",
      windowsVirtualKeyCode: 8,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Backspace",
      code: "Backspace",
      windowsVirtualKeyCode: 8,
    });
    if (text) await send("Input.insertText", { text });
    for (let i = 0; i < 50; i++) {
      const matchCheck = await evaluate(`(()=>{
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { found: false, matches: false };
        return {
          found: true,
          matches: el.value === ${JSON.stringify(text)},
        };
      })()`);
      if (!matchCheck.found) {
        const err = new Error("FILL_SELECTOR_NOT_FOUND");
        err.code = "SELECTOR_NOT_FOUND";
        throw err;
      }
      if (matchCheck.matches) break;
      if (i === 49) {
        console.error(
          "Customer native input diagnostic",
          JSON.stringify(
            await evaluate(
              `(()=>{const el=document.querySelector(${JSON.stringify(selector)});return{found:!!el,focused:document.activeElement===el,documentFocused:document.hasFocus(),disabled:el?.matches(':disabled')??false,actualLength:el?.value?.length??-1,expectedLength:${text.length}};})()`,
            ),
          ),
        );
        const err = new Error("FILL_VALUE_MISMATCH");
        err.code = "VALUE_MISMATCH";
        throw err;
      }
      await delay(50);
    }
  }
  async function ready(expectedAlert = false) {
    await until(
      `location.pathname.startsWith('/customers') && !!document.querySelector('h1#customer-heading') && !Array.from(document.querySelectorAll('[role=status]')).some(e=>e.textContent.startsWith('Đang tải')) && Boolean(document.querySelector('[data-customer-error], [role=alert]:not([data-toast-message])')) === ${expectedAlert} ${expectedAlert ? "&& Boolean(document.querySelector('[data-toast-viewport] [role=alert]'))" : ""}`,
    );
  }
  async function navigate(path) {
    await send("Page.navigate", { url: baseUrl + path });
    await until(`location.pathname === ${JSON.stringify(path)}`);
    await ready();
  }
  async function snapshot(phase) {
    step("CAPTURE_" + phase);
    await evaluate(
      `(()=>{const dialog=document.querySelector('dialog[open]');if(dialog){dialog.querySelector('[aria-label="Đóng biểu mẫu"]')?.focus();const body=dialog.querySelector('[data-customer-form-body]');if(body)body.scrollTop=${phase.endsWith("-address") ? "body.scrollHeight" : "0"};}return true;})()`,
    );
    await send("DOM.enable");
    await send("CSS.enable");
    const { root } = await send("DOM.getDocument");
    const { nodeId } = await send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "h1#customer-heading",
    });
    const { fonts } = await send("CSS.getPlatformFontsForNode", { nodeId });
    assert.ok(
      fonts.some(
        (f) =>
          f.isCustomFont && /inter/i.test(f.familyName) && f.glyphCount > 0,
      ),
    );
    for (const viewport of M1_VIEWPORTS) {
      await send("Emulation.setDeviceMetricsOverride", {
        ...viewport,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evaluate(
        "document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))).then(async()=>{await Promise.all(Array.from(document.querySelectorAll('aside')).flatMap(el=>el.getAnimations()).map(a=>a.finished.catch(()=>{})));return true;})",
      );
      await evaluate(
        `(()=>{const body=document.querySelector('dialog[open] [data-customer-form-body]');if(body)body.scrollTop=${phase.endsWith("-address") ? "body.scrollHeight" : "0"};return new Promise(r=>requestAnimationFrame(()=>r(true)));})()`,
      );
      assert.equal(
        await evaluate("document.documentElement.scrollWidth<=innerWidth"),
        true,
      );
      assert.equal(
        await evaluate(
          'Array.from(document.querySelectorAll("input[name=password],input[name=mfa-code]")).some(e=>e.value)',
        ),
        false,
      );
      const geometry = await verifyWorkspaceGeometry({
        evaluate,
        width: viewport.width,
      });
      await verifyMainFocusOutlineContract({ evaluate });
      const tableGeometry = (await evaluate(
        "Boolean(document.querySelector('main table'))",
      ))
        ? await verifyCustomerTableGeometry({ evaluate })
        : null;
      const detailGeometry = (await evaluate(
        "Boolean(document.querySelector('main dl'))",
      ))
        ? await verifyCustomerDetailGeometry({ evaluate })
        : null;
      const shot = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      const bytes = Buffer.from(shot.data, "base64");
      const file = `${prefix}-${phase}-${viewport.width}x${viewport.height}.png`;
      await writeFile(join(directory, file), bytes);
      records.push({
        file,
        ...viewport,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        fonts,
        geometry,
        tableGeometry,
        detailGeometry,
      });
    }
    await send("Emulation.clearDeviceMetricsOverride");
    await writeFile(
      join(directory, `${prefix}-captures.json`),
      JSON.stringify(
        {
          sourceCommit: process.env.GITHUB_SHA ?? null,
          captureOnly: true,
          records,
        },
        null,
        2,
      ) + "\n",
    );
  }
  try {
    step("LIST_NAVIGATE");
    await navigate("/customers");
    step("LIST_RENDER");
    await until(`${button("Thêm khách hàng")}`);
    assert.equal(
      await evaluate(
        "document.querySelectorAll('[data-toast-message]').length",
      ),
      0,
      "new owner workspace has no previous notifications",
    );
    await snapshot("empty-list");
    step("CREATE_DRAWER_OPEN");
    // Prove harmless create toggle is interactive before typing; never retry a mutation.
    for (let n = 0; n < 100; n++) {
      if (await evaluate('!!document.querySelector("dialog[open]")')) break;
      await evaluate(`${button("Thêm khách hàng")}.click();true`);
      await delay(100);
    }
    step("CREATE_FIELDS_READY");
    await until('!!document.querySelector("dialog[open] input[name=name]")');
    await until('!!document.querySelector("dialog[open] input[name=phone]")');
    await until(
      '!!document.querySelector("dialog[open] textarea[name=addressText]")',
    );
    await until(
      '!document.querySelector("dialog[open] fieldset[disabled]") && !document.querySelector("dialog[open] [role=status]")',
    );
    step("CREATE_FILL_FORM");
    await fill("name", `Khách kiểm thử ${prefix}`);
    await fill("phone", phone);
    await fill("addressText", "Địa chỉ tổng hợp dùng một lần");
    await snapshot("create");
    await snapshot("create-address");
    step("TOKEN_OVERRIDE_VERIFY");
    const tokenResult = await evaluate(`(()=>{
      const root = document.documentElement;
      const dialog = document.querySelector('dialog[open]');
      const input = dialog?.querySelector('input[name="name"]') ?? document.querySelector('input[name="q"]') ?? document.querySelector('input');
      const button = dialog?.querySelector('button[data-variant="emphasis"]') ?? dialog?.querySelector('button[type="submit"]') ?? document.querySelector('button[data-variant="emphasis"]') ?? document.querySelector('main button');
      const select = dialog?.querySelector('select[name="countryCode"]') ?? document.querySelector('select[name="filter-status"], select[aria-label="Số dòng mỗi trang"], select');
      if (!input || !button || !select) {
        return {
          success: false,
          reason: 'CONTROLS_NOT_FOUND',
          hasInput: !!input,
          hasButton: !!button,
          hasSelect: !!select
        };
      }
      const readStyles = (el) => {
        const cs = getComputedStyle(el);
        return { height: cs.height, radius: cs.borderRadius, fontSize: cs.fontSize };
      };
      const baseline = {
        input: readStyles(input),
        button: readStyles(button),
        select: readStyles(select),
      };
      const tokens = [
        { prop: '--control-size-default', styleKey: 'height', override: (parseFloat(baseline.input.height)+8)+'px' },
        { prop: '--control-radius', styleKey: 'radius', override: (parseFloat(baseline.input.radius)+2)+'px' },
        { prop: '--control-font-size', styleKey: 'fontSize', override: (parseFloat(baseline.input.fontSize)+2)+'px' }
      ];
      const saved = tokens.map(t => ({
        value: root.style.getPropertyValue(t.prop),
        priority: root.style.getPropertyPriority(t.prop)
      }));
      try {
        for (const t of tokens) {
          root.style.setProperty(t.prop, t.override);
        }
        const overridden = {
          input: readStyles(input),
          button: readStyles(button),
          select: readStyles(select),
        };
        for (const [name, cs] of Object.entries(overridden)) {
          for (const t of tokens) {
            if (cs[t.styleKey] !== t.override || cs[t.styleKey] === baseline[name][t.styleKey]) {
              return {
                success: false,
                reason: name + '_' + t.styleKey + '_not_overridden',
                actual: cs[t.styleKey],
                expected: t.override
              };
            }
          }
        }
        return { success: true, baseline, saved, tokens };
      } finally {
        tokens.forEach((t, i) => {
          if (saved[i].value) {
            root.style.setProperty(t.prop, saved[i].value, saved[i].priority);
          } else {
            root.style.removeProperty(t.prop);
          }
        });
      }
    })()`);
    if (!tokenResult.success) {
      console.error(
        "Token override diagnostic",
        JSON.stringify({
          reason: tokenResult.reason,
          actual: tokenResult.actual,
          expected: tokenResult.expected,
        }),
      );
    }
    assert.equal(
      tokenResult.success,
      true,
      `Token override failed: ${tokenResult.reason}`,
    );

    // Verify computed styles returned to baseline after restoring inline values
    const restoredResult = await evaluate(`(()=>{
      const root = document.documentElement;
      const dialog = document.querySelector('dialog[open]');
      const input = dialog?.querySelector('input[name="name"]') ?? document.querySelector('input[name="q"]') ?? document.querySelector('input');
      const button = dialog?.querySelector('button[data-variant="emphasis"]') ?? dialog?.querySelector('button[type="submit"]') ?? document.querySelector('button[data-variant="emphasis"]') ?? document.querySelector('main button');
      const select = dialog?.querySelector('select[name="countryCode"]') ?? document.querySelector('select[name="filter-status"], select[aria-label="Số dòng mỗi trang"], select');
      const readStyles = (el) => {
        const cs = getComputedStyle(el);
        return { height: cs.height, radius: cs.borderRadius, fontSize: cs.fontSize };
      };
      const current = {
        input: readStyles(input),
        button: readStyles(button),
        select: readStyles(select),
      };
      const base = ${JSON.stringify(tokenResult.baseline)};
      const tokens=${JSON.stringify(tokenResult.tokens)};const saved=${JSON.stringify(tokenResult.saved)};
      for(let i=0;i<tokens.length;i++){if(document.documentElement.style.getPropertyValue(tokens[i].prop)!==saved[i].value||document.documentElement.style.getPropertyPriority(tokens[i].prop)!==saved[i].priority)return{success:false,reason:'ROOT_TOKEN_NOT_RESTORED'};}
      for (const name of ['input', 'button', 'select']) {
        if (current[name].height !== base[name].height ||
            current[name].radius !== base[name].radius ||
            current[name].fontSize !== base[name].fontSize) {
          return { success: false, reason: name + '_not_restored_to_baseline' };
        }
      }
      return { success: true };
    })()`);
    if (!restoredResult.success) {
      console.error(
        "Token restore diagnostic",
        JSON.stringify({ reason: restoredResult.reason }),
      );
    }
    assert.equal(
      restoredResult.success,
      true,
      `Token restore failed: ${restoredResult.reason}`,
    );

    // Negative regression: verify check fails closed if a consumer is detached from token
    const negativeResult = await evaluate(`(()=>{
      const root = document.documentElement;
      const dialog = document.querySelector('dialog[open]');
      const select = (dialog && (dialog.querySelector('select[name="countryCode"]') || dialog.querySelector('select')))
        || document.querySelector('select[name="filter-status"]')
        || document.querySelector('select[aria-label="Số dòng mỗi trang"]')
        || document.querySelector('select');
      if (!select) return { success: false, reason: 'SELECT_NOT_FOUND' };
      const oldRootHeight = root.style.getPropertyValue('--control-size-default');
      const oldRootPriority = root.style.getPropertyPriority('--control-size-default');
      const oldInlineHeight = select.style.height;
      const oldInlinePriority = select.style.getPropertyPriority('height');
      const oldInlineMinHeight = select.style.minHeight;
      const oldInlineMinPriority = select.style.getPropertyPriority('min-height');
      try {
        select.style.setProperty('height', '70px', 'important');
        select.style.setProperty('min-height', '70px', 'important');
        root.style.setProperty('--control-size-default', '52px');
        const computedHeight = getComputedStyle(select).height;
        return {
          savedRoot:oldRootHeight,savedRootPriority:oldRootPriority,savedInline:oldInlineHeight,savedInlinePriority:oldInlinePriority,savedInlineMin:oldInlineMinHeight,savedInlineMinPriority:oldInlineMinPriority,
          detectedFailure: computedHeight !== '52px',
          actualHeight: computedHeight
        };
      } finally {
        if (oldInlineHeight) select.style.setProperty('height', oldInlineHeight, oldInlinePriority);
        else select.style.removeProperty('height');
        if (oldInlineMinHeight) select.style.setProperty('min-height', oldInlineMinHeight, oldInlineMinPriority);
        else select.style.removeProperty('min-height');
        if(oldRootHeight)root.style.setProperty('--control-size-default',oldRootHeight,oldRootPriority);else root.style.removeProperty('--control-size-default');
      }
    })()`);
    if (!negativeResult.detectedFailure) {
      console.error(
        "Negative override check diagnostic",
        JSON.stringify(negativeResult),
      );
    }
    assert.equal(
      negativeResult.detectedFailure,
      true,
      "Negative test must detect detached consumer",
    );
    await verifyCustomerControls({ send, evaluate, checks });
    assert.equal(
      await evaluate(
        `(()=>{const root=document.documentElement;const select=document.querySelector('select[aria-label="Số dòng mỗi trang"]');const saved=${JSON.stringify(negativeResult)};return root.style.getPropertyValue('--control-size-default')===saved.savedRoot&&root.style.getPropertyPriority('--control-size-default')===saved.savedRootPriority&&select.style.height===saved.savedInline&&select.style.getPropertyPriority('height')===saved.savedInlinePriority&&select.style.minHeight===saved.savedInlineMin&&select.style.getPropertyPriority('min-height')===saved.savedInlineMinPriority;})()`,
      ),
      true,
    );
    step("CREATE_SUBMIT");
    await click("Lưu khách hàng");
    await until('!document.querySelector("dialog[open]")');
    await ready();
    const list = await evaluate(
      'fetch("/api/customers").then(async r=>({status:r.status,data:await r.json()}))',
    );
    assert.equal(list.status, 200);
    const customer = list.data.customers.find(
      (c) => c.name === `Khách kiểm thử ${prefix}`,
    );
    assert.ok(customer);
    expectedCustomerId = customer.id;
    assert.ok(Number.isSafeInteger(list.data.stats.total));
    assert.equal(
      list.data.stats.total,
      list.data.stats.active + list.data.stats.inactive,
    );
    if (foreignId) {
      const missing = await evaluate(
        `fetch('/api/customers/'+${JSON.stringify(foreignId)}).then(r=>r.status)`,
      );
      assert.equal(missing, 404);
      assert.equal(
        list.data.customers.some((c) => c.id === foreignId),
        false,
      );
    }
    await verifyCustomerStatusContrast({ evaluate, checks });
    await snapshot("list");
    step("WIDE_MANUAL_SIDEBAR_COLLAPSE");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await until(
      "Boolean(document.querySelector('header button[aria-expanded=true]'))",
    );
    await evaluate(
      "document.querySelector('header button[aria-expanded=true]').click();true",
    );
    await until(
      "Math.round(document.querySelector('aside').getBoundingClientRect().width)===72",
    );
    await snapshot("list-manual-collapsed");
    step("DUPLICATE_PHONE_FORM");
    await dismissToastFeedback();
    await click("Thêm khách hàng");
    step("DUPLICATE_PHONE_FIELDS_READY");
    await until('!!document.querySelector("dialog[open] input[name=name]")');
    await fill("name", "Bản ghi trùng thử nghiệm");
    await fill("phone", phone);
    await fill("addressText", "Địa chỉ tổng hợp");
    step("DUPLICATE_PHONE_SUBMIT");
    await click("Lưu khách hàng");
    step("DUPLICATE_PHONE_FIELD_ERROR");
    await until(
      '!!document.querySelector("dialog[open] input[name=phone][aria-invalid=true]")',
    );
    assert.equal(
      await evaluate(
        'document.querySelector("dialog[open] input[name=name]").value==="Bản ghi trùng thử nghiệm"',
      ),
      true,
    );
    step("DUPLICATE_PHONE_NOTICE_SETTLED");
    await ready(true);
    await snapshot("validation-error");
    await click("Đóng biểu mẫu");
    await until('!document.querySelector("dialog[open]")');
    // Same-key URL normalization and Back/Forward must restart, not deadlock.
    step("CLEAR_QUERY");
    await fill("q", " "); // Visible whitespace draft exercises same-key clear before debounce.
    await click("Xóa từ khóa tìm kiếm");
    await ready();
    await evaluate(
      'history.pushState(null,"","/customers?pageSize=20&page=1");history.back();true',
    );
    await delay(100);
    await ready();
    await fill("q", "không có kết quả");
    await delay(350);
    await until('location.search.includes("q=")');
    await ready();
    await snapshot("filtered-empty");
    await click("Xóa từ khóa tìm kiếm");
    await ready();
    assert.equal(
      await evaluate('new URLSearchParams(location.search).has("q")'),
      false,
    );
    await verifyCustomerReadRaces({
      send,
      evaluate,
      socket,
      baseUrl,
      fill,
      click,
      ready,
      snapshot,
      customer,
      list: list.data,
      checks,
    });
    step("LIST_MUTATION_QUERY_SCOPE");
    await navigate("/customers");
    await ready();
    // The preceding read-race fixture may leave a retained read error in the
    // mounted list. Require a fresh successful read before opening the editor.
    await click("Làm mới");
    await ready();
    await until(
      `(()=>{const edit=document.querySelector('main tbody button[aria-label="Sửa ${customer.code}"]');const reload=document.querySelector('main button[aria-label="Làm mới"]');return !!edit&&!edit.matches(':disabled')&&reload?.getAttribute('aria-busy')==='false'&&!document.querySelector('main [data-customer-error]');})()`,
    );
    await evaluate(
      `document.querySelector('main tbody button[aria-label="Sửa ${customer.code}"]').click();true`,
    );
    await until(
      '!!document.querySelector("dialog[open] textarea[name=note]") && !document.querySelector("dialog[open] fieldset[disabled]")',
    );
    await fill("note", "Kiểm tra đối chiếu theo bộ lọc");
    await loseOneCommittedResponse("PATCH", async (counts) => {
      await click("Lưu khách hàng");
      await until(
        'Array.from(document.querySelectorAll("dialog[open] button")).some(b=>b.textContent.trim()==="Thử lưu lại"&&!b.disabled)',
      );
      assert.equal(counts().responses, 1);
      assert.equal(
        await evaluate(
          'Array.from(document.querySelectorAll("dialog[open] button")).find(b=>b.textContent.trim()==="Lưu khách hàng")?.disabled === true',
        ),
        true,
      );
      // Native showModal() makes the page inert. Close the Drawer before changing filters.
      await click("Đóng biểu mẫu");
      await until('!document.querySelector("dialog[open]")');
      await until('!!document.getElementById("customer-tab-INACTIVE")');
      await evaluate(
        'document.getElementById("customer-tab-INACTIVE").click();true',
      );
      await until(
        'new URLSearchParams(location.search).get("status")==="INACTIVE"',
      );
      await ready();
      assert.equal(
        await evaluate(
          'Array.from(document.querySelectorAll("main button")).some(b=>b.textContent.trim()==="Đã kiểm tra xong"&&!b.disabled)',
        ),
        false,
        "An unrelated filtered GET must not unlock the page-level write guard",
      );
      await evaluate(
        'document.getElementById("customer-tab-all").click();true',
      );
      await until('!new URLSearchParams(location.search).has("status")');
      await ready();
      await until(
        'Array.from(document.querySelectorAll("main button")).some(b=>b.textContent.trim()==="Đã kiểm tra xong"&&!b.disabled)',
      );
      assert.equal(counts().responses, 1, "No duplicated PATCH");
      await click("Đã kiểm tra xong");
      await until(
        '!Array.from(document.querySelectorAll("main button")).some(b=>b.textContent.trim()==="Đã kiểm tra xong")',
      );
      assert.equal(
        counts().detailReads,
        1,
        "Recovery reads the exact Customer ID",
      );
    });
    await ready();
    step("DETAIL_RENDER");
    await navigate("/customers/" + customer.id);
    await until(`${button("Thêm địa chỉ")}`);
    step("DETAIL_PROFILE_FIELDS");
    const profileLayout = await evaluate(
      `(()=>{const profile=document.querySelector('main dl');return {labels:Array.from(profile?.children??[]).map(row=>row.querySelector('dt')?.textContent.trim()),fullWidth:!!profile&&Array.from(profile.children).every(row=>Math.abs(row.getBoundingClientRect().width-profile.getBoundingClientRect().width)<1)};})()`,
    );
    assert.deepEqual(profileLayout.labels, [
      "Mã khách hàng",
      "Họ và tên",
      "Số điện thoại",
      "Email",
      "Trạng thái",
      "Ngày đăng ký hồ sơ",
      "Số địa chỉ nhận hàng",
    ]);
    step("DETAIL_PROFILE_GEOMETRY");
    assert.equal(profileLayout.fullWidth, true);
    await snapshot("detail");
    step("EDIT_PROFILE");
    await click("Chỉnh sửa thông tin");
    await until('!!document.querySelector("dialog[open] input[name=name]")');
    await fill("note", "Ghi chú thử nghiệm");
    await evaluate(
      '(()=>{const s=document.querySelector("dialog select[name=status]");s.value="INACTIVE";s.dispatchEvent(new Event("change",{bubbles:true}));return true;})()',
    );
    assert.equal(
      await evaluate(
        '(()=>{const i=document.querySelector("dialog input");const s=document.querySelector("dialog select");return getComputedStyle(i).height===getComputedStyle(s).height&&getComputedStyle(i).borderRadius===getComputedStyle(s).borderRadius;})()',
      ),
      true,
    );
    await snapshot("edit");
    step("PROFILE_LOST_RESPONSE_RECOVERY");
    await loseOneCommittedResponse("PATCH", async (counts) => {
      await click("Lưu khách hàng");
      await until(
        'Array.from(document.querySelectorAll("dialog[open] button")).some(b=>b.textContent.trim()==="Thử lưu lại"&&!b.disabled)',
      );
      assert.equal(counts().responses, 1);
      assert.equal(
        await evaluate(
          'Array.from(document.querySelectorAll("dialog[open] button")).find(b=>b.textContent.trim()==="Lưu khách hàng")?.disabled === true',
        ),
        true,
      );
      await click("Thử lưu lại");
      await until(
        'Array.from(document.querySelectorAll("dialog[open] button")).some(b=>b.textContent.trim()==="Lưu khách hàng"&&!b.disabled)',
      );
      assert.ok(
        counts().detailReads >= 2,
        "A lost profile PATCH is reconciled and its Customer ID is verified",
      );
      assert.equal(
        counts().responses,
        1,
        "No automatic retry of the committed PATCH",
      );
      await click("Lưu khách hàng");
      await until('!document.querySelector("dialog[open]")');
      await ready();
      assert.equal(counts().responses, 2, "Exactly one explicit user retry");
    });
    step("ADD_ADDRESS");
    await click("Thêm địa chỉ");
    await until(
      '!!document.querySelector("dialog[open] textarea[name=addressText]")',
    );
    await fill("addressText", "Địa chỉ thay thế tổng hợp");
    await snapshot("address");
    await click("Lưu địa chỉ");
    await until('!document.querySelector("dialog[open]")');
    await ready();
    let detail = await evaluate(
      `fetch('/api/customers/'+${JSON.stringify(customer.id)}).then(r=>r.json())`,
    );
    assert.equal(detail.customer.addresses.length, 2);
    const added = detail.customer.addresses.find((a) => !a.isDefault);
    assert.ok(added);
    await click("Sửa địa chỉ");
    await until('!!document.querySelector("dialog[open]")');
    await fill("label", "Nhãn thử nghiệm");
    await click("Lưu địa chỉ");
    await until('!document.querySelector("dialog[open]")');
    await ready();
    step("SET_DEFAULT");
    step("SET_DEFAULT_LOST_RESPONSE_RECOVERY");
    await loseOneCommittedResponse("PUT", async (counts) => {
      await click("Đặt làm mặc định");
      await until(
        'Array.from(document.querySelectorAll("main button")).some(b=>b.textContent.trim()==="Đã kiểm tra xong"&&!b.disabled)',
      );
      assert.equal(counts().responses, 1);
      assert.equal(
        await evaluate(
          'Array.from(document.querySelectorAll("main button")).find(b=>b.textContent.trim()==="Chỉnh sửa thông tin")?.disabled === true',
        ),
        true,
      );
      await click("Đã kiểm tra xong");
      await until(
        'Array.from(document.querySelectorAll("main button")).some(b=>b.textContent.trim()==="Chỉnh sửa thông tin"&&!b.disabled)',
      );
      assert.equal(
        counts().responses,
        1,
        "Acknowledging the GET must not repeat PUT",
      );
    });
    await ready();
    await until(
      `!document.querySelector('dialog[open]')&&document.querySelector('h1')`,
    );
    detail = await evaluate(
      `fetch('/api/customers/'+${JSON.stringify(customer.id)}).then(r=>r.json())`,
    );
    assert.equal(
      detail.customer.addresses.find((a) => a.id === added.id).isDefault,
      true,
    );
    // Delete current default through explicit replacement then DELETE.
    step("DELETE_DEFAULT");
    const currentDefault = added.id;
    step("DELETE_DEFAULT_READY");
    await until(
      `(()=>{const card=document.querySelector('article[aria-label="Địa chỉ mặc định"]');const action=card?.querySelector('button[aria-label="Xóa địa chỉ"]');return !!action&&!action.disabled&&card.textContent.includes('Địa chỉ thay thế tổng hợp');})()`,
    );
    step("DELETE_DEFAULT_OPEN");
    await evaluate(
      `document.querySelector('article[aria-label="Địa chỉ mặc định"] button[aria-label="Xóa địa chỉ"]').click();true`,
    );
    await until(
      '!!document.querySelector("dialog[open] select[name=replacement]")',
    );
    const replacement = detail.customer.addresses.find(
      (a) => a.id !== currentDefault,
    ).id;
    step("DELETE_DEFAULT_REPLACEMENT");
    await evaluate(
      `(()=>{const s=document.querySelector('select[name=replacement]');s.value=${JSON.stringify(replacement)};s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`,
    );
    await snapshot("delete");
    step("DELETE_FAULT_RECONCILIATION");
    let failPut = true,
      failDelete = true,
      deleteRequests = 0,
      interceptError;
    const intercept = (event) => {
      const message = JSON.parse(event.data);
      if (message.method !== "Fetch.requestPaused") return;
      const p = message.params;
      void (async () => {
        const method = p.request.method;
        let fail = false;
        if (method === "PUT" && failPut) {
          failPut = false;
          fail = true;
        } else if (method === "DELETE") {
          deleteRequests++;
          if (failDelete) {
            failDelete = false;
            fail = true;
          }
        }
        if (fail)
          await send("Fetch.fulfillRequest", {
            requestId: p.requestId,
            responseCode: 500,
            responseHeaders: [
              { name: "content-type", value: "application/json" },
            ],
            body: Buffer.from(
              JSON.stringify({
                code: "INTERNAL_ERROR",
                message: "Controlled failure",
                requestId: "m2-fault",
              }),
            ).toString("base64"),
          });
        else await send("Fetch.continueRequest", { requestId: p.requestId });
      })().catch((error) => {
        interceptError = error;
      });
    };
    socket.addEventListener("message", intercept);
    await send("Fetch.enable", {
      patterns: [
        { urlPattern: baseUrl + "/api/customers/*", requestStage: "Request" },
      ],
    });
    try {
      await click("Xác nhận xóa");
      await until('!!document.querySelector("dialog[open] [role=alert]")');
      await ready(true);
      assert.equal(deleteRequests, 0, "Failed PUT must not send DELETE");
      await until(
        'Array.from(document.querySelectorAll("dialog[open] button")).some(b=>b.textContent.trim()==="Bỏ qua và đóng"&&!b.disabled)',
      );
      await click("Bỏ qua và đóng");
      await until('!document.querySelector("dialog[open]")');
      await until(
        'Array.from(document.querySelectorAll("button[aria-label]")).some(b=>b.getAttribute("aria-label")==="Xóa địa chỉ"&&!b.disabled)',
      );
      await evaluate(
        `document.querySelector('article[aria-label="Địa chỉ mặc định"] button[aria-label="Xóa địa chỉ"]').click();true`,
      );
      await until(
        '!!document.querySelector("dialog[open] select[name=replacement]")',
      );
      await evaluate(
        `(()=>{const s=document.querySelector('select[name=replacement]');s.value=${JSON.stringify(replacement)};s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`,
      );
      await click("Xác nhận xóa");
      await until(
        'document.querySelector("dialog[open]")?.textContent.includes("Đã chuyển mặc định")',
      );
      await ready(true);
      const partial = await evaluate(
        `fetch('/api/customers/'+${JSON.stringify(customer.id)}).then(r=>r.json())`,
      );
      assert.equal(partial.customer.addresses.length, 2);
      assert.equal(
        partial.customer.addresses.find((a) => a.id === replacement).isDefault,
        true,
      );
      step("DELETE_PARTIAL_REQUIRES_ACKNOWLEDGEMENT");
      assert.equal(
        await evaluate(
          'Array.from(document.querySelectorAll("dialog[open] button")).find(b=>b.textContent.trim()==="Xác nhận xóa")?.disabled === true',
        ),
        true,
      );
      await until(
        'Array.from(document.querySelectorAll("dialog[open] button")).some(b=>b.textContent.trim()==="Bỏ qua và đóng"&&!b.disabled)',
      );
      assert.equal(deleteRequests, 1, "GET cannot repeat the failed DELETE");
      await click("Bỏ qua và đóng");
      await until('!document.querySelector("dialog[open]")');
      await until(
        `!document.querySelector('article[data-address-id="${currentDefault}"] button[aria-label="Xóa địa chỉ"]').disabled`,
      );
      await evaluate(
        `document.querySelector('article[data-address-id="${currentDefault}"] button[aria-label="Xóa địa chỉ"]').click();true`,
      );
      await until('!!document.querySelector("dialog[open]")');
      await click("Xác nhận xóa");
      await until('!document.querySelector("dialog[open]")');
      assert.equal(deleteRequests, 2);
      assert.equal(interceptError, undefined);
    } finally {
      try {
        await send("Fetch.disable");
      } finally {
        socket.removeEventListener("message", intercept);
      }
    }
    step("DELETE_DIALOG_CLOSED");
    await until('!document.querySelector("dialog[open]")');
    await ready();

    step("DELETE_SERVER_CONFIRMED");
    detail = await evaluate(
      `fetch('/api/customers/'+${JSON.stringify(customer.id)}).then(r=>r.json())`,
    );
    assert.equal(detail.customer.addresses.length, 1);
    assert.equal(detail.customer.addresses[0].id, replacement);
    assert.equal(detail.customer.addresses[0].isDefault, true);

    step("DELETE_UI_RECONCILED");
    // Await UI settlement: Customer route, idle status, single address card with replacement ID and default flag, disabled delete button
    await until(`(()=>{
      if (location.pathname !== '/customers/' + ${JSON.stringify(customer.id)}) return false;
      if (document.querySelector('dialog[open]')) return false;
      const statuses = Array.from(document.querySelectorAll('[role=status]'));
      if (statuses.some(e => e.textContent.includes('Đang tải') || e.textContent.includes('Chưa đối chiếu'))) return false;
      const cards = Array.from(document.querySelectorAll('main article[data-address-id]'));
      if (cards.length !== 1) return false;
      const card = cards[0];
      if (card.getAttribute('data-address-id') !== ${JSON.stringify(replacement)}) return false;
      if (card.getAttribute('aria-label') !== 'Địa chỉ mặc định') return false;
      const delButtons = Array.from(document.querySelectorAll('button[aria-label="Xóa địa chỉ"]'));
      if (delButtons.length !== 1) return false;
      return delButtons[0].disabled === true;
    })()`);

    step("DELETE_LAST_ACTION_DISABLED");
    const uiStatus = await evaluate(`(()=>{
      const cards = Array.from(document.querySelectorAll('main article[data-address-id]'));
      const delButtons = Array.from(document.querySelectorAll('button[aria-label="Xóa địa chỉ"]'));
      const card = cards[0];
      return {
        cardCount: cards.length,
        remainingId: card?.getAttribute('data-address-id') ?? null,
        isDefault: card?.getAttribute('aria-label') === 'Địa chỉ mặc định',
        buttonCount: delButtons.length,
        buttonDisabled: delButtons[0]?.disabled === true,
      };
    })()`);
    assert.equal(uiStatus.cardCount, 1);
    assert.equal(uiStatus.remainingId, replacement);
    assert.equal(uiStatus.isDefault, true);
    assert.equal(uiStatus.buttonCount, 1);
    assert.equal(uiStatus.buttonDisabled, true);

    step("DELETE_COMMITTED_RESPONSE_LOSS");
    await click("Thêm địa chỉ");
    await until(
      '!!document.querySelector("dialog[open] textarea[name=addressText]")',
    );
    await fill("addressText", "Địa chỉ kiểm thử mất phản hồi DELETE");
    await click("Lưu địa chỉ");
    await until('!document.querySelector("dialog[open]")');
    await ready();
    const deletionFixture = await evaluate(
      `fetch('/api/customers/'+${JSON.stringify(customer.id)}).then(r=>r.json())`,
    );
    const toDelete = deletionFixture.customer.addresses.find(
      (a) => !a.isDefault,
    );
    assert.ok(
      toDelete,
      "A nondefault address is available for a committed DELETE",
    );
    await evaluate(
      `document.querySelector('article[data-address-id="${toDelete.id}"] button[aria-label="Xóa địa chỉ"]').click();true`,
    );
    await until('!!document.querySelector("dialog[open]")');
    await loseOneCommittedResponse("DELETE", async (counts) => {
      await click("Xác nhận xóa");
      await until(
        'Array.from(document.querySelectorAll("main button")).some(b=>b.textContent.trim()==="Đã kiểm tra xong"&&!b.disabled)',
      );
      assert.equal(counts().responses, 1, "Only one committed DELETE was sent");
      const deleted = await evaluate(
        `fetch('/api/customers/'+${JSON.stringify(customer.id)}).then(r=>r.json())`,
      );
      assert.equal(
        deleted.customer.addresses.some((a) => a.id === toDelete.id),
        false,
        "Server committed the DELETE before its response was lost",
      );
      assert.equal(
        await evaluate(
          'Array.from(document.querySelectorAll("main button")).find(b=>b.textContent.trim()==="Thêm địa chỉ")?.disabled === true',
        ),
        true,
        "Parent mutations stay blocked pending user acknowledgement",
      );
      await click("Đã kiểm tra xong");
      await until(
        'Array.from(document.querySelectorAll("main button")).some(b=>b.textContent.trim()==="Thêm địa chỉ"&&!b.disabled)',
      );
      assert.equal(
        counts().responses,
        1,
        "GET and acknowledgement never repeat DELETE",
      );
    });
    await ready();

    step("FOCUS_ADD_ADDRESS_OPENED");
    // Ensure initial focus is on another control (heading) before user clicks trigger
    await evaluate(`(()=>{
      const h1 = document.querySelector('h1#customer-heading');
      if (h1) h1.focus();
      return document.activeElement === h1;
    })()`);
    // Click trigger with real CDP pointer interaction
    await clickPointer("Thêm địa chỉ");
    await until('!!document.querySelector("dialog[open]")');
    // Ensure focus moved inside modal dialog
    await until(
      'document.querySelector("dialog[open]").contains(document.activeElement)',
    );
    assert.equal(
      await evaluate(
        'document.querySelector("dialog[open]").contains(document.activeElement)',
      ),
      true,
    );

    step("FOCUS_FORWARD_TAB_CONTAINMENT");
    for (let i = 0; i < 12; i++) {
      await send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "Tab",
        code: "Tab",
        windowsVirtualKeyCode: 9,
      });
      await send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "Tab",
        code: "Tab",
        windowsVirtualKeyCode: 9,
      });
      assert.equal(
        await evaluate(
          'document.querySelector("dialog[open]").contains(document.activeElement)',
        ),
        true,
      );
    }

    step("FOCUS_REVERSE_TAB_CONTAINMENT");
    for (let i = 0; i < 12; i++) {
      await send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "Tab",
        code: "Tab",
        windowsVirtualKeyCode: 9,
        modifiers: 8,
      });
      await send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "Tab",
        code: "Tab",
        windowsVirtualKeyCode: 9,
        modifiers: 8,
      });
      assert.equal(
        await evaluate(
          'document.querySelector("dialog[open]").contains(document.activeElement)',
        ),
        true,
      );
    }

    step("FOCUS_ESCAPE_CLOSED");
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await until('!document.querySelector("dialog[open]")');

    step("FOCUS_TRIGGER_RESTORED");
    await until(`(()=>{
      const trigger = ${button("Thêm địa chỉ")};
      const active = document.activeElement;
      return active === trigger && (active.getAttribute('aria-label') ?? active.textContent.trim()) === "Thêm địa chỉ";
    })()`);
    assert.equal(
      await evaluate(`document.activeElement === ${button("Thêm địa chỉ")}`),
      true,
    );

    step("FOCUS_FALLBACK_REMOVED_TRIGGER");
    // Open dialog using verified focus + click helper
    await clickWithVerifiedFocus("Thêm địa chỉ");
    await until('!!document.querySelector("dialog[open]")');
    // Simulate removed trigger by disconnecting the button while dialog is open
    await evaluate(`(()=>{
      const btn = ${button("Thêm địa chỉ")};
      if (btn) btn.remove();
      return true;
    })()`);
    // Close with Escape
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await until('!document.querySelector("dialog[open]")');
    // Focus must fall back to live heading
    await until(
      'document.activeElement === document.querySelector("h1#customer-heading")',
    );
    assert.equal(
      await evaluate(
        'document.activeElement === document.querySelector("h1#customer-heading")',
      ),
      true,
    );
    step("SAVE_OPEN_LONG_CONTENT");
    await navigate("/customers");
    await dismissToastFeedback();
    await click("Thêm khách hàng");
    await until('!!document.querySelector("dialog[open] input[name=name]")');
    const longName = "Tên khách hàng dài ".repeat(20).slice(0, 199) + "Z";
    const longAddress =
      "Địa chỉ giao nhận tổng hợp dài ".repeat(100).slice(0, 1999) + "Z";
    await fill("name", longName);
    await fill("phone", "0912345679");
    await fill("addressText", longAddress);
    await click("Lưu và mở hồ sơ");
    await until('location.pathname.startsWith("/customers/")');
    await ready();
    const stressId = await evaluate('location.pathname.split("/").at(-1)');
    const stress = await evaluate(
      `fetch('/api/customers/'+${JSON.stringify(stressId)}).then(r=>r.json())`,
    );
    assert.equal(stress.customer.name.length, 200);
    assert.equal(stress.customer.addresses[0].addressText.length, 2000);
    await snapshot("detail-long");
    step("CUSTOMER_MOBILE_NAVIGATION");
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await until(
      `document.querySelector('header button[aria-expanded]')?.getAttribute('aria-label')==='Mở menu di động'`,
    );
    const previousScroll = await evaluate("document.body.style.overflow");
    await evaluate(
      `document.querySelector('header button[aria-expanded]').click();true`,
    );
    await until(
      `!!document.querySelector('dialog[open] a[href="/customers"]')`,
    );
    await evaluate(
      `document.querySelector('dialog[open] a[href="/customers"]').click();true`,
    );
    await until(
      'location.pathname==="/customers"&&!document.querySelector("dialog[open]")',
    );
    await ready();
    assert.equal(
      await evaluate("document.body.style.overflow"),
      previousScroll,
    );
    await evaluate(
      `document.querySelector('header button[aria-expanded]').click();true`,
    );
    await until('!!document.querySelector("dialog[open]")');
    assert.equal(
      await evaluate(
        `document.querySelector('dialog[open] a[href="/customers"]').getAttribute('aria-current')`,
      ),
      "page",
    );
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await until('!document.querySelector("dialog[open]")');
    await send("Emulation.clearDeviceMetricsOverride");
    step("CUSTOMER_SEGMENTED_STATUS");
    await evaluate(
      `document.querySelector('#customer-tab-ACTIVE').focus();document.querySelector('#customer-tab-ACTIVE').click();true`,
    );
    await ready();
    assert.equal(
      await evaluate('new URLSearchParams(location.search).get("status")'),
      "ACTIVE",
    );
    const filtered = await evaluate(
      'fetch("/api/customers?status=ACTIVE").then(r=>r.json())',
    );
    assert.equal(
      await evaluate('document.querySelectorAll("tbody tr").length'),
      filtered.customers.length,
    );
    assert.equal(
      await evaluate(
        `document.querySelector('#customer-tab-all').textContent.trim().endsWith(${JSON.stringify(String(filtered.stats.total))})`,
      ),
      true,
    );
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "End",
      code: "End",
      windowsVirtualKeyCode: 35,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "End",
      code: "End",
      windowsVirtualKeyCode: 35,
    });
    await ready();
    assert.equal(
      await evaluate('new URLSearchParams(location.search).get("status")'),
      "INACTIVE",
    );
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Home",
      code: "Home",
      windowsVirtualKeyCode: 36,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Home",
      code: "Home",
      windowsVirtualKeyCode: 36,
    });
    await ready();
    assert.equal(
      await evaluate('new URLSearchParams(location.search).has("status")'),
      false,
    );
    await verifyCustomerPower({
      send,
      evaluate,
      socket,
      baseUrl,
      ready,
      snapshot,
      click,
      checks,
    });
    step("TABLE_KEYBOARD_FOCUS_RING");
    await evaluate(
      "document.querySelector('main [role=region][tabindex]').focus();true",
    );
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "ArrowRight",
      code: "ArrowRight",
      windowsVirtualKeyCode: 39,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "ArrowRight",
      code: "ArrowRight",
      windowsVirtualKeyCode: 39,
    });
    const focusRing = await evaluate(
      "(()=>{const el=document.querySelector('main [role=region][tabindex]'),s=getComputedStyle(el);return {active:document.activeElement===el,visible:el.matches(':focus-visible'),width:s.outlineWidth,style:s.outlineStyle};})()",
    );
    assert.deepEqual(focusRing, {
      active: true,
      visible: true,
      width: "2px",
      style: "solid",
    });
    await snapshot("table-keyboard-focus");
    await snapshot("populated-final");
    await writeFile(
      join(directory, `${prefix}.json`),
      JSON.stringify(
        { sourceCommit: process.env.GITHUB_SHA ?? null, records },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Customer ${prefix} real API/UI CRUD, default/delete, history, keyboard and ten viewport evidence PASS`,
    );
    return customer.id;
  } finally {
    await send("Emulation.clearDeviceMetricsOverride").catch(() => {});
  }
}
