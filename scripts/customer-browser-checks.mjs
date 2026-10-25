// Extends the existing authenticated CDP session. Only owned disposable fixtures.
import { verifyCustomerReadRaces } from "./customer-read-races.mjs";
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
  const button = (text) =>
    `Array.from(document.querySelectorAll('button')).find(b=>b.getClientRects().length&&b.textContent.trim()===${JSON.stringify(text)})`;
  async function click(text) {
    await until(`${button(text)}&&!${button(text)}.disabled`);
    await evaluate(`${button(text)}.click();true`);
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
      `location.pathname.startsWith('/customers') && !!document.querySelector('h1') && document.querySelector('h1').textContent.toLowerCase().includes('khách hàng') && !Array.from(document.querySelectorAll('[role=status]')).some(e=>e.textContent.startsWith('Đang tải')) && Boolean(document.querySelector('[role=alert]')) === ${expectedAlert}`,
    );
  }
  async function navigate(path) {
    await send("Page.navigate", { url: baseUrl + path });
    await until(`location.pathname === ${JSON.stringify(path)}`);
    await ready();
  }
  async function snapshot(phase) {
    step("CAPTURE_" + phase);
    for (const viewport of M1_VIEWPORTS) {
      await send("Emulation.setDeviceMetricsOverride", {
        ...viewport,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evaluate(
        "document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))))",
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
    step("TOKEN_OVERRIDE_VERIFY");
    // Real token override reaches TextInput/Select/Button, restored before submit.
    const tokenResult = await evaluate(`(()=>{
      const root = document.documentElement;
      const input = document.querySelector('dialog[open] input[name=name], input[name=q]');
      const button = document.querySelector('dialog[open] button, button');
      const select = document.querySelector('select[name=filter-status], select[aria-label="Số dòng mỗi trang"], select');
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
        { prop: '--control-height', styleKey: 'height', override: '52px' },
        { prop: '--control-radius', styleKey: 'radius', override: '6px' },
        { prop: '--control-font-size', styleKey: 'fontSize', override: '16px' }
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
            if (cs[t.styleKey] !== t.override) {
              return {
                success: false,
                reason: name + '_' + t.styleKey + '_not_overridden',
                actual: cs[t.styleKey],
                expected: t.override
              };
            }
          }
        }
        return { success: true, baseline };
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
      const input = document.querySelector('dialog[open] input[name=name], input[name=q]');
      const button = document.querySelector('dialog[open] button, button');
      const select = document.querySelector('select[name=filter-status], select[aria-label="Số dòng mỗi trang"], select');
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
      const select = document.querySelector('select[name=filter-status], select[aria-label="Số dòng mỗi trang"], select');
      if (!select) return { success: false, reason: 'SELECT_NOT_FOUND' };
      const oldInlineHeight = select.style.height;
      const oldInlinePriority = select.style.getPropertyPriority('height');
      const oldInlineMinHeight = select.style.minHeight;
      const oldInlineMinPriority = select.style.getPropertyPriority('min-height');
      try {
        select.style.setProperty('height', '70px', 'important');
        select.style.setProperty('min-height', '70px', 'important');
        root.style.setProperty('--control-height', '52px');
        const computedHeight = getComputedStyle(select).height;
        return {
          detectedFailure: computedHeight !== '52px',
          actualHeight: computedHeight
        };
      } finally {
        if (oldInlineHeight) select.style.setProperty('height', oldInlineHeight, oldInlinePriority);
        else select.style.removeProperty('height');
        if (oldInlineMinHeight) select.style.setProperty('min-height', oldInlineMinHeight, oldInlineMinPriority);
        else select.style.removeProperty('min-height');
        root.style.removeProperty('--control-height');
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
    await snapshot("list");
    step("DUPLICATE_PHONE_FORM");
    await click("Thêm khách hàng");
    await until('!!document.querySelector("dialog[open] input[name=name]")');
    await fill("name", "Bản ghi trùng thử nghiệm");
    await fill("phone", phone);
    await fill("addressText", "Địa chỉ tổng hợp");
    await click("Lưu khách hàng");
    await until(
      '!!document.querySelector("dialog[open] input[name=phone][aria-invalid=true]")',
    );
    assert.equal(
      await evaluate(
        'document.querySelector("dialog[open] input[name=name]").value==="Bản ghi trùng thử nghiệm"',
      ),
      true,
    );
    await ready(true);
    await click("Đóng");
    await until('!document.querySelector("dialog[open]")');
    // Same-key URL normalization and Back/Forward must restart, not deadlock.
    step("CLEAR_QUERY");
    await click("Xóa tìm kiếm");
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
    await click("Xóa tìm kiếm");
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
      customer,
      list: list.data,
      checks,
    });
    step("DETAIL_RENDER");
    await navigate("/customers/" + customer.id);
    await until(`${button("Thêm địa chỉ")}`);
    await snapshot("detail");
    step("EDIT_PROFILE");
    await click("Sửa khách hàng");
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
    await click("Lưu khách hàng");
    await until('!document.querySelector("dialog[open]")');
    await ready();
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
    await click("Đặt mặc định");
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
    await evaluate(
      `Array.from(document.querySelectorAll('article')).find(a=>a.querySelector('h3')?.textContent.includes('Mặc định')).querySelector('button:last-child').click();true`,
    );
    await until(
      '!!document.querySelector("dialog[open] select[name=replacement]")',
    );
    const replacement = detail.customer.addresses.find(
      (a) => a.id !== currentDefault,
    ).id;
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
    step("DELETE_SUBMIT");
    await until('!document.querySelector("dialog[open]")');
    await ready();
    detail = await evaluate(
      `fetch('/api/customers/'+${JSON.stringify(customer.id)}).then(r=>r.json())`,
    );
    assert.equal(detail.customer.addresses.length, 1);
    assert.equal(detail.customer.addresses[0].id, replacement);
    assert.equal(detail.customer.addresses[0].isDefault, true);
    assert.equal(
      await evaluate(
        `Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.trim()==='Xóa địa chỉ').every(b=>b.disabled)`,
      ),
      true,
    );
    // Keyboard forward/reverse and Escape restore live trigger on actual shared modal.
    await click("Thêm địa chỉ");
    await until('!!document.querySelector("dialog[open]")');
    for (const shift of [false, true])
      for (let i = 0; i < 12; i++) {
        await send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "Tab",
          code: "Tab",
          windowsVirtualKeyCode: 9,
          modifiers: shift ? 8 : 0,
        });
        await send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "Tab",
          code: "Tab",
          windowsVirtualKeyCode: 9,
          modifiers: shift ? 8 : 0,
        });
        assert.equal(
          await evaluate(
            'document.querySelector("dialog[open]").contains(document.activeElement)',
          ),
          true,
        );
      }
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
    assert.equal(
      await evaluate("document.activeElement.textContent.trim()"),
      "Thêm địa chỉ",
    );
    await writeFile(
      join(directory, `${prefix}.json`),
      JSON.stringify(
        { sourceCommit: process.env.GITHUB_SHA ?? null, records },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Customer ${prefix} real API/UI CRUD, default/delete, history, keyboard and six viewport evidence PASS`,
    );
    return customer.id;
  } finally {
    await send("Emulation.clearDeviceMetricsOverride").catch(() => {});
  }
}
