// Extends the existing authenticated CDP session. Only owned disposable fixtures.
import { verifyCustomerReadRaces } from "./customer-read-races.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { M1_VIEWPORTS } from "./m1-visual-checks.mjs";
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
        if (await evaluate(expression)) return;
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
    await evaluate(
      `document.querySelector('dialog[open] [name=${JSON.stringify(name)}], [name=${JSON.stringify(name)}]').focus();true`,
    );
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
    assert.equal(
      await evaluate(
        `document.querySelector('dialog[open] [name=${JSON.stringify(name)}], [name=${JSON.stringify(name)}]').value===${JSON.stringify(text)}`,
      ),
      true,
    );
  }
  async function ready() {
    await until(
      `document.querySelector('h1')?.textContent.includes('khách hàng') && !Array.from(document.querySelectorAll('[role=status]')).some(e=>e.textContent.startsWith('Đang tải'))`,
    );
  }
  async function navigate(path) {
    await send("Page.navigate", { url: baseUrl + path });
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
  }
  try {
    step("LIST_RENDER");
    await navigate("/customers");
    await until(`${button("Thêm khách hàng")}`);
    // Prove harmless create toggle is interactive before typing; never retry a mutation.
    for (let n = 0; n < 100; n++) {
      if (await evaluate('!!document.querySelector("dialog[open]")')) break;
      await evaluate(`${button("Thêm khách hàng")}.click();true`);
      await delay(100);
    }
    await until('!!document.querySelector("dialog[open] input[name=name]")');
    await fill("name", `Khách kiểm thử ${prefix}`);
    await fill("phone", phone);
    await fill("addressText", "Địa chỉ tổng hợp dùng một lần");
    await snapshot("create");
    // Real token override reaches TextInput/Select/Button, restored before submit.
    assert.equal(
      await evaluate(
        `(()=>{const root=document.documentElement;const keys=['--control-height','--control-radius'];const old=keys.map(k=>root.style.getPropertyValue(k));try{root.style.setProperty(keys[0],'52px');root.style.setProperty(keys[1],'6px');const e=document.querySelector('dialog input');const b=document.querySelector('dialog button');return getComputedStyle(e).height===getComputedStyle(b).height&&getComputedStyle(e).borderRadius===getComputedStyle(b).borderRadius;}finally{keys.forEach((k,i)=>old[i]?root.style.setProperty(k,old[i]):root.style.removeProperty(k));}})()`,
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
      '!!document.querySelector(\"dialog[open] input[name=phone][aria-invalid=true]\")',
    );
    assert.equal(
      await evaluate(
        'document.querySelector(\"dialog[open] input[name=name]\").value===\"Bản ghi trùng thử nghiệm\"',
      ),
      true,
    );
    await ready();
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
      await ready();
      assert.equal(deleteRequests, 0, "Failed PUT must not send DELETE");
      await click("Xác nhận xóa");
      await until(
        'document.querySelector("dialog[open]")?.textContent.includes("Đã chuyển mặc định")',
      );
      await ready();
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
